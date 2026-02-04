import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import * as XLSX from 'xlsx';

// Disable body parser to handle file upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
  maxDuration: 300, // 5 minutes timeout (Vercel Hobby plan limit)
};

interface ImportRow {
  'Category': string;
  'Brand': string;
  'Model': string;
  'Serial Number': string;
  'Under Warranty': string;
  'Warranty Date'?: string;
}

interface ImportResult {
  success: number;
  failed: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; error: string; data?: any }>;
}

async function getOrCreateRecord(
  table: string,
  nameField: string,
  value: any,
  additionalFields?: Record<string, any>
): Promise<string | null> {
  // Convert to string first (in case Excel parsed it as a number)
  const stringValue = value ? value.toString().trim() : '';

  if (!stringValue) return null;

  if (!supabaseAdmin) {
    throw new Error('Database connection not available');
  }

  const trimmedValue = stringValue;

  // Try to find existing record (use limit(1) in case of duplicates)
  const { data: existing, error: findError } = await supabaseAdmin
    .from(table)
    .select('id')
    .ilike(nameField, trimmedValue)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding ${table}:`, findError);
    throw new Error(`Failed to find ${table}: ${findError.message}`);
  }

  if (existing) {
    return existing.id;
  }

  // Create new record if not found
  const insertData = {
    [nameField]: trimmedValue,
    ...additionalFields,
  };

  const { data: created, error: createError } = await supabaseAdmin
    .from(table)
    .insert(insertData)
    .select('id')
    .single();

  if (createError) {
    console.error(`Error creating ${table}:`, createError);
    throw new Error(`Could not create ${table} - Please check that the value is valid and not a duplicate`);
  }

  return created.id;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const userId = req.user.id;
    const { fileData, fileName } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Parse base64 file data
    const buffer = Buffer.from(fileData, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data: ImportRow[] = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({ error: 'No data found in file' });
    }

    // Filter out completely empty rows and track original row numbers
    const nonEmptyData = data
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) =>
        row['Category'] || row['Brand'] || row['Model'] || row['Serial Number']
      );

    // Check row count limits
    const MAX_ROWS = 1500;
    const WARNING_THRESHOLD = 1000;

    if (nonEmptyData.length > MAX_ROWS) {
      return res.status(400).json({
        error: `File contains ${nonEmptyData.length} rows. Maximum allowed is ${MAX_ROWS} rows per import.`,
        details: `Please split your file into smaller batches of ${MAX_ROWS} rows or less to avoid timeout issues. Process times are limited to 5 minutes on this plan.`,
        rowCount: nonEmptyData.length,
        maxAllowed: MAX_ROWS,
      });
    }

    if (nonEmptyData.length > WARNING_THRESHOLD) {
      console.warn(`Large import detected: ${nonEmptyData.length} rows. This may take several minutes to complete.`);
    }

    // Create import log entry
    const { data: importLog, error: importLogError } = await supabaseAdmin
      .from('import_logs')
      .insert({
        import_type: 'assets',
        file_name: fileName || 'unknown.xlsx',
        imported_by: userId,
        total_rows: nonEmptyData.length, // Count only non-empty rows
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (importLogError || !importLog) {
      console.error('Error creating import log:', importLogError);
      // Continue with import even if logging fails
    }

    const result: ImportResult = {
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    // PHASE 1: VALIDATE ALL ROWS FIRST (without writing to database)
    console.log('Phase 1: Validating all rows...');
    const validationErrors: Array<{ row: number; error: string; data?: any }> = [];

    // Track serial numbers to detect duplicates and auto-generate for blanks
    const serialNumberMap = new Map<string, number>(); // serial -> first row number
    let autoGeneratedCount = 0;

    for (let i = 0; i < nonEmptyData.length; i++) {
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number (header is row 1)

      try {
        // Validate required fields
        if (!row['Category']) {
          throw new Error('Missing Category - Please provide a category for this asset (e.g., Laptop, Monitor, Printer)');
        }
        if (!row['Brand']) {
          throw new Error('Missing Brand - Please provide a brand name for this asset (e.g., Dell, HP, Lenovo)');
        }
        if (!row['Model']) {
          throw new Error('Missing Model - Please provide a model number or name for this asset');
        }
        if (!row['Under Warranty']) {
          throw new Error('Missing Under Warranty - Please enter "Yes" or "No" to indicate warranty status');
        }

        // Handle Serial Number - auto-generate if blank or "NO-SERIAL"
        let serialNumber = row['Serial Number'] ? row['Serial Number'].toString().trim() : '';

        // Check if serial number is blank or variations of "NO SERIAL"
        const isBlankOrNoSerial = !serialNumber ||
          serialNumber.toUpperCase() === 'NO SERIAL' ||
          serialNumber.toUpperCase() === 'NO-SERIAL' ||
          serialNumber.toUpperCase() === 'NOSERIAL' ||
          serialNumber.toUpperCase() === 'N/A' ||
          serialNumber.toUpperCase() === 'NA';

        if (isBlankOrNoSerial) {
          // Auto-generate unique serial number
          autoGeneratedCount++;
          serialNumber = `NO-SERIAL-${String(autoGeneratedCount).padStart(3, '0')}`;
          row['Serial Number'] = serialNumber; // Update the row data
          console.log(`Row ${rowNumber}: Auto-generated serial number: ${serialNumber}`);
        } else {
          // Check for duplicates within the import file
          const upperSerial = serialNumber.toUpperCase();
          if (serialNumberMap.has(upperSerial)) {
            const firstRow = serialNumberMap.get(upperSerial);
            throw new Error(`Duplicate serial number "${serialNumber}" - already used in row ${firstRow}. Each asset must have a unique serial number.`);
          }
          serialNumberMap.set(upperSerial, rowNumber);
        }

        // Validate warranty fields
        const underWarranty = row['Under Warranty'].toLowerCase() === 'yes';
        if (underWarranty && !row['Warranty Date']) {
          throw new Error('Missing Warranty Date - When "Under Warranty" is "Yes", you must provide a warranty expiration date in MM/DD/YYYY format (e.g., 12/31/2025)');
        }

        // Validate and convert warranty date
        let warrantyDate: string | null = null;
        if (underWarranty && row['Warranty Date']) {
          const rawDate = row['Warranty Date'];

          // Check if it's an Excel serial number (number)
          if (typeof rawDate === 'number') {
            // Convert Excel serial date to JS Date
            // Excel dates are days since 1900-01-01 (with leap year bug)
            const excelEpoch = new Date(1900, 0, 1);
            const daysOffset = rawDate > 59 ? rawDate - 2 : rawDate - 1;
            const jsDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);

            // Convert to YYYY-MM-DD for database
            const year = jsDate.getFullYear();
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getDate()).padStart(2, '0');
            warrantyDate = `${year}-${month}-${day}`;
          } else {
            // It's a string - check if it's in MM/DD/YYYY format
            const dateString = rawDate.toString().trim();
            const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;

            if (!dateRegex.test(dateString)) {
              throw new Error('Warranty Date must be in MM/DD/YYYY format (e.g., 12/31/2025). Use Excel\'s default date format.');
            }

            // Convert MM/DD/YYYY to YYYY-MM-DD for database
            const [month, day, year] = dateString.split('/');
            warrantyDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          }

          // Save converted date back to row for Phase 2
          row['Warranty Date'] = warrantyDate;
        }

        // All validations passed for this row
      } catch (error: any) {
        validationErrors.push({
          row: rowNumber,
          error: error.message,
          data: row,
        });
      }
    }

    // If there are validation errors, return them immediately without importing anything
    if (validationErrors.length > 0) {
      console.log(`Validation failed: ${validationErrors.length} errors found. Aborting import.`);

      // Save errors to database
      if (importLog) {
        const errorRecords = validationErrors.map(err => ({
          import_log_id: importLog.id,
          row_number: err.row,
          error_message: err.error,
          row_data: err.data,
        }));

        await supabaseAdmin.from('import_errors').insert(errorRecords);

        await supabaseAdmin
          .from('import_logs')
          .update({
            success_count: 0,
            failed_count: validationErrors.length,
            status: 'failed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', importLog.id);
      }

      return res.status(400).json({
        error: 'Validation failed. Please fix the errors below and try again.',
        result: {
          success: 0,
          failed: validationErrors.length,
          errors: validationErrors,
        },
      });
    }

    // PHASE 2: ALL VALIDATIONS PASSED - NOW ACTUALLY IMPORT THE DATA
    console.log('Phase 2: All validations passed. Importing data...');

    // Create caches to avoid repeated database lookups
    const categoryCache = new Map<string, string>(); // category name -> id
    const brandCache = new Map<string, string>(); // brand name -> id
    const modelCache = new Map<string, string>(); // model name -> id

    // Batch configuration
    const BATCH_SIZE = 100;
    const totalBatches = Math.ceil(nonEmptyData.length / BATCH_SIZE);

    // Process rows in batches
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, nonEmptyData.length);
      const batch = nonEmptyData.slice(batchStart, batchEnd);

      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${batchStart + 1}-${batchEnd})...`);

      // Process each row in the batch
      for (let i = 0; i < batch.length; i++) {
        const { row, originalIndex } = batch[i];
        const rowNumber = originalIndex + 2;
        const globalIndex = batchStart + i;

      try {
        const underWarranty = row['Under Warranty'].toLowerCase() === 'yes';
        const warrantyDate = row['Warranty Date'] ? row['Warranty Date'].toString().trim() : null;

        // Get or create category, brand, model (with caching)
        const categoryKey = row['Category'].toString().trim().toUpperCase();
        let categoryId: string | null | undefined = categoryCache.get(categoryKey);
        if (!categoryId) {
          categoryId = await getOrCreateRecord('categories', 'name', row['Category']);
          if (categoryId) categoryCache.set(categoryKey, categoryId);
        }

        const brandKey = row['Brand'].toString().trim().toUpperCase();
        let brandId: string | null | undefined = brandCache.get(brandKey);
        if (!brandId) {
          brandId = await getOrCreateRecord('brands', 'name', row['Brand']);
          if (brandId) brandCache.set(brandKey, brandId);
        }

        const modelKey = row['Model'].toString().trim().toUpperCase();
        let modelId: string | null | undefined = modelCache.get(modelKey);
        if (!modelId) {
          modelId = await getOrCreateRecord('models', 'name', row['Model']);
          if (modelId) modelCache.set(modelKey, modelId);
        }

        // Check if asset with same serial number already exists
        const { data: existingAsset } = await supabaseAdmin
          .from('asset_inventory')
          .select('id')
          .ilike('serial_number', row['Serial Number'].toString().trim())
          .limit(1)
          .maybeSingle();

        if (existingAsset) {
          // Update existing asset
          await supabaseAdmin
            .from('asset_inventory')
            .update({
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              under_warranty: underWarranty,
              warranty_date: underWarranty ? warrantyDate : null,
              // Status is not updated during import - it's auto-managed
              updated_at: new Date().toISOString(),
              updated_by: userId,
            })
            .eq('id', existingAsset.id);

          result.updated++;
          console.log(`Row ${rowNumber}: Updated existing asset with serial number ${row['Serial Number']}`);
        } else {
          // Create new asset - always set status to "Available"
          await supabaseAdmin
            .from('asset_inventory')
            .insert({
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              serial_number: row['Serial Number'].toString().trim(),
              under_warranty: underWarranty,
              warranty_date: underWarranty ? warrantyDate : null,
              status: 'Available', // Always set to Available on import
              created_by: userId,
            });

          result.created++;
          console.log(`Row ${rowNumber}: Created new asset with serial number ${row['Serial Number']}`);
        }

        result.success++;
      } catch (error: any) {
        // This should rarely happen since we validated everything
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: error.message,
          data: row,
        });
      }
    }

      // Update import log after each batch
      if (importLog) {
        await supabaseAdmin
          .from('import_logs')
          .update({
            success_count: result.success,
            failed_count: result.failed,
            status: 'in_progress',
          })
          .eq('id', importLog.id);
      }

      console.log(`Batch ${batchIndex + 1}/${totalBatches} completed: ${result.success} successful, ${result.failed} failed, ${result.created} created, ${result.updated} updated so far`);
    }

    console.log(`Import completed: ${result.success} successful, ${result.failed} failed, ${result.created} created, ${result.updated} updated`);

    // Save errors to database if import log was created
    if (importLog && result.errors.length > 0) {
      const errorRecords = result.errors.map(err => ({
        import_log_id: importLog.id,
        row_number: err.row,
        error_message: err.error,
        row_data: err.data,
      }));

      const { error: errorsInsertError } = await supabaseAdmin
        .from('import_errors')
        .insert(errorRecords);

      if (errorsInsertError) {
        console.error('Error saving import errors:', errorsInsertError);
      }
    }

    // Update import log with final results
    if (importLog) {
      const { error: updateError } = await supabaseAdmin
        .from('import_logs')
        .update({
          success_count: result.success,
          failed_count: result.failed,
          status: result.failed === 0 ? 'completed' : (result.success === 0 ? 'failed' : 'partial'),
          completed_at: new Date().toISOString(),
        })
        .eq('id', importLog.id);

      if (updateError) {
        console.error('Error updating import log:', updateError);
      }
    }

    return res.status(200).json({
      message: 'Import completed',
      result: {
        ...result,
        autoGeneratedSerials: autoGeneratedCount,
      },
      importLogId: importLog?.id, // Return the log ID for reference
    });
  } catch (error: any) {
    console.error('Error importing file:', error);
    return res.status(500).json({ error: error.message || 'Failed to import file' });
  }
}

export default withAuth(handler, { requirePermission: 'manage_assets' });
