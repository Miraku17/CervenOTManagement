import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Security Check: Verify user has edit_time_entries permission
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasPermission = await userHasPermission(req.user.id, 'edit_time_entries');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to add time records.'
    });
  }

  const { userId, timeIn, timeOut, isMarkedAsOvertime, overtimeComment, overtimeStatus, adminId } = req.body;

  console.log('Add Time Request Body:', {
    userId,
    timeIn,
    timeOut,
    isMarkedAsOvertime,
    overtimeComment,
    overtimeStatus,
    adminId
  });

  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  if (!timeIn) {
    return res.status(400).json({ error: 'Time In is required' });
  }

  if (!timeOut) {
    return res.status(400).json({ error: 'Time Out is required' });
  }

  try {
    // Convert PHT to UTC (correct for timestamptz)
    const timeInUTC = fromZonedTime(timeIn, "Asia/Manila").toISOString();
    const timeOutUTC = fromZonedTime(timeOut, "Asia/Manila").toISOString();

    // Validate timeOut is after timeIn
    if (new Date(timeOutUTC) <= new Date(timeInUTC)) {
      return res.status(400).json({ error: 'Time Out must be after Time In' });
    }

    // Extract date from timeIn (in Philippine timezone)
    const PHILIPPINE_TZ = 'Asia/Manila';
    const date = formatInTimeZone(new Date(timeInUTC), PHILIPPINE_TZ, 'yyyy-MM-dd');

    // Create new attendance record
    const { data: attendance, error: insertError } = await supabase
      .from('attendance')
      .insert({
        user_id: userId,
        date: date,
        time_in: timeInUTC,
        time_out: timeOutUTC,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Handle overtime if marked
    if (isMarkedAsOvertime === true && attendance) {
      const { data: newOvertimeRequest, error: overtimeError } = await supabase
        .from('overtime')
        .insert({
          attendance_id: attendance.id,
          requested_by: userId,
          comment: overtimeComment || null,
          status: overtimeStatus || 'pending',
          requested_at: new Date().toISOString(),
          ...(overtimeStatus === 'approved' || overtimeStatus === 'rejected' ? {
            approved_at: new Date().toISOString(),
            reviewer: adminId
          } : {})
        })
        .select()
        .single();

      if (overtimeError) {
        console.error('Error creating overtime request:', overtimeError);
      } else {
        console.log('Created overtime request:', newOvertimeRequest);
      }

      // Update is_overtime_approved if status is approved
      if (overtimeStatus === 'approved') {
        await supabase
          .from('attendance')
          .update({ is_overtime_approved: true })
          .eq('id', attendance.id);
      }
    }

    return res.status(201).json({
      message: 'Attendance record added successfully',
      attendance
    });

  } catch (error: any) {
    console.error('Add attendance error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to add attendance record'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
