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
      return res.status(400).json({
        error: 'No file data provided',
        details: 'The uploaded file appears to be empty or corrupted. Please try selecting the file again.'
      });
    }

    // Convert base64 to buffer
    let buffer;
    try {
      buffer = Buffer.from(fileData, 'base64');
    } catch (decodeError) {
      return res.status(400).json({
        error: 'Invalid file format',
        details: 'The file could not be decoded. Please ensure you are uploading a valid Excel file (.xlsx or .xls).'
      });
    }

    // Parse the Excel file
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (parseError: any) {
      return res.status(400).json({
        error: 'Failed to parse Excel file',
        details: `The file could not be read as an Excel file. ${parseError.message || 'Please ensure the file is not corrupted and is in .xlsx or .xls format.'}`
      });
    }

    // Get the "stores" sheet
    const sheetName = 'stores';
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({
        error: `Missing required sheet: "${sheetName}"`,
        details: workbook.SheetNames.length > 0
          ? `Your Excel file contains the following sheets: ${workbook.SheetNames.join(', ')}. Please rename one of them to "${sheetName}" or add a new sheet named "${sheetName}".`
          : `Your Excel file appears to have no sheets. Please ensure the file contains a sheet named "${sheetName}".`
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return res.status(400).json({
        error: 'No data found in the stores sheet',
        details: 'The "stores" sheet exists but contains no data rows. Please ensure the sheet has a header row and at least one data row.'
      });
    }

    // Validate required columns
    const requiredColumns = ['Store Code'];
    const firstRow = rawData[0];
    const availableColumns = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        details: `The following required columns are missing: ${missingColumns.join(', ')}. Available columns in your file: ${availableColumns.join(', ')}`
      });
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
        errors.push(`Row ${rowNumber}: Skipped - Missing Store Code (required field)`);
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

          if (updateError) {
            throw new Error(`Failed to update store: ${updateError.message}`);
          }
          storeId = updatedStore.id;

          // Delete existing managers for this store
          const { error: deleteManagersError } = await supabase
            .from('store_managers')
            .delete()
            .eq('store_id', storeId);

          if (deleteManagersError) {
            console.warn(`Row ${rowNumber}: Warning - Could not delete existing managers: ${deleteManagersError.message}`);
          }

        } else {
          // Insert new store
          const { data: newStore, error: insertError } = await supabase
            .from('stores')
            .insert(storeData)
            .select('id')
            .single();

          if (insertError) {
            throw new Error(`Failed to insert store: ${insertError.message}`);
          }
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

    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to import stores';
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

export default withAuth(handler, { requireRole: 'admin' });
