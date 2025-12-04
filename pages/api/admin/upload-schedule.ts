import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { parse } from 'csv-parse';
import { parse as parseDate } from 'date-fns';

const weekDaysMap: Record<string, number> = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6
};

export const config = {
  api: {
    bodyParser: false, // We'll handle file upload manually
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Read CSV from the request (assume file is in req.body as text)
    let csvText = '';
    for await (const chunk of req) {
      csvText += chunk.toString();
    }

    // 2. Parse CSV
    const records: any[] = await new Promise((resolve, reject) => {
      parse(csvText, { columns: true, trim: true }, (err, output) => {
        if (err) reject(err);
        else resolve(output);
      });
    });

    // 3. Process each row
    for (const row of records) {
      const { employee_id, month, shift_start, shift_end, rest_days } = row;

      if (!employee_id || !month) {
        console.warn('Skipping row due to missing employee_id or month', row);
        continue;
      }

      // 3a. Lookup UUID from profiles
      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('employee_id', employee_id)
        .single();

      if (profileError || !profileData) {
        console.warn(`Employee not found: ${employee_id}`);
        continue; // skip unknown employee
      }
      const employeeUUID = profileData.id;

      // 3b. Parse month to get start & end date
      // month format YYYY-MM
      const startDate = parseDate(`${month}-01`, 'yyyy-MM-dd', new Date());
      const year = startDate.getFullYear();
      const monthIndex = startDate.getMonth();

      const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

      // 3c. Parse rest days
      const restDaysArray = rest_days
        ? rest_days
            .split(',')
            .map((d: string) => d.trim())
            .map((d: string) => weekDaysMap[d])
            .filter((d: number | undefined) => d !== undefined)
        : [];

      const insertRows = [];

      // 3d. Generate per-day rows
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, monthIndex, day);
        const dayOfWeek = date.getDay(); // 0=Sunday ... 6=Saturday
        const isRest = restDaysArray.includes(dayOfWeek);
        
        // Format date as YYYY-MM-DD manually to avoid timezone issues causing day shifts
        const dateStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

        insertRows.push({
          employee_id: employeeUUID,
          date: dateStr,
          shift_start: isRest ? null : shift_start,
          shift_end: isRest ? null : shift_end,
          is_rest_day: isRest,
        });
      }

      // 3e. Upsert into working_schedules
      if (insertRows.length > 0) {
        const { error: insertError } = await supabaseAdmin
          .from('working_schedules')
          .upsert(insertRows, { onConflict: 'employee_id, date' });

        if (insertError) console.error('Error inserting schedule:', insertError);
      }
    }

    return res.status(200).json({ message: 'CSV processed and schedules saved.' });
  } catch (error: any) {
    console.error(error);
    return res.status(500).json({ error: error.message });
  }
}
