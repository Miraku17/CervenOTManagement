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

    // Check if user has import_schedule permission (same as schedule import)
    const hasPermission = await userHasPermission(userId, 'import_schedule');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to download holiday templates.'
      });
    }

    // Create template data
    const templateData = [
      [
        'Date',
        'Holiday Name',
        'Type',
        'Recurring',
      ],
      [
        '2024-01-01',
        'New Year\'s Day',
        'regular',
        'Yes',
      ],
      [
        '2024-12-25',
        'Christmas Day',
        'regular',
        'Yes',
      ],
      [
        '2024-04-09',
        'Araw ng Kagitingan',
        'regular',
        'Yes',
      ],
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Date
      { wch: 30 }, // Holiday Name
      { wch: 25 }, // Type
      { wch: 12 }, // Recurring
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'holidays');

    // Add instructions sheet
    const instructions = [
      ['HOLIDAY IMPORT TEMPLATE - INSTRUCTIONS'],
      [''],
      ['Sheet Name Requirement:'],
      ['- The data sheet MUST be named "holidays" (lowercase)'],
      ['- Do not rename or change this sheet name'],
      [''],
      ['Required Fields:'],
      ['1. Date - Date in YYYY-MM-DD format (e.g., 2024-01-01, 2024-12-25)'],
      ['   IMPORTANT: Must be in YYYY-MM-DD format'],
      ['2. Holiday Name - Name of the holiday (e.g., New Year\'s Day, Christmas Day)'],
      [''],
      ['Optional Fields:'],
      ['3. Type - Type of holiday (default: regular)'],
      ['   - regular: Regular holiday'],
      ['   - special_non_working: Special non-working holiday'],
      ['   - special_working: Special working holiday'],
      ['4. Recurring - Whether the holiday recurs every year (default: No)'],
      ['   - Yes: Holiday repeats yearly (e.g., Christmas, New Year)'],
      ['   - No: One-time holiday or movable holiday'],
      [''],
      ['Import Behavior:'],
      ['- If a holiday with the same date exists, it will be UPDATED with the new data'],
      ['- If a holiday with the date does not exist, it will be CREATED as a new holiday'],
      ['- Duplicate dates in the same import file will be skipped'],
      [''],
      ['Important Notes:'],
      ['- The sheet MUST be named "holidays" (all lowercase)'],
      ['- Date format must be YYYY-MM-DD (e.g., 2024-12-25)'],
      ['- Date is REQUIRED for every row'],
      ['- Holiday Name is REQUIRED for every row'],
      ['- Type must be: regular, special_non_working, or special_working'],
      ['- Recurring must be: Yes or No (case-insensitive)'],
      ['- Empty rows will be skipped'],
      ['- Rows without Date or Holiday Name will be skipped'],
      ['- Maximum file size: 10MB'],
      ['- Delete the example rows before importing your data'],
      [''],
      ['Date Format Examples:'],
      ['- Correct: 2024-01-01, 2024-12-25, 2024-06-12'],
      ['- Incorrect: 01/01/2024, 25-12-2024, Jan 1 2024'],
      [''],
      ['Tips:'],
      ['- Keep the header row (first row) exactly as is'],
      ['- Do not add or remove columns'],
      ['- Do not rename the "holidays" sheet'],
      ['- Save the file in .xlsx format'],
      ['- Test with a small batch first (5-10 holidays)'],
      ['- Use YYYY-MM-DD date format consistently'],
      ['- For recurring holidays (like Christmas), set Recurring to "Yes"'],
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=holidays_import_template.xlsx');

    return res.send(buffer);
  } catch (error: any) {
    console.error('Error generating template:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate template' });
  }
}

export default withAuth(handler);
