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
  'Date Reported'?: string;
  'Time Reported'?: string;
  'Date Responded'?: string;
  'Time Responded'?: string;
  'RCC Reference Number': string;
  'Store Code': string;
  'Store Name'?: string;
  'Request type'?: string;
  'Device'?: string;
  'Station'?: string;
  'Brand'?: string;
  'M/MT Model'?: string;
  'Serial Number'?: string;
  'Request Detail': string;
  '----- Action Taken -----'?: string;
  'Problem Category'?: string;
  'Sev': string;
  'Final resolution'?: string;
  'Status'?: string;
  'Part/s replaced'?: string;
  'New Parts Serial'?: string;
  'Old Parts Serial'?: string;
  'Date Ack'?: string;
  'Time Ack'?: string;
  'Date Attended'?: string;
  'Store Arrival'?: string;
  'Work Start'?: string;
  'Pause Time\n(Start)'?: string;
  'Pause Time\n(End)'?: string;
  'Work End'?: string;
  'Date Resolved'?: string;
  'Reported by'?: string;
  'Serviced by'?: string;
  'MOD'?: string;
  'SLA Count\n(Hrs)'?: string;
  'Downtime'?: string;
  'SLA Status'?: string;
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
      'RCC Reference Number',
      'Store Code',
      'Sev',
      'Request Detail'
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
    const MAX_ROWS = 5000;
    const WARNING_THRESHOLD = 1000;

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

    // --- Performance Optimization: Pre-fetch caches ---
    console.log('Pre-fetching data caches...');
    
    // 1. Stores Cache
    const storeCache = new Map<string, string>(); // store code -> id
    const { data: stores, error: storesError } = await supabaseAdmin
      .from('stores')
      .select('id, store_code');
    
    if (!storesError && stores) {
      stores.forEach(s => {
        if (s.store_code) storeCache.set(s.store_code.toUpperCase(), s.id);
      });
    }

    // 2. Stations Cache
    const stationCache = new Map<string, string>(); // station name -> id
    const { data: stations, error: stationsError } = await supabaseAdmin
      .from('stations')
      .select('id, name');
    
    if (!stationsError && stations) {
      stations.forEach(s => {
        if (s.name) stationCache.set(s.name.toUpperCase(), s.id);
      });
    }

    // 3. Profiles Cache (Employees)
    // Create a map that can lookup by first name, last name, or full name
    // Simplification: We'll search on demand if not found in a quick map, 
    // or just pre-fetch basic info if the list isn't huge.
    // Assuming < 5000 employees, fetching all ID/Names is fine.
    const employeeCache = new Map<string, string>(); // name key -> id
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name');
    
    if (!profilesError && profiles) {
      profiles.forEach(p => {
        if (p.first_name) employeeCache.set(p.first_name.toLowerCase(), p.id);
        if (p.last_name) employeeCache.set(p.last_name.toLowerCase(), p.id);
        if (p.first_name && p.last_name) {
          employeeCache.set(`${p.first_name} ${p.last_name}`.toLowerCase(), p.id);
        }
      });
    }

    const managerCache = new Map<string, string | null>(); // store id -> manager id (first manager)
    const storeInventoryCache = new Map<string, any[]>(); // store id -> inventory items[]

    console.log(`Starting import of ${nonEmptyData.length} tickets...`);

    // Helper functions (defined once)
    const getOptionalField = (row: ImportRow, fieldName: keyof ImportRow): string | null => {
        const value = row[fieldName];
        return value ? value.toString().trim() : null;
    };

    const parseTime = (timeValue: any): string | null => {
        if (!timeValue) return null;

        try {
        // Handle Python time objects (from openpyxl)
        if (timeValue && typeof timeValue === 'object' && 'hour' in timeValue && 'minute' in timeValue) {
            let hours = timeValue.hour;
            const minutes = String(timeValue.minute).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        }

        if (timeValue instanceof Date) {
            // JavaScript Date object (datetime or time-only)
            let hours = timeValue.getHours();
            const minutes = String(timeValue.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
        } else if (typeof timeValue === 'number') {
            // Excel serial number - could be time (0-1) or datetime (>1)
            let fractionalDay = timeValue;

            // If it's a datetime (>1), extract just the time portion
            if (timeValue >= 1) {
            fractionalDay = timeValue - Math.floor(timeValue);
            }

            const totalMinutes = Math.round(fractionalDay * 24 * 60);
            let hours = Math.floor(totalMinutes / 60) % 24;
            const minutes = totalMinutes % 60;
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${String(minutes).padStart(2, '0')} ${ampm}`;
        } else if (typeof timeValue === 'string') {
            const timeString = timeValue.toString().trim();
            if (!timeString) return null;

            // If it's 24-hour format, convert to 12-hour
            const time24Match = timeString.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])(:[0-5][0-9])?$/);
            if (time24Match) {
            let hours = parseInt(time24Match[1]);
            const minutes = time24Match[2];
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            return `${hours}:${minutes} ${ampm}`;
            }

            // Check for 12-hour format with AM/PM
            const time12Match = timeString.match(/^(0?[1-9]|1[0-2]):([0-5][0-9])(:[0-5][0-9])?\s?(AM|PM|am|pm)$/i);
            if (time12Match) {
            return timeString; // Already in correct format
            }

            // If it contains letters (text like "email ETA"), treat as null
            if (/[a-zA-Z]/.test(timeString)) {
            // console.warn(`Ignoring text value in time field: "${timeString}"`);
            return null;
            }

            // Return as-is for other formats
            return timeString;
        }
        } catch (error) {
        // console.warn(`Failed to parse time value:`, timeValue, error);
        return null;
        }

        return null;
    };

    const parseDate = (dateValue: any): string | null => {
        if (!dateValue) return null;

        try {
        if (dateValue instanceof Date) {
            // JavaScript Date object
            const year = dateValue.getFullYear();
            const month = String(dateValue.getMonth() + 1).padStart(2, '0');
            const day = String(dateValue.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else if (typeof dateValue === 'number') {
            // Excel serial date
            const excelEpoch = new Date(1900, 0, 1);
            const daysOffset = dateValue > 59 ? dateValue - 2 : dateValue - 1;
            const jsDate = new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
            const year = jsDate.getFullYear();
            const month = String(jsDate.getMonth() + 1).padStart(2, '0');
            const day = String(jsDate.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        } else if (typeof dateValue === 'string') {
            // String date - validate MM/DD/YYYY format
            const dateString = dateValue.toString().trim();

            // If it contains letters (text), treat as null
            if (/[a-zA-Z]/.test(dateString)) {
            // console.warn(`Ignoring text value in date field: "${dateString}"`);
            return null;
            }

            const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;
            if (dateRegex.test(dateString)) {
            const [month, day, year] = dateString.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }

            // Return null for invalid formats
            return null;
        }
        } catch (error) {
        // console.warn(`Failed to parse date value:`, dateValue, error);
        return null;
        }

        return null;
    };

            const formatTimestamp = (dateStr: string | null, timeStr: string | null): string | null => {
            if (!dateStr || !timeStr) return null;
            
            try {
            // dateStr is YYYY-MM-DD
            // timeStr is HH:MM AM/PM or HH:MM
            
            let hours = 0;
            let minutes = 0;
            let seconds = 0;
    
            const timeParts = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
            
            if (timeParts) {
                hours = parseInt(timeParts[1]);
                minutes = parseInt(timeParts[2]);
                seconds = timeParts[3] ? parseInt(timeParts[3]) : 0;
                const ampm = timeParts[4] ? timeParts[4].toUpperCase() : null;
    
                if (ampm === 'PM' && hours < 12) {
                hours += 12;
                } else if (ampm === 'AM' && hours === 12) {
                hours = 0;
                }
            } else {
                return null;
            }
    
            return `${dateStr}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            } catch (e) {
            // console.warn(`Failed to format timestamp: ${dateStr} ${timeStr}`, e);
            return null;
            }
        };
    
        const parseNumeric = (value: any): number | null => {
            if (value === null || value === undefined || value === '') return null;
            if (typeof value === 'number') return isNaN(value) ? null : value;
            
            const strVal = value.toString().trim();
            // Check for Excel error values like #VALUE!, #N/A, etc.
            if (strVal.startsWith('#')) return null;
    
            const parsed = parseFloat(strVal);
            return isNaN(parsed) ? null : parsed;
        };
    
    // --- Batch Processing Loop ---
    const BATCH_SIZE = 50;
    let ticketsToInsert: any[] = [];
    
    // Process each row
    for (let i = 0; i < nonEmptyData.length; i++) {
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number (header is row 1)

      // Log progress every 50 rows
      if (i > 0 && i % 100 === 0) {
        console.log(`Progress: ${i}/${nonEmptyData.length} rows processed...`);
      }

      try {
        // Validate required fields
        const missingFields = [];
        if (!row['Store Code']) missingFields.push('Store Code');
        if (!row['RCC Reference Number']) missingFields.push('RCC Reference Number');
        if (!row['Sev']) missingFields.push('Sev');
        if (!row['Request Detail']) missingFields.push('Request Detail');

        if (missingFields.length > 0) {
          throw new Error(`Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`);
        }

        // Validate severity
        const severity = row['Sev'].toString().trim().toLowerCase();
        if (!['sev1', 'sev2', 'sev3', 'sev4'].includes(severity)) {
          throw new Error(`Invalid Severity "${row['Sev']}" - Must be Sev1, Sev2, Sev3, or Sev4`);
        }

        // --- Store Lookup/Creation ---
        const storeCode = row['Store Code'].toString().trim();
        const storeName = row['Store Name'] ? row['Store Name'].toString().trim() : storeCode;
        const storeCacheKey = storeCode.toUpperCase();
        let storeId: string | null = null;

        if (storeCache.has(storeCacheKey)) {
          storeId = storeCache.get(storeCacheKey)!;
        } else {
          // Double check DB just in case (race condition or first time seeing it)
          const { data: store, error: storeError } = await supabaseAdmin
            .from('stores')
            .select('id')
            .ilike('store_code', storeCode)
            .maybeSingle();

          if (!store) {
            // Create store
            const { data: newStore, error: createStoreError } = await supabaseAdmin
              .from('stores')
              .insert({
                store_code: storeCode,
                store_name: storeName,
                status: 'active'
              })
              .select('id')
              .single();

            if (createStoreError || !newStore) throw new Error(`Failed to create store "${storeCode}"`);
            
            storeId = newStore.id;
            storeCache.set(storeCacheKey, newStore.id);
            console.log(`Created new store: ${storeCode}`);

            // If MOD is provided, create store_managers entry
            if (row['MOD']) {
                const modName = row['MOD'].toString().trim();
                await supabaseAdmin
                  .from('store_managers')
                  .insert({ store_id: newStore.id, manager_name: modName });
            }
          } else {
            storeId = store.id;
            storeCache.set(storeCacheKey, store.id);
            // Check MOD logic handled asynchronously/lazily or skipped for speed in batch?
            // For now, let's skip the "update existing store manager" logic to speed up import,
            // or just do it very simply.
          }
        }

        // --- Manager Lookup (Simplified) ---
        let modId: string | null = null;
        if (managerCache.has(storeId!)) {
            modId = managerCache.get(storeId!)!;
        } else {
            const { data: managers } = await supabaseAdmin
                .from('store_managers')
                .select('id, manager_name')
                .eq('store_id', storeId)
                .limit(1);
            
            if (managers && managers.length > 0) {
                modId = managers[0].id;
            }
            managerCache.set(storeId!, modId);
        }


        // --- Employee Lookup (Optimized) ---
        let reporterId: string | null = null;
        if (row['Reported by']) {
            const name = row['Reported by'].toString().trim().toLowerCase();
            if (employeeCache.has(name)) reporterId = employeeCache.get(name)!;
            else { 
            // Find fuzzy match? Or just query DB once
                 const { data: reporterData } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
                    .limit(1)
                    .maybeSingle();
                 if (reporterData) reporterId = reporterData.id;
            }
        }

        let servicedById: string | null = null;
        if (row['Serviced by']) {
            const name = row['Serviced by'].toString().trim().toLowerCase();
            if (employeeCache.has(name)) servicedById = employeeCache.get(name)!;
             else {
                 const { data: servicedData } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .or(`first_name.ilike.%${name}%,last_name.ilike.%${name}%`)
                    .limit(1)
                    .maybeSingle();
                 if (servicedData) servicedById = servicedData.id;
            }
        }


        // --- Device/Station Logic (Optimized) ---
        let stationId: string | null = null;
        
        // 1. Try from Device Inventory (Cached per store)
        if (row['Device']) {
            const deviceString = row['Device'].toString().trim();
            
            // Check if we have fetched inventory for this store yet
            if (!storeInventoryCache.has(storeId!)) {
                const { data: inventory } = await supabaseAdmin
                    .from('store_inventory')
                    .select(
                        `
                        id, station_id, serial_number,
                        categories(name), brands(name), models(name)
                    `)
                    .eq('store_id', storeId);
                
                storeInventoryCache.set(storeId!, inventory || []);
            }

            const inventoryMatch = storeInventoryCache.get(storeId!);
            if (inventoryMatch && inventoryMatch.length > 0) {
                 for (const item of inventoryMatch) {
                    const categoryName = (item.categories as any)?.name || '';
                    const brandName = (item.brands as any)?.name || '';
                    const modelName = (item.models as any)?.name || '';
                    const serial = item.serial_number || '';
                    const inventoryDeviceString = [categoryName, brandName, modelName, serial].filter(Boolean).join(' ');

                    if (inventoryDeviceString.toLowerCase() === deviceString.toLowerCase()) {
                        stationId = item.station_id;
                        break;
                    }
                }
            }
        }

        // 2. Fallback to Station Name
        if (!stationId && row['Station']) {
            const stationName = row['Station'].toString().trim();
            const sKey = stationName.toUpperCase();
            if (stationCache.has(sKey)) {
                stationId = stationCache.get(sKey)!;
            } else {
                // Create station
                const { data: newStation, error: stationError } = await supabaseAdmin
                  .from('stations')
                  .insert({ name: stationName })
                  .select('id')
                  .single();
                
                if (newStation) {
                    stationId = newStation.id;
                    stationCache.set(sKey, newStation.id);
                }
            }
        }

        // --- Prepare Ticket Object ---
        const formattedDate = parseDate(row['Date Reported']);
        // Check if Date Reported contains text (invalid)
        const dateReportedHasText = row['Date Reported'] && typeof row['Date Reported'] === 'string' && /[a-zA-Z]/.test(row['Date Reported'].toString().trim());

        if (dateReportedHasText || (row['Date Reported'] && !formattedDate)) {
             // console.log(`Skipping row ${rowNumber}: Date Reported contains invalid/text value`);
             continue; 
        }

        let timeReported = null;
        if (row['Time Reported']) {
          const timeValue: any = row['Time Reported'];
          if (timeValue instanceof Date) {
            let hours = timeValue.getHours();
            const minutes = String(timeValue.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;
            timeReported = `${hours}:${minutes} ${ampm}`;
          } else {
            const timeStr = timeValue.toString().trim();
            const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;
            if (timeRegex.test(timeStr)) timeReported = timeStr;
          }
        }

        const dateAttended = parseDate(row['Date Attended']);
        
        const ticket = {
            store_id: storeId,
            station_id: stationId,
            mod_id: modId,
            rcc_reference_number: row['RCC Reference Number'].toString().trim(),
            date_reported: formattedDate,
            time_reported: timeReported,
            date_responded: parseDate(row['Date Responded']),
            time_responded: parseTime(row['Time Responded']),
            request_type: getOptionalField(row, 'Request type'),
            device: getOptionalField(row, 'Device'),
            problem_category: getOptionalField(row, 'Problem Category'),
            sev: severity,
            request_detail: row['Request Detail'].toString().trim(),
            action_taken: getOptionalField(row, '----- Action Taken -----'),
            final_resolution: getOptionalField(row, 'Final resolution'),
            status: getOptionalField(row, 'Status')?.toLowerCase() || 'open',
            parts_replaced: getOptionalField(row, 'Part/s replaced'),
            new_parts_serial: getOptionalField(row, 'New Parts Serial'),
            old_parts_serial: getOptionalField(row, 'Old Parts Serial'),
            date_ack: parseDate(row['Date Ack']),
            time_ack: parseTime(row['Time Ack']),
            date_attended: dateAttended,
            store_arrival: formatTimestamp(dateAttended, parseTime(row['Store Arrival'])),
            work_start: formatTimestamp(dateAttended, parseTime(row['Work Start'])),
            pause_time_start: formatTimestamp(dateAttended, parseTime(row['Pause Time\n(Start)'])),
            pause_time_end: formatTimestamp(dateAttended, parseTime(row['Pause Time\n(End)'])),
            work_end: formatTimestamp(dateAttended, parseTime(row['Work End'])),
            date_resolved: parseDate(row['Date Resolved']),
            sla_count_hrs: parseNumeric(row['SLA Count\n(Hrs)']),
            downtime: parseNumeric(row['Downtime']),
            sla_status: getOptionalField(row, 'SLA Status'),
            reported_by: reporterId,
            serviced_by: servicedById,
        };
        
        ticketsToInsert.push(ticket);

        // --- Execute Batch Insert ---
        if (ticketsToInsert.length >= BATCH_SIZE) {
            const { error: batchError } = await supabaseAdmin.from('tickets').insert(ticketsToInsert);
            if (batchError) {
                // If batch fails, maybe fall back to single insert? 
                // Or just log it. For now, we assume it works or fails hard.
                throw new Error(`Batch insert failed: ${batchError.message}`);
            }
            result.success += ticketsToInsert.length;
            ticketsToInsert = []; // Clear batch
        }

      } catch (error: any) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: error.message,
          data: row,
        });
      }
    }

    // Insert remaining tickets
    if (ticketsToInsert.length > 0) {
        const { error: batchError } = await supabaseAdmin.from('tickets').insert(ticketsToInsert);
        if (batchError) {
             // Capture error for remaining items
             result.failed += ticketsToInsert.length;
             result.errors.push({ row: -1, error: `Batch insert failed for last ${ticketsToInsert.length} rows: ${batchError.message}` });
        } else {
            result.success += ticketsToInsert.length;
        }
    }

    console.log(`Import completed: ${result.success} successful, ${result.failed} failed`);

    // Save errors to database if import log was created
    if (importLog && result.errors.length > 0) {
      // Limit error logs to avoid timeout on huge error lists
      const errorRecords = result.errors.slice(0, 1000).map(err => ({
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