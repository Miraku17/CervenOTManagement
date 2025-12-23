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

    // Check for restricted positions
    const userPosition = req.user.position?.toLowerCase() || '';
    const restrictedPositions = ['asset', 'asset lead', 'asset associate'];
    if (restrictedPositions.includes(userPosition)) {
      return res.status(403).json({ error: 'Forbidden: Access denied for your position' });
    }

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Fetch the ticket to check authorization
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('id, serviced_by')
      .eq('id', id)
      .single();

    if (fetchError || !existingTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
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
