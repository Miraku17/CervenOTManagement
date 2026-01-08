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
    const MAX_ROWS = 1000;
    if (nonEmptyData.length > MAX_ROWS) {
      return res.status(400).json({
        errors: [`File contains ${nonEmptyData.length} rows. Maximum allowed is ${MAX_ROWS} rows per import.`]
      });
    }

    const validationErrors: ValidationError[] = [];

    // Fetch all stores once for validation
    const { data: stores } = await supabaseAdmin
      .from('stores')
      .select('store_code');
    const validStoreCodes = new Set(stores?.map(s => s.store_code.toUpperCase()) || []);

    // Fetch all employees once for validation
    const { data: employees } = await supabaseAdmin
      .from('profiles')
      .select('employee_id');
    const validEmployeeIds = new Set(employees?.map(e => e.employee_id) || []);

    // Validate each row
    for (let i = 0; i < Math.min(nonEmptyData.length, 100); i++) { // Validate first 100 rows
      const { row, originalIndex } = nonEmptyData[i];
      const rowNumber = originalIndex + 2; // Excel row number

      // Check required fields
      if (!row['Store Code']) {
        validationErrors.push({ row: rowNumber, field: 'Store Code', message: 'Missing Store Code' });
      } else {
        const storeCode = row['Store Code'].toString().trim().toUpperCase();
        if (!validStoreCodes.has(storeCode)) {
          validationErrors.push({ row: rowNumber, field: 'Store Code', message: `Store "${row['Store Code']}" not found in system` });
        }
      }

      if (!row['Station Name']) {
        validationErrors.push({ row: rowNumber, field: 'Station Name', message: 'Missing Station Name' });
      }

      if (!row['RCC Reference Number']) {
        validationErrors.push({ row: rowNumber, field: 'RCC Reference Number', message: 'Missing RCC Reference Number' });
      }

      if (!row['Date Reported']) {
        validationErrors.push({ row: rowNumber, field: 'Date Reported', message: 'Missing Date Reported' });
      } else {
        const dateReported = row['Date Reported'];
        if (typeof dateReported === 'string') {
          const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/\d{4}$/;
          if (!dateRegex.test(dateReported.trim())) {
            validationErrors.push({ row: rowNumber, field: 'Date Reported', message: 'Invalid date format. Use MM/DD/YYYY' });
          }
        }
      }

      if (!row['Time Reported']) {
        validationErrors.push({ row: rowNumber, field: 'Time Reported', message: 'Missing Time Reported' });
      } else {
        const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM|am|pm)$/i;
        if (!timeRegex.test(row['Time Reported'].toString().trim())) {
          validationErrors.push({ row: rowNumber, field: 'Time Reported', message: 'Invalid time format. Use HH:MM AM/PM' });
        }
      }

      if (!row['Request Type']) {
        validationErrors.push({ row: rowNumber, field: 'Request Type', message: 'Missing Request Type' });
      }

      if (!row['Device']) {
        validationErrors.push({ row: rowNumber, field: 'Device', message: 'Missing Device' });
      }

      if (!row['Problem Category']) {
        validationErrors.push({ row: rowNumber, field: 'Problem Category', message: 'Missing Problem Category' });
      }

      if (!row['Severity']) {
        validationErrors.push({ row: rowNumber, field: 'Severity', message: 'Missing Severity' });
      } else {
        const severity = row['Severity'].toString().trim().toLowerCase();
        if (!['sev1', 'sev2', 'sev3'].includes(severity)) {
          validationErrors.push({ row: rowNumber, field: 'Severity', message: `Invalid Severity "${row['Severity']}". Must be sev1, sev2, or sev3` });
        }
      }

      if (!row['Request Detail']) {
        validationErrors.push({ row: rowNumber, field: 'Request Detail', message: 'Missing Request Detail' });
      }

      if (!row['Reported By (Employee ID)']) {
        validationErrors.push({ row: rowNumber, field: 'Reported By (Employee ID)', message: 'Missing Employee ID' });
      } else {
        const employeeId = row['Reported By (Employee ID)'].toString().trim();
        if (!validEmployeeIds.has(employeeId)) {
          validationErrors.push({ row: rowNumber, field: 'Reported By (Employee ID)', message: `Employee ID "${employeeId}" not found in system` });
        }
      }

      // Validate Assigned To (required)
      if (!row['Assigned To (Employee ID)']) {
        validationErrors.push({ row: rowNumber, field: 'Assigned To (Employee ID)', message: 'Missing Assigned To Employee ID' });
      } else {
        const assignedId = row['Assigned To (Employee ID)'].toString().trim();
        if (!validEmployeeIds.has(assignedId)) {
          validationErrors.push({ row: rowNumber, field: 'Assigned To (Employee ID)', message: `Assigned Employee ID "${assignedId}" not found in system` });
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
