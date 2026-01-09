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

    // If user doesn't have manage_tickets permission, filter by tickets they are servicing
    if (!hasManageTickets) {
      countQuery = countQuery.eq('serviced_by', req.user.id);
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
      .range(from, to)
      .order('created_at', { ascending: false });

    // If user doesn't have manage_tickets permission, filter by tickets they are servicing
    if (!hasManageTickets) {
      query = query.eq('serviced_by', req.user.id);
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
