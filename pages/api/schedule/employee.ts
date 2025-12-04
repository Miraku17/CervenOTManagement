import type { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from '@/services/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, month, year } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Build date range filter if month and year are provided
    let query = supabase
      .from('working_schedules')
      .select('*')
      .eq('employee_id', userId)
      .order('date', { ascending: true });

    // If month and year are provided, filter by that month
    if (month && year) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      // Fix: Construct endDate manually to avoid timezone shifts from toISOString()
      const lastDay = new Date(Number(year), Number(month), 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      query = query.gte('date', startDate).lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching working schedules:', error);
      return res.status(500).json({ error: 'Failed to fetch working schedules' });
    }

    return res.status(200).json({ schedules: data || [] });
  } catch (error: any) {
    console.error('Error in employee schedule API:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
