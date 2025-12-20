'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import { History, Search, Filter, Calendar, User, Package, FileText, Loader2 } from 'lucide-react';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  user_id: string;
  user_email: string;
  user_name: string;
  created_at: string;
}

export default function AuditLogsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'store_inventory' | 'asset_inventory'>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Access control check - admin only
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const userRole = profile?.role;

        if (userRole !== 'admin') {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/dashboard');
      }
    };

    checkAccess();
  }, [user, router]);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/audit-logs/get');
      const data = await response.json();
      if (response.ok) {
        setAuditLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'UPDATE':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'DELETE':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getTableDisplayName = (tableName: string) => {
    switch (tableName) {
      case 'store_inventory':
        return 'Store Inventory';
      case 'asset_inventory':
        return 'Asset Inventory';
      default:
        return tableName;
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getChangeSummary = (log: AuditLog) => {
    if (log.action === 'INSERT') {
      return 'New record created';
    } else if (log.action === 'DELETE') {
      return 'Record deleted';
    } else if (log.action === 'UPDATE') {
      return 'Record updated';
    }
    return '';
  };

  const filteredLogs = auditLogs.filter(log => {
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.record_id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === 'all' || log.table_name === filterType;
    const matchesAction = filterAction === 'all' || log.action === filterAction;

    let matchesDate = true;
    if (startDate && endDate) {
      const logDate = new Date(log.created_at);
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      matchesDate = logDate >= start && logDate <= end;
    }

    return matchesSearch && matchesType && matchesAction && matchesDate;
  });

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400">Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <History className="w-8 h-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-white">Audit Logs</h1>
        </div>
        <p className="text-slate-400">Track all changes to inventory records</p>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 space-y-4">
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-5 h-5 text-blue-500" />
          <h2 className="text-lg font-semibold text-white">Filters</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-slate-400 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by user or record ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          </div>

          {/* Inventory Type Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Inventory Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Types</option>
              <option value="store_inventory">Store Inventory</option>
              <option value="asset_inventory">Asset Inventory</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Action</label>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Actions</option>
              <option value="INSERT">Created</option>
              <option value="UPDATE">Updated</option>
              <option value="DELETE">Deleted</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [color-scheme:dark]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Clear Filters */}
        {(searchTerm || filterType !== 'all' || filterAction !== 'all' || startDate || endDate) && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterType('all');
              setFilterAction('all');
              setStartDate('');
              setEndDate('');
            }}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-sm">Total Logs</p>
              <p className="text-2xl font-bold text-white">{filteredLogs.length}</p>
            </div>
            <FileText className="w-8 h-8 text-slate-600" />
          </div>
        </div>
        <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-400 text-sm">Created</p>
              <p className="text-2xl font-bold text-green-400">
                {filteredLogs.filter(log => log.action === 'INSERT').length}
              </p>
            </div>
            <Package className="w-8 h-8 text-green-600/50" />
          </div>
        </div>
        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-400 text-sm">Updated</p>
              <p className="text-2xl font-bold text-blue-400">
                {filteredLogs.filter(log => log.action === 'UPDATE').length}
              </p>
            </div>
            <FileText className="w-8 h-8 text-blue-600/50" />
          </div>
        </div>
        <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-400 text-sm">Deleted</p>
              <p className="text-2xl font-bold text-red-400">
                {filteredLogs.filter(log => log.action === 'DELETE').length}
              </p>
            </div>
            <Package className="w-8 h-8 text-red-600/50" />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/50 text-slate-200 font-medium border-b border-slate-800">
              <tr>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Record ID</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Changes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-400">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No audit logs found</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-500" />
                        <span className="text-slate-300">{formatDate(log.created_at)}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getActionColor(log.action)}`}>
                        {log.action === 'INSERT' ? 'Created' : log.action === 'UPDATE' ? 'Updated' : 'Deleted'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-300">{getTableDisplayName(log.table_name)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs text-slate-400">{log.record_id.substring(0, 8)}...</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-500" />
                        <div>
                          <p className="text-slate-300">{log.user_name}</p>
                          <p className="text-xs text-slate-500">{log.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-slate-400">{getChangeSummary(log)}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
