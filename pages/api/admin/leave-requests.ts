import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('leave_requests')
      .select(`
        *,
        employee:employee_id (
          id,
          first_name,
          last_name,
          email
        ),
        reviewer:reviewer_id (
          first_name,
          last_name
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return res.status(200).json({ data });
  } catch (error: any) {
    console.error('Error fetching leave requests:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch leave requests' });
  }
}
