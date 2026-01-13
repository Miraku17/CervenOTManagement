import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';
import * as XLSX from 'xlsx';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await userHasPermission(userId, 'manage_stores');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to download store templates.'
      });
    }

    // Create template data
    const templateData = [
      [
        'Store Code',
        'STORE NAME',
        'STORE TYPE',
        'Contact No.',
        'Mobile Number',
        'STORE ADDRESS',
        'City',
        'Location',
        'Group',
        'Status',
        'Managers',
      ],
      [
        'ST001',
        'McDonald\'s Ayala Mall',
        'Mall Store',
        '(02) 1234-5678',
        '0917-123-4567',
        '123 Ayala Avenue, Makati City',
        'Makati',
        'Ayala Mall Level 2',
        'Metro Manila',
        'active',
        'Juan Dela Cruz, Maria Santos',
      ],
      [
        'ST002',
        'McDonald\'s Ortigas Center',
        'Standalone',
        '(02) 8765-4321',
        '0918-765-4321',
        '456 EDSA, Ortigas Center',
        'Pasig',
        'Ortigas Business District',
        'Metro Manila',
        'active',
        'Pedro Garcia',
      ],
      [
        'ST003',
        'McDonald\'s BGC',
        'Mall Store',
        '(02) 5555-6666',
        '0919-555-6666',
        '789 26th Street, BGC',
        'Taguig',
        'SM Aura Premier Level 1',
        'Metro Manila',
        'inactive',
        'Ana Reyes, Carlos Lopez',
      ],
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Store Code
      { wch: 30 }, // STORE NAME
      { wch: 15 }, // STORE TYPE
      { wch: 18 }, // Contact No.
      { wch: 18 }, // Mobile Number
      { wch: 40 }, // STORE ADDRESS
      { wch: 15 }, // City
      { wch: 30 }, // Location
      { wch: 20 }, // Group
      { wch: 10 }, // Status
      { wch: 40 }, // Managers
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'stores');

    // Add instructions sheet
    const instructions = [
      ['STORE IMPORT TEMPLATE - INSTRUCTIONS'],
      [''],
      ['Sheet Name Requirement:'],
      ['- The data sheet MUST be named "stores" (lowercase)'],
      ['- Do not rename or change this sheet name'],
      [''],
      ['Required Fields (must be filled for every row):'],
      ['1. Store Code - Unique identifier for the store (e.g., ST001, ST002, ST003)'],
      ['   IMPORTANT: Must be unique across all stores'],
      [''],
      ['Optional Fields:'],
      ['2. STORE NAME - Full name of the store location (e.g., McDonald\'s Ayala Mall)'],
      ['3. STORE TYPE - Type of store (e.g., Mall Store, Standalone, Drive-Thru Only)'],
      ['4. Contact No. - Primary contact phone number (e.g., (02) 1234-5678)'],
      ['5. Mobile Number - Mobile contact number (e.g., 0917-123-4567)'],
      ['6. STORE ADDRESS - Complete store address'],
      ['7. City - City where the store is located (e.g., Makati, Pasig, Taguig)'],
      ['8. Location - Specific location details (e.g., Ayala Mall Level 2, Ortigas Business District)'],
      ['9. Group - Store grouping or region (e.g., Metro Manila, Luzon North, Visayas)'],
      ['10. Status - Store status (active or inactive). Defaults to "active" if not specified'],
      ['11. Managers - Store manager names, comma-separated if multiple (e.g., Juan Dela Cruz, Maria Santos)'],
      [''],
      ['Import Behavior:'],
      ['- If a store with the same Store Code exists, it will be UPDATED with the new data'],
      ['- If a store with the Store Code does not exist, it will be CREATED as a new store'],
      ['- Managers will be created or updated based on the comma-separated list'],
      ['- Existing managers not in the list will be removed from the store'],
      [''],
      ['Important Notes:'],
      ['- The sheet MUST be named "stores" (all lowercase)'],
      ['- Store Code is REQUIRED for every row'],
      ['- Store Code should be unique and consistent'],
      ['- Status must be either "active" or "inactive" (case-insensitive)'],
      ['- Manager names in the Managers column should be comma-separated'],
      ['- Empty rows will be skipped'],
      ['- Rows without Store Code will be skipped'],
      ['- Maximum file size: 10MB'],
      ['- Delete the example rows before importing your data'],
      [''],
      ['Data Format Guidelines:'],
      ['- Phone numbers: Any format is accepted (e.g., (02) 1234-5678, 02-12345678, 02 1234 5678)'],
      ['- Mobile numbers: Any format is accepted (e.g., 0917-123-4567, 0917 123 4567, 09171234567)'],
      ['- Text fields: Keep within reasonable length'],
      ['- Special characters: Avoid using special characters in Store Code'],
      [''],
      ['Tips:'],
      ['- Keep the header row (first row) exactly as is'],
      ['- Do not add or remove columns'],
      ['- Do not rename the "stores" sheet'],
      ['- Save the file in .xlsx format'],
      ['- Test with a small batch first (5-10 stores)'],
      ['- Use consistent formatting for phone numbers'],
      ['- Use proper capitalization for store names'],
      ['- Verify store codes before importing'],
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=store_import_template.xlsx');

    return res.send(buffer);
  } catch (error: any) {
    console.error('Error generating template:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate template' });
  }
}

export default withAuth(handler);
