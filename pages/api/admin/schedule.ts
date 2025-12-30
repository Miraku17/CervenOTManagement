import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

// Validation Regex
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const DATE_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!['POST', 'PUT', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has required position
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions(name)')
      .eq('id', req.user?.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    const userPosition = userProfile?.positions && (userProfile.positions as any).name;
    const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer'];

    if (!allowedPositions.includes(userPosition)) {
      return res.status(403).json({
        error: 'Forbidden: Only Operations Manager, Technical Support Lead, and Technical Support Engineer can manage schedules'
      });
    }
  } catch (error: any) {
    console.error('Error checking user position:', error);
    return res.status(500).json({ error: 'Failed to verify user permissions' });
  }

  // Handle DELETE request
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Schedule ID is required' });
      }

      const { error: deleteError } = await supabaseAdmin
        .from('working_schedules')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      return res.status(200).json({
        success: true,
        message: 'Schedule entry deleted successfully'
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // Handle POST and PUT requests (create/update)
  try {
    const { employee_id, date, shift_start, shift_end, is_rest_day, id } = req.body;

    // Validation
    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date are required' });
    }

    if (!DATE_REGEX.test(date)) {
      return res.status(400).json({ error: 'Invalid date format (expected YYYY-MM-DD)' });
    }

    if (shift_start && !TIME_REGEX.test(shift_start)) {
      return res.status(400).json({ error: 'Invalid shift_start format (expected HH:MM in 24h format)' });
    }

    if (shift_end && !TIME_REGEX.test(shift_end)) {
      return res.status(400).json({ error: 'Invalid shift_end format (expected HH:MM in 24h format)' });
    }

    // Verify employee exists
    const { data: employeeProfile, error: employeeError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', employee_id)
      .single();

    if (employeeError || !employeeProfile) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Prepare schedule data (don't include ID as it's GENERATED ALWAYS)
    const scheduleData: any = {
      employee_id,
      date,
      shift_start: is_rest_day ? null : shift_start,
      shift_end: is_rest_day ? null : shift_end,
      is_rest_day: is_rest_day || false,
    };

    // Upsert the schedule entry
    // The upsert will automatically update if a record with the same employee_id and date exists
    const { data, error: upsertError } = await supabaseAdmin
      .from('working_schedules')
      .upsert(scheduleData, { onConflict: 'employee_id, date' })
      .select()
      .single();

    if (upsertError) {
      throw upsertError;
    }

    return res.status(200).json({
      success: true,
      message: req.method === 'POST' ? 'Schedule entry created successfully' : 'Schedule entry updated successfully',
      data
    });

  } catch (error: any) {
    console.error('Schedule operation error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
