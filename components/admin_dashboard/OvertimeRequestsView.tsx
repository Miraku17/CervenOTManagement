import React, { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmModal } from '@/components/ConfirmModal';

interface OvertimeRequest {
  id: string;
  attendance_id: string;
  requested_by: {
    first_name: string;
    last_name: string;
    email: string;
  };
  reviewer?: {
    first_name: string;
    last_name: string;
    email?: string;
  };
  attendance: {
    date: string;
    total_minutes: number;
  };
  comment: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  approved_at: string | null;
  approved_hours: number | null;
}

interface ConfirmationState {
  isOpen: boolean;
  requestId: string | null;
  action: 'approve' | 'reject' | null;
  employeeName: string;
}

const OvertimeRequestsView: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    requestId: null,
    action: null,
    employeeName: '',
  });

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    // Keep loading true only on initial load if desired, or just rely on refreshing logic
    if (!requests.length) setIsLoading(true);
    try {
      const response = await fetch('/api/admin/overtime-requests');
      if (!response.ok) {
        throw new Error('Failed to fetch requests');
      }
      const result = await response.json();
      setRequests(result.data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching overtime requests:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const openConfirmation = (id: string, action: 'approve' | 'reject') => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    setConfirmation({
      isOpen: true,
      requestId: id,
      action,
      employeeName: `${request.requested_by.first_name} ${request.requested_by.last_name}`,
    });
  };

  const closeConfirmation = () => {
    setConfirmation({
      isOpen: false,
      requestId: null,
      action: null,
      employeeName: '',
    });
  };

  const handleConfirmedAction = async () => {
    if (!confirmation.requestId || !confirmation.action) return;

    setProcessingId(confirmation.requestId);
    closeConfirmation();

    try {
      const adminId = user?.id;

      const response = await fetch('/api/admin/update-overtime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: confirmation.requestId,
          action: confirmation.action,
          adminId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update request');
      }

      // Refresh list
      await fetchRequests();

    } catch (err: any) {
      console.error(`Error ${confirmation.action}ing request:`, err);
      setError(`Failed to ${confirmation.action} request: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = (id: string) => openConfirmation(id, 'approve');
  const handleReject = (id: string) => openConfirmation(id, 'reject');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4 text-red-400">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button 
            onClick={fetchRequests}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const getConfirmationConfig = () => {
    if (confirmation.action === 'approve') {
      return {
        title: 'Approve Overtime Request',
        message: `Are you sure you want to approve the overtime request for ${confirmation.employeeName}?`,
        confirmText: 'Approve',
        type: 'info' as const,
      };
    } else {
      return {
        title: 'Reject Overtime Request',
        message: `Are you sure you want to reject the overtime request for ${confirmation.employeeName}?`,
        confirmText: 'Reject',
        type: 'danger' as const,
      };
    }
  };

  return (
    <div className="space-y-6">
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={confirmation.isOpen}
        {...getConfirmationConfig()}
        onConfirm={handleConfirmedAction}
        onCancel={closeConfirmation}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right z-50">
          <AlertCircle size={20} />
          <p>{error}</p>
          <button onClick={() => setError(null)} className="ml-2 hover:text-red-300">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Overtime Requests</h2>
          <p className="text-slate-400 mt-1">Manage and review employee overtime submissions</p>
        </div>
        <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-slate-300">
          <span className="font-bold text-white">{requests.filter(r => r.status === 'pending').length}</span> Pending Requests
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950/50 text-slate-200 font-medium border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Overtime Hours</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-1/3">Comment</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No overtime requests found</p>
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          {request.requested_by.first_name[0]}{request.requested_by.last_name[0]}
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">
                            {request.requested_by.first_name} {request.requested_by.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{request.requested_by.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-300">
                        {new Date(request.attendance.date).toLocaleDateString(undefined, { 
                          month: 'short', day: 'numeric', year: 'numeric' 
                        })}
                      </div>
                      <div className="text-xs text-slate-500">
                        Requested: {new Date(request.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {request.approved_hours !== null ? `${request.approved_hours.toFixed(2)} hrs` : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        {request.status !== 'pending' && request.reviewer && (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-medium">
                              by {request.reviewer.first_name} {request.reviewer.last_name}
                            </span>
                            {request.approved_at && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(request.approved_at).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 truncate max-w-xs" title={request.comment}>
                      {request.comment}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {request.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={processingId !== null}
                            className={`p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors ${processingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Approve"
                          >
                            {processingId === request.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            disabled={processingId !== null}
                            className={`p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors ${processingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title="Reject"
                          >
                            {processingId === request.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <X size={16} />
                            )}
                          </button>
                        </div>
                      )}
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
};

export default OvertimeRequestsView;
