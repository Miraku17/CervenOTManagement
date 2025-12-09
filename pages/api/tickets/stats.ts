import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Fetch minimal data for aggregation
    const { data, error } = await supabaseAdmin
      .from('tickets')
      .select('id, status, sev, created_at, request_type, store_id, stores(store_name)');

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(200).json({ 
        total: 0, 
        byStatus: {}, 
        bySeverity: {}, 
        recentActivity: [] 
      });
    }

    // Process data
    const total = data.length;
    
    const byStatus = data.reduce((acc: any, ticket) => {
      const status = ticket.status || 'Unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const bySeverity = data.reduce((acc: any, ticket) => {
      const sev = ticket.sev || 'Unknown';
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {});

    // Last 30 days activity
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentActivity = data
      .filter(t => new Date(t.created_at) >= thirtyDaysAgo)
      .reduce((acc: any, ticket) => {
        const date = new Date(ticket.created_at).toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {});

    const activityArray = Object.entries(recentActivity)
      .map(([date, count]) => ({ date, count }))
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json({
      total,
      byStatus,
      bySeverity,
      recentActivity: activityArray
    });

  } catch (error: any) {
    console.error('Error fetching ticket stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch ticket stats' });
  }
}
