import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

// Aggregated stats for the accounting top-expense dashboard (Cash Advances + Liquidations).
// Aggregation happens in Node; row volumes are small (hundreds per month).

const EXPENSE_COLUMNS = [
  { key: 'jeep', label: 'Jeep' },
  { key: 'bus', label: 'Bus' },
  { key: 'fx_van', label: 'FX/Van' },
  { key: 'gas', label: 'Gas' },
  { key: 'toll', label: 'Toll' },
  { key: 'meals', label: 'Meals' },
  { key: 'lodging', label: 'Lodging' },
  { key: 'tools', label: 'Tools' },
  { key: 'supplies', label: 'Supplies' },
  { key: 'mobility_transport', label: 'Mobility/Transport' },
  { key: 'others', label: 'Others' },
] as const;

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

    const hasAccess = await userHasPermission(req.user.id, 'view_accounting_dashboard');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view the accounting dashboard' });
    }

    // Default range: last 30 days
    const endDate = (req.query.endDate as string) || new Date().toISOString().split('T')[0];
    const startDate =
      (req.query.startDate as string) ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const statusFilter = (req.query.status as string) || 'all'; // 'all' | 'approved'

    // ---- Liquidations (with items, employee, store) ----
    let liqQuery = supabaseAdmin
      .from('liquidations')
      .select(`
        id,
        user_id,
        store_id,
        total_amount,
        return_to_company,
        reimbursement,
        status,
        liquidation_date,
        stores:store_id (
          store_name,
          store_code
        ),
        liquidation_items (
          jeep, bus, fx_van, gas, toll, meals, lodging, tools, supplies, mobility_transport, others, total
        )
      `)
      .gte('liquidation_date', startDate)
      .lte('liquidation_date', endDate)
      .limit(5000);

    if (statusFilter === 'approved') {
      liqQuery = liqQuery.eq('status', 'approved');
    }

    const { data: liquidations, error: liqError } = await liqQuery;
    if (liqError) throw liqError;

    // ---- Cash advances (with requester) ----
    let caQuery = supabaseAdmin
      .from('cash_advances')
      .select(`
        id,
        type,
        amount,
        status,
        date_requested,
        requested_by,
        profiles:requested_by (
          first_name,
          last_name
        )
      `)
      .is('deleted_at', null)
      .gte('date_requested', `${startDate}T00:00:00`)
      .lte('date_requested', `${endDate}T23:59:59`)
      .limit(5000);

    if (statusFilter === 'approved') {
      caQuery = caQuery.eq('status', 'approved');
    }

    const { data: cashAdvances, error: caError } = await caQuery;
    if (caError) throw caError;

    // liquidations.user_id references auth.users, so profiles can't be embedded —
    // fetch them in a second query and map manually (same pattern as /api/liquidation/get)
    const liqUserIds = Array.from(
      new Set((liquidations || []).map((l) => l.user_id).filter(Boolean))
    );
    let liqProfilesMap: Record<string, { first_name: string; last_name: string }> = {};
    if (liqUserIds.length > 0) {
      const { data: liqProfiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', liqUserIds);
      if (profilesError) throw profilesError;
      liqProfilesMap = (liqProfiles || []).reduce((acc, p) => {
        acc[p.id] = { first_name: p.first_name, last_name: p.last_name };
        return acc;
      }, {} as Record<string, { first_name: string; last_name: string }>);
    }

    // ---- Aggregate ----
    const num = (v: unknown) => Number(v) || 0;
    const personName = (p: any) =>
      p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown' : 'Unknown';

    // Liquidation totals + by-category
    let liquidationTotal = 0;
    let returnToCompany = 0;
    let reimbursement = 0;
    const byCategoryMap: Record<string, number> = {};
    const byEmployeeMap = new Map<string, { name: string; amount: number; count: number }>();
    const byStoreMap = new Map<string, { name: string; code: string; amount: number; count: number }>();

    for (const liq of liquidations || []) {
      liquidationTotal += num(liq.total_amount);
      returnToCompany += num(liq.return_to_company);
      reimbursement += num(liq.reimbursement);

      for (const item of (liq.liquidation_items as any[]) || []) {
        for (const col of EXPENSE_COLUMNS) {
          byCategoryMap[col.key] = (byCategoryMap[col.key] || 0) + num(item[col.key]);
        }
      }

      const empKey = liq.user_id || 'unknown';
      const emp = byEmployeeMap.get(empKey) || {
        name: personName(liq.user_id ? liqProfilesMap[liq.user_id] : null),
        amount: 0,
        count: 0,
      };
      emp.amount += num(liq.total_amount);
      emp.count += 1;
      byEmployeeMap.set(empKey, emp);

      if (liq.store_id && liq.stores) {
        const store = liq.stores as any;
        const st = byStoreMap.get(liq.store_id) || {
          name: store.store_name || 'Unknown',
          code: store.store_code || '',
          amount: 0,
          count: 0,
        };
        st.amount += num(liq.total_amount);
        st.count += 1;
        byStoreMap.set(liq.store_id, st);
      }
    }

    // Cash advance aggregates
    let caTotal = 0;
    const caByTypeMap: Record<string, { amount: number; count: number }> = {};
    const caByStatusMap: Record<string, { amount: number; count: number }> = {};
    const caByEmployeeMap = new Map<string, { name: string; amount: number; count: number }>();

    for (const ca of cashAdvances || []) {
      caTotal += num(ca.amount);

      const type = (ca.type as string) || 'unknown';
      caByTypeMap[type] = caByTypeMap[type] || { amount: 0, count: 0 };
      caByTypeMap[type].amount += num(ca.amount);
      caByTypeMap[type].count += 1;

      const status = (ca.status as string) || 'unknown';
      caByStatusMap[status] = caByStatusMap[status] || { amount: 0, count: 0 };
      caByStatusMap[status].amount += num(ca.amount);
      caByStatusMap[status].count += 1;

      const empKey = ca.requested_by || 'unknown';
      const emp = caByEmployeeMap.get(empKey) || { name: personName(ca.profiles), amount: 0, count: 0 };
      emp.amount += num(ca.amount);
      emp.count += 1;
      caByEmployeeMap.set(empKey, emp);
    }

    const topN = <T,>(arr: T[], by: (x: T) => number, n = 10) =>
      [...arr].sort((a, b) => by(b) - by(a)).slice(0, n);

    return res.status(200).json({
      range: { startDate, endDate, status: statusFilter },
      totals: {
        liquidationTotal,
        liquidationCount: liquidations?.length || 0,
        returnToCompany,
        reimbursement,
        caTotal,
        caCount: cashAdvances?.length || 0,
      },
      byCategory: EXPENSE_COLUMNS.map((col) => ({
        key: col.key,
        label: col.label,
        amount: byCategoryMap[col.key] || 0,
      })).filter((c) => c.amount > 0),
      byEmployee: topN(Array.from(byEmployeeMap.values()), (e) => e.amount),
      byStore: topN(Array.from(byStoreMap.values()), (s) => s.amount),
      caByType: Object.entries(caByTypeMap).map(([type, v]) => ({ type, ...v })),
      caByStatus: Object.entries(caByStatusMap).map(([status, v]) => ({ status, ...v })),
      caByEmployee: topN(Array.from(caByEmployeeMap.values()), (e) => e.amount),
    });
  } catch (error: any) {
    console.error('Error fetching accounting dashboard stats:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch accounting dashboard stats' });
  }
}

export default withAuth(handler);
