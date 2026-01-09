import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check permissions - using 'view_ticket_overview' as a proxy for dashboard access
  const hasPermission = await userHasPermission(req.user?.id || '', 'view_ticket_overview');

  if (!hasPermission) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to view ticket dashboard'
    });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Fetch all active/relevant tickets to process in memory or use multiple queries
    // specialized queries are better for performance but raw data might be easier for complex logic
    // Let's do a mix.

    // 1. Fetch all tickets using pagination/batching to bypass the 1000 limit
    let allTickets: any[] = [];
    const PAGE_SIZE = 1000;
    let from = 0;
    let to = PAGE_SIZE - 1;
    let moreData = true;

    while (moreData) {
      const { data, error } = await supabaseAdmin
        .from('tickets')
        .select('id, status, sev, problem_category, serviced_by, sla_status, created_at')
        .range(from, to);

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

    const stats = {
      overdue: 0,
      dueToday: 0,
      open: 0,
      onHold: 0,
      unassigned: 0,
      total: allTickets.length,
      byPriority: [] as { name: string; value: number; color: string }[],
      byStatus: [] as { name: string; value: number }[],
      byCategory: [] as { name: string; value: number }[]
    };

    // Helper to normalize status
    const isUnresolved = (status: string) => !['closed', 'resolved'].includes(status?.toLowerCase());
    const isOpen = (status: string) => ['open', 'new', 'in progress', 'pending'].includes(status?.toLowerCase());

    const priorityMap = new Map<string, number>();
    // Initialize with expected priorities
    priorityMap.set('SEV1', 0);
    priorityMap.set('SEV2', 0);
    priorityMap.set('SEV3', 0);

    const statusMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();

    allTickets.forEach(ticket => {
      const status = ticket.status?.toLowerCase() || 'unknown';
      const slaStatus = ticket.sla_status?.toLowerCase() || '';

      // Overdue
      if (slaStatus.includes('overdue') || slaStatus.includes('breached')) {
        stats.overdue++;
      }

      // Due Today
      if (slaStatus.includes('warning')) {
        stats.dueToday++;
      }

      // Open (Active)
      if (isOpen(status)) {
        stats.open++;
      }

      // On Hold
      if (status === 'on hold' || status === 'on_hold') {
        stats.onHold++;
      }

      // Unassigned
      if (!ticket.serviced_by && status !== 'closed' && status !== 'resolved') {
        stats.unassigned++;
      }

      // Charts Data Construction

      // Unresolved tickets by Priority
      if (isUnresolved(status)) {
        const sev = (ticket.sev || '').toUpperCase();
        if (priorityMap.has(sev)) {
          priorityMap.set(sev, priorityMap.get(sev)! + 1);
        }
      }

      // All tickets by Status (not just unresolved)
      const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
      statusMap.set(displayStatus, (statusMap.get(displayStatus) || 0) + 1);

      // New & Open by Category
      if (isOpen(status)) {
        const cat = ticket.problem_category || 'Other';
        categoryMap.set(cat, (categoryMap.get(cat) || 0) + 1);
      }
    });

    // Format Priority Data
    stats.byPriority = Array.from(priorityMap.entries()).map(([name, value]) => {
      let color = '#3b82f6'; // Blue default
      if (name.toUpperCase() === 'SEV1') color = '#ef4444'; // Red
      if (name.toUpperCase() === 'SEV2') color = '#f59e0b'; // Amber
      if (name.toUpperCase() === 'SEV3') color = '#3b82f6'; // Blue
      return { name, value, color };
    });

    // Format Status Data
    stats.byStatus = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

    // Format Category Data
    stats.byCategory = Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5

    return res.status(200).json(stats);

  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch dashboard stats' });
  }
}

export default withAuth(handler);
