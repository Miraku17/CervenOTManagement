import React, { useEffect, useState } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Calendar, Loader2, ChevronRight, Eye, X } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
}

interface OvertimeRequest {
  id: string;
  created_at: string;
  requested_at: string;
  status: 'pending' | 'approved' | 'rejected';
  level1_status: 'pending' | 'approved' | 'rejected' | null;
  level2_status: 'pending' | 'approved' | 'rejected' | null;
  final_status: 'pending' | 'approved' | 'rejected' | null;
  comment: string | null;
  level1_comment: string | null;
  level2_comment: string | null;
  approved_hours: number | null;
  level1_reviewed_at: string | null;
  level2_reviewed_at: string | null;
  attendance: {
    date: string;
    total_minutes: number;
  };
  level1_reviewer_profile?: ProfileData | null;
  level2_reviewer_profile?: ProfileData | null;
}

const OvertimeHistory: React.FC = () => {
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
  }, [user?.id]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await supabase
        .from('overtime')
        .select(`
          *,
          attendance!inner (
            date,
            total_minutes,
            user_id
          ),
          level1_reviewer_profile:level1_reviewer (
            first_name,
            last_name,
            email
          ),
          level2_reviewer_profile:level2_reviewer (
            first_name,
            last_name,
            email
          )
        `)
        .eq('attendance.user_id', user!.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
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

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.final_status === filter || (filter === 'pending' && !req.final_status);
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
      {/* Detail Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-50"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800 bg-slate-900">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">Overtime Request Details</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    {new Date(selectedRequest.attendance.date).toLocaleDateString(undefined, {
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

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Overtime Hours</label>
                  <p className="text-slate-200 mt-1 font-mono text-lg">
                    {selectedRequest.approved_hours !== null ? `${selectedRequest.approved_hours.toFixed(2)} hrs` : 'Pending'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Requested At</label>
                  <p className="text-slate-200 mt-1">
                    {new Date(selectedRequest.requested_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Approval Timeline */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-white uppercase">Approval Status</h4>

                {/* Level 1 */}
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      selectedRequest.level1_status === 'approved' ? 'bg-emerald-500/20 border-emerald-500' :
                      selectedRequest.level1_status === 'rejected' ? 'bg-red-500/20 border-red-500' :
                      'bg-slate-800 border-slate-600'
                    }`}>
                      {getStatusIcon(selectedRequest.level1_status || 'pending')}
                    </div>
                    {selectedRequest.level1_status === 'approved' && (
                      <div className="w-0.5 h-12 bg-emerald-500/30 my-1"></div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium text-white">Level 1 Approval</h5>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedRequest.level1_status || 'pending')}`}>
                        {(selectedRequest.level1_status || 'pending').toUpperCase()}
                      </span>
                    </div>
                    {selectedRequest.level1_reviewer_profile && (
                      <p className="text-sm text-slate-400 mt-1">
                        by {selectedRequest.level1_reviewer_profile.first_name} {selectedRequest.level1_reviewer_profile.last_name}
                      </p>
                    )}
                    {selectedRequest.level1_reviewed_at && (
                      <p className="text-xs text-slate-500 mt-1">
                        {new Date(selectedRequest.level1_reviewed_at).toLocaleString()}
                      </p>
                    )}
                    {selectedRequest.level1_comment && (
                      <div className="mt-2 bg-slate-800/50 p-3 rounded-lg">
                        <p className="text-sm text-slate-300">{selectedRequest.level1_comment}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Level 2 */}
                {selectedRequest.level1_status === 'approved' && (
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                        selectedRequest.level2_status === 'approved' ? 'bg-emerald-500/20 border-emerald-500' :
                        selectedRequest.level2_status === 'rejected' ? 'bg-red-500/20 border-red-500' :
                        'bg-slate-800 border-slate-600'
                      }`}>
                        {getStatusIcon(selectedRequest.level2_status || 'pending')}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h5 className="font-medium text-white">Level 2 Approval</h5>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(selectedRequest.level2_status || 'pending')}`}>
                          {(selectedRequest.level2_status || 'pending').toUpperCase()}
                        </span>
                      </div>
                      {selectedRequest.level2_reviewer_profile && (
                        <p className="text-sm text-slate-400 mt-1">
                          by {selectedRequest.level2_reviewer_profile.first_name} {selectedRequest.level2_reviewer_profile.last_name}
                        </p>
                      )}
                      {selectedRequest.level2_reviewed_at && (
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(selectedRequest.level2_reviewed_at).toLocaleString()}
                        </p>
                      )}
                      {selectedRequest.level2_comment && (
                        <div className="mt-2 bg-slate-800/50 p-3 rounded-lg">
                          <p className="text-sm text-slate-300">{selectedRequest.level2_comment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {selectedRequest.comment && (
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Your Comment</label>
                  <p className="text-slate-200 mt-1 bg-slate-800/50 p-3 rounded-lg">
                    {selectedRequest.comment}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 bg-slate-800/50 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

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
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 hover:border-slate-700 transition-all cursor-pointer group"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Date and Hours */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <Calendar size={20} className="text-blue-400" />
                    <span className="text-lg font-semibold text-white">
                      {new Date(request.attendance.date).toLocaleDateString(undefined, {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock size={16} />
                    <span>Total: {Math.floor(request.attendance.total_minutes / 60)}h {request.attendance.total_minutes % 60}m</span>
                    {request.approved_hours !== null && (
                      <>
                        <ChevronRight size={16} className="text-slate-600" />
                        <span className="text-emerald-400 font-semibold">
                          Approved: {request.approved_hours.toFixed(2)} hrs
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Center: Approval Flow */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {/* Level 1 */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${getStatusColor(request.level1_status || 'pending')}`}>
                        {getStatusIcon(request.level1_status || 'pending')}
                        <span>L1</span>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-600" />

                    {/* Level 2 */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                        request.level1_status === 'rejected' ? 'bg-slate-800 text-slate-600 border-slate-700' :
                        getStatusColor(request.level2_status || 'pending')
                      }`}>
                        {request.level1_status === 'rejected' ? <AlertCircle size={16} /> : getStatusIcon(request.level2_status || 'pending')}
                        <span>L2</span>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-600" />

                    {/* Final */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${getStatusColor(request.final_status || 'pending')}`}>
                      {getStatusIcon(request.final_status || 'pending')}
                      <span className="capitalize">{request.final_status || 'pending'}</span>
                    </div>
                  </div>
                </div>

                {/* Right: View Details */}
                <div className="flex items-center gap-2">
                  <button className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium group-hover:bg-slate-700">
                    <Eye size={16} />
                    <span className="hidden sm:inline">View Details</span>
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
