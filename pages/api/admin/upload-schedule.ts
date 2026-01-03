import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { parse } from 'csv-parse';
import { parse as parseDate } from 'date-fns';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

const weekDaysMap: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6,
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
};

// Validation Regex
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const config = {
  api: {
    bodyParser: false,
  },
};

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for dry run parameter
  const isDryRun = req.query.dryRun === 'true';

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has import_schedule permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'import_schedule');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to import schedules'
      });
    }
  } catch (error: any) {
    console.error('Error checking user position:', error);
    return res.status(500).json({ error: 'Failed to verify user permissions' });
  }

  try {
    let csvText = '';
    for await (const chunk of req) {
      csvText += chunk.toString();
    }

    const records: any[] = await new Promise((resolve, reject) => {
      parse(csvText, { 
        columns: true, 
        trim: true,
        skip_empty_lines: true 
      }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, employee_id');

    if (profileError) {
      throw new Error(`Failed to fetch profiles: ${profileError.message}`);
    }

    const employeeMap = new Map<string, string>();
    profiles?.forEach((p) => {
      if (p.employee_id) {
        employeeMap.set(p.employee_id, p.id);
      }
    });

    const allInsertRows: any[] = [];
    const errors: string[] = [];
    const processedEmployeeIds = new Set<string>(); // Keep track of processed employee_ids for error reporting

    // Process rows with index for error reporting
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // +1 for 0-index, +1 for header row

      const { employee_id, month, shift_start, shift_end, rest_days } = row;

      // 1. Basic Required Fields
      if (!employee_id || !month) {
        errors.push(`Row ${rowNum}: Missing 'employee_id' or 'month'`);
        continue;
      }

      // 2. Format Validation
      if (!MONTH_REGEX.test(month)) {
        errors.push(`Row ${rowNum}: Invalid month format '${month}' (expected YYYY-MM)`);
        continue;
      }

      if (shift_start && !TIME_REGEX.test(shift_start)) {
        errors.push(`Row ${rowNum}: Invalid shift_start '${shift_start}' (expected HH:MM in 24h format)`);
        continue;
      }

      if (shift_end && !TIME_REGEX.test(shift_end)) {
        errors.push(`Row ${rowNum}: Invalid shift_end '${shift_end}' (expected HH:MM in 24h format)`);
        continue;
      }

      // 3. Employee Lookup
      const employeeUUID = employeeMap.get(employee_id);
      if (!employeeUUID) {
        errors.push(`Row ${rowNum}: Employee ID '${employee_id}' not found in system`);
        continue;
      }

      // 4. Date Logic
      const startDate = parseDate(`${month}-01`, 'yyyy-MM-dd', new Date());
      const year = startDate.getFullYear();
      const monthIndex = startDate.getMonth();
      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      // 5. Rest Days Validation & Parsing
      let restDaysArray: number[] = [];
      if (rest_days) {
        const splitDays = rest_days.split(',').map((d: string) => d.trim());
        const invalidDays = splitDays.filter((d: string) => weekDaysMap[d] === undefined && d !== '');
        
        if (invalidDays.length > 0) {
          errors.push(`Row ${rowNum}: Invalid rest days: ${invalidDays.join(', ')}`);
          continue;
        }

        restDaysArray = splitDays
            .map((d: string) => weekDaysMap[d])
            .filter((d: number | undefined) => d !== undefined);
      }

      // Generate rows
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthIndex, day);
        const dayOfWeek = date.getDay();
        const isRest = restDaysArray.includes(dayOfWeek);
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        allInsertRows.push({
          employee_id: employeeUUID,
          date: dateStr,
          shift_start: isRest ? null : shift_start,
          shift_end: isRest ? null : shift_end,
          is_rest_day: isRest,
        });
      }
    }

    // Skip database upsert if it's a dry run
    if (!isDryRun && allInsertRows.length > 0) {
      const BATCH_SIZE = 1000;
      for (let i = 0; i < allInsertRows.length; i += BATCH_SIZE) {
        const batch = allInsertRows.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabaseAdmin
          .from('working_schedules')
          .upsert(batch, { onConflict: 'employee_id, date' });

        if (insertError) {
            console.error('Batch insert error:', insertError);
            throw new Error('Database error while saving schedules.');
        }
      }
    }

    // Adjust message for dry run
    const message = isDryRun
      ? `Dry run completed. ${allInsertRows.length} schedule entries would have been processed.`
      : (allInsertRows.length > 0 
            ? `Processed ${allInsertRows.length} schedule entries.` 
            : 'No valid schedule entries were processed.');

    // Return structured response
    return res.status(200).json({ 
        success: true,
        message: message,
        isDryRun: isDryRun, // Indicate if it was a dry run
        stats: {
            processed_rows: records.length - errors.length,
            total_rows: records.length,
            generated_entries: allInsertRows.length
        },
        errors: errors
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler, { requireRole: 'admin' });