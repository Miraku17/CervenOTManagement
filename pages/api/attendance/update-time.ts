import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { fromZonedTime } from 'date-fns-tz';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Security Check: Verify user has edit_time_entries permission
  if (!req.user || !req.user.id) {
     return res.status(401).json({ error: 'Unauthorized' });
  }

  const hasPermission = await userHasPermission(req.user.id, 'edit_time_entries');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to edit time records.'
    });
  }

  const { attendanceId, timeIn, timeOut, isMarkedAsOvertime, overtimeComment, overtimeStatus, overtimeRequestId, adminId } = req.body;

  console.log('Update Time Request Body:', {
    attendanceId,
    timeIn,
    timeOut,
    isMarkedAsOvertime,
    overtimeComment,
    overtimeStatus,
    overtimeRequestId,
    adminId
  });

  if (!attendanceId) {
    return res.status(400).json({ error: 'Attendance ID is required' });
  }

  if (!timeIn) {
    return res.status(400).json({ error: 'Time In is required' });
  }

  try {
    // Convert PHT to UTC (correct for timestamptz)
    const timeInUTC = fromZonedTime(timeIn, "Asia/Manila").toISOString();
    const timeOutUTC = timeOut ? fromZonedTime(timeOut, "Asia/Manila").toISOString() : null;

    // Update the attendance record (total_minutes is auto-calculated by database)
    const { data, error } = await supabase
      .from('attendance')
      .update({
        time_in: timeInUTC,
        time_out: timeOutUTC,
        updated_at: new Date().toISOString(),
      })
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) throw error;

    // Handle overtime marking and updates
    if (isMarkedAsOvertime === false && overtimeRequestId) {
      // If session is unmarked as overtime, delete the overtime request
      console.log('Deleting overtime request:', overtimeRequestId);
      await supabase
        .from('overtime')
        .delete()
        .eq('id', overtimeRequestId);

      // Reset is_overtime_approved in attendance table
      await supabase
        .from('attendance')
        .update({ is_overtime_approved: false })
        .eq('id', attendanceId);

    } else if (isMarkedAsOvertime === true) {
      // Session is marked as overtime
      if (overtimeRequestId) {
        // Update existing overtime request
        const updates: any = {
          updated_at: new Date().toISOString()
        };

        if (overtimeComment !== undefined) {
          updates.comment = overtimeComment || null;
        }

        if (overtimeStatus !== undefined) {
          updates.status = overtimeStatus;
          // Set approved_at and reviewer when status changes to approved or rejected
          if (overtimeStatus === 'approved' || overtimeStatus === 'rejected') {
            updates.approved_at = new Date().toISOString();
            if (adminId) {
              updates.reviewer = adminId;
            }
          }
        }

        await supabase
          .from('overtime')
          .update(updates)
          .eq('id', overtimeRequestId);

        // Update is_overtime_approved in attendance table when overtime is approved
        if (overtimeStatus === 'approved') {
          console.log('Updating attendance is_overtime_approved to TRUE for attendanceId:', attendanceId);
          const { data: attendanceUpdateData, error: attendanceUpdateError } = await supabase
            .from('attendance')
            .update({ is_overtime_approved: true })
            .eq('id', attendanceId)
            .select();

          if (attendanceUpdateError) {
            console.error('Error updating is_overtime_approved:', attendanceUpdateError);
          } else {
            console.log('Successfully updated is_overtime_approved:', attendanceUpdateData);
          }
        } else if (overtimeStatus === 'rejected') {
          console.log('Updating attendance is_overtime_approved to FALSE for attendanceId:', attendanceId);
          const { data: attendanceUpdateData, error: attendanceUpdateError } = await supabase
            .from('attendance')
            .update({ is_overtime_approved: false })
            .eq('id', attendanceId)
            .select();

          if (attendanceUpdateError) {
            console.error('Error updating is_overtime_approved:', attendanceUpdateError);
          } else {
            console.log('Successfully updated is_overtime_approved:', attendanceUpdateData);
          }
        }
      } else {
        // Create new overtime request
        const { data: attendanceData } = await supabase
          .from('attendance')
          .select('user_id')
          .eq('id', attendanceId)
          .single();

        if (attendanceData) {
          const { data: newOvertimeRequest } = await supabase
            .from('overtime')
            .insert({
              attendance_id: attendanceId,
              requested_by: attendanceData.user_id,
              comment: overtimeComment || null,
              status: overtimeStatus || 'pending',
              requested_at: new Date().toISOString()
            })
            .select()
            .single();

          console.log('Created new overtime request:', newOvertimeRequest);

          // Update is_overtime_approved if status is approved
          if (overtimeStatus === 'approved') {
            await supabase
              .from('attendance')
              .update({ is_overtime_approved: true })
              .eq('id', attendanceId);
          }
        }
      }
    }

    return res.status(200).json({
      message: 'Attendance updated successfully',
      attendance: data
    });

  } catch (error: any) {
    console.error('Update attendance error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to update attendance'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
