import React from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, Clock, User, FileText, CheckCircle, XCircle, AlertCircle, RotateCcw } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

interface LeaveRequestDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: {
    id: string;
    employee?: {
      id: string;
      first_name: string;
      last_name: string;
      email: string;
    };
    leave_type: string;
    start_date: string;
    end_date: string;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'revoked';
    created_at: string;
    reviewer?: {
      first_name: string;
      last_name: string;
    } | null;
    reviewed_at?: string;
    reviewer_comment?: string | null;
  } | null;
}

export const LeaveRequestDetailModal: React.FC<LeaveRequestDetailModalProps> = ({
  isOpen,
  onClose,
  request,
}) => {
  if (!isOpen || !request) return null;

  const calculateDuration = (start: string, end: string) => {
    try {
      const diff = differenceInDays(parseISO(end), parseISO(start)) + 1;
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  };

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
      case 'revoked':
        return {
          color: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
          icon: <RotateCcw size={20} />,
          label: 'Revoked',
        };
      default:
        return {
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Clock size={20} />,
          label: 'Pending',
        };
    }
  };

  const duration = calculateDuration(request.start_date, request.end_date);
  const statusConfig = getStatusConfig(request.status);

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
            <div>
              <h3 className="text-2xl font-bold text-white mb-1">Leave Request Details</h3>
              <p className="text-slate-400 text-sm">Request ID: {request.id.slice(0, 8)}...</p>
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
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-slate-900/50">
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

          {/* Employee Info (Admin view only) */}
          {request.employee && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Employee Information</h4>
              </div>
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {request.employee.first_name[0]}{request.employee.last_name[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {request.employee.first_name} {request.employee.last_name}
                    </p>
                    <p className="text-slate-400 text-sm">{request.employee.email}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Leave Details */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="text-blue-400" size={18} />
              <h4 className="font-semibold text-white">Leave Details</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">Leave Type</p>
                <span className="px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-sm font-medium text-blue-300 inline-block">
                  {request.leave_type}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Duration</p>
                <p className="text-white font-semibold font-mono">
                  {duration} day{duration !== 1 ? 's' : ''}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Start Date</p>
                <p className="text-white font-medium">{formatDate(request.start_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">End Date</p>
                <p className="text-white font-medium">{formatDate(request.end_date)}</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="text-blue-400" size={18} />
              <h4 className="font-semibold text-white">Reason</h4>
            </div>
            <p className="text-slate-300 ml-6 leading-relaxed bg-slate-900/50 p-3 rounded-lg italic border border-slate-700">
              "{request.reason}"
            </p>
          </div>

          {/* Review Information */}
          {request.status !== 'pending' && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Review Information</h4>
              </div>
              <div className="space-y-3 ml-6">
                {request.reviewer && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Reviewed By</p>
                    <p className="text-white font-medium">
                      {request.reviewer.first_name} {request.reviewer.last_name}
                    </p>
                  </div>
                )}
                {request.reviewed_at && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Reviewed On</p>
                    <p className="text-white font-medium">{formatDateTime(request.reviewed_at)}</p>
                  </div>
                )}
                {request.reviewer_comment && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Reviewer Comment</p>
                    <p className="text-slate-300 bg-slate-900/50 p-3 rounded-lg italic border border-slate-700">
                      "{request.reviewer_comment}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
