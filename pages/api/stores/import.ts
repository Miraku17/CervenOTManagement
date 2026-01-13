import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Increased to support larger files (1000+ rows)
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

  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  // Check if user has manage_stores permission (Operations Manager, Tech Support Lead, Tech Support Engineer)
  const hasPermission = await userHasPermission(userId, 'manage_stores');
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to import stores' });
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
    let updatedCount = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 50; // Process 50 rows at a time for better performance

    console.log(`Starting import of ${rawData.length} rows in batches of ${BATCH_SIZE}`);

    // Process in batches for better performance with large datasets
    for (let batchStart = 0; batchStart < rawData.length; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, rawData.length);
      const batch = rawData.slice(batchStart, batchEnd);

      console.log(`Processing batch: rows ${batchStart + 2} to ${batchEnd + 1}`);

      // Process each row in the batch
      for (let i = 0; i < batch.length; i++) {
        const row = batch[i];
        const rowNumber = batchStart + i + 2; // +2 because Excel is 1-indexed and first row is header

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
          updatedCount++;

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
          skippedCount++;
        }
      }

      // Log batch completion
      console.log(`Completed batch: ${batchEnd - batchStart} rows processed`);
    }

    console.log(`Import completed: ${importedCount} total, ${updatedCount} updated, ${skippedCount} skipped/failed`);

    return res.status(200).json({
      message: 'Import completed successfully',
      imported: importedCount,
      updated: updatedCount,
      created: importedCount - updatedCount,
      skipped: skippedCount,
      total: rawData.length,
      errors: errors.length > 0 ? errors.slice(0, 100) : undefined, // Limit to first 100 errors
      hasMoreErrors: errors.length > 100,
    });

  } catch (error: any) {
    console.error('Import error:', error);

    // Provide more specific error messages based on error type
    let errorMessage = 'Failed to import stores';
    let errorDetails = error.message;
    let errorCode = 'UNKNOWN_ERROR';

    if (error.message?.includes('base64')) {
      errorMessage = 'Invalid file encoding';
      errorDetails = 'The file could not be processed. Please ensure it is a valid Excel file (.xlsx or .xls).';
      errorCode = 'INVALID_ENCODING';
    } else if (error.message?.includes('ENOENT') || error.message?.includes('no such file')) {
      errorMessage = 'File not found';
      errorDetails = 'The file could not be accessed. Please try uploading again.';
      errorCode = 'FILE_NOT_FOUND';
    } else if (error.message?.includes('file is too large') || error.message?.includes('request entity too large')) {
      errorMessage = 'File size limit exceeded';
      errorDetails = 'The file is too large. Maximum file size is 50MB. For files larger than this, please split them into smaller files or contact support.';
      errorCode = 'FILE_TOO_LARGE';
    } else if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      errorMessage = 'Import timeout';
      errorDetails = 'The import took too long to process. This usually happens with very large files. Try splitting your file into smaller batches (500-1000 rows each).';
      errorCode = 'TIMEOUT';
    } else if (error.message?.includes('permission') || error.message?.includes('unauthorized')) {
      errorMessage = 'Permission denied';
      errorDetails = 'You do not have permission to perform this operation. Please contact your administrator.';
      errorCode = 'PERMISSION_DENIED';
    } else if (error.message?.includes('duplicate') || error.code === '23505') {
      errorMessage = 'Duplicate data detected';
      errorDetails = 'One or more stores have duplicate store codes. Each store code must be unique.';
      errorCode = 'DUPLICATE_DATA';
    } else if (error.message?.includes('connection') || error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Database connection error';
      errorDetails = 'Could not connect to the database. Please try again in a moment or contact support if the problem persists.';
      errorCode = 'DB_CONNECTION_ERROR';
    } else if (error.message?.includes('memory') || error.message?.includes('heap')) {
      errorMessage = 'File too complex';
      errorDetails = 'The file is too large or complex to process. Please try splitting it into smaller files (recommended: 1000 rows per file).';
      errorCode = 'MEMORY_ERROR';
    }

    return res.status(500).json({
      error: errorMessage,
      details: errorDetails,
      code: errorCode,
      suggestion: getSuggestionForError(errorCode),
    });
  }
}

function getSuggestionForError(errorCode: string): string {
  const suggestions: Record<string, string> = {
    'FILE_TOO_LARGE': 'Split your Excel file into multiple smaller files (500-1000 rows each) and import them separately.',
    'TIMEOUT': 'Try importing fewer rows at a time. We recommend batches of 500-1000 rows for optimal performance.',
    'MEMORY_ERROR': 'Your file may have too many rows or complex formulas. Export it as a simple .xlsx file with values only (no formulas).',
    'DUPLICATE_DATA': 'Check your Excel file for duplicate Store Code values. Use Excel\'s "Remove Duplicates" feature or filter to find them.',
    'DB_CONNECTION_ERROR': 'Wait a moment and try again. If the problem continues, please contact technical support.',
    'INVALID_ENCODING': 'Save your file as a new .xlsx file using "Save As" in Excel and try again.',
  };

  return suggestions[errorCode] || 'Please check your file format and try again. Contact support if the problem persists.';
}

export default withAuth(handler);
