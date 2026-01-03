'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';
import { Ticket, AlertTriangle, CheckCircle, Clock, Activity, AlertCircle, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';

interface TicketStats {
  total: number;
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  recentActivity: { date: string; count: number }[];
}

export default function TicketOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const isLoading = authLoading || permissionsLoading;

  useEffect(() => {
    const fetchStats = async () => {
      if (isLoading || !user?.id) return;

      // Only fetch if user has permission
      if (!hasPermission('view_ticket_overview')) return;

      setLoadingStats(true);
      try {
        const response = await fetch('/api/tickets/stats');
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
  }, [user?.id, isLoading, hasPermission]);

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

  // Prepare data for charts
  const statusData = [
    { name: 'Open', value: stats.byStatus['Open'] || 0, color: '#3b82f6' }, // blue-500
    { name: 'Pending', value: stats.byStatus['Pending'] || 0, color: '#eab308' }, // yellow-500
    { name: 'Resolved', value: stats.byStatus['Resolved'] || 0, color: '#22c55e' }, // green-500
    { name: 'Closed', value: stats.byStatus['Closed'] || 0, color: '#64748b' }, // slate-500
  ].filter(d => d.value > 0);

  const severityData = [
    { name: 'Critical', value: stats.bySeverity['Critical'] || 0, color: '#ef4444' }, // red-500
    { name: 'High', value: stats.bySeverity['High'] || 0, color: '#f97316' }, // orange-500
    { name: 'Medium', value: stats.bySeverity['Medium'] || 0, color: '#eab308' }, // yellow-500
    { name: 'Low', value: stats.bySeverity['Low'] || 0, color: '#3b82f6' }, // blue-500
  ].filter(d => d.value > 0);

  const activityData = stats.recentActivity;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard Overview</h1>
        <p className="text-slate-400">Real-time insights and performance metrics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Total Tickets</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.total}</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg">
              <Ticket className="text-blue-500" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
            <Activity size={16} />
            <span>All time records</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Open Tickets</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.byStatus['Open'] || 0}</h3>
            </div>
            <div className="p-3 bg-indigo-500/10 rounded-lg">
              <AlertCircle className="text-indigo-500" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-indigo-400">
            <span>Requires attention</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Pending</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.byStatus['Pending'] || 0}</h3>
            </div>
            <div className="p-3 bg-yellow-500/10 rounded-lg">
              <Clock className="text-yellow-500" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-yellow-500/80">
            <span>In progress</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400">Critical Issues</p>
              <h3 className="text-3xl font-bold text-white mt-2">{stats.bySeverity['Critical'] || 0}</h3>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg">
              <AlertTriangle className="text-red-500" size={24} />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-red-400">
            <span>High priority</span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <h3 className="text-lg font-semibold text-white mb-6">Ticket Status Distribution</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.1)" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
          <h3 className="text-lg font-semibold text-white mb-6">Tickets by Severity</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                <Tooltip 
                  cursor={{ fill: '#334155', opacity: 0.2 }}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Trend */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 lg:col-span-2">
          <h3 className="text-lg font-semibold text-white mb-6">Ticket Volume (Last 30 Days)</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  tickFormatter={(str) => {
                    const date = new Date(str);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis stroke="#94a3b8" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
