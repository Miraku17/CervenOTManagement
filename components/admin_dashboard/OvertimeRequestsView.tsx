import React, { useEffect, useState } from 'react';
import { Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { ConfirmModal } from '@/components/ConfirmModal';

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  positions?: { name: string } | null;
}

interface OvertimeRequest {
  id: string;
  requested_by: ProfileData;
  level1_reviewer_profile?: ProfileData | null;
  level2_reviewer_profile?: ProfileData | null;
  overtime_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  level1_status: 'pending' | 'approved' | 'rejected' | null;
  level2_status: 'pending' | 'approved' | 'rejected' | null;
  final_status: 'pending' | 'approved' | 'rejected' | null;
  level1_comment?: string | null;
  level2_comment?: string | null;
  requested_at: string;
  approved_at: string | null;
  level1_reviewed_at: string | null;
  level2_reviewed_at: string | null;
}

interface ConfirmationState {
  isOpen: boolean;
  requestId: string | null;
  action: 'approve' | 'reject' | null;
  level: 'level1' | 'level2' | null;
  employeeName: string;
  comment: string;
}

interface OvertimeRequestsViewProps {
  userPosition: string | null;
}

const OvertimeRequestsView: React.FC<OvertimeRequestsViewProps> = ({ userPosition }) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    requestId: null,
    action: null,
    level: null,
    employeeName: '',
    comment: '',
  });
  const [selectedRequest, setSelectedRequest] = useState<OvertimeRequest | null>(null);

  useEffect(() => {
    // Fetch requests immediately since access is already verified by the page
    if (user?.id && userPosition) {
      fetchRequests();
    }
  }, [user?.id, userPosition]);

  const fetchRequests = async () => {
    // Keep loading true only on initial load if desired, or just rely on refreshing logic
    if (!requests.length) setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/overtime-requests?userId=${user?.id}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch requests');
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

  // Helper functions to determine user's approval level
  const isLevel1Approver = () => {
    if (!userPosition) return false;
    const level1Positions = ['Admin Tech', 'Technical Support Engineer', 'Operations Technical Lead'];
    return level1Positions.includes(userPosition);
  };

  const isLevel2Approver = () => {
    if (!userPosition) return false;
    const level2Positions = ['Operations Manager', 'Admin Tech'];
    return level2Positions.includes(userPosition);
  };

  // Check if user has any access to overtime requests
  const hasOvertimeAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Admin Tech',
      'Technical Support Engineer',
      'Operations Technical Lead',
      'Operations Manager'
    ];
    return authorizedPositions.includes(userPosition);
  };

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const openConfirmation = (id: string, action: 'approve' | 'reject', level: 'level1' | 'level2') => {
    const request = requests.find(r => r.id === id);
    if (!request) return;

    setConfirmation({
      isOpen: true,
      requestId: id,
      action,
      level,
      employeeName: `${request.requested_by.first_name} ${request.requested_by.last_name}`,
      comment: '',
    });
  };

  const closeConfirmation = () => {
    setConfirmation({
      isOpen: false,
      requestId: null,
      action: null,
      level: null,
      employeeName: '',
      comment: '',
    });
  };

  const handleConfirmedAction = async () => {
    if (!confirmation.requestId || !confirmation.action || !confirmation.level) return;

    setProcessingId(confirmation.requestId);
    const currentAction = confirmation.action;
    const currentLevel = confirmation.level;
    const currentComment = confirmation.comment;
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
          action: currentAction,
          adminId,
          level: currentLevel,
          comment: currentComment
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update request');
      }

      // Refresh list
      await fetchRequests();

    } catch (err: any) {
      console.error(`Error ${currentAction}ing request at ${currentLevel}:`, err);
      setError(`Failed to ${currentAction} request: ${err.message}`);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessingId(null);
    }
  };

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

  // Show loading while fetching requests
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
    const levelText = confirmation.level === 'level1' ? 'Level 1' : 'Level 2';
    if (confirmation.action === 'approve') {
      return {
        title: `${levelText} Approve Overtime Request`,
        message: `Are you sure you want to ${levelText.toLowerCase()} approve the overtime request for ${confirmation.employeeName}?`,
        confirmText: `${levelText} Approve`,
        type: 'info' as const,
      };
    } else {
      return {
        title: `${levelText} Reject Overtime Request`,
        message: `Are you sure you want to ${levelText.toLowerCase()} reject the overtime request for ${confirmation.employeeName}?`,
        confirmText: `${levelText} Reject`,
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
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Comment {confirmation.action === 'reject' && <span className="text-red-400">*</span>}
          </label>
          <textarea
            value={confirmation.comment}
            onChange={(e) => setConfirmation({ ...confirmation, comment: e.target.value })}
            placeholder={`Add a comment for this ${confirmation.action === 'approve' ? 'approval' : 'rejection'}...`}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>
      </ConfirmModal>

      {/* Detail View Modal */}
      {selectedRequest && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-50"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold text-white">Overtime Request Details</h3>
                  <p className="text-slate-400 text-sm mt-1">
                    Submitted by {selectedRequest.requested_by.first_name} {selectedRequest.requested_by.last_name}
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

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Employee Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Employee</label>
                  <p className="text-slate-200 mt-1">
                    {selectedRequest.requested_by.first_name} {selectedRequest.requested_by.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Email</label>
                  <p className="text-slate-200 mt-1">{selectedRequest.requested_by.email}</p>
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Overtime Date</label>
                  <p className="text-slate-200 mt-1">
                    {new Date(selectedRequest.overtime_date).toLocaleDateString(undefined, {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Time Period</label>
                  <p className="text-slate-200 mt-1">
                    {formatTime(selectedRequest.start_time)} - {formatTime(selectedRequest.end_time)}
                  </p>
                </div>
              </div>

              {/* Hours */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Total Hours</label>
                  <p className="text-slate-200 mt-1 font-mono text-lg font-bold">
                    {selectedRequest.total_hours.toFixed(2)} hours
                  </p>
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Requested At</label>
                  <p className="text-slate-200 mt-1">
                    {new Date(selectedRequest.requested_at).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Status Info */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Level 1 Status</label>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border mt-2 ${getStatusColor(selectedRequest.level1_status || 'pending')}`}>
                    {(selectedRequest.level1_status || 'pending').toUpperCase()}
                  </span>
                  {selectedRequest.level1_reviewed_at && (
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(selectedRequest.level1_reviewed_at).toLocaleString()}
                    </p>
                  )}
                </div>
                {isLevel2Approver() && (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-medium">Level 2 Status</label>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border mt-2 ${getStatusColor(selectedRequest.level2_status || 'pending')}`}>
                        {(selectedRequest.level2_status || 'pending').toUpperCase()}
                      </span>
                      {selectedRequest.level2_reviewed_at && (
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(selectedRequest.level2_reviewed_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 uppercase font-medium">Final Status</label>
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border mt-2 ${getStatusColor(selectedRequest.final_status || 'pending')}`}>
                        {(selectedRequest.final_status || 'pending').toUpperCase()}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Reviewers */}
              {selectedRequest.level1_reviewer_profile && (
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Level 1 Reviewer</label>
                  <p className="text-slate-200 mt-1">
                    {selectedRequest.level1_reviewer_profile.first_name} {selectedRequest.level1_reviewer_profile.last_name}
                  </p>
                </div>
              )}
              {selectedRequest.level2_reviewer_profile && (
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Level 2 Reviewer</label>
                  <p className="text-slate-200 mt-1">
                    {selectedRequest.level2_reviewer_profile.first_name} {selectedRequest.level2_reviewer_profile.last_name}
                  </p>
                </div>
              )}

              {/* Comments */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-medium">Reason for Overtime</label>
                  <p className="text-slate-200 mt-1 bg-slate-800/50 p-3 rounded-lg">
                    {selectedRequest.reason || <span className="text-slate-500 italic">No reason provided</span>}
                  </p>
                </div>
                {selectedRequest.level1_comment && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase font-medium">Level 1 Reviewer Comment</label>
                    <p className="text-slate-200 mt-1 bg-slate-800/50 p-3 rounded-lg">
                      {selectedRequest.level1_comment}
                    </p>
                  </div>
                )}
                {selectedRequest.level2_comment && (
                  <div>
                    <label className="text-xs text-slate-500 uppercase font-medium">Level 2 Reviewer Comment</label>
                    <p className="text-slate-200 mt-1 bg-slate-800/50 p-3 rounded-lg">
                      {selectedRequest.level2_comment}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
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
        <div className="flex items-center gap-4">
          <div className="bg-slate-800 px-4 py-2 rounded-lg border border-slate-700 text-slate-300">
            <span className="font-bold text-white">{requests.filter(r => !r.final_status || r.final_status === 'pending').length}</span> Pending Requests
          </div>
          {userPosition && (
            <div className="bg-blue-500/10 px-4 py-2 rounded-lg border border-blue-500/30 text-blue-400">
              <span className="font-semibold">{userPosition}</span>
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950/50 text-slate-200 font-medium border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Time Period</th>
                <th className="px-6 py-4">Hours</th>
                <th className="px-6 py-4">Level 1 Status</th>
                {isLevel2Approver() && <th className="px-6 py-4">Level 2 Status</th>}
                {isLevel2Approver() && <th className="px-6 py-4">Final Status</th>}
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={isLevel2Approver() ? 9 : 7} className="px-6 py-12 text-center text-slate-500">
                    <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No overtime requests found</p>
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  // Determine what actions the current user can take
                  const canLevel1Approve = isLevel1Approver() && (!request.level1_status || request.level1_status === 'pending');
                  const canLevel2Approve = isLevel2Approver() && request.level1_status === 'approved' && (!request.level2_status || request.level2_status === 'pending');
                  const showActions = canLevel1Approve || canLevel2Approve;

                  return (
                  <tr
                    key={request.id}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => setSelectedRequest(request)}
                  >
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
                        {new Date(request.overtime_date).toLocaleDateString(undefined, {
                          month: 'short', day: 'numeric', year: 'numeric'
                        })}
                      </div>
                      <div className="text-xs text-slate-500">
                        Requested: {new Date(request.requested_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      <div className="text-sm">
                        {formatTime(request.start_time)} - {formatTime(request.end_time)}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300 font-semibold">
                      {request.total_hours.toFixed(2)} hrs
                    </td>
                    {/* Level 1 Status */}
                    <td className="px-6 py-4">
                      {request.level1_status ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.level1_status)}`}>
                            {request.level1_status.toUpperCase()}
                          </span>
                          {request.level1_reviewer_profile && (
                            <span className="text-[10px] text-slate-400">
                              by {request.level1_reviewer_profile.first_name} {request.level1_reviewer_profile.last_name}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Pending</span>
                      )}
                    </td>
                    {/* Level 2 Status */}
                    {isLevel2Approver() && (
                      <td className="px-6 py-4">
                        {request.level2_status ? (
                          <div className="flex flex-col items-start gap-1">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.level2_status)}`}>
                              {request.level2_status.toUpperCase()}
                            </span>
                            {request.level2_reviewer_profile && (
                              <span className="text-[10px] text-slate-400">
                                by {request.level2_reviewer_profile.first_name} {request.level2_reviewer_profile.last_name}
                              </span>
                            )}
                          </div>
                        ) : request.level1_status === 'approved' ? (
                          <span className="text-xs text-slate-500">Pending</span>
                        ) : (
                          <span className="text-xs text-slate-600">-</span>
                        )}
                      </td>
                    )}
                    {/* Final Status */}
                    {isLevel2Approver() && (
                      <td className="px-6 py-4">
                        {request.final_status ? (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.final_status)}`}>
                            {request.final_status.toUpperCase()}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">Pending</span>
                        )}
                      </td>
                    )}
                    {/* Reason Column */}
                    <td className="px-6 py-4 text-slate-300 max-w-xs">
                      <div className="text-xs truncate" title={request.reason}>
                        {request.reason || <span className="text-slate-500">-</span>}
                      </div>
                    </td>
                    {/* Actions */}
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      {showActions ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openConfirmation(request.id, 'approve', canLevel1Approve ? 'level1' : 'level2')}
                            disabled={processingId !== null}
                            className={`p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors ${processingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={`${canLevel1Approve ? 'Level 1' : 'Level 2'} Approve`}
                          >
                            {processingId === request.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} />
                            )}
                          </button>
                          <button
                            onClick={() => openConfirmation(request.id, 'reject', canLevel1Approve ? 'level1' : 'level2')}
                            disabled={processingId !== null}
                            className={`p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors ${processingId !== null ? 'opacity-50 cursor-not-allowed' : ''}`}
                            title={`${canLevel1Approve ? 'Level 1' : 'Level 2'} Reject`}
                          >
                            {processingId === request.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <X size={16} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 text-center block">-</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OvertimeRequestsView;
