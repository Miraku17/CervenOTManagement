import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { userId, type, startDate, endDate, reason } = req.body;

  if (!userId || !type || !startDate || !endDate || !reason) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .insert({
        employee_id: userId,
        leave_type: type,
        start_date: startDate,
        end_date: endDate,
        reason: reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ message: 'Leave request submitted successfully', data });
  } catch (error: any) {
    console.error('Error creating leave request:', error);
    return res.status(500).json({ error: error.message || 'Failed to submit leave request.' });
  }
}
