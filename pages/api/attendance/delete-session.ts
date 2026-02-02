import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Security Check: Verify user has edit_time_entries permission
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasPermission = await userHasPermission(req.user.id, 'edit_time_entries');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to delete time records.'
    });
  }

  const { attendanceId } = req.body;

  if (!attendanceId) {
    return res.status(400).json({ error: 'Attendance ID is required' });
  }

  try {
    // First, check if the attendance record exists
    const { data: attendanceRecord, error: fetchError } = await supabase
      .from('attendance')
      .select('id, user_id')
      .eq('id', attendanceId)
      .single();

    if (fetchError || !attendanceRecord) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    // Delete any associated overtime requests first
    const { error: overtimeDeleteError } = await supabase
      .from('overtime')
      .delete()
      .eq('attendance_id', attendanceId);

    if (overtimeDeleteError) {
      console.error('Error deleting overtime request:', overtimeDeleteError);
      // Continue even if overtime delete fails - the attendance record might not have an overtime request
    }

    // Delete the attendance record
    const { error: deleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('id', attendanceId);

    if (deleteError) {
      throw deleteError;
    }

    return res.status(200).json({
      message: 'Session deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete session error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete session'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
