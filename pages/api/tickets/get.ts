import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has manage_tickets permission
    const hasManageTickets = await userHasPermission(req.user.id, 'manage_tickets');

    // Get pagination params
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Get filter params
    const statusFilter = req.query.status as string;
    const searchTerm = req.query.search as string;
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    // Build the base query for counting
    let countQuery = supabaseAdmin
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    // If user doesn't have manage_tickets permission, filter by tickets they are servicing OR unassigned
    if (!hasManageTickets) {
      countQuery = countQuery.or(`serviced_by.eq.${req.user.id},serviced_by.is.null`);
    }

    // Apply status filter (handle both underscore and space formats)
    if (statusFilter && statusFilter !== 'all') {
      // Convert filter to database format (e.g., "in progress" -> "in_progress")
      const dbStatus = statusFilter.toLowerCase().replace(/ /g, '_');
      countQuery = countQuery.eq('status', dbStatus);
    }

    // Apply search filter
    if (searchTerm) {
      countQuery = countQuery.or(`rcc_reference_number.ilike.%${searchTerm}%,request_type.ilike.%${searchTerm}%,device.ilike.%${searchTerm}%`);
    }

    // Apply date range filters
    if (startDate) {
      countQuery = countQuery.gte('date_reported', startDate);
    }
    if (endDate) {
      countQuery = countQuery.lte('date_reported', endDate);
    }

    // Get total count
    const { count: total, error: countError } = await countQuery;

    if (countError) {
      throw countError;
    }

    // Build the query for data
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
      .order('created_at', { ascending: false });

    // If user doesn't have manage_tickets permission, filter by tickets they are servicing OR unassigned
    if (!hasManageTickets) {
      query = query.or(`serviced_by.eq.${req.user.id},serviced_by.is.null`);
    }

    // Apply status filter (handle both underscore and space formats)
    if (statusFilter && statusFilter !== 'all') {
      // Convert filter to database format (e.g., "in progress" -> "in_progress")
      const dbStatus = statusFilter.toLowerCase().replace(/ /g, '_');
      query = query.eq('status', dbStatus);
    }

    // Apply search filter
    if (searchTerm) {
      query = query.or(`rcc_reference_number.ilike.%${searchTerm}%,request_type.ilike.%${searchTerm}%,device.ilike.%${searchTerm}%`);
    }

    // Apply date range filters
    if (startDate) {
      query = query.gte('date_reported', startDate);
    }
    if (endDate) {
      query = query.lte('date_reported', endDate);
    }

    const { data: tickets, error } = await query;

    if (error) {
      throw error;
    }

    // Debug logging
    console.log('Fetching tickets - hasManageTickets:', hasManageTickets, 'Total count:', total, 'Returned:', tickets?.length, 'Page:', page);

    // Log store distribution
    if (tickets && tickets.length > 0) {
      const storeDistribution = tickets.reduce((acc: any, t: any) => {
        const storeId = t.store_id || 'no-store';
        acc[storeId] = (acc[storeId] || 0) + 1;
        return acc;
      }, {});
      console.log('Store distribution in this page:', storeDistribution);
    }

    return res.status(200).json({
      tickets,
      pagination: {
        total: total || 0,
        page,
        limit,
        totalPages: Math.ceil((total || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch tickets' });
  }
}

export default withAuth(handler);
