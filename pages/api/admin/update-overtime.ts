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

    // Add reviewer (admin who approved/rejected)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = adminId && uuidRegex.test(adminId);
    if (isValidUUID) {
      updates.reviewer = adminId;
    } else {
      console.warn('Invalid or missing adminId, reviewer will not be set:', adminId);
    }

    console.log(`Updating overtime request ${id}:`, updates);

    const { data, error } = await supabase
      .from('overtime')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`Overtime request ${status} successfully:`, data);

    // Update is_overtime_approved in attendance table
    if (data && data.attendance_id) {
      const isApproved = status === 'approved';
      console.log(`Updating attendance ${data.attendance_id} is_overtime_approved to ${isApproved}`);

      const { error: attendanceError } = await supabase
        .from('attendance')
        .update({ is_overtime_approved: isApproved })
        .eq('id', data.attendance_id);

      if (attendanceError) {
        console.error('Error updating is_overtime_approved in attendance:', attendanceError);
        // Don't throw - overtime was already updated successfully
      } else {
        console.log(`Successfully updated is_overtime_approved to ${isApproved}`);
      }
    }

    return res.status(200).json({ message: `Overtime request ${status}`, data });

  } catch (error: any) {
    console.error('Error updating overtime request:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
