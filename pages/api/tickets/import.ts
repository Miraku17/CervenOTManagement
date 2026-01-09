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
        if (!row['RCC Reference Number']) missingFields.push('RCC Reference Number');
        if (!row['Sev']) missingFields.push('Sev');
        if (!row['Request Detail']) missingFields.push('Request Detail');

        if (missingFields.length > 0) {
          throw new Error(`Missing required field${missingFields.length > 1 ? 's' : ''}: ${missingFields.join(', ')}`);
        }

        // Look up reporter by name (optional)
        let reporterEmployee = null;
        if (row['Reported by']) {
          const reporterName = row['Reported by'].toString().trim();
          const { data: reporterData, error: reporterError } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name')
            .or(`first_name.ilike.%${reporterName}%,last_name.ilike.%${reporterName}%`)
            .limit(1)
            .maybeSingle();

          if (reporterData && !reporterError) {
            reporterEmployee = reporterData;
          }
          // If not found, reporterEmployee remains null (optional field)
        }

        // Look up assigned employee by name (serviced by) - optional
        let assignedEmployee = null;
        if (row['Serviced by']) {
          const servicedByName = row['Serviced by'].toString().trim();
          const { data: assignedData, error: assignedError } = await supabaseAdmin
            .from('profiles')
            .select('id, first_name, last_name')
            .or(`first_name.ilike.%${servicedByName}%,last_name.ilike.%${servicedByName}%`)
            .limit(1)
            .maybeSingle();

          if (assignedData && !assignedError) {
            assignedEmployee = assignedData;
          }
          // If not found, assignedEmployee remains null (optional field)
        }

        // Validate severity
        const severity = row['Sev'].toString().trim().toLowerCase();
        if (!['sev1', 'sev2', 'sev3', 'sev4'].includes(severity)) {
          throw new Error(`Invalid Severity "${row['Sev']}" - Must be Sev1, Sev2, Sev3, or Sev4`);
        }

        // Get store by code (with caching), create if doesn't exist
        const storeCode = row['Store Code'].toString().trim();
        const storeName = row['Store Name'] ? row['Store Name'].toString().trim() : storeCode; // Use store code as name if not provided
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

          if (storeError && storeError.code !== 'PGRST116') {
            throw new Error(`Error looking up store "${storeCode}": ${storeError.message}`);
          }

          if (!store) {
            // Store doesn't exist, create it
            const { data: newStore, error: createStoreError } = await supabaseAdmin
              .from('stores')
              .insert({
                store_code: storeCode,
                store_name: storeName,
                status: 'active'
              })
              .select('id')
              .single();

            if (createStoreError || !newStore) {
              throw new Error(`Failed to create store "${storeCode}" - ${createStoreError?.message || 'Unknown error'}`);
            }

            storeId = newStore.id;
            storeCache.set(storeCacheKey, newStore.id);
            console.log(`Created new store: ${storeCode} - ${storeName}`);

            // If MOD is provided, create store_managers entry
            if (row['MOD']) {
              const modName = row['MOD'].toString().trim();
              const { error: managerError } = await supabaseAdmin
                .from('store_managers')
                .insert({
                  store_id: newStore.id,
                  manager_name: modName
                });

              if (managerError) {
                console.warn(`Warning: Failed to create manager "${modName}" for store ${storeCode}: ${managerError.message}`);
              } else {
                console.log(`Created manager "${modName}" for store ${storeCode}`);
              }
            }
          } else {
            storeId = store.id;
            storeCache.set(storeCacheKey, store.id);

            // For existing stores, check if MOD needs to be added
            if (row['MOD']) {
              const modName = row['MOD'].toString().trim();

              // Check if this manager already exists for this store
              const { data: existingManager } = await supabaseAdmin
                .from('store_managers')
                .select('id')
                .eq('store_id', store.id)
                .ilike('manager_name', modName)
                .maybeSingle();

              // Only create if manager doesn't exist
              if (!existingManager) {
                const { error: managerError } = await supabaseAdmin
                  .from('store_managers')
                  .insert({
                    store_id: store.id,
                    manager_name: modName
                  });

                if (managerError) {
                  console.warn(`Warning: Failed to add manager "${modName}" to existing store ${storeCode}: ${managerError.message}`);
                } else {
                  console.log(`Added manager "${modName}" to existing store ${storeCode}`);
                }
              }
            }
          }
        }

        // Try to match device to store inventory and get station from device
        let stationId: string | null = null;
        let deviceMatchedFromInventory = false;

        if (row['Device']) {
          const deviceString = row['Device'].toString().trim();

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
        }

        // If device not found in inventory, fall back to Station column (optional)
        if (!stationId && row['Station']) {
          const stationName = row['Station'].toString().trim();
          if (stationName) {
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
        }

        // Helper function to safely get optional field value
        const getOptionalField = (fieldName: keyof ImportRow): string | null => {
          const value = row[fieldName];
          return value ? value.toString().trim() : null;
        };

        // Helper function to parse time fields (handles Date objects, Excel serial numbers, and strings)
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
                console.warn(`Ignoring text value in time field: "${timeString}"`);
                return null;
              }

              // Return as-is for other formats
              return timeString;
            }
          } catch (error) {
            console.warn(`Failed to parse time value:`, timeValue, error);
            return null;
          }

          return null;
        };

        // Helper function to parse date fields (handles Date objects, Excel serial numbers, and strings)
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
                console.warn(`Ignoring text value in date field: "${dateString}"`);
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
            console.warn(`Failed to parse date value:`, dateValue, error);
            return null;
          }

          return null;
        };

        // Parse date and time (Date Reported is now optional)
        const formattedDate = parseDate(row['Date Reported']);

        // Check if Date Reported contains text (invalid)
        const dateReportedHasText = row['Date Reported'] && typeof row['Date Reported'] === 'string' && /[a-zA-Z]/.test(row['Date Reported'].toString().trim());

        // Skip this row if Date Reported contains text or is invalid
        if (dateReportedHasText || (row['Date Reported'] && !formattedDate)) {
          console.log(`Skipping row ${rowNumber}: Date Reported contains invalid/text value "${row['Date Reported']}"`);
          continue; // Skip this row, don't count as success or failure
        }

        // Parse time (HH:MM AM/PM format) - optional
        let timeReported = null;
        if (row['Time Reported']) {
          const timeValue = row['Time Reported'];

          if (timeValue instanceof Date) {
            // JavaScript Date object (from XLSX parsing)
            let hours = timeValue.getHours();
            const minutes = String(timeValue.getMinutes()).padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12; // Convert to 12-hour format
            timeReported = `${hours}:${minutes} ${ampm}`;
          } else {
            const timeStr = timeValue.toString().trim();
            const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;

            if (!timeRegex.test(timeStr)) {
              throw new Error('Time Reported must be in HH:MM AM/PM format (e.g., 09:30 AM)');
            }
            timeReported = timeStr;
          }
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

        // Helper function to safely get optional field value
        const getOptionalField = (fieldName: keyof ImportRow): string | null => {
          const value = row[fieldName];
          return value ? value.toString().trim() : null;
        };

        // Helper function to parse time fields (handles Date objects, Excel serial numbers, and strings)
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
                console.warn(`Ignoring text value in time field: "${timeString}"`);
                return null;
              }

              // Return as-is for other formats
              return timeString;
            }
          } catch (error) {
            console.warn(`Failed to parse time value:`, timeValue, error);
            return null;
          }

          return null;
        };

        // Helper function to parse date fields (handles Date objects, Excel serial numbers, and strings)
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
                console.warn(`Ignoring text value in date field: "${dateString}"`);
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
            console.warn(`Failed to parse date value:`, dateValue, error);
            return null;
          }

          return null;
        };

        // Insert ticket with all fields from Excel template
        const { error: ticketError } = await supabaseAdmin
          .from('tickets')
          .insert({
            store_id: storeId,
            station_id: stationId,
            mod_id: modId,
            rcc_reference_number: row['RCC Reference Number'].toString().trim(),
            date_reported: formattedDate,
            time_reported: timeReported,
            date_responded: parseDate(row['Date Responded']),
            time_responded: parseTime(row['Time Responded']),
            request_type: getOptionalField('Request type'),
            device: getOptionalField('Device'),
            problem_category: getOptionalField('Problem Category'),
            sev: severity,
            request_detail: row['Request Detail'].toString().trim(),
            action_taken: getOptionalField('----- Action Taken -----'),
            final_resolution: getOptionalField('Final resolution'),
            status: getOptionalField('Status')?.toLowerCase() || 'open',
            parts_replaced: getOptionalField('Part/s replaced'),
            new_parts_serial: getOptionalField('New Parts Serial'),
            old_parts_serial: getOptionalField('Old Parts Serial'),
            date_ack: parseDate(row['Date Ack']),
            time_ack: parseTime(row['Time Ack']),
            date_attended: parseDate(row['Date Attended']),
            store_arrival: parseTime(row['Store Arrival']),
            work_start: parseTime(row['Work Start']),
            pause_time_start: parseTime(row['Pause Time\n(Start)']),
            pause_time_end: parseTime(row['Pause Time\n(End)']),
            work_end: parseTime(row['Work End']),
            date_resolved: parseDate(row['Date Resolved']),
            sla_count_hrs: getOptionalField('SLA Count\n(Hrs)') ? parseFloat(getOptionalField('SLA Count\n(Hrs)')!) : null,
            downtime: getOptionalField('Downtime'),
            sla_status: getOptionalField('SLA Status'),
            reported_by: reporterEmployee?.id || null,
            serviced_by: assignedEmployee?.id || null,
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
