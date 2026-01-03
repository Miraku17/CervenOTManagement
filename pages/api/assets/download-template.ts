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
      { 'Field': 'Category', 'Description': 'Product category (Required)', 'Example': 'Desktop, Laptop, Monitor, Printer, etc.' },
      { 'Field': 'Brand', 'Description': 'Brand name (Required)', 'Example': 'Dell, HP, Lenovo, Canon' },
      { 'Field': 'Model', 'Description': 'Model name (Required)', 'Example': 'OptiPlex 7090, ThinkPad X1' },
      { 'Field': 'Serial Number', 'Description': 'Unique serial number (Required)', 'Example': 'SN123456789' },
      { 'Field': 'Under Warranty', 'Description': 'Warranty status - Yes or No (Required)', 'Example': 'Yes' },
      { 'Field': 'Warranty Date', 'Description': 'Warranty expiration date (Required if under warranty)', 'Example': '2025-12-31' },
      { 'Field': 'Status', 'Description': 'Asset status (Required)', 'Example': 'Available, In Use, Under Repair, Broken' }
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [
      { wch: 20 }, // Field
      { wch: 50 }, // Description
      { wch: 35 }  // Example
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
