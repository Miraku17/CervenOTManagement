import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import * as XLSX from 'xlsx';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Increased for larger files
    },
  },
};

interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  preview: any[];
  duplicateStoreCodes: string[];
}

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

  // Check if user has manage_stores permission
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

    // Validation
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const validRows: number[] = [];
    const storeCodesInFile = new Map<string, number[]>();
    const storeCodePattern = /^[A-Za-z0-9\-_]+$/; // Only alphanumeric, hyphens, underscores

    // First pass: validate each row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // +2 because Excel is 1-indexed and first row is header
      let hasError = false;

      // Validate Store Code
      const storeCode = row['Store Code']?.toString().trim();
      if (!storeCode) {
        errors.push({
          row: rowNumber,
          field: 'Store Code',
          message: 'Store Code is required but missing',
          severity: 'error'
        });
        hasError = true;
      } else {
        // Check format
        if (!storeCodePattern.test(storeCode)) {
          warnings.push({
            row: rowNumber,
            field: 'Store Code',
            message: `Store Code "${storeCode}" contains special characters. Only alphanumeric, hyphens, and underscores are recommended.`,
            severity: 'warning'
          });
        }

        // Track store codes for duplicate detection
        if (!storeCodesInFile.has(storeCode)) {
          storeCodesInFile.set(storeCode, []);
        }
        storeCodesInFile.get(storeCode)!.push(rowNumber);

        // Check length
        if (storeCode.length > 50) {
          errors.push({
            row: rowNumber,
            field: 'Store Code',
            message: `Store Code is too long (${storeCode.length} characters). Maximum is 50 characters.`,
            severity: 'error'
          });
          hasError = true;
        }
      }

      // Validate Store Name
      const storeName = row['STORE NAME']?.toString().trim();
      if (storeName && storeName.length > 255) {
        warnings.push({
          row: rowNumber,
          field: 'STORE NAME',
          message: `Store Name is very long (${storeName.length} characters). It will be truncated to 255 characters.`,
          severity: 'warning'
        });
      }

      // Validate Contact Numbers
      const contactNo = row['Contact No.']?.toString().trim();
      const mobileNumber = row['Mobile Number']?.toString().trim();
      const phonePattern = /^[0-9\s\-\+\(\)]+$/;

      if (contactNo && !phonePattern.test(contactNo)) {
        warnings.push({
          row: rowNumber,
          field: 'Contact No.',
          message: `Contact number "${contactNo}" has unusual format. It may contain invalid characters.`,
          severity: 'warning'
        });
      }

      if (mobileNumber && !phonePattern.test(mobileNumber)) {
        warnings.push({
          row: rowNumber,
          field: 'Mobile Number',
          message: `Mobile number "${mobileNumber}" has unusual format. It may contain invalid characters.`,
          severity: 'warning'
        });
      }

      // Validate Status
      const status = row['Status']?.toString().trim().toLowerCase();
      if (status && !['active', 'inactive', 'closed'].includes(status)) {
        warnings.push({
          row: rowNumber,
          field: 'Status',
          message: `Status "${status}" is not recognized. Will default to "active". Valid values: active, inactive, closed.`,
          severity: 'warning'
        });
      }

      if (!hasError) {
        validRows.push(rowNumber);
      }
    }

    // Check for duplicates within the file
    const duplicateStoreCodes: string[] = [];
    storeCodesInFile.forEach((rows, storeCode) => {
      if (rows.length > 1) {
        duplicateStoreCodes.push(storeCode);
        errors.push({
          row: rows[0],
          field: 'Store Code',
          message: `Duplicate Store Code "${storeCode}" found in rows: ${rows.join(', ')}. Each store code must be unique.`,
          severity: 'error'
        });
      }
    });

    // Check against existing stores in database
    const uniqueStoreCodes = Array.from(storeCodesInFile.keys());
    const { data: existingStores } = await supabase
      .from('stores')
      .select('store_code')
      .in('store_code', uniqueStoreCodes);

    if (existingStores && existingStores.length > 0) {
      const existingCodes = new Set(existingStores.map(s => s.store_code));
      existingCodes.forEach(code => {
        const rows = storeCodesInFile.get(code);
        if (rows) {
          warnings.push({
            row: rows[0],
            field: 'Store Code',
            message: `Store Code "${code}" already exists in database and will be updated with new data.`,
            severity: 'warning'
          });
        }
      });
    }

    // Create preview (first 10 rows)
    const preview = rawData.slice(0, 10).map((row, idx) => ({
      rowNumber: idx + 2,
      storeCode: row['Store Code']?.toString().trim() || '',
      storeName: row['STORE NAME']?.toString().trim() || '',
      storeType: row['STORE TYPE']?.toString().trim() || '',
      city: row['City']?.toString().trim() || '',
      status: row['Status']?.toString().trim() || 'active',
    }));

    const result: ValidationResult = {
      valid: errors.length === 0,
      totalRows: rawData.length,
      validRows: validRows.length,
      errors,
      warnings,
      preview,
      duplicateStoreCodes,
    };

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Validation error:', error);

    return res.status(500).json({
      error: 'Validation failed',
      details: error.message || 'An unexpected error occurred during validation. Please try again.',
    });
  }
}

export default withAuth(handler);
