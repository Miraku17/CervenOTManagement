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
        'Warranty Date': '2025-12-31',
        'Status': 'Available'
      },
      {
        'Category': '',
        'Brand': '',
        'Model': '',
        'Serial Number': '',
        'Under Warranty': '',
        'Warranty Date': '',
        'Status': ''
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
      { wch: 15 }, // Warranty Date
      { wch: 12 }  // Status
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
      { 'Section': 'Serial Number (Required)', 'Information': 'Unique serial number from the device. Each serial number should be unique.' },
      { 'Section': 'Under Warranty (Required)', 'Information': 'Type exactly: Yes or No (case-insensitive)' },
      { 'Section': 'Warranty Date', 'Information': 'CRITICAL: Format the column as TEXT first, then enter date as YYYY-MM-DD (e.g., 2025-12-31)' },
      { 'Section': '  - Required when', 'Information': 'Under Warranty is "Yes"' },
      { 'Section': '  - Leave empty when', 'Information': 'Under Warranty is "No"' },
      { 'Section': 'Status (Required)', 'Information': 'Choose one: Available, In Use, Under Repair, or Broken (case-insensitive)' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'IMPORTANT DATE FORMATTING', 'Information': '' },
      { 'Section': 'Step 1', 'Information': 'Select the entire Warranty Date column (column F)' },
      { 'Section': 'Step 2', 'Information': 'Right-click and select "Format Cells"' },
      { 'Section': 'Step 3', 'Information': 'Choose "Text" as the format (NOT Date)' },
      { 'Section': 'Step 4', 'Information': 'Type dates manually as YYYY-MM-DD (example: 2025-12-31)' },
      { 'Section': 'Why?', 'Information': 'Excel converts dates to numbers automatically. Formatting as Text prevents this.' },
      { 'Section': '', 'Information': '' },
      { 'Section': 'COMMON MISTAKES TO AVOID', 'Information': '' },
      { 'Section': 'X Do not leave required fields empty', 'Information': 'All fields except Warranty Date are required' },
      { 'Section': 'X Do not use date format', 'Information': 'Do NOT format Warranty Date as Date - use Text format only' },
      { 'Section': 'X Do not use wrong status values', 'Information': 'Only use: Available, In Use, Under Repair, or Broken' },
      { 'Section': 'X Do not duplicate serial numbers', 'Information': 'Each asset should have a unique serial number (unless updating existing)' },
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
