import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
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
  'Store Name': string;
  'Store Code': string;
  'Station Name': string;
  'Device': string;
  'Brand': string;
  'Model': string;
  'Serial Number': string;
  'Status': string;
  'Under Warranty': string;
  'Warranty Date'?: string;
}

interface ImportResult {
  success: number;
  failed: number;
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

  // Try to find existing record
  const { data: existing, error: findError } = await supabaseAdmin
    .from(table)
    .select('id')
    .ilike(nameField, trimmedValue)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error(`Error finding ${table}:`, findError);
    throw new Error(`Could not search for ${table} - Please contact support if this issue persists`);
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

    const userId = req.user?.id;

    // Check if user has permission to manage store inventory
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await userHasPermission(userId, 'manage_store_inventory');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to import store inventory.'
      });
    }

    const { fileData, fileName } = req.body;

    if (!fileData) {
      return res.status(400).json({
        error: 'No file data provided',
        details: 'The uploaded file appears to be empty or corrupted. Please try selecting the file again.'
      });
    }

    // Parse base64 file data
    let buffer;
    try {
      buffer = Buffer.from(fileData, 'base64');
    } catch (decodeError) {
      return res.status(400).json({
        error: 'Invalid file format',
        details: 'The file could not be decoded. Please ensure you are uploading a valid Excel file (.xlsx or .xls).'
      });
    }

    // Parse Excel file
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (parseError: any) {
      return res.status(400).json({
        error: 'Failed to parse Excel file',
        details: `The file could not be read as an Excel file. ${parseError.message || 'Please ensure the file is not corrupted and is in .xlsx or .xls format.'}`
      });
    }

    // Get first sheet
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        error: 'No sheets found in Excel file',
        details: 'Your Excel file appears to have no sheets. Please ensure the file contains at least one sheet with data.'
      });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data: ImportRow[] = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        error: 'No data found in file',
        details: `The sheet "${sheetName}" exists but contains no data rows. Please ensure the sheet has a header row and at least one data row.`
      });
    }

    // Validate required columns exist
    const requiredColumns = ['Store Name', 'Store Code', 'Station Name', 'Device', 'Brand', 'Model', 'Serial Number', 'Status'];
    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        details: `The following required columns are missing: ${missingColumns.join(', ')}. Available columns: ${availableColumns.join(', ')}`
      });
    }

    // Filter out completely empty rows and track original row numbers for logging
    const nonEmptyData = data
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) => {
         return row['Store Name'] || row['Store Code'] || row['Station Name'] ||
                row['Device'] || row['Brand'] || row['Model'] || row['Serial Number'] ||
                row['Status'];
      });

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
        import_type: 'store_inventory',
        file_name: fileName || 'unknown.xlsx',
        imported_by: userId,
        total_rows: nonEmptyData.length,
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
      errors: [],
    };

    // Create caches to avoid repeated database lookups
    const categoryCache = new Map<string, string>(); // category name -> id
    const brandCache = new Map<string, string>(); // brand name -> id
    const modelCache = new Map<string, string>(); // model name -> id
    const stationCache = new Map<string, string>(); // station name -> id
    const storeCache = new Map<string, string>(); // store name/code -> id

    console.log(`Starting import of ${nonEmptyData.length} rows...`);

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
        const rowNumber = originalIndex + 2; // Excel row number (header is row 1)
        const globalIndex = batchStart + i;

      try {
        // Validate required fields with specific messages
        const missingFields = [];
        if (!row['Store Name']) missingFields.push('Store Name');
        if (!row['Store Code']) missingFields.push('Store Code');
        if (!row['Station Name']) missingFields.push('Station Name');
        if (!row['Device']) missingFields.push('Device');
        if (!row['Brand']) missingFields.push('Brand');
        if (!row['Model']) missingFields.push('Model');
        if (!row['Serial Number']) missingFields.push('Serial Number');
        if (!row['Status']) missingFields.push('Status');

        if (missingFields.length > 0) {
          throw new Error(`Missing required information - Please fill in the following field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`);
        }

        // Validate and normalize status
        const statusValue = row['Status'].toString().trim().toLowerCase();
        if (!['permanent', 'temporary'].includes(statusValue)) {
          throw new Error(`Invalid Status "${row['Status']}" - Please use either "Permanent" or "Temporary"`);
        }
        const status = statusValue as 'permanent' | 'temporary';

        // Parse warranty information
        const underWarrantyValue = row['Under Warranty']?.toString().toLowerCase();
        const underWarranty = underWarrantyValue === 'yes';

        // Validate and convert warranty date
        let warrantyDate: string | null = null;
        if (row['Warranty Date']) {
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
        }

        // Get or create store (with caching)
        let storeId: string | null = null;
        const storeName = row['Store Name'].toString().trim();
        const storeCode = row['Store Code'].toString().trim();
        const storeCacheKey = storeCode.toUpperCase(); // Use store code as cache key since it's unique

        if (storeCache.has(storeCacheKey)) {
          storeId = storeCache.get(storeCacheKey)!;
        } else {
          // First, check if store with this code already exists (store_code is unique)
          const { data: existingStore, error: findStoreError } = await supabaseAdmin
            .from('stores')
            .select('id, store_name, store_code')
            .ilike('store_code', storeCode)
            .maybeSingle();

          if (findStoreError) {
            throw new Error(`Error checking for existing store - ${findStoreError.message}`);
          }

          if (existingStore && existingStore.id) {
            // Store code already exists - use the existing store
            storeId = existingStore.id;
            storeCache.set(storeCacheKey, existingStore.id);

            // Log a warning if the names don't match
            if (existingStore.store_name.toLowerCase() !== storeName.toLowerCase()) {
              console.warn(`Row ${rowNumber}: Store code "${storeCode}" already exists with name "${existingStore.store_name}". Using existing store. Import has "${storeName}".`);
            }
          } else {
            // Store doesn't exist - create new store
            const { data: newStore, error: storeError } = await supabaseAdmin
              .from('stores')
              .insert({
                store_name: storeName,
                store_code: storeCode,
              })
              .select('id')
              .single();

            if (storeError) {
              // Provide more detailed error message
              const errorMsg = storeError.message.includes('duplicate')
                ? `Store code "${storeCode}" already exists in the database. If you see this error, please contact support as there may be a caching issue.`
                : storeError.message;
              throw new Error(`Could not create store - ${errorMsg}. Please verify Store Name and Store Code are correct`);
            }

            if (newStore?.id) {
              storeId = newStore.id;
              storeCache.set(storeCacheKey, newStore.id);
            }
          }
        }

        // Get or create station (with caching)
        const stationKey = row['Station Name'].toString().trim().toUpperCase();
        let stationId: string | null | undefined = stationCache.get(stationKey);
        if (!stationId) {
          stationId = await getOrCreateRecord('stations', 'name', row['Station Name'].toString());
          if (stationId) stationCache.set(stationKey, stationId);
        }
        if (!stationId) {
          throw new Error('Unable to process Station Name - Please check that this field contains valid text');
        }

        // Get or create category, brand, model (with caching)
        const categoryKey = row['Device'].toString().trim().toUpperCase();
        let categoryId: string | null | undefined = categoryCache.get(categoryKey);
        if (!categoryId) {
          categoryId = await getOrCreateRecord('categories', 'name', row['Device'].toString());
          if (categoryId) categoryCache.set(categoryKey, categoryId);
        }

        const brandKey = row['Brand'].toString().trim().toUpperCase();
        let brandId: string | null | undefined = brandCache.get(brandKey);
        if (!brandId) {
          brandId = await getOrCreateRecord('brands', 'name', row['Brand'].toString());
          if (brandId) brandCache.set(brandKey, brandId);
        }

        const modelKey = row['Model'].toString().trim().toUpperCase();
        let modelId: string | null | undefined = modelCache.get(modelKey);
        if (!modelId) {
          modelId = await getOrCreateRecord('models', 'name', row['Model'].toString());
          if (modelId) modelCache.set(modelKey, modelId);
        }

        if (!categoryId || !brandId || !modelId) {
          throw new Error('Unable to process Device, Brand, or Model - Please check that these fields contain valid text values');
        }

        // Normalize serial number
        const serialNumber = row['Serial Number'].toString().trim();

        // Always create new inventory entry (allows duplicate serial numbers)
        // This is useful for placeholder values like "NO DEVICE" or when importing bulk data
        const { error: inventoryError } = await supabaseAdmin
          .from('store_inventory')
          .insert({
            store_id: storeId,
            station_id: stationId,
            category_id: categoryId,
            brand_id: brandId,
            model_id: modelId,
            serial_number: serialNumber,
            status: status,
            under_warranty: underWarranty,
            warranty_date: warrantyDate,
            created_by: userId,
          });

        if (inventoryError) throw new Error(`Could not add item to inventory - ${inventoryError.message}. Please verify all data is entered correctly`);

        result.success++;
      } catch (error: any) {
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

      console.log(`Batch ${batchIndex + 1}/${totalBatches} completed: ${result.success} successful, ${result.failed} failed so far`);
    }

    console.log(`Import completed: ${result.success} successful, ${result.failed} failed`);

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
      result,
      importLogId: importLog?.id,
    });
  } catch (error: any) {
    console.error('Error importing file:', error);

    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to import inventory';
    let errorDetails = error.message;

    if (error.message?.includes('base64')) {
      errorMessage = 'Invalid file encoding';
      errorDetails = 'The file could not be processed. Please ensure it is a valid Excel file (.xlsx or .xls).';
    } else if (error.message?.includes('ENOENT') || error.message?.includes('no such file')) {
      errorMessage = 'File not found';
      errorDetails = 'The file could not be accessed. Please try uploading again.';
    } else if (error.message?.includes('file is too large')) {
      errorMessage = 'File size limit exceeded';
      errorDetails = 'The file is too large. Maximum file size is 10MB.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Import timeout';
      errorDetails = 'The import took too long to process. Please try with a smaller file or contact support.';
    } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      errorMessage = 'Permission denied';
      errorDetails = 'You do not have permission to perform this operation.';
    }

    return res.status(500).json({
      error: errorMessage,
      details: errorDetails,
    });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
