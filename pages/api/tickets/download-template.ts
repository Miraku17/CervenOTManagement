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

    const hasPermission = await userHasPermission(userId, 'manage_tickets');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to download ticket templates.'
      });
    }

    // Create template data
    const templateData = [
      [
        'Store Code',
        'Station Name',
        'RCC Reference Number',
        'Date Reported',
        'Time Reported',
        'Request Type',
        'Device',
        'Problem Category',
        'Severity',
        'Request Detail',
        'Reported By (Employee ID)',
        'Assigned To (Employee ID)',
      ],
      [
        'ST001',
        'Drive Thru',
        'RCC-2024-001',
        '01/15/2024',
        '09:30 AM',
        'Repair',
        'POS NCR 7167 SN123456',
        'Device Malfunction',
        'sev2',
        'POS terminal not responding to touch input',
        'EMP001',
        'EMP100',
      ],
      [
        'ST002',
        'Front Counter',
        'RCC-2024-002',
        '01/16/2024',
        '02:15 PM',
        'Installation',
        'Headset Plantronics CS540 SN789012',
        'Installation',
        'sev1',
        'New headset installation required',
        'EMP002',
        'EMP101',
      ],
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Store Code
      { wch: 20 }, // Station Name
      { wch: 20 }, // RCC Reference Number
      { wch: 15 }, // Date Reported
      { wch: 15 }, // Time Reported
      { wch: 15 }, // Request Type
      { wch: 35 }, // Device
      { wch: 25 }, // Problem Category
      { wch: 10 }, // Severity
      { wch: 50 }, // Request Detail
      { wch: 25 }, // Reported By (Employee ID)
      { wch: 25 }, // Assigned To (Employee ID)
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ticket Template');

    // Add instructions sheet
    const instructions = [
      ['TICKET IMPORT TEMPLATE - INSTRUCTIONS'],
      [''],
      ['Required Fields (must be filled for every row):'],
      ['1. Store Code - The unique code for the store (e.g., ST001, ST002)'],
      ['2. Station Name - Fallback station name if device is not found in inventory (e.g., Drive Thru, Front Counter)'],
      ['   Note: If the device exists in your store inventory, its station will be used automatically'],
      ['3. RCC Reference Number - External reference number (e.g., RCC-2024-001)'],
      ['4. Date Reported - Date in MM/DD/YYYY format (e.g., 01/15/2024)'],
      ['5. Time Reported - Time in HH:MM AM/PM format (e.g., 09:30 AM)'],
      ['6. Request Type - Type of request (e.g., Repair, Installation, Maintenance)'],
      ['7. Device - The device name/description. Format: Category Brand Model Serial'],
      ['   Example: "POS NCR 7167 SN123456" or "Headset Plantronics CS540 SN789012"'],
      ['   IMPORTANT: If this matches a device in your store inventory, the station will be taken from the device'],
      ['   IMPORTANT: Format must exactly match: Category Brand Model Serial (space-separated)'],
      ['8. Problem Category - Category of the problem (e.g., Device Malfunction, Installation, Network Issue)'],
      ['9. Severity - Must be one of: sev1, sev2, or sev3'],
      ['   - sev1: Low priority'],
      ['   - sev2: Medium priority'],
      ['   - sev3: High priority / Critical'],
      ['10. Request Detail - Description of the issue'],
      ['11. Reported By (Employee ID) - Employee ID of the person reporting the issue (e.g., EMP001, EMP123)'],
      ['    IMPORTANT: Must match an existing employee ID in your system'],
      ['12. Assigned To (Employee ID) - Employee ID of the technician/field engineer to assign (e.g., EMP100)'],
      ['    IMPORTANT: Must match an existing employee ID in your system'],
      [''],
      ['Auto-Filled Fields (handled by the system):'],
      ['- Manager on Duty - Automatically assigned based on the store (uses first manager for the store)'],
      ['- Station - If your Device matches an item in store inventory, its station is used automatically'],
      ['  Otherwise, the Station Name column will be used to find or create the station'],
      [''],
      ['Important Notes:'],
      ['- RCC Reference Number is REQUIRED for every ticket'],
      ['- Both Reported By and Assigned To employee IDs are REQUIRED for every ticket'],
      ['- The Store Code must match an existing store in your system'],
      ['- All Employee IDs must match existing employees in your system'],
      ['- Device field should exactly match the format from your store inventory for automatic station assignment'],
      ['- If Device is found in inventory, its station will override the Station Name column'],
      ['- Dates must be in MM/DD/YYYY format'],
      ['- Times must be in HH:MM AM/PM format'],
      ['- Severity must be exactly: sev1, sev2, or sev3 (lowercase)'],
      ['- Maximum file size: 10MB'],
      ['- Maximum rows per import: 1000'],
      ['- Delete the example rows before importing your data'],
      [''],
      ['Tips:'],
      ['- Keep the header row (first row) as is'],
      ['- Do not add or remove columns'],
      ['- Save the file in .xlsx format'],
      ['- Test with a small batch first (5-10 tickets)'],
      ['- Verify employee IDs are correct before importing'],
    ];

    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    instructionsSheet['!cols'] = [{ wch: 100 }];
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, 'Instructions');

    // Convert to buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ticket_import_template.xlsx');

    return res.send(buffer);
  } catch (error: any) {
    console.error('Error generating template:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate template' });
  }
}

export default withAuth(handler);
