import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, Loader2, Filter } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

interface OvertimeRequest {
  id: string;
  created_at: string;
  status: 'pending' | 'approved' | 'rejected';
  comment: string | null;
  approved_hours: number | null;
  attendance: {
    date: string;
    total_minutes: number;
  };
  reviewer?: {
    first_name: string;
    last_name: string;
  } | null;
}

const OvertimeHistory: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
    }
  }, [user?.id]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      
      // Join overtime with attendance to filter by user_id
      const { data, error } = await supabase
        .from('overtime')
        .select(`
          *,
          attendance!inner (
            date,
            total_minutes,
            user_id
          ),
          reviewer:reviewer (
            first_name,
            last_name
          )
        `)
        .eq('attendance.user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching overtime history:', err);
      setError('Failed to load overtime history');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  if (isLoading) {
    return (
      <div id="overtime-history" className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div id="overtime-history" className="space-y-6 animate-fade-in scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Clock className="text-blue-400" />
          Overtime History
        </h2>
        
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock className="text-slate-500" size={32} />
          </div>
          <h3 className="text-lg font-medium text-white mb-1">No {filter !== 'all' ? filter : ''} overtime requests</h3>
          <p className="text-slate-400 text-sm">
            {filter === 'all' 
              ? "You haven't submitted any overtime requests yet." 
              : `You don't have any ${filter} requests.`}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 text-sm uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Duration</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium w-1/3">Comment</th>
                  <th className="px-6 py-4 font-medium">Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm text-slate-300">
                {filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-slate-500" />
                        {new Date(request.attendance.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400">
                      {Math.floor(request.attendance.total_minutes / 60)}h {request.attendance.total_minutes % 60}m
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                        {getStatusIcon(request.status)}
                        <span className="capitalize">{request.status}</span>
                      </div>
                      {request.approved_hours && (
                        <div className="text-xs text-emerald-400 mt-1 ml-1">
                          {request.approved_hours} hrs {request.status}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="truncate max-w-xs" title={request.comment || ''}>
                        {request.comment || '-'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {request.reviewer && request.status !== 'pending' ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs text-slate-400">
                            {request.reviewer.first_name} {request.reviewer.last_name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {filteredRequests.map((request) => (
              <div 
                key={request.id}
                className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2 text-slate-200 font-medium">
                    <Calendar size={18} className="text-blue-400" />
                    {new Date(request.attendance.date).toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    <span className="capitalize">{request.status}</span>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-800/50">
                    <span className="text-slate-500">Total Duration</span>
                    <span className="text-slate-300 font-mono">
                      {Math.floor(request.attendance.total_minutes / 60)}h {request.attendance.total_minutes % 60}m
                    </span>
                  </div>
                  
                  {request.approved_hours && (
                    <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-emerald-500">Approved Hours</span>
                      <span className="text-emerald-400 font-bold">{request.approved_hours} hrs</span>
                    </div>
                  )}

                  {request.comment && (
                    <div className="pt-2">
                      <span className="text-slate-500 text-xs block mb-1">Reason:</span>
                      <p className="text-slate-300 bg-slate-800/30 p-2 rounded-lg italic">
                        "{request.comment}"
                      </p>
                    </div>
                  )}

                  {request.reviewer && request.status !== 'pending' && (
                    <div className="pt-2">
                      <span className="text-slate-500 text-xs block mb-1">Reviewer:</span>
                      <p className="text-slate-400">
                        {request.reviewer.first_name} {request.reviewer.last_name}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OvertimeHistory;