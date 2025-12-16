import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Calendar, AlertCircle, Clock, Loader2, Search, FileDown, Upload, Edit3, ChevronDown, Eye } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { differenceInDays, parseISO } from 'date-fns';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LeaveRequestDetailModal } from '@/components/LeaveRequestDetailModal';
import { UploadLeaveCreditsModal } from '@/components/admin_dashboard/UploadLeaveCreditsModal';
import { QuickUpdateLeaveCreditsModal } from '@/components/admin_dashboard/QuickUpdateLeaveCreditsModal';
import { ViewLeaveCreditsModal } from '@/components/admin_dashboard/ViewLeaveCreditsModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewer?: {
    first_name: string;
    last_name: string;
  } | null;
  reviewed_at?: string;
}

interface ConfirmationState {
  isOpen: boolean;
  requestId: string | null;
  action: 'approve' | 'reject' | null;
  employeeName: string;
}

const LeaveRequestsView: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    requestId: null,
    action: null,
    employeeName: '',
  });
  const [reviewerComment, setReviewerComment] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequest | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isQuickUpdateModalOpen, setIsQuickUpdateModalOpen] = useState(false);
  const [isViewCreditsModalOpen, setIsViewCreditsModalOpen] = useState(false);
  const [showLeaveCreditsDropdown, setShowLeaveCreditsDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowLeaveCreditsDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/leave-requests');
      if (!response.ok) throw new Error('Failed to fetch leave requests');
      const result = await response.json();
      setRequests(result.data || []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching leave requests:', err);
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
      employeeName: `${request.employee.first_name} ${request.employee.last_name}`,
    });
  };

  const closeConfirmation = () => {
    setConfirmation({
      isOpen: false,
      requestId: null,
      action: null,
      employeeName: '',
    });
    setReviewerComment('');
  };

  const handleConfirmedAction = async () => {
    if (!confirmation.requestId || !confirmation.action) return;

    setProcessingId(confirmation.requestId);
    closeConfirmation();

    try {
      const response = await fetch('/api/admin/update-leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: confirmation.requestId,
          action: confirmation.action,
          adminId: user?.id,
          reviewerComment: reviewerComment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update request');
      }

      await fetchRequests();
    } catch (err: any) {
      console.error(`Error ${confirmation.action}ing request:`, err);
      setError(err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleApprove = (id: string) => openConfirmation(id, 'approve');
  const handleReject = (id: string) => openConfirmation(id, 'reject');

  const handleExportPDF = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates for export');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Filter requests by date range
      const filteredByDate = requests.filter(req => {
        const reqDate = new Date(req.created_at);
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        return reqDate >= start && reqDate <= end;
      });

      // Sort by employee name
      const sortedRequests = [...filteredByDate].sort((a, b) => {
        const nameA = `${a.employee.first_name} ${a.employee.last_name}`;
        const nameB = `${b.employee.first_name} ${b.employee.last_name}`;
        return nameA.localeCompare(nameB);
      });

      // Add logo
      try {
        const logoImg = new Image();
        logoImg.src = '/logo.png';
        await new Promise((resolve, reject) => {
          logoImg.onload = resolve;
          logoImg.onerror = reject;
        });

        const logoWidth = 80;
        const logoHeight = 20;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
      } catch (error) {
        console.error('Failed to load logo:', error);
      }

      // Add document title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text("Leave Requests Report", pageWidth / 2, 38, { align: 'center' });

      // Add date range and count
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      const dateRange = `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`;
      doc.text(`Period: ${dateRange}`, 14, 46);
      doc.text(`Total Requests: ${sortedRequests.length}`, pageWidth - 14, 46, { align: 'right' });

      // Add separator line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 52, pageWidth - 14, 52);

      // Prepare table data
      const tableColumn = [
        "Employee",
        "Leave Type",
        "Start Date",
        "End Date",
        "Days",
        "Status",
        "Reviewer"
      ];

      const tableRows = sortedRequests.map((req) => {
        const employeeName = `${req.employee.first_name} ${req.employee.last_name}`;
        const duration = calculateDuration(req.start_date, req.end_date);
        const reviewer = req.reviewer
          ? `${req.reviewer.first_name} ${req.reviewer.last_name}`
          : 'N/A';

        return [
          employeeName,
          req.leave_type,
          new Date(req.start_date).toLocaleDateString(),
          new Date(req.end_date).toLocaleDateString(),
          `${duration} day${duration !== 1 ? 's' : ''}`,
          req.status.charAt(0).toUpperCase() + req.status.slice(1),
          reviewer
        ];
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 58,
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'left',
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        columnStyles: {
          0: { cellWidth: 35 }, // Employee
          1: { cellWidth: 25 }, // Leave Type
          2: { cellWidth: 25 }, // Start Date
          3: { cellWidth: 25 }, // End Date
          4: { cellWidth: 18 }, // Days
          5: { cellWidth: 22 }, // Status
          6: { cellWidth: 'auto' }, // Reviewer
        },
        margin: { left: 14, right: 14 },
      });

      // Add footer with page numbers
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      const filename = `Leave_Requests_${startDate}_to_${endDate}.pdf`;
      doc.save(filename);

    } catch (error: any) {
      console.error('Export failed:', error);
      setError('Failed to export PDF. Please try again.');
      setTimeout(() => setError(null), 3000);
    } finally {
      setIsExporting(false);
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

  const calculateDuration = (start: string, end: string) => {
    try {
      const diff = differenceInDays(parseISO(end), parseISO(start)) + 1;
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'all' ? true : req.status === filter;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      req.employee.first_name.toLowerCase().includes(searchLower) ||
      req.employee.last_name.toLowerCase().includes(searchLower) ||
      req.employee.email.toLowerCase().includes(searchLower);
    
    return matchesFilter && matchesSearch;
  });

  const getConfirmationConfig = () => {
    if (confirmation.action === 'approve') {
      return {
        title: 'Approve Leave Request',
        message: `Are you sure you want to approve the leave request for ${confirmation.employeeName}? This will deduct credits from their balance.`,
        confirmText: 'Approve',
        type: 'info' as const,
      };
    } else {
      return {
        title: 'Reject Leave Request',
        message: `Are you sure you want to reject the leave request for ${confirmation.employeeName}?`,
        confirmText: 'Reject',
        type: 'danger' as const,
      };
    }
  };

  const handleRowClick = (request: LeaveRequest) => {
    setSelectedRequest(request);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedRequest(null);
  };

  const handleUploadSuccess = () => {
    // Optionally refresh the page or show a success message
    // You might want to refetch employee data if the leave credits are displayed
  };

  // Check if the current user is Operations Manager
  const isOperationsManager = user?.position === 'Operations Manager';

  if (isLoading && requests.length === 0) {
     return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400">Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ConfirmModal
        isOpen={confirmation.isOpen}
        {...getConfirmationConfig()}
        onConfirm={handleConfirmedAction}
        onCancel={closeConfirmation}
      >
        <textarea
          value={reviewerComment}
          onChange={(e) => setReviewerComment(e.target.value)}
          placeholder="Optional: Add a comment for the employee..."
          className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder-slate-600"
          rows={3}
        />
      </ConfirmModal>

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Leave Requests</h2>
          <p className="text-slate-400 mt-1">Manage employee leave applications</p>
        </div>

        {isOperationsManager && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowLeaveCreditsDropdown(!showLeaveCreditsDropdown)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-lg"
            >
              <Upload size={18} />
              <span className="whitespace-nowrap">Manage Leave Credits</span>
              <ChevronDown size={18} className={`transition-transform ${showLeaveCreditsDropdown ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showLeaveCreditsDropdown && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden">
                <button
                  onClick={() => {
                    setIsViewCreditsModalOpen(true);
                    setShowLeaveCreditsDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors text-white border-b border-slate-800"
                >
                  <Eye size={18} className="text-blue-400" />
                  <div>
                    <p className="font-medium">View Leave Credits</p>
                    <p className="text-xs text-slate-400">See all employees</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsQuickUpdateModalOpen(true);
                    setShowLeaveCreditsDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors text-white border-b border-slate-800"
                >
                  <Edit3 size={18} className="text-emerald-400" />
                  <div>
                    <p className="font-medium">Quick Update</p>
                    <p className="text-xs text-slate-400">Update single employee</p>
                  </div>
                </button>
                <button
                  onClick={() => {
                    setIsUploadModalOpen(true);
                    setShowLeaveCreditsDropdown(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800 transition-colors text-white"
                >
                  <Upload size={18} className="text-purple-400" />
                  <div>
                    <p className="font-medium">Bulk Upload</p>
                    <p className="text-xs text-slate-400">Upload Excel file</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search and Filter Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search employee..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm placeholder-slate-500"
          />
        </div>

        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Export Section */}
      <div className="bg-slate-800/50 p-4 sm:p-6 rounded-xl border border-slate-700/50">
        <div className="flex items-center gap-3 mb-4">
          <FileDown className="w-5 h-5 text-blue-500" />
          <h3 className="text-base sm:text-lg font-semibold text-white">Export Leave Requests Report</h3>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
            />
          </div>
          <div className="sm:self-end">
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className={`w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg ${
                isExporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isExporting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span className="whitespace-nowrap">Exporting...</span>
                </>
              ) : (
                <>
                  <FileDown size={18} />
                  <span className="whitespace-nowrap">Export PDF</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          {error}
        </div>
      )}

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950/50 text-slate-200 font-medium border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-1/4">Reason</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No {filter !== 'all' ? filter : ''} leave requests found</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => {
                   const duration = calculateDuration(request.start_date, request.end_date);
                   const initials = `${request.employee.first_name[0]}${request.employee.last_name[0]}`;
                   
                   return (
                  <tr
                    key={request.id}
                    className="hover:bg-slate-800/30 transition-colors cursor-pointer"
                    onClick={() => handleRowClick(request)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          {initials}
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">
                            {request.employee.first_name} {request.employee.last_name}
                          </div>
                          <div className="text-xs text-slate-500">{request.employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-blue-300">
                        {request.leave_type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="text-slate-300">From: {new Date(request.start_date).toLocaleDateString()}</span>
                        <span className="text-slate-500">To: {new Date(request.end_date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {duration} day{duration !== 1 ? 's' : ''}
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
                            {request.reviewed_at && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(request.reviewed_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 truncate max-w-xs" title={request.reason}>
                      {request.reason}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {request.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(request.id);
                            }}
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
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(request.id);
                            }}
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
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Leave Request Detail Modal */}
      <LeaveRequestDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        request={selectedRequest}
      />

      {/* Upload Leave Credits Modal */}
      <UploadLeaveCreditsModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Quick Update Leave Credits Modal */}
      <QuickUpdateLeaveCreditsModal
        isOpen={isQuickUpdateModalOpen}
        onClose={() => setIsQuickUpdateModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* View Leave Credits Modal */}
      <ViewLeaveCreditsModal
        isOpen={isViewCreditsModalOpen}
        onClose={() => setIsViewCreditsModalOpen(false)}
      />
    </div>
  );
};

export default LeaveRequestsView;
