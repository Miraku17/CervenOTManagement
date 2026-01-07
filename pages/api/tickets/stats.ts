import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check if user has view_ticket_overview permission
  const hasPermission = await userHasPermission(req.user?.id || '', 'view_ticket_overview');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to view ticket statistics'
    });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Get date range from query params
    const { startDate, endDate } = req.query;

    // Build query with date filtering
    let query = supabaseAdmin
      .from('tickets')
      .select(`
        id,
        sev,
        problem_category,
        date_reported,
        stores(store_name),
        serviced_by_user:serviced_by(first_name, last_name)
      `);

    // Apply date filters if provided
    if (startDate && typeof startDate === 'string') {
      query = query.gte('date_reported', startDate);
    }
    if (endDate && typeof endDate === 'string') {
      query = query.lte('date_reported', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(200).json({
        total: 0,
        byStore: [],
        byFieldEngineer: [],
        bySeverity: [],
        byProblemCategory: []
      });
    }

    // Process data
    const total = data.length;

    // 1. Tickets by Store
    const storeMap = new Map<string, number>();
    data.forEach(ticket => {
      const storeName = (ticket.stores as any)?.store_name || 'Unknown';
      storeMap.set(storeName, (storeMap.get(storeName) || 0) + 1);
    });
    const byStore = Array.from(storeMap.entries())
      .map(([store_name, count]) => ({ store_name, count }))
      .sort((a, b) => b.count - a.count);

    // 2. Tickets by Field Engineer
    const feMap = new Map<string, number>();
    data.forEach(ticket => {
      const fe = ticket.serviced_by_user as any;
      const engineerName = fe ? `${fe.first_name} ${fe.last_name}` : 'Unassigned';
      feMap.set(engineerName, (feMap.get(engineerName) || 0) + 1);
    });
    const byFieldEngineer = Array.from(feMap.entries())
      .map(([engineer_name, count]) => ({ engineer_name, count }))
      .sort((a, b) => b.count - a.count);

    // 3. Tickets by Severity
    const sevMap = new Map<string, number>();
    data.forEach(ticket => {
      const severity = ticket.sev || 'Unknown';
      sevMap.set(severity, (sevMap.get(severity) || 0) + 1);
    });
    const bySeverity = Array.from(sevMap.entries())
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => {
        // Sort by severity priority: SEV3, SEV2, SEV1
        const order: Record<string, number> = { 'SEV3': 1, 'SEV2': 2, 'SEV1': 3 };
        return (order[a.severity] || 999) - (order[b.severity] || 999);
      });

    // 4. Top Problem Categories
    const categoryMap = new Map<string, number>();
    data.forEach(ticket => {
      const category = ticket.problem_category || 'Unknown';
      categoryMap.set(category, (categoryMap.get(category) || 0) + 1);
    });
    const byProblemCategory = Array.from(categoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      total,
      byStore,
      byFieldEngineer,
      bySeverity,
      byProblemCategory
    });

  } catch (error: any) {
    console.error('Error fetching ticket stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch ticket stats' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
