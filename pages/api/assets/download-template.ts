import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import * as XLSX from 'xlsx';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Create template data with example and empty rows
    const templateData = [
      {
        'Category': 'Desktop',
        'Brand': 'Dell',
        'Model': 'OptiPlex 7090',
        'Serial Number': 'SN123456789',
        'Under Warranty': 'Yes',
        'Warranty Date': '12/31/2025'
      },
      {
        'Category': '',
        'Brand': '',
        'Model': '',
        'Serial Number': '',
        'Under Warranty': '',
        'Warranty Date': ''
      }
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    ws['!cols'] = [
      { wch: 15 }, // Category
      { wch: 15 }, // Brand
      { wch: 20 }, // Model
      { wch: 20 }, // Serial Number
      { wch: 15 }, // Under Warranty
      { wch: 15 }  // Warranty Date
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Asset Inventory Template');

    // Add instructions sheet
    const instructions = [
      { 'Section': 'IMPORTANT INSTRUCTIONS', 'Information': 'Please read carefully before filling out the template' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'HOW TO USE THIS TEMPLATE', 'Information': '' },
      { 'Section': '1. Fill in your data', 'Information': 'Start from Row 2 (after the example row). Delete the example row after understanding the format.' },
      { 'Section': '2. Save your file', 'Information': 'Save as .xlsx or .xls format. Do NOT save as .csv' },
      { 'Section': '3. Upload the file', 'Information': 'Go to Asset Inventory page and click the Import button' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'FIELD REQUIREMENTS', 'Information': '' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'Category (Required)', 'Information': 'Type of asset. Examples: Desktop, Laptop, Monitor, Printer, Mouse, Keyboard' },
      { 'Section': 'Brand (Required)', 'Information': 'Manufacturer name. Examples: Dell, HP, Lenovo, Canon, Logitech' },
      { 'Section': 'Model (Required)', 'Information': 'Model number or name. Examples: OptiPlex 7090, ThinkPad X1, LaserJet Pro' },
      { 'Section': 'Serial Number', 'Information': 'Unique serial number from the device. Leave BLANK or enter "NO SERIAL" for assets without serial numbers - system will auto-generate unique IDs (NO-SERIAL-001, NO-SERIAL-002, etc.)' },
      { 'Section': 'Under Warranty (Required)', 'Information': 'Type exactly: Yes or No (case-insensitive)' },
      { 'Section': 'Warranty Date', 'Information': 'Enter warranty expiration date in MM/DD/YYYY format (e.g., 12/31/2025). Use Excel\'s default date format - NO special formatting needed!' },
      { 'Section': '  - Required when', 'Information': 'Under Warranty is "Yes"' },
      { 'Section': '  - Leave empty when', 'Information': 'Under Warranty is "No"' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'STATUS (Auto-managed)', 'Information': 'Status is automatically set to "Available" when importing. It will change to "In Use" when the asset is assigned to a store.' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'IMPORTANT DATE FORMATTING', 'Information': '' },
      { 'Section': '✓ Use MM/DD/YYYY format', 'Information': 'Enter dates like: 12/31/2025, 1/15/2026, 3/5/2025' },
      { 'Section': '✓ Excel default works!', 'Information': 'Just type the date normally - Excel\'s default date format is perfect!' },
      { 'Section': '✓ No special formatting', 'Information': 'You do NOT need to format the column as Text anymore' },
      { 'Section': 'Examples', 'Information': '12/31/2025 ✓ | 1/5/2026 ✓ | 03/15/2025 ✓ | 2025-12-31 ✗ (wrong format)' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'COMMON MISTAKES TO AVOID', 'Information': '' },
      { 'Section': 'X Do not leave required fields empty', 'Information': 'Category, Brand, Model, and Under Warranty are required. Serial Number and Warranty Date can be left blank in certain cases.' },
      { 'Section': 'X Do not use wrong date format', 'Information': 'Use MM/DD/YYYY (like 12/31/2025), NOT YYYY-MM-DD or other formats' },
      { 'Section': 'X Do not duplicate serial numbers', 'Information': 'Each asset must have a unique serial number. Leave blank for auto-generation.' },
      { 'Section': '✓ Auto-generated serial numbers', 'Information': 'If you leave Serial Number blank or enter "NO SERIAL", the system will automatically generate unique IDs like NO-SERIAL-001, NO-SERIAL-002, etc.' },
      { 'Section': 'X Do not add extra columns', 'Information': 'Only use the provided column headers' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'NEED HELP?', 'Information': '' },
      { 'Section': 'If import fails', 'Information': 'Read the error message carefully - it will tell you which row and what is wrong' },
      { 'Section': 'Check row numbers', 'Information': 'Error messages show the Excel row number where the problem occurred' },
      { 'Section': 'Example error', 'Information': 'Row 5: Missing Category - means you need to fill in Category in row 5' }
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
    res.setHeader('Content-Disposition', 'attachment; filename=asset_inventory_template.xlsx');

    return res.status(200).send(buf);
  } catch (error: any) {
    console.error('Error generating template:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate template' });
  }
}

export default withAuth(handler, { requirePermission: 'manage_assets' });
