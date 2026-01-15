import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check if user has permission to export ticket data
  const hasPermission = await userHasPermission(req.user?.id || '', 'view_ticket_overview');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to export ticket data'
    });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get date range from query params
    const { startDate, endDate } = req.query;

    // Check if user has manage_tickets permission
    const hasManageTickets = await userHasPermission(req.user?.id || '', 'manage_tickets');

    // Fetch all tickets using pagination to bypass 1000 limit
    let allTickets: any[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let to = PAGE_SIZE - 1;
    let moreData = true;

    while (moreData) {
      let query = supabaseAdmin
        .from('tickets')
        .select(`
          id,
          store_id,
          station_id,
          mod_id,
          reported_by,
          serviced_by,
          rcc_reference_number,
          date_reported,
          time_reported,
          date_responded,
          time_responded,
          request_type_id,
          request_type,
          device,
          request_detail,
          problem_category_id,
          problem_category,
          sev,
          action_taken,
          final_resolution,
          status,
          parts_replaced,
          new_parts_serial,
          old_parts_serial,
          date_ack,
          time_ack,
          date_attended,
          store_arrival,
          work_start,
          pause_time_start,
          pause_time_end,
          pause_time_start_2,
          pause_time_end_2,
          work_end,
          date_resolved,
          time_resolved,
          sla_count_hrs,
          downtime,
          sla_status,
          created_at,
          kb_id,
          stores:store_id (
            id,
            store_name,
            store_code
          ),
          stations:station_id (
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
          request_types:request_type_id (
            id,
            name
          ),
          problem_categories:problem_category_id (
            id,
            name
          ),
          store_managers:mod_id (
            id,
            manager_name
          )
        `)
        .range(from, to)
        .order('date_reported', { ascending: false });

      // If user doesn't have manage_tickets permission, filter by tickets they are servicing OR unassigned
      if (!hasManageTickets) {
        query = query.or(`serviced_by.eq.${req.user?.id},serviced_by.is.null`);
      }

      // Apply date filters if provided
      if (startDate && typeof startDate === 'string') {
        query = query.gte('date_reported', startDate);
      }
      if (endDate && typeof endDate === 'string') {
        query = query.lte('date_reported', endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data && data.length > 0) {
        allTickets = allTickets.concat(data);
        if (data.length < PAGE_SIZE) {
          moreData = false;
        } else {
          from += PAGE_SIZE;
          to += PAGE_SIZE;
        }
      } else {
        moreData = false;
      }
    }

    console.log('Export - hasManageTickets:', hasManageTickets, 'Total tickets:', allTickets.length);

    if (allTickets.length === 0) {
      return res.status(200).json({ tickets: [] });
    }

    return res.status(200).json({ tickets: allTickets });

  } catch (error: any) {
    console.error('Error exporting ticket data:', error);
    return res.status(500).json({ error: error.message || 'Failed to export ticket data' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
