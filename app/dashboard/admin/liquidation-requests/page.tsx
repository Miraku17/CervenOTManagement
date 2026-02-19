'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Receipt, Filter, ChevronDown, Loader2, CheckCircle, XCircle, Clock, Eye, AlertTriangle, FileDown, FolderDown, X, User, Pencil, Trash2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';
import JSZip from 'jszip';
import { Pagination } from '@/components/ui/pagination';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { LiquidationDetailModal } from '@/components/admin_dashboard/LiquidationDetailModal';
import { EditLiquidationModal } from '@/components/admin_dashboard/EditLiquidationModal';
import { DeleteLiquidationModal } from '@/components/admin_dashboard/DeleteLiquidationModal';

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
  liquidation_item_attachments?: LiquidationAttachment[];
}

interface LiquidationAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  liquidation_item_id?: string | null;
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
  status: 'pending' | 'level1_approved' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  reviewer_comment: string | null;
  level1_approved_by: string | null;
  level1_approved_at: string | null;
  level1_reviewer_comment: string | null;
  level2_approved_by: string | null;
  level2_approved_at: string | null;
  level2_reviewer_comment: string | null;
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
    position_id: string | null;
    positions: {
      name: string;
    } | null;
  } | null;
  approver: {
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
  level1_approver: {
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
  level2_approver: {
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

interface Employee {
  id: string;
  fullName: string;
  email: string;
  employee_id: string | null;
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
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [liquidationToEdit, setLiquidationToEdit] = useState<Liquidation | null>(null);
  const [liquidationToDelete, setLiquidationToDelete] = useState<Liquidation | null>(null);

  const canManageLiquidation = hasPermission('manage_liquidation');
  const canApproveLiquidation = hasPermission('approve_liquidations');
  const canApproveLevel1 = hasPermission('approve_liquidations_level1');
  const canApproveLevel2 = hasPermission('approve_liquidations_level2');

  // Export states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isDownloadingAttachments, setIsDownloadingAttachments] = useState(false);

  // Fetch employees for export dropdown
  useEffect(() => {
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const response = await fetch('/api/employees/get');
        if (response.ok) {
          const data = await response.json();
          setEmployees((data.employees || []).map((emp: any) => ({
            id: emp.id,
            fullName: emp.fullName || `${emp.first_name} ${emp.last_name}`,
            email: emp.email,
            employee_id: emp.employee_id,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch employees:', error);
      } finally {
        setIsLoadingEmployees(false);
      }
    };
    if (canManageLiquidation) {
      fetchEmployees();
    }
  }, [canManageLiquidation]);

  // Get selected employee object from ID
  const selectedEmployee = employees.find(emp => emp.id === selectedEmployeeId) || null;

  const convertLiquidationsToExcel = (liquidations: any[]) => {
    if (!liquidations || liquidations.length === 0) return null;

    const reportData: any[][] = [];

    // Title row
    reportData.push(['Liquidation Report']);
    reportData.push([]);

    // Headers
    reportData.push([
      'Employee Name',
      'Employee ID',
      'Store Code',
      'Store Name',
      'Incident No.',
      'Liquidation Date',
      'Expense Date',
      'From Destination',
      'To Destination',
      'Jeep',
      'Bus',
      'FX/Van',
      'Gas',
      'Toll',
      'Meals',
      'Lodging',
      'Others',
      'Item Total',
      'Item Remarks',
      'Cash Advance',
      'Total Expenses',
      'Return to Company',
      'Reimbursement',
      'Status',
      'Approved At',
      'Overall Remarks'
    ]);

    // Sort liquidations alphabetically by last name, then first name, then by date
    const sortedLiquidations = [...liquidations].sort((a, b) => {
      const lastNameA = a.profiles?.last_name || '';
      const lastNameB = b.profiles?.last_name || '';
      const lastNameCompare = lastNameA.localeCompare(lastNameB);
      if (lastNameCompare !== 0) return lastNameCompare;

      const firstNameA = a.profiles?.first_name || '';
      const firstNameB = b.profiles?.first_name || '';
      const firstNameCompare = firstNameA.localeCompare(firstNameB);
      if (firstNameCompare !== 0) return firstNameCompare;

      // If names are the same, sort by date
      return a.liquidation_date.localeCompare(b.liquidation_date);
    });

    // Data rows - each liquidation item gets its own row
    for (const liq of sortedLiquidations) {
      const employeeName = liq.profiles
        ? `${liq.profiles.first_name} ${liq.profiles.last_name}`
        : 'Unknown';
      const employeeId = liq.profiles?.employee_id || 'N/A';
      const storeCode = liq.stores?.store_code || 'N/A';
      const storeName = liq.stores?.store_name || 'N/A';
      const incidentNo = liq.tickets?.rcc_reference_number || 'N/A';
      const liquidationDate = liq.liquidation_date;
      const cashAdvance = liq.cash_advances?.amount || 0;
      const totalExpenses = liq.total_amount || 0;
      const returnToCompany = liq.return_to_company || 0;
      const reimbursement = liq.reimbursement || 0;
      const status = liq.status?.toUpperCase() || 'PENDING';
      const approvedAt = liq.approved_at
        ? format(new Date(liq.approved_at), 'MMM dd, yyyy h:mm a')
        : 'N/A';
      const overallRemarks = liq.remarks || '';

      // Each liquidation item gets its own row
      if (liq.liquidation_items && liq.liquidation_items.length > 0) {
        liq.liquidation_items.forEach((item: any) => {
          reportData.push([
            employeeName,
            employeeId,
            storeCode,
            storeName,
            incidentNo,
            liquidationDate,
            item.expense_date || '',
            item.from_destination || '',
            item.to_destination || '',
            item.jeep || 0,
            item.bus || 0,
            item.fx_van || 0,
            item.gas || 0,
            item.toll || 0,
            item.meals || 0,
            item.lodging || 0,
            item.others || 0,
            item.total || 0,
            item.remarks || '',
            cashAdvance,
            totalExpenses,
            returnToCompany,
            reimbursement,
            status,
            approvedAt,
            overallRemarks
          ]);
        });
      } else {
        // If no items, still show the liquidation with empty expense columns
        reportData.push([
          employeeName,
          employeeId,
          storeCode,
          storeName,
          incidentNo,
          liquidationDate,
          '', // expense_date
          '', // from_destination
          '', // to_destination
          0, // jeep
          0, // bus
          0, // fx_van
          0, // gas
          0, // toll
          0, // meals
          0, // lodging
          0, // others
          0, // item total
          '', // item remarks
          cashAdvance,
          totalExpenses,
          returnToCompany,
          reimbursement,
          status,
          approvedAt,
          overallRemarks
        ]);
      }
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(reportData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 },  // Employee Name
      { wch: 15 },  // Employee ID
      { wch: 12 },  // Store Code
      { wch: 20 },  // Store Name
      { wch: 15 },  // Incident No.
      { wch: 15 },  // Liquidation Date
      { wch: 15 },  // Expense Date
      { wch: 20 },  // From Destination
      { wch: 20 },  // To Destination
      { wch: 10 },  // Jeep
      { wch: 10 },  // Bus
      { wch: 10 },  // FX/Van
      { wch: 10 },  // Gas
      { wch: 10 },  // Toll
      { wch: 10 },  // Meals
      { wch: 10 },  // Lodging
      { wch: 10 },  // Others
      { wch: 12 },  // Item Total
      { wch: 25 },  // Item Remarks
      { wch: 15 },  // Cash Advance
      { wch: 15 },  // Total Expenses
      { wch: 18 },  // Return to Company
      { wch: 15 },  // Reimbursement
      { wch: 12 },  // Status
      { wch: 20 },  // Approved At
      { wch: 30 }   // Overall Remarks
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
          // Title
          cell.s = {
            fill: { fgColor: { rgb: "F97316" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
            alignment: { horizontal: "center" }
          };
        } else if (R === 2) {
          // Headers
          cell.s = {
            fill: { fgColor: { rgb: "334155" } },
            font: { bold: true, color: { rgb: "FFFFFF" } },
            alignment: { horizontal: "center" },
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
            border: {
              top: { style: "thin", color: { rgb: "E2E8F0" } },
              bottom: { style: "thin", color: { rgb: "E2E8F0" } },
              left: { style: "thin", color: { rgb: "E2E8F0" } },
              right: { style: "thin", color: { rgb: "E2E8F0" } }
            }
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Liquidations');
    return workbook;
  };

  const handleExport = async (type: 'all' | 'individual') => {
    if (!exportStartDate || !exportEndDate) {
      alert('Please select both start and end dates.');
      return;
    }

    if (type === 'individual' && !selectedEmployee) {
      alert('Please select an employee.');
      return;
    }

    if (type === 'all') setIsExportingAll(true);
    else setIsExporting(true);

    try {
      const params = new URLSearchParams({
        startDate: exportStartDate,
        endDate: exportEndDate,
      });
      if (type === 'individual' && selectedEmployee) {
        params.append('userId', selectedEmployee.id);
      }

      const response = await fetch(`/api/liquidation/export?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to export liquidations');
      }

      if (!result.liquidations || result.liquidations.length === 0) {
        alert('No liquidation records found for the selected criteria.');
        return;
      }

      const workbook = convertLiquidationsToExcel(result.liquidations);
      if (!workbook) {
        alert('Failed to generate Excel file.');
        return;
      }

      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });

      // For individual export, include receipts in a ZIP file
      if (type === 'individual' && result.includeAttachments) {
        const zip = new JSZip();

        // Add Excel file to ZIP
        const excelFilename = `liquidations_${selectedEmployee?.fullName.replace(/\s+/g, '_')}_${exportStartDate}_${exportEndDate}.xlsx`;
        zip.file(excelFilename, excelBuffer);

        // Create receipts folder
        const receiptsFolder = zip.folder('receipts');

        // Collect all attachments with signed URLs
        let attachmentIndex = 0;
        for (const liq of result.liquidations) {
          if (!liq.liquidation_attachments || liq.liquidation_attachments.length === 0) continue;

          const liqDate = liq.liquidation_date;
          const storeName = liq.stores?.store_code || 'unknown';

          for (const attachment of liq.liquidation_attachments) {
            if (!attachment.signed_url) continue;

            try {
              // Fetch the image
              const imgResponse = await fetch(attachment.signed_url);
              if (!imgResponse.ok) continue;

              const imgBlob = await imgResponse.blob();

              // Create a meaningful filename
              const ext = attachment.file_name.split('.').pop() || 'jpg';
              const sanitizedName = attachment.file_name.replace(/[^a-zA-Z0-9.-]/g, '_');
              const filename = `${liqDate}_${storeName}_${attachmentIndex + 1}_${sanitizedName}`;

              receiptsFolder?.file(filename, imgBlob);
              attachmentIndex++;
            } catch (imgError) {
              console.error('Failed to download attachment:', imgError);
            }
          }
        }

        // Generate ZIP and download
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipUrl = window.URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = zipUrl;
        a.download = `liquidations_${selectedEmployee?.fullName.replace(/\s+/g, '_')}_${exportStartDate}_${exportEndDate}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(zipUrl);
      } else {
        // For bulk export, just download Excel
        const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const filename = `liquidations_all_${exportStartDate}_${exportEndDate}.xlsx`;

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export liquidations. Please try again.');
    } finally {
      if (type === 'all') setIsExportingAll(false);
      else setIsExporting(false);
    }
  };

  const handleDownloadAllAttachments = async () => {
    setIsDownloadingAttachments(true);
    try {
      const response = await fetch('/api/liquidation/download-attachments');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch attachments');
      }

      if (!result.attachments || result.attachments.length === 0) {
        alert('No image attachments found.');
        return;
      }

      const zip = new JSZip();

      for (const attachment of result.attachments) {
        if (!attachment.signed_url) continue;

        try {
          const imgResponse = await fetch(attachment.signed_url);
          if (!imgResponse.ok) continue;

          const imgBlob = await imgResponse.blob();
          const date = attachment.liquidation_date || 'unknown-date';
          const sanitizedName = attachment.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
          zip.folder(date)?.file(sanitizedName, imgBlob);
        } catch (err) {
          console.error('Failed to download attachment:', err);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = window.URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = `liquidation_receipts_${today}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(zipUrl);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download attachments. Please try again.');
    } finally {
      setIsDownloadingAttachments(false);
    }
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-liquidations', currentPage, pageLimit, statusFilter],
    queryFn: () => fetchLiquidations(currentPage, pageLimit, statusFilter),
    enabled: canManageLiquidation || canApproveLiquidation || canApproveLevel1 || canApproveLevel2,
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

  const handleEditLiquidation = (e: React.MouseEvent, liquidation: Liquidation) => {
    e.stopPropagation();
    setLiquidationToEdit(liquidation);
    setIsEditModalOpen(true);
  };

  const handleDeleteLiquidation = (e: React.MouseEvent, liquidation: Liquidation) => {
    e.stopPropagation();
    setLiquidationToDelete(liquidation);
    setIsDeleteModalOpen(true);
  };

  const handleEditSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-liquidations'] });
  };

  const handleDeleteSuccess = () => {
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
      case 'level1_approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <CheckCircle size={12} />
            Level 1 Approved
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

  const getApprovalLevelStatus = (liquidation: Liquidation, level: 1 | 2) => {
    const approver = level === 1 ? liquidation.level1_approver : liquidation.level2_approver;
    const approvedAt = level === 1 ? liquidation.level1_approved_at : liquidation.level2_approved_at;
    const isRejected = liquidation.status === 'rejected';
    const isApproved = level === 1
      ? (liquidation.level1_approved_by !== null)
      : (liquidation.level2_approved_by !== null);

    // Check if this level should show as rejected
    const isRejectedAtThisLevel = isRejected && (
      (level === 1 && liquidation.level1_approved_by && !liquidation.level2_approved_by) ||
      (level === 2 && liquidation.level2_approved_by)
    );

    if (isRejectedAtThisLevel) {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
            <XCircle size={12} />
            Rejected
          </span>
          {approver && (
            <span className="text-xs text-slate-500 truncate max-w-[120px]" title={`${approver.first_name} ${approver.last_name}`}>
              {approver.first_name} {approver.last_name}
            </span>
          )}
        </div>
      );
    }

    if (isApproved) {
      return (
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
            <CheckCircle size={12} />
            Approved
          </span>
          {approver && (
            <span className="text-xs text-slate-500 truncate max-w-[120px]" title={`${approver.first_name} ${approver.last_name}`}>
              {approver.first_name} {approver.last_name}
            </span>
          )}
        </div>
      );
    }

    // Not yet reached this level
    if (level === 2 && liquidation.status === 'pending') {
      return (
        <span className="text-xs text-slate-600">-</span>
      );
    }

    // Pending at this level
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
        <Clock size={12} />
        Pending
      </span>
    );
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

  // Show access denied if no permission (need either manage or approve permission)
  if (!canManageLiquidation && !canApproveLiquidation && !canApproveLevel1 && !canApproveLevel2) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3">
        <AlertTriangle size={24} />
        <div>
          <h2 className="font-bold text-lg">Access Denied</h2>
          <p>You do not have permission to view liquidation requests.</p>
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadAllAttachments}
            disabled={isDownloadingAttachments}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDownloadingAttachments ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <FolderDown size={18} />
            )}
            {isDownloadingAttachments ? 'Downloading...' : 'Download Receipts'}
          </button>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors font-medium"
          >
            <FileDown size={18} />
            Export
          </button>
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
            <span>Status: {statusFilter === 'all' ? 'All' : statusFilter === 'level1_approved' ? 'Level 1 Approved' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}</span>
            <ChevronDown size={16} className={`transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isStatusDropdownOpen && (
            <div className="absolute z-10 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl">
              {['all', 'pending', 'level1_approved', 'approved', 'rejected'].map((status) => (
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
                  {status === 'all' ? 'All' : status === 'level1_approved' ? 'Level 1 Approved' : status.charAt(0).toUpperCase() + status.slice(1)}
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
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Ticket No.</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Cash Advance</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Expenses</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Level 1</th>
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Level 2</th>
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
                        {liquidation.profiles?.positions?.name && (
                          <p className="text-xs text-slate-500 italic">{liquidation.profiles.positions.name}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {liquidation.stores?.store_code || '-'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-300">
                        {liquidation.tickets?.rcc_reference_number || '-'}
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
                    <td className="px-6 py-4">{getApprovalLevelStatus(liquidation, 1)}</td>
                    <td className="px-6 py-4">{getApprovalLevelStatus(liquidation, 2)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
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
                        {canManageLiquidation && (
                          <>
                            <button
                              onClick={(e) => handleEditLiquidation(e, liquidation)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 hover:bg-orange-500/20 transition-colors text-xs font-medium"
                            >
                              <Pencil size={14} />
                              Edit
                            </button>
                            <button
                              onClick={(e) => handleDeleteLiquidation(e, liquidation)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-xs font-medium"
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
      <LiquidationDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
        liquidation={selectedLiquidation}
        adminId={user?.id || ''}
        onActionSuccess={handleActionSuccess}
        canApproveLiquidation={canApproveLiquidation}
        canApproveLevel1={canApproveLevel1}
        canApproveLevel2={canApproveLevel2}
      />

      {/* Edit Modal */}
      <EditLiquidationModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setLiquidationToEdit(null);
        }}
        liquidation={liquidationToEdit}
        onEditSuccess={handleEditSuccess}
      />

      {/* Delete Modal */}
      <DeleteLiquidationModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setLiquidationToDelete(null);
        }}
        liquidation={liquidationToDelete}
        onDeleteSuccess={handleDeleteSuccess}
      />

      {/* Export Modal */}
      {isExportModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm z-[9999]"
          onClick={() => setIsExportModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <FileDown className="w-5 h-5 text-orange-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Export Liquidations</h3>
              </div>
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              <style jsx>{`
                input[type="date"]::-webkit-calendar-picker-indicator {
                  filter: invert(1);
                  cursor: pointer;
                }
              `}</style>

              {/* Date Range */}
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <h4 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  Date Range
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">Start Date</label>
                    <input
                      type="date"
                      value={exportStartDate}
                      onChange={(e) => setExportStartDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-2">End Date</label>
                    <input
                      type="date"
                      value={exportEndDate}
                      onChange={(e) => setExportEndDate(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>

              {/* Export Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export All */}
                <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-semibold text-white mb-2">Bulk Export</h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Export liquidations for all employees within the date range.
                  </p>
                  <button
                    onClick={() => handleExport('all')}
                    disabled={isExportingAll || isExporting}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      isExportingAll || isExporting
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
                    }`}
                  >
                    {isExportingAll ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Exporting...
                      </>
                    ) : (
                      <>
                        <FileDown size={16} />
                        Export All
                      </>
                    )}
                  </button>
                </div>

                {/* Export Individual */}
                <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700">
                  <h4 className="text-sm font-semibold text-white mb-2">Individual Export</h4>
                  <p className="text-xs text-slate-400 mb-4">
                    Export liquidations for a specific employee.
                  </p>

                  {/* Employee Dropdown */}
                  <div className="mb-4">
                    <label className="block text-xs text-slate-400 mb-2">Select Employee</label>
                    <Select
                      value={selectedEmployeeId}
                      onValueChange={(value) => setSelectedEmployeeId(value)}
                      disabled={isLoadingEmployees}
                    >
                      <SelectTrigger className="w-full bg-slate-900 border-slate-600 text-white h-10 rounded-lg focus:ring-2 focus:ring-orange-500 focus:ring-offset-0">
                        <SelectValue placeholder={isLoadingEmployees ? "Loading employees..." : "Select an employee"} />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60 z-[10000]">
                        {employees.map((emp) => (
                          <SelectItem
                            key={emp.id}
                            value={emp.id}
                            className="text-white focus:bg-slate-800 focus:text-white cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400 text-xs font-bold shrink-0">
                                {emp.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm">{emp.fullName}</span>
                                {emp.employee_id && (
                                  <span className="text-xs text-slate-400">{emp.employee_id}</span>
                                )}
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Selected Employee Preview */}
                  {selectedEmployee && (
                    <div className="bg-slate-900 border border-slate-600 rounded-lg p-2 mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-orange-600/20 flex items-center justify-center text-orange-400">
                          <User size={14} />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{selectedEmployee.fullName}</div>
                          <div className="text-xs text-slate-500">{selectedEmployee.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedEmployeeId('')}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}

                  <button
                    onClick={() => handleExport('individual')}
                    disabled={!selectedEmployee || isExporting || isExportingAll}
                    className={`w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
                      !selectedEmployee || isExporting || isExportingAll
                        ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                        : 'bg-orange-600 hover:bg-orange-500 text-white'
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
                        Export Individual
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-end">
              <button
                onClick={() => setIsExportModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
