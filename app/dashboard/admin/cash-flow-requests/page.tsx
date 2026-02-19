'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Filter, ChevronDown, Loader2, CheckCircle, XCircle, Clock, Eye, Pencil, Trash2, FileDown, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { CashAdvanceDetailModal } from '@/components/admin_dashboard/CashAdvanceDetailModal';
import { EditCashAdvanceModal } from '@/components/admin_dashboard/EditCashAdvanceModal';
import { DeleteCashAdvanceModal } from '@/components/admin_dashboard/DeleteCashAdvanceModal';

interface CashAdvance {
  id: string;
  type: 'personal' | 'support' | 'reimbursement';
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
    position_id: string | null;
    positions: {
      name: string;
    } | null;
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
  const { hasPermission } = usePermissions();
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [requestToEdit, setRequestToEdit] = useState<CashAdvance | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<CashAdvance | null>(null);

  // Export state
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportSection, setShowExportSection] = useState(false);

  const canManageCashFlow = hasPermission('manage_cash_flow');
  const canApproveLevel1 = hasPermission('approve_cash_advance_level1');
  const canApproveLevel2 = hasPermission('approve_cash_advance_level2');

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

  const handleEditRequest = (e: React.MouseEvent, request: CashAdvance) => {
    e.stopPropagation();
    setRequestToEdit(request);
    setIsEditModalOpen(true);
  };

  const handleDeleteRequest = (e: React.MouseEvent, request: CashAdvance) => {
    e.stopPropagation();
    setRequestToDelete(request);
    setIsDeleteModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setRequestToEdit(null);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setRequestToDelete(null);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
  };

  const handleDeleteSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
  };

  const handleExport = async () => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    setIsExporting(true);

    try {
      const params = new URLSearchParams({
        startDate: exportStartDate,
        endDate: exportEndDate,
      });

      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (typeFilter && typeFilter !== 'all') {
        params.append('type', typeFilter);
      }

      const response = await fetch(`/api/cash-advance/export?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to export data');
      }

      if (!result.data || result.data.length === 0) {
        alert('No cash advance requests found for the selected date range.');
        return;
      }

      // Convert to Excel
      const workbook = convertCashAdvanceToExcel(result.data, exportStartDate, exportEndDate);
      if (!workbook) {
        alert('Failed to generate Excel file.');
        return;
      }

      // Download
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cash_advance_requests_${exportStartDate}_${exportEndDate}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const convertCashAdvanceToExcel = (data: CashAdvance[], startDate: string, endDate: string) => {
    if (!data || data.length === 0) return null;

    const reportData: (string | number)[][] = [];

    // Title row
    reportData.push([`Cash Advance Requests Report (${startDate} to ${endDate})`]);
    reportData.push([]); // Empty row

    // Header row
    reportData.push([
      'Employee Name',
      'Employee ID',
      'Email',
      'Type',
      'Amount (PHP)',
      'Date Requested',
      'Purpose',
      'Status',
      'Reviewed By',
      'Date Reviewed',
      'Reviewer Comment'
    ]);

    // Data rows (already sorted alphabetically by surname from API)
    for (const row of data) {
      const firstName = row.requester?.first_name || '';
      const lastName = row.requester?.last_name || '';
      const fullName = `${lastName}, ${firstName}`.trim();
      const employeeId = row.requester?.employee_id || 'N/A';
      const email = row.requester?.email || 'N/A';
      const type = row.type.charAt(0).toUpperCase() + row.type.slice(1);
      const amount = row.amount;
      const dateRequested = format(new Date(row.date_requested), 'MMM dd, yyyy');
      const purpose = row.purpose || 'N/A';
      const status = row.status.charAt(0).toUpperCase() + row.status.slice(1);
      const reviewedBy = row.approved_by_user
        ? `${row.approved_by_user.first_name} ${row.approved_by_user.last_name}`
        : 'N/A';
      const dateReviewed = row.date_approved
        ? format(new Date(row.date_approved), 'MMM dd, yyyy h:mm a')
        : 'N/A';
      const reviewerComment = row.rejection_reason || 'N/A';

      reportData.push([
        fullName,
        employeeId,
        email,
        type,
        amount,
        dateRequested,
        purpose,
        status,
        reviewedBy,
        dateReviewed,
        reviewerComment
      ]);
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(reportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 },  // Employee Name
      { wch: 15 },  // Employee ID
      { wch: 30 },  // Email
      { wch: 12 },  // Type
      { wch: 15 },  // Amount
      { wch: 15 },  // Date Requested
      { wch: 35 },  // Purpose
      { wch: 12 },  // Status
      { wch: 20 },  // Reviewed By
      { wch: 20 },  // Date Reviewed
      { wch: 30 }   // Reviewer Comment
    ];

    // Apply styles
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        const cell = worksheet[cellAddress];
        if (!cell.s) cell.s = {};

        if (R === 0) {
          // Title row
          cell.s = {
            fill: { fgColor: { rgb: "1E3A5F" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
            alignment: { horizontal: "center", vertical: "center" }
          };
        } else if (R === 2) {
          // Header row
          cell.s = {
            fill: { fgColor: { rgb: "374151" } },
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        } else if (R > 2) {
          // Data rows
          cell.s = {
            fill: { fgColor: { rgb: R % 2 === 0 ? "F9FAFB" : "FFFFFF" } },
            alignment: { horizontal: C === 4 ? "right" : "left", vertical: "center" },
            border: {
              top: { style: "thin", color: { rgb: "E5E7EB" } },
              bottom: { style: "thin", color: { rgb: "E5E7EB" } },
              left: { style: "thin", color: { rgb: "E5E7EB" } },
              right: { style: "thin", color: { rgb: "E5E7EB" } }
            }
          };

          // Format amount column
          if (C === 4 && typeof cell.v === 'number') {
            cell.z = '#,##0.00';
          }
        }
      }
    }

    // Merge title row
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 10 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cash Advance Requests');

    return workbook;
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
      case 'reimbursement':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            Reimbursement
          </span>
        );
      default:
        return null;
    }
  };

  const getLevelStatusBadge = (status: 'pending' | 'approved' | 'rejected' | null, level: 'L1' | 'L2') => {
    if (status === null) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-500 border border-slate-600/50">
          {level}: -
        </span>
      );
    }
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            <Clock size={10} />
            {level}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <CheckCircle size={10} />
            {level}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle size={10} />
            {level}
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

      {/* Filters and Export Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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
                {['all', 'personal', 'support', 'reimbursement'].map((type) => (
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

        {/* Export Button */}
        {canManageCashFlow && (
          <button
            onClick={() => setShowExportSection(!showExportSection)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              showExportSection
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <FileDown size={16} />
            <span>Export</span>
            <ChevronDown size={16} className={`transition-transform ${showExportSection ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>

      {/* Export Section */}
      {showExportSection && canManageCashFlow && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <FileDown className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Export Cash Advance Requests</h3>
              <p className="text-sm text-slate-400">Select date range and export to Excel (sorted by surname)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Calendar size={14} className="inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={exportStartDate}
                onChange={(e) => setExportStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">
                <Calendar size={14} className="inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={exportEndDate}
                onChange={(e) => setExportEndDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent [color-scheme:dark]"
              />
            </div>

            {/* Filter Info */}
            <div className="flex items-end">
              <div className="text-sm text-slate-500">
                <p>Current filters will be applied:</p>
                <p className="text-slate-400">
                  Status: <span className="text-white">{statusFilter === 'all' ? 'All' : statusFilter}</span>,
                  Type: <span className="text-white">{typeFilter === 'all' ? 'All' : typeFilter}</span>
                </p>
              </div>
            </div>

            {/* Export Button */}
            <div className="flex items-end">
              <button
                onClick={handleExport}
                disabled={isExporting || !exportStartDate || !exportEndDate}
                className={`w-full flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors ${
                  isExporting || !exportStartDate || !exportEndDate
                    ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileDown size={16} />
                    Export to Excel
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Approval</th>
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
                        {request.requester?.positions?.name && (
                          <p className="text-xs text-slate-500 italic">{request.requester.positions.name}</p>
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
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {getLevelStatusBadge(request.level1_status, 'L1')}
                        {getLevelStatusBadge(request.level2_status, 'L2')}
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(request.status)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
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
                        {canManageCashFlow && (
                          <>
                            <button
                              onClick={(e) => handleEditRequest(e, request)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-xs font-medium"
                              title="Edit request"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteRequest(e, request)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs font-medium"
                              title="Delete request"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </>
                        )}
                      </div>
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
        canApproveLevel1={canApproveLevel1}
        canApproveLevel2={canApproveLevel2}
      />

      {/* Edit Modal */}
      <EditCashAdvanceModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        request={requestToEdit}
        onEditSuccess={handleEditSuccess}
      />

      {/* Delete Modal */}
      <DeleteCashAdvanceModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        request={requestToDelete}
        onDeleteSuccess={handleDeleteSuccess}
      />
    </div>
  );
}
