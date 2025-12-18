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
        'Store Name': 'Example Store',
        'Store Code': 'ST001',
        'Station Name': 'Station A',
        'Category': 'Desktop',
        'Brand': 'Dell',
        'Model': 'OptiPlex 7090',
        'Serial Number': 'SN123456789',
        'Under Warranty': 'Yes',
        'Warranty Date': '2025-12-31'
      },
      {
        'Store Name': '',
        'Store Code': '',
        'Station Name': '',
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
      { wch: 20 }, // Store Name
      { wch: 12 }, // Store Code
      { wch: 15 }, // Station Name
      { wch: 15 }, // Category
      { wch: 15 }, // Brand
      { wch: 20 }, // Model
      { wch: 20 }, // Serial Number
      { wch: 15 }, // Under Warranty
      { wch: 15 }  // Warranty Date
    ];

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Store Inventory Template');

    // Add instructions sheet
    const instructions = [
      { 'Field': 'Store Name', 'Description': 'Name of the store (Required)', 'Example': 'Main Branch Store' },
      { 'Field': 'Store Code', 'Description': 'Unique store code (Required)', 'Example': 'ST001' },
      { 'Field': 'Station Name', 'Description': 'Station name (Required)', 'Example': 'Station A' },
      { 'Field': 'Category', 'Description': 'Product category (Required)', 'Example': 'Desktop, Laptop, Monitor' },
      { 'Field': 'Brand', 'Description': 'Brand name (Required)', 'Example': 'Dell, HP, Lenovo' },
      { 'Field': 'Model', 'Description': 'Model name (Required)', 'Example': 'OptiPlex 7090' },
      { 'Field': 'Serial Number', 'Description': 'Unique serial number (Required)', 'Example': 'SN123456789' },
      { 'Field': 'Under Warranty', 'Description': 'Warranty status - Yes or No (Optional, defaults to No)', 'Example': 'Yes' },
      { 'Field': 'Warranty Date', 'Description': 'Warranty expiration date (Optional, format: YYYY-MM-DD)', 'Example': '2025-12-31' }
    ];
    const wsInstructions = XLSX.utils.json_to_sheet(instructions);
    wsInstructions['!cols'] = [
      { wch: 20 }, // Field
      { wch: 50 }, // Description
      { wch: 30 }  // Example
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
