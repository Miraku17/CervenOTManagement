'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Calendar, ShieldAlert, Ticket, Store, AlertTriangle, Activity } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/admin_dashboard/StatCard';

interface TicketStats {
  total: number;
  byStore: { store_name: string; count: number }[];
  byFieldEngineer: { engineer_name: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byProblemCategory: { category: string; count: number }[];
}

export default function TicketOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isLoading = authLoading || permissionsLoading;

  useEffect(() => {
    const fetchStats = async () => {
      if (isLoading || !user?.id) return;

      // Only fetch if user has permission
      if (!hasPermission('view_ticket_overview')) return;

      setLoadingStats(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await fetch(`/api/tickets/stats?${params.toString()}`);
        const data = await response.json();
        if (response.ok) {
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.id, isLoading, hasPermission, startDate, endDate]);

  // Show loading while checking permissions
  if (isLoading || loadingStats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">
            {loadingStats ? 'Loading overview...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('view_ticket_overview');

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to view the overview page.</p>
            <p className="text-slate-500 text-sm mt-2">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/ticketing/tickets')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go to Tickets
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Color palette for charts
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#84cc16'];

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl shadow-black/50">
          <p className="text-slate-300 text-xs font-semibold mb-1">{label}</p>
          <p className="text-white text-sm font-bold">
            {payload[0].value} Tickets
          </p>
        </div>
      );
    }
    return null;
  };

  // Prepare data for charts
  const storeData = stats.byStore.slice(0, 10).map((item, index) => ({
    name: item.store_name,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const fieldEngineerData = stats.byFieldEngineer.slice(0, 10).map((item, index) => ({
    name: item.engineer_name,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const severityData = stats.bySeverity.map(item => ({
    name: item.severity,
    value: item.count,
    color: item.severity === 'SEV3' ? '#ef4444' : item.severity === 'SEV2' ? '#f59e0b' : '#3b82f6'
  }));

  const problemCategoryData = stats.byProblemCategory.slice(0, 8).map((item, index) => ({
    name: item.category,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  // Calculate Summary Stats
  const criticalCount = stats.bySeverity.find(s => s.severity === 'SEV3')?.count || 0;
  const criticalPercentage = stats.total > 0 ? ((criticalCount / stats.total) * 100).toFixed(1) : '0';
  
  const topCategory = stats.byProblemCategory[0];
  const topStore = stats.byStore[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Ticketing Analytics</h1>
        <p className="text-slate-400">Analyze ticket performance and trends.</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 text-slate-400 mb-3">
          <Calendar size={18} className="text-white" />
          <span className="text-sm font-medium text-white">Filtered by: Date Range</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="analytics-start-date" className="text-sm text-slate-400 whitespace-nowrap">From:</label>
            <input
              id="analytics-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="analytics-end-date" className="text-sm text-slate-400 whitespace-nowrap">To:</label>
            <input
              id="analytics-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
            />
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
            >
              Clear Dates
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tickets"
          value={stats.total.toString()}
          change={startDate || endDate ? "In selected range" : "All time"}
          icon={<Ticket />}
          color="blue"
        />
        <StatCard
          title="Critical (SEV3)"
          value={criticalCount.toString()}
          change={`${criticalPercentage}% of total`}
          icon={<AlertTriangle />}
          color="rose"
        />
        <StatCard
          title="Top Category"
          value={topCategory?.category || 'N/A'}
          change={topCategory ? `${topCategory.count} tickets` : 'No data'}
          icon={<Activity />}
          color="amber"
        />
        <StatCard
          title="Top Store"
          value={topStore?.store_name || 'N/A'}
          change={topStore ? `${topStore.count} tickets` : 'No data'}
          icon={<Store />}
          color="emerald"
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Tickets Assigned per Store */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Store size={18} className="text-blue-400" />
            Tickets Assigned per Store
          </h3>
          <div className="h-[350px] w-full">
            {storeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeData} margin={{ left: 0, right: 0, bottom: 60, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {storeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 2. Tickets Assigned per FE */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
             <Activity size={18} className="text-purple-400" />
             Tickets Assigned per FE
          </h3>
          <div className="h-[350px] w-full">
            {fieldEngineerData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldEngineerData} layout="vertical" margin={{ left: 100, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={90}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {fieldEngineerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 3. Tickets per Severity */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-400" />
            Tickets per Severity
          </h3>
          <div className="h-[350px] w-full relative">
            {severityData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-slate-300 ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Stats */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[calc(50%+18px)] text-center pointer-events-none">
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 4. Top Drivers in Problem Category */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Ticket size={18} className="text-emerald-400" />
            Problem Categories
          </h3>
          <div className="h-[350px] w-full">
            {problemCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={problemCategoryData} layout="vertical" margin={{ left: 120, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={110}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {problemCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
