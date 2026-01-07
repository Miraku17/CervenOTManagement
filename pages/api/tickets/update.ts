import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

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

    // Fetch the existing ticket to check authorization and get current data
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('id, serviced_by, date_reported, time_reported, date_resolved, time_resolved')
      .eq('id', id)
      .single();

    if (fetchError || !existingTicket) {
      console.error('Error fetching ticket for update:', fetchError);
      return res.status(404).json({ 
        error: 'Ticket not found', 
        details: fetchError 
      });
    }

    // Authorization check: Only admin or assigned employee can update
    const isAdmin = req.user.role === 'admin';
    const isAssignedEmployee = existingTicket.serviced_by === req.user.id;

    if (!isAdmin && !isAssignedEmployee) {
      return res.status(403).json({
        error: 'Unauthorized: Only admins or the assigned employee can update this ticket'
      });
    }

    // Remove fields that shouldn't be updated by non-admins
    if (!isAdmin) {
      // Non-admins cannot change who the ticket is assigned to
      delete updateData.serviced_by;
      delete updateData.reported_by;
      delete updateData.store_id;
      delete updateData.station_id;
      delete updateData.mod_id;
      delete updateData.sev;
    }

    // Calculate SLA Count Hours if date_resolved and time_resolved are available
    const dateReported = updateData.date_reported || existingTicket.date_reported;
    const timeReported = updateData.time_reported || existingTicket.time_reported;
    const dateResolved = updateData.date_resolved || existingTicket.date_resolved;
    const timeResolved = updateData.time_resolved || existingTicket.time_resolved;

    if (dateReported && timeReported && dateResolved && timeResolved) {
      try {
        // Parse reported date and time
        const reportedDate = new Date(dateReported);
        const [reportedHours, reportedMinutes] = timeReported.split(':');
        reportedDate.setHours(parseInt(reportedHours), parseInt(reportedMinutes), 0, 0);

        // Parse resolved date and time
        const resolvedDate = new Date(dateResolved);
        const [resolvedHours, resolvedMinutes] = timeResolved.split(':');
        resolvedDate.setHours(parseInt(resolvedHours), parseInt(resolvedMinutes), 0, 0);

        // Calculate difference in hours
        const diffInMs = resolvedDate.getTime() - reportedDate.getTime();

        if (diffInMs < 0) {
          return res.status(400).json({ error: 'Date Resolved cannot be earlier than Date Reported' });
        }

        const diffInHours = diffInMs / (1000 * 60 * 60);

        // Round to 2 decimal places and ensure it's not negative
        updateData.sla_count_hrs = Math.max(0, Math.round(diffInHours * 100) / 100);
      } catch (error) {
        console.error('Error calculating SLA count hours:', error);
        // Continue without setting sla_count_hrs if calculation fails
      }
    } else if (updateData.date_resolved === null || updateData.time_resolved === null) {
      // If date_resolved or time_resolved is being cleared, also clear sla_count_hrs
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
