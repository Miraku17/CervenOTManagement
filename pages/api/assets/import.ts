import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import * as XLSX from 'xlsx';

// Disable body parser to handle file upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

interface ImportRow {
  'Category': string;
  'Brand': string;
  'Model': string;
  'Serial Number': string;
  'Under Warranty': string;
  'Warranty Date'?: string;
  'Status': string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
}

async function getOrCreateRecord(
  table: string,
  nameField: string,
  value: string,
  additionalFields?: Record<string, any>
): Promise<string | null> {
  if (!value || value.trim() === '') return null;

  if (!supabaseAdmin) {
    throw new Error('Database connection not available');
  }

  const trimmedValue = value.trim();

  // Try to find existing record
  const { data: existing, error: findError } = await supabaseAdmin
    .from(table)
    .select('id')
    .ilike(nameField, trimmedValue)
    .single();

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
    throw new Error(`Failed to create ${table}: ${createError.message}`);
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
      errors: [],
    };

    // Process each row
    for (let i = 0; i < nonEmptyData.length; i++) {
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number (header is row 1)

      try {

        // Validate required fields
        if (!row['Category']) {
          throw new Error('Category is required');
        }
        if (!row['Brand']) {
          throw new Error('Brand is required');
        }
        if (!row['Model']) {
          throw new Error('Model is required');
        }
        if (!row['Serial Number']) {
          throw new Error('Serial Number is required');
        }
        if (!row['Under Warranty']) {
          throw new Error('Under Warranty is required');
        }
        if (!row['Status']) {
          throw new Error('Status is required');
        }

        // Validate warranty fields
        const underWarranty = row['Under Warranty'].toLowerCase() === 'yes';
        if (underWarranty && !row['Warranty Date']) {
          throw new Error('Warranty Date is required when Under Warranty is Yes');
        }

        // Validate status
        const validStatuses = ['Available', 'In Use', 'Under Repair', 'Broken', 'available', 'in use', 'under repair', 'broken'];
        if (!validStatuses.includes(row['Status'])) {
          throw new Error('Status must be "Available", "In Use", "Under Repair", or "Broken"');
        }

        // Get or create category, brand, model
        const categoryId = await getOrCreateRecord('categories', 'name', row['Category']);
        const brandId = await getOrCreateRecord('brands', 'name', row['Brand']);
        const modelId = await getOrCreateRecord('models', 'name', row['Model']);

        if (!categoryId || !brandId || !modelId) {
          throw new Error('Failed to create or find category, brand, or model');
        }

        // Check if asset with same serial number already exists
        const { data: existingAsset } = await supabaseAdmin
          .from('asset_inventory')
          .select('id')
          .ilike('serial_number', row['Serial Number'].trim())
          .single();

        if (existingAsset) {
          // Update existing asset
          const { error: updateError } = await supabaseAdmin
            .from('asset_inventory')
            .update({
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              under_warranty: underWarranty,
              warranty_date: underWarranty && row['Warranty Date'] ? row['Warranty Date'] : null,
              status: row['Status'].trim(),
              updated_at: new Date().toISOString(),
              updated_by: userId,
            })
            .eq('id', existingAsset.id);

          if (updateError) throw new Error(`Failed to update asset: ${updateError.message}`);
        } else {
          // Create new asset
          const { error: assetError } = await supabaseAdmin
            .from('asset_inventory')
            .insert({
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              serial_number: row['Serial Number'].trim(),
              under_warranty: underWarranty,
              warranty_date: underWarranty && row['Warranty Date'] ? row['Warranty Date'] : null,
              status: row['Status'].trim(),
              created_by: userId,
            });

          if (assetError) throw new Error(`Failed to create asset: ${assetError.message}`);
        }

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
      importLogId: importLog?.id, // Return the log ID for reference
    });
  } catch (error: any) {
    console.error('Error importing file:', error);
    return res.status(500).json({ error: error.message || 'Failed to import file' });
  }
}

export default withAuth(handler, { requirePosition: ['asset', 'operations manager'] });
