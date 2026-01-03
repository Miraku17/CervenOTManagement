import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
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
  'Store Name': string;
  'Store Code': string;
  'Station Name': string;
  'Category': string;
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
    .maybeSingle();

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

    const { fileData } = req.body;

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
    const requiredColumns = ['Store Name', 'Store Code', 'Station Name', 'Category', 'Brand', 'Model', 'Serial Number', 'Status'];
    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        details: `The following required columns are missing: ${missingColumns.join(', ')}. Available columns: ${availableColumns.join(', ')}`
      });
    }

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = i + 2; // Excel row number (header is row 1)

      try {
        // Skip completely empty rows
        const isEmpty = !row['Store Name'] && !row['Store Code'] && !row['Station Name'] &&
                        !row['Category'] && !row['Brand'] && !row['Model'] && !row['Serial Number'] &&
                        !row['Status'];
        if (isEmpty) {
          continue; // Skip this row without counting it as success or failure
        }

        // Validate required fields with specific messages
        const missingFields = [];
        if (!row['Store Name']) missingFields.push('Store Name');
        if (!row['Store Code']) missingFields.push('Store Code');
        if (!row['Station Name']) missingFields.push('Station Name');
        if (!row['Category']) missingFields.push('Category');
        if (!row['Brand']) missingFields.push('Brand');
        if (!row['Model']) missingFields.push('Model');
        if (!row['Serial Number']) missingFields.push('Serial Number');
        if (!row['Status']) missingFields.push('Status');

        if (missingFields.length > 0) {
          throw new Error(`Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`);
        }

        // Validate and normalize status
        const statusValue = row['Status'].toString().trim().toLowerCase();
        if (!['permanent', 'temporary'].includes(statusValue)) {
          throw new Error(`Invalid Status "${row['Status']}". Status must be either "Permanent" or "Temporary"`);
        }
        const status = statusValue as 'permanent' | 'temporary';

        // Parse warranty information
        const underWarrantyValue = row['Under Warranty']?.toString().toLowerCase();
        const underWarranty = underWarrantyValue === 'yes';
        const warrantyDate = underWarranty && row['Warranty Date'] ? row['Warranty Date'].toString() : null;

        // Get or create store
        let storeId: string | null = null;
        const storeName = row['Store Name'].toString().trim();
        const storeCode = row['Store Code'].toString().trim();

        const { data: existingStore, error: findStoreError } = await supabaseAdmin
          .from('stores')
          .select('id')
          .or(`store_name.ilike.${storeName},store_code.ilike.${storeCode}`)
          .maybeSingle();

        if (existingStore) {
          storeId = existingStore.id;
        } else {
          // Create new store
          const { data: newStore, error: storeError } = await supabaseAdmin
            .from('stores')
            .insert({
              store_name: storeName,
              store_code: storeCode,
            })
            .select('id')
            .single();

          if (storeError) throw new Error(`Failed to create store: ${storeError.message}`);
          storeId = newStore.id;
        }

        // Get or create station (required)
        const stationId = await getOrCreateRecord('stations', 'name', row['Station Name'].toString());
        if (!stationId) {
          throw new Error('Failed to create or find station');
        }

        // Get or create category, brand, model
        const categoryId = await getOrCreateRecord('categories', 'name', row['Category'].toString());
        const brandId = await getOrCreateRecord('brands', 'name', row['Brand'].toString());
        const modelId = await getOrCreateRecord('models', 'name', row['Model'].toString());

        if (!categoryId || !brandId || !modelId) {
          throw new Error('Failed to create or find category, brand, or model');
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

        if (inventoryError) throw new Error(`Failed to create inventory: ${inventoryError.message}`);

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

    return res.status(200).json({
      message: 'Import completed',
      result,
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
