'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Filter, ChevronDown, Loader2, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { CashAdvanceDetailModal } from '@/components/admin_dashboard/CashAdvanceDetailModal';

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

const fetchCashAdvances = async (
  page: number,
  limit: number,
  status?: string,
  type?: string
): Promise<CashAdvanceResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (status && status !== 'all') {
    params.append('status', status);
  }
  if (type && type !== 'all') {
    params.append('type', type);
  }

  const response = await fetch(`/api/cash-advance/get?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch cash advance requests');
  }
  return response.json();
};

export default function CashFlowRequestsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<CashAdvance | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['cash-advances', currentPage, pageLimit, statusFilter, typeFilter],
    queryFn: () => fetchCashAdvances(currentPage, pageLimit, statusFilter, typeFilter),
  });

  const cashAdvances = data?.cashAdvances || [];
  const pagination = data?.pagination;

  const handleViewRequest = (request: CashAdvance) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
  };

  const handleActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
  };

  const handlePageSizeChange = (size: number | 'all') => {
    if (size === 'all') {
      setShowAll(true);
    } else {
      setShowAll(false);
      setPageLimit(size);
      setCurrentPage(1);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock size={12} />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle size={12} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'personal':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            Personal
          </span>
        );
      case 'support':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
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

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p>Error loading cash advance requests: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-lg">
            <Wallet className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cash Advance Requests</h1>
            <p className="text-sm text-slate-400">Manage employee cash advance requests</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setIsStatusDropdownOpen(!isStatusDropdownOpen);
              setIsTypeDropdownOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Filter size={16} />
            <span>Status: {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
            <ChevronDown size={16} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isStatusDropdownOpen && (
            <div className="absolute z-10 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
              {['all', 'pending', 'approved', 'rejected'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status);
                    setIsStatusDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    statusFilter === status ? 'text-blue-400 bg-slate-700/50' : 'text-slate-300'
                  }`}
                >
                  {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Type Filter */}
        <div className="relative">
          <button
            onClick={() => {
              setIsTypeDropdownOpen(!isTypeDropdownOpen);
              setIsStatusDropdownOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <Filter size={16} />
            <span>Type: {typeFilter === 'all' ? 'All' : typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1)}</span>
            <ChevronDown size={16} className={`transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isTypeDropdownOpen && (
            <div className="absolute z-10 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
              {['all', 'personal', 'support'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setTypeFilter(type);
                    setIsTypeDropdownOpen(false);
                    setCurrentPage(1);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                    typeFilter === type ? 'text-blue-400 bg-slate-700/50' : 'text-slate-300'
                  }`}
                >
                  {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : cashAdvances.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Wallet className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No cash advance requests found</p>
            <p className="text-sm">Requests will appear here when employees submit them</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date Requested</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {cashAdvances.map((request) => (
                  <tr
                    key={request.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => handleViewRequest(request)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {request.requester
                            ? `${request.requester.first_name} ${request.requester.last_name}`
                            : 'Unknown'}
                        </p>
                        {request.requester?.employee_id && (
                          <p className="text-xs text-slate-400">{request.requester.employee_id}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getTypeBadge(request.type)}</td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-white font-mono">
                        {formatCurrency(request.amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {format(new Date(request.date_requested), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-400 max-w-xs truncate block">
                        {request.purpose || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRequest(request);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-xs font-medium"
                      >
                        <Eye size={14} />
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          pageSize={pageLimit}
          totalCount={pagination.total}
          showAll={showAll}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
      )}

      {/* Detail Modal */}
      <CashAdvanceDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        request={selectedRequest}
        adminId={user?.id || ''}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
}
