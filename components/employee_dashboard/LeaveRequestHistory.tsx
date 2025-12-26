import React, { useState, useEffect } from 'react';
import { Calendar, CheckCircle, XCircle, Clock, AlertCircle, Filter, CalendarDays, Loader2 } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, parseISO } from 'date-fns';
import { LeaveRequestDetailModal } from '@/components/LeaveRequestDetailModal';

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: 'pending' | 'approved' | 'rejected';
  reason: string;
  created_at: string;
  reviewer?: {
    first_name: string;
    last_name: string;
  } | null;
  reviewer_comment?: string | null;
}

interface LeaveRequestHistoryProps {
  refreshTrigger?: number;
}

const LeaveRequestHistory: React.FC<LeaveRequestHistoryProps> = ({ refreshTrigger = 0 }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
    }
  }, [user?.id, refreshTrigger]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('leave_requests')
        .select(`
          *,
          reviewer:reviewer_id (
            first_name,
            last_name
          ),
          reviewer_comment
        `)
        .eq('employee_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (err: any) {
      console.error('Error fetching leave requests:', err);
      setError('Failed to load leave history');
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

  const calculateDuration = (start: string, end: string) => {
    try {
      const diff = differenceInDays(parseISO(end), parseISO(start)) + 1;
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const handleRowClick = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
  };

  if (isLoading) {
    return (
      <div id="leave-history" className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div id="leave-history" className="space-y-6 animate-fade-in scroll-mt-24">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-400" />
          Leave Requests
        </h2>
        
        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
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
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CalendarDays className="text-slate-500" size={24} />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">No {filter !== 'all' ? filter : ''} leave requests</h3>
          <p className="text-slate-400 text-xs">
            {filter === 'all' 
              ? "You haven't submitted any leave requests yet." 
              : `You don't have any ${filter} requests.`}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Dates</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 w-1/4">Reason</th>
                  <th className="px-6 py-4">Reviewer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-sm">
                {filteredRequests.map((request) => {
                  const duration = calculateDuration(request.start_date, request.end_date);
                  return (
                    <tr
                      key={request.id}
                      className="hover:bg-slate-800/30 transition-colors cursor-pointer group"
                      onClick={() => handleRowClick(request)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800/80 border border-slate-700 text-xs font-medium text-blue-300">
                          {request.leave_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col text-xs">
                          <span className="text-slate-200 font-medium">From: {new Date(request.start_date).toLocaleDateString()}</span>
                          <span className="text-slate-400">To: {new Date(request.end_date).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-400 text-xs">
                        {duration} day{duration !== 1 ? 's' : ''}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          <span className="capitalize">{request.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="truncate max-w-[200px] text-slate-400" title={request.reason}>
                          {request.reason}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {request.reviewer ? (
                          <span className="text-xs text-slate-400">
                            {request.reviewer.first_name} {request.reviewer.last_name}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredRequests.map((request) => {
              const duration = calculateDuration(request.start_date, request.end_date);
              return (
                <div
                  key={request.id}
                  className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-5 hover:border-blue-500/50 transition-all cursor-pointer shadow-sm hover:shadow-md"
                  onClick={() => handleRowClick(request)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs font-medium text-blue-300">
                        {request.leave_type}
                      </span>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      <span className="capitalize">{request.status}</span>
                    </div>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-slate-800/50">
                      <span className="text-slate-500 text-xs">Duration</span>
                      <span className="text-slate-300 font-mono text-xs font-medium">
                        {duration} day{duration !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 py-2 border-b border-slate-800/50">
                      <div>
                        <span className="text-slate-500 text-[10px] uppercase block font-semibold">From</span>
                        <span className="text-slate-300 text-sm">{new Date(request.start_date).toLocaleDateString()}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 text-[10px] uppercase block font-semibold">To</span>
                        <span className="text-slate-300 text-sm">{new Date(request.end_date).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="pt-2">
                      <span className="text-slate-500 text-[10px] uppercase block mb-1 font-semibold">Reason:</span>
                      <p className="text-slate-300 bg-slate-800/50 p-2 rounded-lg italic text-xs">
                        &quot;{request.reason}&quot;
                      </p>
                    </div>
                    
                    {request.reviewer_comment && (
                       <div className="pt-2">
                        <span className="text-slate-500 text-[10px] uppercase block mb-1 font-semibold">Reviewer Comment:</span>
                        <p className="text-slate-400 bg-slate-800/50 p-2 rounded-lg italic text-xs">
                          &quot;{request.reviewer_comment}&quot;
                        </p>
                      </div>
                    )}
                    
                    {request.reviewer && (
                       <div className="pt-2 flex justify-end">
                        <span className="text-slate-500 text-xs">
                          Reviewed by <span className="font-medium text-slate-300">{request.reviewer.first_name} {request.reviewer.last_name}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Leave Request Detail Modal */}
      <LeaveRequestDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        request={selectedRequest}
      />
    </div>
  );
};

export default LeaveRequestHistory;