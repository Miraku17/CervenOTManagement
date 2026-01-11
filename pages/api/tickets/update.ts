import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Check if user has manage_tickets permission
    const hasManageTickets = await userHasPermission(req.user.id, 'manage_tickets');

    if (!hasManageTickets) {
      return res.status(403).json({
        error: 'Unauthorized: You do not have permission to update tickets'
      });
    }

    // Fetch the existing ticket to get current data for SLA calculation
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('id, serviced_by, date_reported, time_reported, date_resolved, time_resolved, date_ack, time_ack, date_attended, work_end, pause_time_start, pause_time_end')
      .eq('id', id)
      .single();

    if (fetchError || !existingTicket) {
      console.error('Error fetching ticket for update:', fetchError);
      return res.status(404).json({
        error: 'Ticket not found',
        details: fetchError
      });
    }

    // Calculate SLA Count Hours: (Date Attended & Work End) - (Date & Time Acknowledge)
    // If pause exists: SLA Count - (Pause End - Pause Start)
    const dateAck = updateData.date_ack !== undefined ? updateData.date_ack : existingTicket.date_ack;
    const timeAck = updateData.time_ack !== undefined ? updateData.time_ack : existingTicket.time_ack;
    const dateAttended = updateData.date_attended !== undefined ? updateData.date_attended : existingTicket.date_attended;
    const workEnd = updateData.work_end !== undefined ? updateData.work_end : existingTicket.work_end;
    const pauseStart = updateData.pause_time_start !== undefined ? updateData.pause_time_start : existingTicket.pause_time_start;
    const pauseEnd = updateData.pause_time_end !== undefined ? updateData.pause_time_end : existingTicket.pause_time_end;

    if (dateAck && timeAck && dateAttended && workEnd) {
      try {
        // Validate time format (HH:MM or HH:MM:SS)
        const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

        if (!timePattern.test(timeAck)) {
          return res.status(400).json({
            error: 'Invalid time format for Time Acknowledge. Expected format: HH:MM (e.g., 09:30)'
          });
        }

        if (!timePattern.test(workEnd)) {
          return res.status(400).json({
            error: 'Invalid time format for Work End. Expected format: HH:MM (e.g., 17:30)'
          });
        }

        // Validate pause time formats if provided
        if (pauseStart && !timePattern.test(pauseStart)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause Start. Expected format: HH:MM (e.g., 12:00)'
          });
        }

        if (pauseEnd && !timePattern.test(pauseEnd)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause End. Expected format: HH:MM (e.g., 13:00)'
          });
        }

        // Parse acknowledge date and time
        const ackDate = new Date(dateAck);
        const [ackHours, ackMinutes] = timeAck.split(':');
        ackDate.setHours(parseInt(ackHours), parseInt(ackMinutes), 0, 0);

        // Validate acknowledge date is valid
        if (isNaN(ackDate.getTime())) {
          return res.status(400).json({
            error: 'Invalid Date Acknowledge. Please provide a valid date.'
          });
        }

        // Combine Date Attended + Work End time to create full work end timestamp
        const workEndDate = new Date(dateAttended);
        const [workEndHours, workEndMinutes] = workEnd.split(':');
        workEndDate.setHours(parseInt(workEndHours), parseInt(workEndMinutes), 0, 0);

        // Validate date attended is valid
        if (isNaN(workEndDate.getTime())) {
          return res.status(400).json({
            error: 'Invalid Date Attended. Please provide a valid date.'
          });
        }

        // Calculate difference in hours
        const diffInMs = workEndDate.getTime() - ackDate.getTime();

        if (diffInMs < 0) {
          return res.status(400).json({
            error: 'Work End cannot be earlier than Date/Time Acknowledge'
          });
        }

        let diffInHours = diffInMs / (1000 * 60 * 60);

        // Subtract pause time if both pause start and end exist
        if (pauseStart && pauseEnd) {
          // Parse pause times and calculate duration in hours
          const [pStartHours, pStartMinutes] = pauseStart.split(':');
          const [pEndHours, pEndMinutes] = pauseEnd.split(':');

          // Convert to total minutes for easier calculation
          let pauseStartMinutes = parseInt(pStartHours) * 60 + parseInt(pStartMinutes);
          let pauseEndMinutes = parseInt(pEndHours) * 60 + parseInt(pEndMinutes);

          // Validate pause end is after pause start (should be same day)
          if (pauseEndMinutes <= pauseStartMinutes) {
            return res.status(400).json({
              error: 'Pause End must be after Pause Start. Both times should be on the same day.'
            });
          }

          // Calculate pause duration in hours
          const pauseDurationMinutes = pauseEndMinutes - pauseStartMinutes;
          const pauseHours = pauseDurationMinutes / 60;

          // Validate pause duration doesn't exceed total work duration
          if (pauseHours > diffInHours) {
            return res.status(400).json({
              error: 'Pause duration cannot exceed total work duration'
            });
          }

          // Subtract pause duration from total SLA hours
          diffInHours = diffInHours - pauseHours;
        } else if ((pauseStart && !pauseEnd) || (!pauseStart && pauseEnd)) {
          // Validate both pause times are provided together
          return res.status(400).json({
            error: 'Both Pause Start and Pause End must be provided together'
          });
        }

        // Round to 2 decimal places and ensure it's not negative
        updateData.sla_count_hrs = Math.max(0, Math.round(diffInHours * 100) / 100);
      } catch (error) {
        console.error('Error calculating SLA count hours:', error);
        return res.status(400).json({
          error: 'Failed to calculate SLA count hours. Please check all date and time values are correct.'
        });
      }
    } else if (updateData.date_ack === null || updateData.time_ack === null || updateData.date_attended === null || updateData.work_end === null) {
      // If required fields are being cleared, also clear sla_count_hrs
      updateData.sla_count_hrs = null;
    }

    // Update the ticket
    const { data: ticket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        stores (
          store_name,
          store_code
        ),
        stations (
          name
        ),
        reported_by_user:reported_by (
          first_name,
          last_name
        ),
        serviced_by_user:serviced_by (
          first_name,
          last_name
        ),
        manager_on_duty:store_managers (
          manager_name
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({ ticket });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({ error: error.message || 'Failed to update ticket' });
  }
}

export default withAuth(handler);
