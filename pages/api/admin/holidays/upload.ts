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

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
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
      return res.status(403).json({ error: 'You do not have permission to import holidays' });
    }

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { fileData } = req.body;

    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(fileData, 'base64');

    // Parse the Excel file
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get the "holidays" sheet
    const sheetName = 'holidays';
    if (!workbook.SheetNames.includes(sheetName)) {
      return res.status(400).json({
        error: `Missing required sheet: "${sheetName}"`,
        details: `Your Excel file must contain a sheet named "${sheetName}".`
      });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[] = XLSX.utils.sheet_to_json(worksheet);

    if (rawData.length === 0) {
      return res.status(400).json({
        error: 'No data found in the holidays sheet',
        details: 'The "holidays" sheet exists but contains no data rows.'
      });
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      const rowNumber = i + 2; // +2 because Excel is 1-indexed and first row is header

      try {
        // Get and validate required fields
        const date = row['Date']?.toString().trim();
        const name = row['Holiday Name']?.toString().trim();

        if (!date || !name) {
          skipped++;
          errors.push(`Row ${rowNumber}: Missing required fields (Date or Holiday Name)`);
          continue;
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          skipped++;
          errors.push(`Row ${rowNumber}: Invalid date format. Use YYYY-MM-DD (e.g., 2024-12-25)`);
          continue;
        }

        // Parse optional fields
        const holidayType = row['Type']?.toString().trim().toLowerCase() || 'regular';
        const recurringStr = row['Recurring']?.toString().trim().toLowerCase();
        const isRecurring = recurringStr === 'yes' || recurringStr === 'true' || recurringStr === '1';

        // Validate holiday type
        const validTypes = ['regular', 'special_non_working', 'special_working'];
        if (!validTypes.includes(holidayType)) {
          skipped++;
          errors.push(`Row ${rowNumber}: Invalid type "${holidayType}". Must be: regular, special_non_working, or special_working`);
          continue;
        }

        // Check if holiday exists
        const { data: existingHoliday } = await supabaseAdmin
          .from('holidays')
          .select('id')
          .eq('date', date)
          .is('deleted_at', null)
          .single();

        if (existingHoliday) {
          // Update existing holiday
          const { error: updateError } = await supabaseAdmin
            .from('holidays')
            .update({
              name,
              holiday_type: holidayType,
              is_recurring: isRecurring,
            })
            .eq('id', existingHoliday.id);

          if (updateError) {
            skipped++;
            errors.push(`Row ${rowNumber}: Failed to update - ${updateError.message}`);
          } else {
            updated++;
          }
        } else {
          // Insert new holiday
          const { error: insertError } = await supabaseAdmin
            .from('holidays')
            .insert({
              date,
              name,
              holiday_type: holidayType,
              is_recurring: isRecurring,
            });

          if (insertError) {
            skipped++;
            errors.push(`Row ${rowNumber}: Failed to insert - ${insertError.message}`);
          } else {
            imported++;
          }
        }
      } catch (err: any) {
        skipped++;
        errors.push(`Row ${rowNumber}: ${err.message}`);
      }
    }

    return res.status(200).json({
      success: true,
      imported,
      updated,
      skipped,
      total: rawData.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('Error importing holidays:', error);
    return res.status(500).json({ error: error.message || 'Failed to import holidays' });
  }
}

export default withAuth(handler);
