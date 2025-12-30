import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, Loader2, ChevronRight, Eye, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
}

interface OvertimeRequest {
  id: string;
  overtime_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at: string | null;
  level1_status: 'pending' | 'approved' | 'rejected' | null;
  level2_status: 'pending' | 'approved' | 'rejected' | null;
  final_status: 'pending' | 'approved' | 'rejected' | null;
  level1_comment: string | null;
  level2_comment: string | null;
  level1_reviewed_at: string | null;
  level2_reviewed_at: string | null;
  level1_reviewer_profile?: ProfileData | null;
  level2_reviewer_profile?: ProfileData | null;
}

interface OvertimeHistoryProps {
  refreshKey?: number;
}

const OvertimeHistory: React.FC<OvertimeHistoryProps> = ({ refreshKey }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);

  useEffect(() => {
    if (user?.id) {
      fetchRequests();
    }
  }, [user?.id, refreshKey]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/overtime/my-requests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch overtime requests');
      }

      console.log('Fetched overtime requests:', data.requests);
      setRequests(data.requests || []);
    } catch (err: any) {
      console.error('Error fetching overtime history:', err);
      setError('Failed to load overtime history');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.final_status === filter || (filter === 'pending' && !req.final_status);
  });

  if (isLoading) {
    return (
      <div id="overtime-history" className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div id="overtime-history" className="space-y-6 animate-fade-in scroll-mt-24">
      {/* Detail Modal */}
      {selectedRequest && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800 bg-slate-900">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">Overtime Request Details</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {new Date(selectedRequest.overtime_date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-slate-900/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Overtime Hours</label>
                  <p className="text-white mt-1 font-mono text-xl font-bold">
                    {selectedRequest.total_hours.toFixed(2)} hrs
                  </p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Time Period</label>
                  <p className="text-white mt-1 text-sm">
                    {formatTime(selectedRequest.start_time)} - {formatTime(selectedRequest.end_time)}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Requested At</label>
                <p className="text-white mt-1 text-sm">
                  {new Date(selectedRequest.requested_at).toLocaleString()}
                </p>
              </div>

              {/* Approval Timeline */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white uppercase tracking-wider">Approval Status</h4>

                <div className="space-y-3">
                    {/* Level 1 */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                                selectedRequest.level1_status === 'approved' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' :
                                selectedRequest.level1_status === 'rejected' ? 'border-red-500 bg-red-500/10 text-red-500' :
                                'border-slate-600 bg-slate-700/50 text-slate-400'
                            }`}>
                                {getStatusIcon(selectedRequest.level1_status || 'pending')}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                    <h5 className="font-semibold text-white">Level 1 Approval</h5>
                                    <span className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedRequest.level1_status || 'pending')}`}>
                                        {getStatusIcon(selectedRequest.level1_status || 'pending')}
                                        {(selectedRequest.level1_status || 'pending').toUpperCase()}
                                    </span>
                                </div>

                                {selectedRequest.level1_reviewer_profile && (
                                    <p className="text-sm text-slate-400 mb-1">
                                        Reviewed by {selectedRequest.level1_reviewer_profile.first_name} {selectedRequest.level1_reviewer_profile.last_name}
                                    </p>
                                )}
                                {selectedRequest.level1_reviewed_at && (
                                    <p className="text-xs text-slate-500">
                                        {new Date(selectedRequest.level1_reviewed_at).toLocaleString()}
                                    </p>
                                )}

                                {selectedRequest.level1_comment && (
                                    <div className="mt-3 bg-slate-900/50 p-3 rounded border border-slate-700">
                                        <p className="text-xs text-slate-400 italic">&quot;{selectedRequest.level1_comment}&quot;</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Level 2 (Only if Level 1 is approved) */}
                    {selectedRequest.level1_status === 'approved' && (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                                    selectedRequest.level2_status === 'approved' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' :
                                    selectedRequest.level2_status === 'rejected' ? 'border-red-500 bg-red-500/10 text-red-500' :
                                    'border-slate-600 bg-slate-700/50 text-slate-400'
                                }`}>
                                    {getStatusIcon(selectedRequest.level2_status || 'pending')}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                        <h5 className="font-semibold text-white">Level 2 Approval</h5>
                                        <span className={`inline-flex self-start items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedRequest.level2_status || 'pending')}`}>
                                            {getStatusIcon(selectedRequest.level2_status || 'pending')}
                                            {(selectedRequest.level2_status || 'pending').toUpperCase()}
                                        </span>
                                    </div>

                                    {selectedRequest.level2_reviewer_profile && (
                                        <p className="text-sm text-slate-400 mb-1">
                                            Reviewed by {selectedRequest.level2_reviewer_profile.first_name} {selectedRequest.level2_reviewer_profile.last_name}
                                        </p>
                                    )}
                                    {selectedRequest.level2_reviewed_at && (
                                        <p className="text-xs text-slate-500">
                                            {new Date(selectedRequest.level2_reviewed_at).toLocaleString()}
                                        </p>
                                    )}

                                    {selectedRequest.level2_comment && (
                                        <div className="mt-3 bg-slate-900/50 p-3 rounded border border-slate-700">
                                            <p className="text-xs text-slate-400 italic">&quot;{selectedRequest.level2_comment}&quot;</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Final Status */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                                    selectedRequest.final_status === 'approved' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' :
                                    selectedRequest.final_status === 'rejected' ? 'border-red-500 bg-red-500/10 text-red-500' :
                                    'border-slate-600 bg-slate-700/50 text-slate-400'
                                }`}>
                                    {getStatusIcon(selectedRequest.final_status || 'pending')}
                                </div>
                                <h5 className="font-semibold text-white">Final Status</h5>
                            </div>
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedRequest.final_status || 'pending')}`}>
                                {getStatusIcon(selectedRequest.final_status || 'pending')}
                                {(selectedRequest.final_status || 'pending').toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>
              </div>

              {selectedRequest.reason && (
                <div>
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Reason</label>
                  <p className="text-white mt-1 bg-slate-800 border border-slate-700 p-3 rounded-lg text-sm">
                    {selectedRequest.reason}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-400" />
          Overtime History
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
            <Clock className="text-slate-500" size={24} />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">No {filter !== 'all' ? filter : ''} overtime requests</h3>
          <p className="text-slate-400 text-xs">
            {filter === 'all'
              ? "You haven't submitted any overtime requests yet."
              : `You don't have any ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-blue-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Date and Hours */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar size={18} className="text-blue-400" />
                    <span className="text-base font-semibold text-white">
                      {new Date(request.overtime_date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock size={14} />
                    <span>
                      {formatTime(request.start_time)} - {formatTime(request.end_time)}
                    </span>
                    <ChevronRight size={14} className="text-slate-600" />
                    <span className="text-emerald-400 font-semibold">
                      {request.total_hours.toFixed(2)} hrs
                    </span>
                  </div>
                </div>

                {/* Center: Approval Flow */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    {/* Level 1 */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${getStatusColor(request.level1_status || 'pending')}`}>
                        {getStatusIcon(request.level1_status || 'pending')}
                        <span>L1</span>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-slate-600" />

                    {/* Level 2 */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-2 py-1 rounded border ${
                        request.level1_status === 'rejected' ? 'bg-slate-800 text-slate-500 border-slate-700' :
                        getStatusColor(request.level2_status || 'pending')
                      }`}>
                        {request.level1_status === 'rejected' ? <AlertCircle size={14} /> : getStatusIcon(request.level2_status || 'pending')}
                        <span>L2</span>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-slate-600" />

                    {/* Final */}
                    <div className={`flex items-center gap-1 px-2 py-1 rounded border ${getStatusColor(request.final_status || 'pending')}`}>
                      {getStatusIcon(request.final_status || 'pending')}
                      <span className="capitalize hidden sm:inline">{request.final_status || 'pending'}</span>
                      <span className="sm:hidden capitalize">{request.final_status || 'pending'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: View Details */}
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-medium">
                    <Eye size={14} />
                    <span className="hidden sm:inline">Details</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default OvertimeHistory;
