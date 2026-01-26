'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet, User, FileText, CheckCircle, XCircle, Clock, Loader2, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CashAdvance {
  id: string;
  type: 'personal' | 'support';
  amount: number;
  purpose: string | null;
  status: 'pending' | 'approved' | 'rejected';
  date_requested: string;
  date_approved: string | null;
  rejection_reason: string | null;
  created_at: string;
  requester: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
  } | null;
  approved_by_user: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  level1_status: 'pending' | 'approved' | 'rejected' | null;
  level1_approved_by: string | null;
  level1_date_approved: string | null;
  level1_comment: string | null;
  level2_status: 'pending' | 'approved' | 'rejected' | null;
  level2_approved_by: string | null;
  level2_date_approved: string | null;
  level2_comment: string | null;
  level1_reviewer_profile: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
  level2_reviewer_profile: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface CashAdvanceDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CashAdvance | null;
  adminId: string;
  onActionSuccess: () => void;
  canApproveLevel1?: boolean;
  canApproveLevel2?: boolean;
}

export const CashAdvanceDetailModal: React.FC<CashAdvanceDetailModalProps> = ({
  isOpen,
  onClose,
  request,
  adminId,
  onActionSuccess,
  canApproveLevel1 = false,
  canApproveLevel2 = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionLevel, setActionLevel] = useState<'level1' | 'level2' | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  // Determine which level is active for review
  const getActiveLevel = (): 'level1' | 'level2' | null => {
    // If final status is already set, no active level
    if (request.status === 'approved' || request.status === 'rejected') {
      return null;
    }
    // If level1 is pending or not set, level1 is active
    if (request.level1_status !== 'approved') {
      return canApproveLevel1 ? 'level1' : null;
    }
    // If level1 is approved and level2 is pending, level2 is active
    if (request.level1_status === 'approved' && request.level2_status !== 'approved' && request.level2_status !== 'rejected') {
      return canApproveLevel2 ? 'level2' : null;
    }
    return null;
  };

  const activeLevel = getActiveLevel();
  const canTakeAction = activeLevel !== null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <CheckCircle size={20} />,
          label: 'Approved',
        };
      case 'rejected':
        return {
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          icon: <XCircle size={20} />,
          label: 'Rejected',
        };
      default:
        return {
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Clock size={20} />,
          label: 'Pending',
        };
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'personal':
        return (
          <span className="px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-sm font-medium text-green-400">
            Personal
          </span>
        );
      case 'support':
        return (
          <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm font-medium text-blue-400">
            Support
          </span>
        );
      default:
        return null;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM dd, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM dd, yyyy • h:mm a');
    } catch {
      return new Date(dateString).toLocaleString();
    }
  };

  const handleAction = async (action: 'approve' | 'reject', level: 'level1' | 'level2') => {
    setIsProcessing(true);
    setActionType(action);
    setActionLevel(level);
    setError(null);

    try {
      const response = await fetch('/api/cash-advance/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: request.id,
          action,
          adminId,
          reviewerComment: reviewerComment.trim() || undefined,
          level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} request`);
      }

      onActionSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
      setActionType(null);
      setActionLevel(null);
    }
  };

  const getLevelStatusConfig = (status: 'pending' | 'approved' | 'rejected' | null) => {
    switch (status) {
      case 'approved':
        return {
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <CheckCircle size={16} />,
          label: 'Approved',
        };
      case 'rejected':
        return {
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          icon: <XCircle size={16} />,
          label: 'Rejected',
        };
      case 'pending':
        return {
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Clock size={16} />,
          label: 'Pending',
        };
      default:
        return {
          color: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
          icon: <Clock size={16} />,
          label: 'Not Started',
        };
    }
  };

  const statusConfig = getStatusConfig(request.status);

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Wallet className="w-6 h-6 text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Cash Advance Details</h3>
                <p className="text-slate-400 text-sm">Request ID: {request.id.slice(0, 8)}...</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto bg-slate-900/50">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${statusConfig.color}`}>
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Submitted</p>
              <p className="text-sm text-slate-300">{formatDateTime(request.created_at)}</p>
            </div>
          </div>

          {/* Employee Info */}
          {request.requester && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Employee Information</h4>
              </div>
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {request.requester.first_name[0]}{request.requester.last_name[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {request.requester.first_name} {request.requester.last_name}
                    </p>
                    <p className="text-slate-400 text-sm">{request.requester.email}</p>
                    {request.requester.employee_id && (
                      <p className="text-slate-500 text-xs">ID: {request.requester.employee_id}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cash Advance Details */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="text-blue-400" size={18} />
              <h4 className="font-semibold text-white">Request Details</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">Type</p>
                {getTypeBadge(request.type)}
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Amount</p>
                <p className="text-white font-bold text-xl font-mono">
                  {formatCurrency(request.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Date Requested</p>
                <p className="text-white font-medium">{formatDate(request.date_requested)}</p>
              </div>
            </div>
          </div>

          {/* Purpose */}
          {request.purpose && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Purpose</h4>
              </div>
              <p className="text-slate-300 ml-6 leading-relaxed bg-slate-900/50 p-3 rounded-lg italic border border-slate-700">
                &quot;{request.purpose}&quot;
              </p>
            </div>
          )}

          {/* Approval Timeline */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="text-blue-400" size={18} />
              <h4 className="font-semibold text-white">Approval Timeline</h4>
            </div>
            <div className="ml-6 space-y-4">
              {/* Level 1 */}
              <div className="relative pl-6 pb-4 border-l-2 border-slate-600">
                <div className="absolute -left-2 top-0">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    request.level1_status === 'approved' ? 'bg-emerald-500' :
                    request.level1_status === 'rejected' ? 'bg-red-500' :
                    request.level1_status === 'pending' ? 'bg-amber-500' : 'bg-slate-600'
                  }`}>
                    {request.level1_status === 'approved' && <CheckCircle size={10} className="text-white" />}
                    {request.level1_status === 'rejected' && <XCircle size={10} className="text-white" />}
                    {request.level1_status === 'pending' && <Clock size={10} className="text-white" />}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">Level 1 Approval</span>
                    {request.level1_status && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getLevelStatusConfig(request.level1_status).color}`}>
                        {getLevelStatusConfig(request.level1_status).icon}
                        {getLevelStatusConfig(request.level1_status).label}
                      </span>
                    )}
                  </div>
                  {request.level1_reviewer_profile && (
                    <p className="text-xs text-slate-400">
                      By: {request.level1_reviewer_profile.first_name} {request.level1_reviewer_profile.last_name}
                    </p>
                  )}
                  {request.level1_date_approved && (
                    <p className="text-xs text-slate-500">{formatDateTime(request.level1_date_approved)}</p>
                  )}
                  {request.level1_comment && (
                    <p className="text-xs text-slate-400 mt-1 italic">&quot;{request.level1_comment}&quot;</p>
                  )}
                </div>
              </div>

              {/* Level 2 */}
              <div className="relative pl-6">
                <div className="absolute -left-2 top-0">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    request.level2_status === 'approved' ? 'bg-emerald-500' :
                    request.level2_status === 'rejected' ? 'bg-red-500' :
                    request.level2_status === 'pending' ? 'bg-amber-500' : 'bg-slate-600'
                  }`}>
                    {request.level2_status === 'approved' && <CheckCircle size={10} className="text-white" />}
                    {request.level2_status === 'rejected' && <XCircle size={10} className="text-white" />}
                    {request.level2_status === 'pending' && <Clock size={10} className="text-white" />}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">Level 2 Approval</span>
                    {request.level2_status && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${getLevelStatusConfig(request.level2_status).color}`}>
                        {getLevelStatusConfig(request.level2_status).icon}
                        {getLevelStatusConfig(request.level2_status).label}
                      </span>
                    )}
                    {!request.level2_status && request.level1_status !== 'approved' && (
                      <span className="text-xs text-slate-500">(Requires L1 approval)</span>
                    )}
                  </div>
                  {request.level2_reviewer_profile && (
                    <p className="text-xs text-slate-400">
                      By: {request.level2_reviewer_profile.first_name} {request.level2_reviewer_profile.last_name}
                    </p>
                  )}
                  {request.level2_date_approved && (
                    <p className="text-xs text-slate-500">{formatDateTime(request.level2_date_approved)}</p>
                  )}
                  {request.level2_comment && (
                    <p className="text-xs text-slate-400 mt-1 italic">&quot;{request.level2_comment}&quot;</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Section (for requests that can be reviewed) */}
          {canTakeAction && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">
                  {activeLevel === 'level1' ? 'Level 1' : 'Level 2'} Review Action
                </h4>
              </div>
              <div className="ml-6 space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Comment (optional)
                  </label>
                  <textarea
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    placeholder="Add a comment for this decision..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={isProcessing}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
          {canTakeAction && activeLevel ? (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject', activeLevel)}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing && actionType === 'reject' && actionLevel === activeLevel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {activeLevel === 'level1' ? 'L1 Reject' : 'L2 Reject'}
              </button>
              <button
                onClick={() => handleAction('approve', activeLevel)}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing && actionType === 'approve' && actionLevel === activeLevel ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {activeLevel === 'level1' ? 'L1 Approve' : 'L2 Approve'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
