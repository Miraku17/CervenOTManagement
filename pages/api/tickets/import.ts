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
  maxDuration: 300, // 5 minutes timeout for large imports
};

interface ImportRow {
  'Store Code': string;
  'Station Name': string;
  'RCC Reference Number': string;
  'Date Reported': string;
  'Time Reported': string;
  'Request Type': string;
  'Device': string;
  'Problem Category': string;
  'Severity': string;
  'Request Detail': string;
  'Reported By (Employee ID)': string;
  'Assigned To (Employee ID)': string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; error: string; data?: any }>;
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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await userHasPermission(userId, 'manage_tickets');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to import tickets.'
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
    const requiredColumns = [
      'Store Code', 'Station Name', 'RCC Reference Number', 'Date Reported', 'Time Reported',
      'Request Type', 'Device', 'Problem Category', 'Severity',
      'Request Detail', 'Reported By (Employee ID)', 'Assigned To (Employee ID)'
    ];
    const firstRow = data[0];
    const availableColumns = Object.keys(firstRow);
    const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));

    if (missingColumns.length > 0) {
      return res.status(400).json({
        error: 'Missing required columns',
        details: `The following required columns are missing: ${missingColumns.join(', ')}. Available columns: ${availableColumns.join(', ')}`
      });
    }

    // Filter out completely empty rows
    const nonEmptyData = data
      .map((row, index) => ({ row, originalIndex: index }))
      .filter(({ row }) => {
        return row['Store Code'] || row['Date Reported'] || row['Request Detail'];
      });

    // Check row count limits
    const MAX_ROWS = 1000;
    const WARNING_THRESHOLD = 500;

    if (nonEmptyData.length > MAX_ROWS) {
      return res.status(400).json({
        error: `File contains ${nonEmptyData.length} rows. Maximum allowed is ${MAX_ROWS} rows per import. Please split your file into smaller batches.`,
        rowCount: nonEmptyData.length,
        maxAllowed: MAX_ROWS,
      });
    }

    if (nonEmptyData.length > WARNING_THRESHOLD) {
      console.warn(`Large import detected: ${nonEmptyData.length} rows. This may take 30-60 seconds to complete.`);
    }

    // Create import log entry
    const { data: importLog, error: importLogError } = await supabaseAdmin
      .from('import_logs')
      .insert({
        import_type: 'tickets',
        file_name: fileName || 'unknown.xlsx',
        imported_by: userId,
        total_rows: nonEmptyData.length,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (importLogError || !importLog) {
      console.error('Error creating import log:', importLogError);
    }

    const result: ImportResult = {
      success: 0,
      failed: 0,
      errors: [],
    };

    // Create caches to avoid repeated database lookups
    const storeCache = new Map<string, string>(); // store code -> id
    const stationCache = new Map<string, string>(); // station name -> id
    const managerCache = new Map<string, string | null>(); // store id -> manager id (first manager)

    console.log(`Starting import of ${nonEmptyData.length} tickets...`);

    // Process each row
    for (let i = 0; i < nonEmptyData.length; i++) {
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number (header is row 1)

      // Log progress every 50 rows
      if (i > 0 && i % 50 === 0) {
        console.log(`Progress: ${i}/${nonEmptyData.length} rows processed...`);
      }

      try {
        // Validate required fields
        const missingFields = [];
        if (!row['Store Code']) missingFields.push('Store Code');
        if (!row['Station Name']) missingFields.push('Station Name');
        if (!row['RCC Reference Number']) missingFields.push('RCC Reference Number');
        if (!row['Date Reported']) missingFields.push('Date Reported');
        if (!row['Time Reported']) missingFields.push('Time Reported');
        if (!row['Request Type']) missingFields.push('Request Type');
        if (!row['Device']) missingFields.push('Device');
        if (!row['Problem Category']) missingFields.push('Problem Category');
        if (!row['Severity']) missingFields.push('Severity');
        if (!row['Request Detail']) missingFields.push('Request Detail');
        if (!row['Reported By (Employee ID)']) missingFields.push('Reported By (Employee ID)');
        if (!row['Assigned To (Employee ID)']) missingFields.push('Assigned To (Employee ID)');

        if (missingFields.length > 0) {
          throw new Error(`Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`);
        }

        // Look up reporter by employee_id
        const reporterEmployeeId = row['Reported By (Employee ID)'].toString().trim();
        const { data: reporterEmployee, error: reporterError } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, employee_id')
          .eq('employee_id', reporterEmployeeId)
          .maybeSingle();

        if (reporterError || !reporterEmployee) {
          throw new Error(`Reporter Employee ID "${reporterEmployeeId}" not found. Please check the employee ID.`);
        }

        // Look up assigned employee (required)
        const assignedEmpId = row['Assigned To (Employee ID)'].toString().trim();
        const { data: assignedEmployee, error: assignedError } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, employee_id')
          .eq('employee_id', assignedEmpId)
          .maybeSingle();

        if (assignedError || !assignedEmployee) {
          throw new Error(`Assigned To Employee ID "${assignedEmpId}" not found. Please check the employee ID.`);
        }

        // Validate severity
        const severity = row['Severity'].toString().trim().toLowerCase();
        if (!['sev1', 'sev2', 'sev3'].includes(severity)) {
          throw new Error(`Invalid Severity "${row['Severity']}" - Must be sev1, sev2, or sev3`);
        }

        // Get store by code (with caching)
        const storeCode = row['Store Code'].toString().trim();
        const storeCacheKey = storeCode.toUpperCase();
        let storeId: string | null = null;

        if (storeCache.has(storeCacheKey)) {
          storeId = storeCache.get(storeCacheKey)!;
        } else {
          const { data: store, error: storeError } = await supabaseAdmin
            .from('stores')
            .select('id')
            .ilike('store_code', storeCode)
            .maybeSingle();

          if (storeError || !store) {
            throw new Error(`Store with code "${storeCode}" not found. Please add the store first or check the store code.`);
          }

          storeId = store.id;
          storeCache.set(storeCacheKey, store.id);
        }

        // Try to match device to store inventory and get station from device
        const deviceString = row['Device'].toString().trim();
        let stationId: string | null = null;
        let deviceMatchedFromInventory = false;

        // Attempt to find device in store inventory by matching the device string
        const { data: inventoryMatch } = await supabaseAdmin
          .from('store_inventory')
          .select(`
            id,
            station_id,
            serial_number,
            categories(name),
            brands(name),
            models(name)
          `)
          .eq('store_id', storeId)
          .limit(100); // Get up to 100 items from this store

        // Try to match device string to inventory
        if (inventoryMatch && inventoryMatch.length > 0) {
          for (const item of inventoryMatch) {
            const categoryName = (item.categories as any)?.name || '';
            const brandName = (item.brands as any)?.name || '';
            const modelName = (item.models as any)?.name || '';
            const serial = item.serial_number || '';

            const inventoryDeviceString = [categoryName, brandName, modelName, serial]
              .filter(Boolean)
              .join(' ');

            // Check if the device strings match (case insensitive)
            if (inventoryDeviceString.toLowerCase() === deviceString.toLowerCase()) {
              stationId = item.station_id;
              deviceMatchedFromInventory = true;
              break;
            }
          }
        }

        // If device not found in inventory, fall back to Station Name column
        if (!stationId) {
          const stationName = row['Station Name'].toString().trim();
          const stationCacheKey = stationName.toUpperCase();

          if (stationCache.has(stationCacheKey)) {
            stationId = stationCache.get(stationCacheKey)!;
          } else {
            const { data: existingStation } = await supabaseAdmin
              .from('stations')
              .select('id')
              .ilike('name', stationName)
              .maybeSingle();

            if (existingStation) {
              stationId = existingStation.id;
              stationCache.set(stationCacheKey, existingStation.id);
            } else {
              // Create new station
              const { data: newStation, error: stationError } = await supabaseAdmin
                .from('stations')
                .insert({ name: stationName })
                .select('id')
                .single();

              if (stationError || !newStation) {
                throw new Error(`Failed to create station "${stationName}"`);
              }

              stationId = newStation.id;
              stationCache.set(stationCacheKey, newStation.id);
            }
          }
        }

        // Parse date and time
        const dateReported = row['Date Reported'];
        let formattedDate: string;

        if (typeof dateReported === 'number') {
          // Excel serial date
          const excelEpoch = new Date(1900, 0, 1);
          const daysOffset = dateReported > 59 ? dateReported - 2 : dateReported - 1;
          const jsDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
          const year = jsDate.getFullYear();
          const month = String(jsDate.getMonth() + 1).padStart(2, '0');
          const day = String(jsDate.getDate()).padStart(2, '0');
          formattedDate = `${year}-${month}-${day}`;
        } else {
          // String date - validate MM/DD/YYYY format
          const dateString = dateReported.toString().trim();
          const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;

          if (!dateRegex.test(dateString)) {
            throw new Error('Date Reported must be in MM/DD/YYYY format (e.g., 01/15/2024)');
          }

          const [month, day, year] = dateString.split('/');
          formattedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        // Parse time (HH:MM AM/PM format)
        const timeReported = row['Time Reported'].toString().trim();
        const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;

        if (!timeRegex.test(timeReported)) {
          throw new Error('Time Reported must be in HH:MM AM/PM format (e.g., 09:30 AM)');
        }

        // Get manager on duty for the store (with caching)
        let modId: string | null = null;
        if (managerCache.has(storeId!)) {
          modId = managerCache.get(storeId!)!;
        } else {
          // Fetch managers for this store
          const { data: managers, error: managerError } = await supabaseAdmin
            .from('store_managers')
            .select('id, manager_name')
            .eq('store_id', storeId)
            .limit(1);

          if (!managerError && managers && managers.length > 0) {
            modId = managers[0].id;
          }
          // Cache the result (even if null)
          managerCache.set(storeId!, modId);
        }

        // Insert ticket
        const { error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert({
            store_id: storeId,
            station_id: stationId,
            mod_id: modId, // Manager on duty (auto-fetched from store)
            rcc_reference_number: row['RCC Reference Number'].toString().trim(),
            date_reported: formattedDate,
            time_reported: timeReported,
            request_type: row['Request Type'].toString().trim(),
            device: row['Device'].toString().trim(),
            problem_category: row['Problem Category'].toString().trim(),
            sev: severity,
            request_detail: row['Request Detail'].toString().trim(),
            reported_by: reporterEmployee.id, // Use the profile UUID (same as created_by)
            serviced_by: assignedEmployee.id, // Assigned technician/engineer (required)
            status: 'open', // Default status
          });

        if (ticketError) {
          throw new Error(`Failed to create ticket - ${ticketError.message}`);
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
    console.error('Error importing tickets:', error);

    let errorMessage = 'Failed to import tickets';
    let errorDetails = error.message;

    if (error.message?.includes('base64')) {
      errorMessage = 'Invalid file encoding';
      errorDetails = 'The file could not be processed. Please ensure it is a valid Excel file (.xlsx or .xls).';
    } else if (error.message?.includes('permission')) {
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
