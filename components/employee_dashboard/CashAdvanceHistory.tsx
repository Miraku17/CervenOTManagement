'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Wallet, CheckCircle, XCircle, Clock, AlertCircle, Calendar, Loader2, Eye, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

interface CashAdvanceResponse {
  cashAdvances: CashAdvance[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const fetchMyCashAdvances = async (): Promise<CashAdvanceResponse> => {
  const response = await fetch('/api/cash-advance/my-requests?limit=50');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch cash advance requests');
  }
  return response.json();
};

const CashAdvanceHistory: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedRequest, setSelectedRequest] = useState<CashAdvance | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['my-cash-advances'],
    queryFn: fetchMyCashAdvances,
  });

  const requests = data?.cashAdvances || [];

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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'personal':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            Personal
          </span>
        );
      case 'support':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
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
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy h:mm a');
    } catch {
      return new Date(dateString).toLocaleString();
    }
  };

  const filteredRequests = requests.filter(req => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  if (isLoading) {
    return (
      <div id="cash-advance-history" className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-8 h-8 text-green-400 animate-spin" />
      </div>
    );
  }

  return (
    <div id="cash-advance-history" className="space-y-6 animate-fade-in scroll-mt-24">
      {/* Detail Modal */}
      {selectedRequest && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-xl shadow-2xl overflow-hidden transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-800 bg-slate-900">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Wallet className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Cash Advance Details</h3>
                    <p className="text-slate-400 text-sm mt-0.5">
                      Request ID: {selectedRequest.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto bg-slate-900/50">
              {/* Status and Type */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusColor(selectedRequest.status)}`}>
                  {getStatusIcon(selectedRequest.status)}
                  <span className="capitalize">{selectedRequest.status}</span>
                </div>
                {getTypeBadge(selectedRequest.type)}
              </div>

              {/* Amount */}
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Amount</label>
                <p className="text-white mt-1 font-mono text-2xl font-bold text-green-400">
                  {formatCurrency(selectedRequest.amount)}
                </p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Date Requested</label>
                  <p className="text-white mt-1 text-sm">
                    {formatDate(selectedRequest.date_requested)}
                  </p>
                </div>
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Submitted At</label>
                  <p className="text-white mt-1 text-sm">
                    {formatDateTime(selectedRequest.created_at)}
                  </p>
                </div>
              </div>

              {/* Purpose */}
              {selectedRequest.purpose && (
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Purpose</label>
                  <p className="text-white mt-2 text-sm">
                    {selectedRequest.purpose}
                  </p>
                </div>
              )}

              {/* Approval Progress */}
              <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                <label className="text-xs text-slate-400 uppercase font-semibold tracking-wider">Approval Progress</label>
                <div className="mt-3 space-y-3">
                  {/* Level 1 */}
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedRequest.level1_status === 'approved' ? 'bg-emerald-500' :
                      selectedRequest.level1_status === 'rejected' ? 'bg-red-500' :
                      selectedRequest.level1_status === 'pending' ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {selectedRequest.level1_status === 'approved' && <CheckCircle size={12} className="text-white" />}
                      {selectedRequest.level1_status === 'rejected' && <XCircle size={12} className="text-white" />}
                      {selectedRequest.level1_status === 'pending' && <Clock size={12} className="text-white" />}
                      {!selectedRequest.level1_status && <span className="text-slate-400 text-xs">1</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">Level 1</span>
                        {selectedRequest.level1_status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            selectedRequest.level1_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            selectedRequest.level1_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {selectedRequest.level1_status.charAt(0).toUpperCase() + selectedRequest.level1_status.slice(1)}
                          </span>
                        )}
                      </div>
                      {selectedRequest.level1_reviewer_profile && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selectedRequest.level1_reviewer_profile.first_name} {selectedRequest.level1_reviewer_profile.last_name}
                          {selectedRequest.level1_date_approved && ` • ${formatDateTime(selectedRequest.level1_date_approved)}`}
                        </p>
                      )}
                      {selectedRequest.level1_comment && (
                        <p className="text-xs text-slate-500 mt-1 italic">&quot;{selectedRequest.level1_comment}&quot;</p>
                      )}
                    </div>
                  </div>

                  {/* Connector */}
                  <div className="ml-2.5 h-2 border-l-2 border-slate-600"></div>

                  {/* Level 2 */}
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                      selectedRequest.level2_status === 'approved' ? 'bg-emerald-500' :
                      selectedRequest.level2_status === 'rejected' ? 'bg-red-500' :
                      selectedRequest.level2_status === 'pending' ? 'bg-amber-500' : 'bg-slate-600'
                    }`}>
                      {selectedRequest.level2_status === 'approved' && <CheckCircle size={12} className="text-white" />}
                      {selectedRequest.level2_status === 'rejected' && <XCircle size={12} className="text-white" />}
                      {selectedRequest.level2_status === 'pending' && <Clock size={12} className="text-white" />}
                      {!selectedRequest.level2_status && <span className="text-slate-400 text-xs">2</span>}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">Level 2</span>
                        {selectedRequest.level2_status && (
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            selectedRequest.level2_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                            selectedRequest.level2_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {selectedRequest.level2_status.charAt(0).toUpperCase() + selectedRequest.level2_status.slice(1)}
                          </span>
                        )}
                        {!selectedRequest.level2_status && selectedRequest.level1_status !== 'approved' && (
                          <span className="text-xs text-slate-500">(Awaiting L1)</span>
                        )}
                      </div>
                      {selectedRequest.level2_reviewer_profile && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {selectedRequest.level2_reviewer_profile.first_name} {selectedRequest.level2_reviewer_profile.last_name}
                          {selectedRequest.level2_date_approved && ` • ${formatDateTime(selectedRequest.level2_date_approved)}`}
                        </p>
                      )}
                      {selectedRequest.level2_comment && (
                        <p className="text-xs text-slate-500 mt-1 italic">&quot;{selectedRequest.level2_comment}&quot;</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
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
          <Wallet className="w-5 h-5 text-green-400" />
          Cash Advance History
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
          {(error as Error).message || 'Failed to load cash advance history'}
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wallet className="text-slate-500" size={24} />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">No {filter !== 'all' ? filter : ''} cash advance requests</h3>
          <p className="text-slate-400 text-xs">
            {filter === 'all'
              ? "You haven't submitted any cash advance requests yet."
              : `You don't have any ${filter} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-green-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Amount and Type */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl font-bold text-green-400 font-mono">
                      {formatCurrency(request.amount)}
                    </span>
                    {getTypeBadge(request.type)}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar size={14} />
                    <span>{formatDate(request.date_requested)}</span>
                  </div>
                </div>

                {/* Center: Purpose (truncated) */}
                <div className="flex-1 hidden lg:block">
                  {request.purpose ? (
                    <p className="text-sm text-slate-400 truncate max-w-xs">
                      {request.purpose}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No purpose specified</p>
                  )}
                </div>

                {/* Right: Approval Progress, Status, and View */}
                <div className="flex items-center gap-3">
                  {/* Mini approval progress */}
                  <div className="hidden sm:flex items-center gap-1">
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${
                      request.level1_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      request.level1_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      request.level1_status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-500'
                    }`}>
                      L1
                    </span>
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${
                      request.level2_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                      request.level2_status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                      request.level2_status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-700 text-slate-500'
                    }`}>
                      L2
                    </span>
                  </div>
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                    {getStatusIcon(request.status)}
                    <span className="capitalize">{request.status}</span>
                  </div>
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

export default CashAdvanceHistory;
