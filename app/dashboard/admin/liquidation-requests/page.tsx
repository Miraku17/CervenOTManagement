'use client';

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Filter, ChevronDown, Loader2, CheckCircle, XCircle, Clock, Eye, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { LiquidationDetailModal } from '@/components/admin_dashboard/LiquidationDetailModal';

interface LiquidationItem {
  id: string;
  from_destination: string;
  to_destination: string;
  jeep: number;
  bus: number;
  fx_van: number;
  gas: number;
  toll: number;
  meals: number;
  lodging: number;
  others: number;
  total: number;
  remarks: string;
}

interface LiquidationAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface Liquidation {
  id: string;
  cash_advance_id: string;
  store_id: string;
  ticket_id: number | null;
  liquidation_date: string;
  total_amount: number;
  return_to_company: number;
  reimbursement: number;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  reviewer_comment: string | null;
  cash_advances: {
    id: string;
    amount: number;
    date_requested: string;
    type: string;
  } | null;
  stores: {
    id: string;
    store_code: string;
    store_name: string;
  } | null;
  tickets: {
    id: number;
    rcc_reference_number: string;
  } | null;
  liquidation_items: LiquidationItem[];
  liquidation_attachments: LiquidationAttachment[];
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
  } | null;
}

interface LiquidationResponse {
  liquidations: Liquidation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const fetchLiquidations = async (
  page: number,
  limit: number,
  status?: string
): Promise<LiquidationResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (status && status !== 'all') {
    params.append('status', status);
  }

  const response = await fetch(`/api/liquidation/get?${params.toString()}`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch liquidation requests');
  }
  return response.json();
};

export default function LiquidationRequestsPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [showAll, setShowAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const canManageLiquidation = hasPermission('manage_liquidation');

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-liquidations', currentPage, pageLimit, statusFilter],
    queryFn: () => fetchLiquidations(currentPage, pageLimit, statusFilter),
    enabled: canManageLiquidation,
  });

  const liquidations = data?.liquidations || [];
  const pagination = data?.pagination;

  const handleViewRequest = (liquidation: Liquidation) => {
    setSelectedLiquidation(liquidation);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedLiquidation(null);
  };

  const handleActionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-liquidations'] });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  // Show loading while permissions are being fetched
  if (permissionsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  // Show access denied if no permission
  if (!canManageLiquidation) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
        <AlertTriangle size={24} />
        <div>
          <h2 className="font-bold text-lg">Access Denied</h2>
          <p>You do not have permission to manage liquidation requests.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
        <p>Error loading liquidation requests: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-lg">
            <Receipt className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Liquidation Requests</h1>
            <p className="text-sm text-slate-400">Review and approve employee liquidation reports</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Status Filter */}
        <div className="relative">
          <button
            onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
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
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : liquidations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Receipt className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No liquidation requests found</p>
            <p className="text-sm">Requests will appear here when employees submit them</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Store</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cash Advance</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {liquidations.map((liquidation) => (
                  <tr
                    key={liquidation.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => handleViewRequest(liquidation)}
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {liquidation.profiles
                            ? `${liquidation.profiles.first_name} ${liquidation.profiles.last_name}`
                            : 'Unknown'}
                        </p>
                        {liquidation.profiles?.employee_id && (
                          <p className="text-xs text-slate-400">{liquidation.profiles.employee_id}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {liquidation.stores?.store_code || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-white font-mono">
                        {liquidation.cash_advances ? formatCurrency(liquidation.cash_advances.amount) : '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-orange-400 font-mono">
                        {formatCurrency(liquidation.total_amount)}
                      </span>
                      {liquidation.return_to_company > 0 && (
                        <p className="text-xs text-emerald-400">
                          Return: {formatCurrency(liquidation.return_to_company)}
                        </p>
                      )}
                      {liquidation.reimbursement > 0 && (
                        <p className="text-xs text-blue-400">
                          Reimburse: {formatCurrency(liquidation.reimbursement)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {format(new Date(liquidation.liquidation_date), 'MMM dd, yyyy')}
                      </span>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(liquidation.status)}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewRequest(liquidation);
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
      <LiquidationDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        liquidation={selectedLiquidation}
        adminId={user?.id || ''}
        onActionSuccess={handleActionSuccess}
      />
    </div>
  );
}
