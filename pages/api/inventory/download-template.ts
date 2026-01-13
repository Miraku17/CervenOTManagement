import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import * as XLSX from 'xlsx';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check for restricted positions
  const userPosition = req.user?.position;
  if (userPosition === 'Field Engineer') {
    return res.status(403).json({ error: 'Forbidden: Access denied for Field Engineers' });
  }

  try {
    // Create template data with example and empty rows
    const templateData = [
      {
        'Store Name': 'Example Store',
        'Store Code': 'ST001',
        'Station Name': 'Station A',
        'Device': 'Desktop',
        'Brand': 'Dell',
        'Model': 'OptiPlex 7090',
        'Serial Number': 'SN123456789',
        'Status': 'Permanent',
        'Under Warranty': 'Yes',
        'Warranty Date': '12/31/2025'
      },
      {
        'Store Name': '',
        'Store Code': '',
        'Station Name': '',
        'Device': '',
        'Brand': '',
        'Model': '',
        'Serial Number': '',
        'Status': '',
        'Under Warranty': '',
        'Warranty Date': ''
      }
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 20 }, // Store Name
      { wch: 12 }, // Store Code
      { wch: 15 }, // Station Name
      { wch: 15 }, // Device
      { wch: 15 }, // Brand
      { wch: 20 }, // Model
      { wch: 20 }, // Serial Number
      { wch: 12 }, // Status
      { wch: 15 }, // Under Warranty
      { wch: 15 }  // Warranty Date
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Store Inventory Template');

    // Add instructions sheet
    const instructions = [
      { 'Section': 'IMPORTANT INSTRUCTIONS', 'Information': 'Please read carefully before filling out the template' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'HOW TO USE THIS TEMPLATE', 'Information': '' },
      { 'Section': '1. Fill in your data', 'Information': 'Start from Row 2 (after the example row). Delete the example row after understanding the format.' },
      { 'Section': '2. Save your file', 'Information': 'Save as .xlsx or .xls format. Do NOT save as .csv' },
      { 'Section': '3. Upload the file', 'Information': 'Go to Store Inventory page and click the Import button' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'FIELD REQUIREMENTS', 'Information': '' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'Store Name (Required)', 'Information': 'Full name of the store. Examples: Main Branch Store, North Plaza Branch' },
      { 'Section': 'Store Code (Required)', 'Information': 'Unique store identifier code. Examples: ST001, BRANCH-01, NP-STORE' },
      { 'Section': 'Station Name (Required)', 'Information': 'Name of the station/workstation. Examples: Station A, Counter 1, POS Terminal 3' },
      { 'Section': 'Device (Required)', 'Information': 'Type of equipment. Examples: Desktop, Laptop, Monitor, Printer, POS Terminal' },
      { 'Section': 'Brand (Required)', 'Information': 'Manufacturer name. Examples: Dell, HP, Lenovo, Canon, Epson' },
      { 'Section': 'Model (Required)', 'Information': 'Model number or name. Examples: OptiPlex 7090, ThinkPad X1, LaserJet Pro' },
      { 'Section': 'Serial Number (Required)', 'Information': 'Unique serial number from the device. Can be "NO DEVICE" if no device assigned yet.' },
      { 'Section': 'Status (Required)', 'Information': 'Type exactly: Permanent or Temporary (case-insensitive)' },
      { 'Section': 'Under Warranty (Optional)', 'Information': 'Type: Yes or No. Leave empty to default to No' },
      { 'Section': 'Warranty Date (Optional)', 'Information': 'Enter warranty expiration date in MM/DD/YYYY format (e.g., 12/31/2025). Use Excel\'s default date format - NO special formatting needed!' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'IMPORTANT DATE FORMATTING', 'Information': '' },
      { 'Section': '✓ Use MM/DD/YYYY format', 'Information': 'Enter dates like: 12/31/2025, 1/15/2026, 3/5/2025' },
      { 'Section': '✓ Excel default works!', 'Information': 'Just type the date normally - Excel\'s default date format is perfect!' },
      { 'Section': '✓ No special formatting', 'Information': 'You do NOT need to format the column as Text anymore' },
      { 'Section': 'Examples', 'Information': '12/31/2025 ✓ | 1/5/2026 ✓ | 03/15/2025 ✓ | 2025-12-31 ✗ (wrong format)' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'STATUS VALUES', 'Information': '' },
      { 'Section': 'Permanent', 'Information': 'Equipment permanently assigned to this store location' },
      { 'Section': 'Temporary', 'Information': 'Equipment temporarily placed at this store location' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'COMMON MISTAKES TO AVOID', 'Information': '' },
      { 'Section': 'X Do not leave required fields empty', 'Information': 'Store Name, Store Code, Station Name, Device, Brand, Model, Serial Number, and Status are required' },
      { 'Section': 'X Do not use wrong date format', 'Information': 'Use MM/DD/YYYY (like 12/31/2025), NOT YYYY-MM-DD or other formats' },
      { 'Section': 'X Do not use wrong status values', 'Information': 'Only use: Permanent or Temporary (not Available, In Use, etc.)' },
      { 'Section': 'X Do not mix up Status field', 'Information': 'Store Inventory uses Permanent/Temporary. Asset Inventory uses Available/In Use/etc.' },
      { 'Section': 'X Do not add extra columns', 'Information': 'Only use the provided column headers' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'DUPLICATE SERIAL NUMBERS', 'Information': '' },
      { 'Section': 'Note', 'Information': 'Store inventory ALLOWS duplicate serial numbers (useful for "NO DEVICE" or bulk imports)' },
      { 'Section': 'Each import', 'Information': 'Creates a new inventory entry, even if the serial number exists' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'NEED HELP?', 'Information': '' },
      { 'Section': 'If import fails', 'Information': 'Read the error message carefully - it will tell you which row and what is wrong' },
      { 'Section': 'Check row numbers', 'Information': 'Error messages show the Excel row number where the problem occurred' },
      { 'Section': 'Example error', 'Information': 'Row 5: Missing Store Name - means you need to fill in Store Name in row 5' }
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [
      { wch: 35 }, // Section
      { wch: 80 }  // Information
    ];
    XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=store_inventory_template.xlsx');

    return res.status(200).send(buf);
  } catch (error: any) {
    console.error('Error generating template:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate template' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
