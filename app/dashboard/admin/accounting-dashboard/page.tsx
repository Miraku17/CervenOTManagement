"use client"
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  Receipt,
  Printer,
  Calendar,
  ShieldAlert,
  AlertCircle,
  Undo2,
  HandCoins,
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { usePermissions } from '@/hooks/usePermissions';
import { StatCard } from '@/components/admin_dashboard/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardStats {
  range: { startDate: string; endDate: string; status: string };
  totals: {
    liquidationTotal: number;
    liquidationCount: number;
    returnToCompany: number;
    reimbursement: number;
    caTotal: number;
    caCount: number;
  };
  byCategory: { key: string; label: string; amount: number }[];
  byEmployee: { name: string; amount: number; count: number }[];
  byStore: { name: string; code: string; amount: number; count: number }[];
  caByType: { type: string; amount: number; count: number }[];
  caByStatus: { status: string; amount: number; count: number }[];
  caByEmployee: { name: string; amount: number; count: number }[];
}

const formatPeso = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

const formatPesoCompact = (value: number) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value || 0);

const fetchStats = async (startDate: string, endDate: string, status: string): Promise<DashboardStats> => {
  const params = new URLSearchParams({ startDate, endDate, status });
  const response = await fetch(`/api/accounting/dashboard-stats?${params.toString()}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Failed to fetch dashboard stats');
  }
  return body;
};

// Single-hue horizontal bar chart for ranked magnitude data.
// One series per chart, so identity never depends on color (no legend needed).
const RankedBarChart = ({
  data,
  color,
  height = 280,
}: {
  data: { name: string; amount: number }[];
  color: string;
  height?: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
      <CartesianGrid horizontal={false} stroke="#334155" strokeOpacity={0.4} />
      <XAxis
        type="number"
        tickFormatter={(v) => formatPesoCompact(Number(v))}
        tick={{ fill: '#94a3b8', fontSize: 11 }}
        axisLine={{ stroke: '#334155' }}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey="name"
        width={130}
        tick={{ fill: '#cbd5e1', fontSize: 12 }}
        axisLine={{ stroke: '#334155' }}
        tickLine={false}
      />
      <Tooltip
        cursor={{ fill: '#33415533' }}
        formatter={(value) => [formatPeso(Number(value)), 'Amount']}
        contentStyle={{
          backgroundColor: '#0f172a',
          border: '1px solid #334155',
          borderRadius: '8px',
          color: '#e2e8f0',
        }}
        labelStyle={{ color: '#e2e8f0' }}
      />
      <Bar
        dataKey="amount"
        fill={color}
        radius={[0, 4, 4, 0]}
        barSize={18}
        label={{
          position: 'right',
          fill: '#94a3b8',
          fontSize: 11,
          formatter: (v) => formatPesoCompact(Number(v) || 0),
        }}
      />
    </BarChart>
  </ResponsiveContainer>
);

const BreakdownTable = ({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) => (
  <div className="overflow-x-auto mt-4">
    <table className="w-full text-sm">
      <thead>
        <tr className="text-slate-400 border-b border-slate-800 print:text-black print:border-slate-300">
          {headers.map((h, i) => (
            <th key={h} className={`py-2 px-3 font-medium ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr
            key={ri}
            className="border-b border-slate-800/60 last:border-0 text-slate-300 print:text-black print:border-slate-200"
          >
            {row.map((cell, ci) => (
              <td key={ci} className={`py-1.5 px-3 ${ci === 0 ? 'text-left' : 'text-right font-mono'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default function AccountingDashboardPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();

  const today = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<'all' | 'approved'>('all');

  const hasAccess = hasPermission('view_accounting_dashboard');

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['accounting-dashboard', startDate, endDate, statusFilter],
    queryFn: () => fetchStats(startDate, endDate, statusFilter),
    enabled: !permissionsLoading && hasAccess,
    staleTime: 60000,
  });

  if (permissionsLoading || (hasAccess && isLoading)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading accounting dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to view the accounting dashboard.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/admin')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Dashboard</h3>
            <p className="text-slate-400">{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const employeeChartData = stats.byEmployee.map((e) => ({ name: e.name, amount: e.amount }));
  const categoryChartData = [...stats.byCategory]
    .sort((a, b) => b.amount - a.amount)
    .map((c) => ({ name: c.label, amount: c.amount }));
  const storeChartData = stats.byStore.map((s) => ({
    name: s.code ? `${s.name} (${s.code})` : s.name,
    amount: s.amount,
  }));
  const caEmployeeChartData = stats.caByEmployee.map((e) => ({ name: e.name, amount: e.amount }));

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print styles: hide app chrome, white background */}
      <style>{`
        @media print {
          aside, header, nav { display: none !important; }
          body, main, .print-white { background: #ffffff !important; }
          main { overflow: visible !important; }
          .print-hide { display: none !important; }
          .print-show { display: block !important; }
          .print-break { break-inside: avoid; }
        }
      `}</style>

      {/* Print-only report header */}
      <div className="hidden print-show">
        <h1 className="text-2xl font-bold text-black">Accounting Top Expense Report</h1>
        <p className="text-slate-600 text-sm">
          Period: {format(new Date(startDate), 'MMM d, yyyy')} – {format(new Date(endDate), 'MMM d, yyyy')}
          {' · '}Scope: {statusFilter === 'approved' ? 'Approved only' : 'All statuses'}
          {' · '}Generated: {format(new Date(), 'MMM d, yyyy h:mm a')}
        </p>
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print-hide">
        <div>
          <h1 className="text-2xl font-bold text-white">Accounting Dashboard</h1>
          <p className="text-slate-400">Top expenses across cash advances and liquidations.</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20 w-fit"
        >
          <Printer size={18} />
          <span>Print Report</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex flex-col lg:flex-row gap-4 print-hide">
        <div className="flex items-center gap-2 text-slate-400">
          <Calendar size={18} className="flex-shrink-0 text-white" />
          <span className="text-sm font-medium whitespace-nowrap">Date Range:</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
          />
          <div className="flex rounded-lg border border-slate-700 overflow-hidden">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                statusFilter === 'approved'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:text-white'
              }`}
            >
              Approved Only
            </button>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print-break">
        <StatCard
          title="Total Liquidated"
          value={formatPeso(stats.totals.liquidationTotal)}
          change={`${stats.totals.liquidationCount} liquidations`}
          icon={<Receipt size={20} />}
          color="blue"
        />
        <StatCard
          title="Total Cash Advances"
          value={formatPeso(stats.totals.caTotal)}
          change={`${stats.totals.caCount} requests`}
          icon={<Wallet size={20} />}
          color="amber"
        />
        <StatCard
          title="Reimbursements"
          value={formatPeso(stats.totals.reimbursement)}
          change="Owed to employees"
          icon={<HandCoins size={20} />}
          color="violet"
        />
        <StatCard
          title="Return to Company"
          value={formatPeso(stats.totals.returnToCompany)}
          change="Unspent cash advances"
          icon={<Undo2 size={20} />}
          color="emerald"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 print:block">
        {/* Top employees by liquidation spend */}
        <Card className="bg-slate-900 border-slate-800 print-break print:bg-white print:border-slate-300">
          <CardHeader>
            <CardTitle className="text-white text-lg print:text-black">Top Expenses by Employee (Liquidation)</CardTitle>
          </CardHeader>
          <CardContent>
            {employeeChartData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No liquidation data in this period.</p>
            ) : (
              <>
                <div className="print-hide">
                  <RankedBarChart data={employeeChartData} color="#3b82f6" />
                </div>
                <BreakdownTable
                  headers={['Employee', 'Liquidations', 'Amount']}
                  rows={stats.byEmployee.map((e) => [e.name, e.count, formatPeso(e.amount)])}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Top CA requesters */}
        <Card className="bg-slate-900 border-slate-800 print-break print:bg-white print:border-slate-300">
          <CardHeader>
            <CardTitle className="text-white text-lg print:text-black">Top Cash Advances by Employee</CardTitle>
          </CardHeader>
          <CardContent>
            {caEmployeeChartData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No cash advance data in this period.</p>
            ) : (
              <>
                <div className="print-hide">
                  <RankedBarChart data={caEmployeeChartData} color="#f59e0b" />
                </div>
                <BreakdownTable
                  headers={['Employee', 'Requests', 'Amount']}
                  rows={stats.caByEmployee.map((e) => [e.name, e.count, formatPeso(e.amount)])}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Expense category breakdown */}
        <Card className="bg-slate-900 border-slate-800 print-break print:bg-white print:border-slate-300">
          <CardHeader>
            <CardTitle className="text-white text-lg print:text-black">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No expense data in this period.</p>
            ) : (
              <>
                <div className="print-hide">
                  <RankedBarChart data={categoryChartData} color="#8b5cf6" height={320} />
                </div>
                <BreakdownTable
                  headers={['Category', 'Amount', '% of Total']}
                  rows={categoryChartData.map((c) => [
                    c.name,
                    formatPeso(c.amount),
                    `${((c.amount / (stats.totals.liquidationTotal || 1)) * 100).toFixed(1)}%`,
                  ])}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Top stores */}
        <Card className="bg-slate-900 border-slate-800 print-break print:bg-white print:border-slate-300">
          <CardHeader>
            <CardTitle className="text-white text-lg print:text-black">Top Expenses by Store</CardTitle>
          </CardHeader>
          <CardContent>
            {storeChartData.length === 0 ? (
              <p className="text-slate-500 text-sm py-8 text-center">No store-linked liquidations in this period.</p>
            ) : (
              <>
                <div className="print-hide">
                  <RankedBarChart data={storeChartData} color="#06b6d4" />
                </div>
                <BreakdownTable
                  headers={['Store', 'Liquidations', 'Amount']}
                  rows={stats.byStore.map((s) => [
                    s.code ? `${s.name} (${s.code})` : s.name,
                    s.count,
                    formatPeso(s.amount),
                  ])}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* CA by type & status */}
        <Card className="bg-slate-900 border-slate-800 print-break print:bg-white print:border-slate-300 xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-white text-lg print:text-black">Cash Advance Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-400 print:text-black">By Type</h4>
                <BreakdownTable
                  headers={['Type', 'Requests', 'Amount']}
                  rows={stats.caByType.map((t) => [
                    t.type.charAt(0).toUpperCase() + t.type.slice(1),
                    t.count,
                    formatPeso(t.amount),
                  ])}
                />
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-400 print:text-black">By Status</h4>
                <BreakdownTable
                  headers={['Status', 'Requests', 'Amount']}
                  rows={stats.caByStatus.map((s) => [
                    s.status.charAt(0).toUpperCase() + s.status.slice(1),
                    s.count,
                    formatPeso(s.amount),
                  ])}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
