import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
import * as XLSX from 'xlsx';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
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

interface ValidationError {
  row: number;
  field: string;
  message: string;
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

    const { fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({
        error: 'No file data provided',
      });
    }

    // Parse base64 file data
    let buffer;
    try {
      buffer = Buffer.from(fileData, 'base64');
    } catch (decodeError) {
      return res.status(400).json({
        errors: ['Invalid file format. The file could not be decoded.']
      });
    }

    // Parse Excel file
    let workbook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (parseError: any) {
      return res.status(400).json({
        errors: [`Failed to parse Excel file: ${parseError.message || 'File may be corrupted'}`]
      });
    }

    // Get first sheet
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return res.status(400).json({
        errors: ['No sheets found in Excel file']
      });
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const data: ImportRow[] = XLSX.utils.sheet_to_json(sheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        errors: ['No data found in file. Please ensure the sheet has data rows.']
      });
    }

    // Validate required columns exist in the Excel file
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
        errors: [`Missing required columns: ${missingColumns.join(', ')}`]
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
    if (nonEmptyData.length > MAX_ROWS) {
      return res.status(400).json({
        errors: [`File contains ${nonEmptyData.length} rows. Maximum allowed is ${MAX_ROWS} rows per import.`]
      });
    }

    const validationErrors: ValidationError[] = [];

    // Helper function to validate date parsing
    const validateDateParsing = (dateValue: any, fieldName: string, rowNumber: number): boolean => {
      if (!dateValue) return true; // Optional field

      try {
        if (dateValue instanceof Date) {
          // Valid Date object
          if (isNaN(dateValue.getTime())) {
            validationErrors.push({ row: rowNumber, field: fieldName, message: 'Invalid date value' });
            return false;
          }
          return true;
        } else if (typeof dateValue === 'number') {
          // Excel serial date - validate it's reasonable
          if (dateValue < 1 || dateValue > 100000) {
            validationErrors.push({ row: rowNumber, field: fieldName, message: 'Invalid Excel date serial number' });
            return false;
          }
          return true;
        } else if (typeof dateValue === 'string') {
          // String date - check if it's a valid date format or just text
          const dateString = dateValue.toString().trim();
          const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;

          // If it contains letters (text), just warn - row will be skipped during import
          if (/[a-zA-Z]/.test(dateString)) {
            console.warn(`Row ${rowNumber} - ${fieldName}: Text value "${dateString}" will cause row to be skipped`);
            return true; // Don't fail validation, just skip row during import
          }

          if (!dateRegex.test(dateString)) {
            validationErrors.push({ row: rowNumber, field: fieldName, message: 'Invalid date format. Use MM/DD/YYYY' });
            return false;
          }
          return true;
        }
        return true;
      } catch (error) {
        validationErrors.push({ row: rowNumber, field: fieldName, message: 'Failed to parse date' });
        return false;
      }
    };

    // Helper function to validate time parsing
    const validateTimeParsing = (timeValue: any, fieldName: string, rowNumber: number): boolean => {
      if (!timeValue) return true; // Optional field

      try {
        // Check if it's a Python time object (has hour/minute properties but not a Date)
        if (timeValue && typeof timeValue === 'object' && 'hour' in timeValue && 'minute' in timeValue) {
          return true; // Python datetime.time object is valid
        }

        if (timeValue instanceof Date) {
          // Valid Date object with time (including datetime objects)
          return true;
        } else if (typeof timeValue === 'number') {
          // Excel time serial - can be fraction (0-1) or large number (datetime)
          // Accept both time-only and datetime values
          return true;
        } else if (typeof timeValue === 'string') {
          // String time - allow various formats, will be parsed in import
          const timeString = timeValue.toString().trim();
          if (!timeString) return true; // Empty string is okay

          // Allow HH:MM AM/PM format
          const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9](:[0-5][0-9])?\s?(AM|PM|am|pm)$/i;
          // Also allow 24-hour format HH:MM:SS or HH:MM
          const time24Regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

          if (!timeRegex.test(timeString) && !time24Regex.test(timeString)) {
            // If it's text (not a time), just warn but don't fail - will be treated as null
            console.warn(`Row ${rowNumber} - ${fieldName}: Text value "${timeString}" will be ignored`);
            return true; // Don't fail validation, just treat as null
          }
          return true;
        }
        return true;
      } catch (error) {
        validationErrors.push({ row: rowNumber, field: fieldName, message: 'Failed to parse time' });
        return false;
      }
    };

    // Fetch all employees once for validation (by name)
    const { data: employees } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name');
    const employeeNames = new Set(
      employees?.map(e => `${e.first_name} ${e.last_name}`.toLowerCase()) || []
    );

    // Validate each row (validate all rows, not just first 100)
    for (let i = 0; i < nonEmptyData.length; i++) {
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number

      // For testing: All fields are optional - skip required field validation
      // if (!row['Store Code']) {
      //   validationErrors.push({ row: rowNumber, field: 'Store Code', message: 'Missing Store Code' });
      // }

      // if (!row['RCC Reference Number']) {
      //   validationErrors.push({ row: rowNumber, field: 'RCC Reference Number', message: 'Missing RCC Reference Number' });
      // }

      // Validate Date Reported (optional now, but validate format if provided)
      if (row['Date Reported']) {
        validateDateParsing(row['Date Reported'], 'Date Reported', rowNumber);
      }

      // Validate optional date fields
      validateDateParsing(row['Date Responded'], 'Date Responded', rowNumber);
      validateDateParsing(row['Date Ack'], 'Date Ack', rowNumber);
      validateDateParsing(row['Date Attended'], 'Date Attended', rowNumber);
      validateDateParsing(row['Date Resolved'], 'Date Resolved', rowNumber);

      // Validate optional time fields
      validateTimeParsing(row['Time Reported'], 'Time Reported', rowNumber);
      validateTimeParsing(row['Time Responded'], 'Time Responded', rowNumber);
      validateTimeParsing(row['Time Ack'], 'Time Ack', rowNumber);
      validateTimeParsing(row['Store Arrival'], 'Store Arrival', rowNumber);
      validateTimeParsing(row['Work Start'], 'Work Start', rowNumber);
      validateTimeParsing(row['Pause Time\n(Start)'], 'Pause Time (Start)', rowNumber);
      validateTimeParsing(row['Pause Time\n(End)'], 'Pause Time (End)', rowNumber);
      validateTimeParsing(row['Work End'], 'Work End', rowNumber);

      // For testing: Severity is optional - only validate format if provided
      if (row['Sev']) {
        const severity = row['Sev'].toString().trim().toLowerCase();
        if (!['sev1', 'sev2', 'sev3', 'sev4'].includes(severity)) {
          validationErrors.push({ row: rowNumber, field: 'Sev', message: `Invalid Severity "${row['Sev']}". Must be Sev1, Sev2, Sev3, or Sev4` });
        }
      }

      // For testing: Request Detail is optional
      // if (!row['Request Detail']) {
      //   validationErrors.push({ row: rowNumber, field: 'Request Detail', message: 'Missing Request Detail' });
      // }

      // Validate Status enum if provided
      if (row['Status']) {
        const status = row['Status'].toString().trim().toLowerCase();
        // Map alternative status names to canonical ones
        const statusMappings: { [key: string]: string } = {
          'ongoing': 'in_progress',
          'hold': 'on_hold',
        };
        const normalizedStatus = statusMappings[status] || status;

        if (!['open', 'in_progress', 'on_hold', 'closed', 'replacement', 'revisit', 'cancelled', 'completed', 'duplicate', 'misroute', 'pending'].includes(normalizedStatus)) {
          validationErrors.push({ row: rowNumber, field: 'Status', message: `Invalid Status "${row['Status']}". Must be one of: open, in_progress, on_hold, closed, replacement, revisit, cancelled, completed, duplicate, misroute, pending (or use aliases: ongoing, hold)` });
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        errors: validationErrors.slice(0, 20).map(e => `Row ${e.row} - ${e.field}: ${e.message}`),
        totalErrors: validationErrors.length,
        rowCount: nonEmptyData.length
      });
    }

    return res.status(200).json({
      message: 'Validation passed',
      rowCount: nonEmptyData.length
    });
  } catch (error: any) {
    console.error('Error validating import:', error);
    return res.status(500).json({
      errors: [error.message || 'Failed to validate file']
    });
  }
}

export default withAuth(handler);
