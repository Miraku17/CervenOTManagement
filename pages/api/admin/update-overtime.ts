import { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { id, action, adminId } = req.body;

  if (!id || !action || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ message: 'Invalid request parameters' });
  }

  try {
    const now = new Date().toISOString();
    const status = action === 'approve' ? 'approved' : 'rejected';
    
    // Update object
    const updates: any = {
      status,
      approved_at: now,
      updated_at: now,
    };

    // Only add approved_by if it's a valid UUID (simple regex check)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = adminId && uuidRegex.test(adminId);
    if (isValidUUID) {
        updates.reviewer = adminId;
    }

    // If approving, we might want to calculate approved_hours based on attendance, 
    // but for now we'll just update the status. 
    // If we wanted to auto-fill approved_hours, we'd need to fetch the attendance record first.
    
    const { data, error } = await supabase
      .from('overtime')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({ message: `Overtime request ${status}`, data });

  } catch (error: any) {
    console.error('Error updating overtime request:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
