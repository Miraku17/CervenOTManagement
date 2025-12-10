import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');

    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get the "stores" sheet
    const sheetName = 'stores';
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({
        error: `Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return res.status(400).json({ error: 'No data found in the stores sheet' });
    }

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // +2 because Excel is 1-indexed and first row is header

      // Skip rows without store code
      const storeCode = row['Store Code']?.toString().trim();
      if (!storeCode) {
        skippedCount++;
        console.log(`Row ${rowNumber}: Skipped - No store code`);
        continue;
      }

      try {
        // Map Excel columns to database columns
        const storeData = {
          store_code: storeCode,
          store_name: row['STORE NAME']?.toString().trim() || '',
          store_type: row['STORE TYPE']?.toString().trim() || null,
          contact_no: row['Contact No.']?.toString().trim() || null,
          mobile_number: row['Mobile Number']?.toString().trim() || null,
          store_address: row['STORE ADDRESS']?.toString().trim() || null,
          city: row['City']?.toString().trim() || null,
          location: row['Location']?.toString().trim() || null,
          group: row['Group']?.toString().trim() || null,
          status: row['Status']?.toString().trim() || 'active',
        };

        // Check if store already exists
        const { data: existingStore } = await supabase
          .from('stores')
          .select('id')
          .eq('store_code', storeCode)
          .single();

        let storeId: string;

        if (existingStore) {
          // Update existing store
          const { data: updatedStore, error: updateError } = await supabase
            .from('stores')
            .update(storeData)
            .eq('store_code', storeCode)
            .select('id')
            .single();

          if (updateError) throw updateError;
          storeId = updatedStore.id;

          // Delete existing managers for this store
          await supabase
            .from('store_managers')
            .delete()
            .eq('store_id', storeId);

        } else {
          // Insert new store
          const { data: newStore, error: insertError } = await supabase
            .from('stores')
            .insert(storeData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          storeId = newStore.id;
        }

        // Handle managers
        const managersString = row['Managers']?.toString().trim();
        if (managersString && storeId) {
          // Split by comma and process each manager
          const managerNames = managersString
            .split(',')
            .map((m: string) => m.trim())
            .filter((m: string) => m.length > 0);

          if (managerNames.length > 0) {
            const managersData = managerNames.map((name: string) => ({
              store_id: storeId,
              manager_name: name,
            }));

            const { error: managersError } = await supabase
              .from('store_managers')
              .insert(managersData);

            if (managersError) {
              console.error(`Row ${rowNumber}: Error inserting managers:`, managersError);
              errors.push(`Row ${rowNumber}: Failed to insert managers - ${managersError.message}`);
            }
          }
        }

        importedCount++;
        console.log(`Row ${rowNumber}: Successfully imported store ${storeCode}`);

      } catch (error: any) {
        console.error(`Row ${rowNumber}: Error processing store ${storeCode}:`, error);
        errors.push(`Row ${rowNumber} (${storeCode}): ${error.message}`);
      }
    }

    return res.status(200).json({
      message: 'Import completed',
      imported: importedCount,
      skipped: skippedCount,
      total: rawData.length,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Import error:', error);
    return res.status(500).json({
      error: 'Failed to import stores',
      details: error.message,
    });
  }
}

export default withAuth(handler, { requireRole: 'admin', requirePosition: 'Operations Manager' });
