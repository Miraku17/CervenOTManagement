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
  'Store Name': string;
  'Store Code': string;
  'Station Name': string;
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

    const { fileData } = req.body;
    const userId = req.user?.id;
    const userPosition = req.user?.position;

    // Check for restricted positions
    if (userPosition === 'Field Engineer') {
      return res.status(403).json({ error: 'Forbidden: Read-only access for Field Engineers' });
    }

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
                        !row['Category'] && !row['Brand'] && !row['Model'] && !row['Serial Number'];
        if (isEmpty) {
          continue; // Skip this row without counting it as success or failure
        }

        // Validate required fields
        if (!row['Store Name'] || !row['Store Code']) {
          throw new Error('Store Name and Store Code are required');
        }
        if (!row['Station Name']) {
          throw new Error('Station Name is required');
        }
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

        // Parse warranty information
        const underWarranty = row['Under Warranty']?.toLowerCase() === 'yes';
        const warrantyDate = underWarranty && row['Warranty Date'] ? row['Warranty Date'] : null;

        // Get or create store
        let storeId: string | null = null;
        const { data: existingStore, error: findStoreError } = await supabaseAdmin
          .from('stores')
          .select('id')
          .or(`store_name.ilike.${row['Store Name'].trim()},store_code.ilike.${row['Store Code'].trim()}`)
          .maybeSingle();

        if (existingStore) {
          storeId = existingStore.id;
        } else {
          // Create new store
          const { data: newStore, error: storeError } = await supabaseAdmin
            .from('stores')
            .insert({
              store_name: row['Store Name'].trim(),
              store_code: row['Store Code'].trim(),
            })
            .select('id')
            .single();

          if (storeError) throw new Error(`Failed to create store: ${storeError.message}`);
          storeId = newStore.id;
        }

        // Get or create station (required)
        const stationId = await getOrCreateRecord('stations', 'name', row['Station Name']);
        if (!stationId) {
          throw new Error('Failed to create or find station');
        }

        // Get or create category, brand, model
        const categoryId = await getOrCreateRecord('categories', 'name', row['Category']);
        const brandId = await getOrCreateRecord('brands', 'name', row['Brand']);
        const modelId = await getOrCreateRecord('models', 'name', row['Model']);

        if (!categoryId || !brandId || !modelId) {
          throw new Error('Failed to create or find category, brand, or model');
        }

        // Check if inventory entry with same serial number already exists in this store
        const { data: existingInventory } = await supabaseAdmin
          .from('store_inventory')
          .select('id')
          .eq('store_id', storeId)
          .ilike('serial_number', row['Serial Number'].trim())
          .is('deleted_at', null)
          .single();

        if (existingInventory) {
          // Update existing inventory
          const { error: updateError } = await supabaseAdmin
            .from('store_inventory')
            .update({
              station_id: stationId,
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              serial_number: row['Serial Number'].trim(),
              under_warranty: underWarranty,
              warranty_date: warrantyDate,
              updated_at: new Date().toISOString(),
              updated_by: userId,
            })
            .eq('id', existingInventory.id);

          if (updateError) throw new Error(`Failed to update inventory: ${updateError.message}`);
        } else {
          // Create new inventory entry
          const { error: inventoryError } = await supabaseAdmin
            .from('store_inventory')
            .insert({
              store_id: storeId,
              station_id: stationId,
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              serial_number: row['Serial Number'].trim(),
              under_warranty: underWarranty,
              warranty_date: warrantyDate,
              created_by: userId,
            });

          if (inventoryError) throw new Error(`Failed to create inventory: ${inventoryError.message}`);
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

    return res.status(200).json({
      message: 'Import completed',
      result,
    });
  } catch (error: any) {
    console.error('Error importing file:', error);
    return res.status(500).json({ error: error.message || 'Failed to import file' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
