"use client"
import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Ticket as TicketIcon, Search, ArrowUpDown, Upload, FileSpreadsheet, History, ChevronDown, Calendar, Clock, MapPin, AlertTriangle, Trash2, Loader2, X, AlertCircle, User, Filter } from 'lucide-react';
import { format } from 'date-fns';
import AddTicketModal from '@/components/ticketing/AddTicketModal';
import TicketDetailModal from '@/components/ticketing/TicketDetailModal';
import TicketImportLogsModal from '@/components/ticketing/TicketImportLogsModal';
import ImportLoadingModal from '@/components/ticketing/ImportLoadingModal';
import { ToastContainer, ToastProps } from '@/components/Toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { supabase } from '@/services/supabase';
import { useRouter } from 'next/navigation';
import { ShieldAlert } from 'lucide-react';
import { Pagination } from "@/components/ui/pagination";

// Define the Ticket interface to match the API response and Modal props
interface Ticket {
  id: string;
  store_id: string;
  station_id: string;
  mod_id?: string | null;
  reported_by: string;
  serviced_by: string;
  rcc_reference_number: string;
  date_reported: string;
  time_reported: string;
  date_responded: string | null;
  time_responded: string | null;
  request_type: string;
  request_type_id?: string;
  device: string;
  request_detail: string;
  problem_category: string;
  problem_category_id?: string;
  sev: string;
  action_taken: string | null;
  final_resolution: string | null;
  status: string;
  parts_replaced: string | null;
  new_parts_serial: string | null;
  old_parts_serial: string | null;
  date_ack: string | null;
  time_ack: string | null;
  date_attended: string | null;
  store_arrival: string | null;
  work_start: string | null;
  pause_time_start: string | null;
  pause_time_end: string | null;
  pause_time_start_2: string | null;
  pause_time_end_2: string | null;
  work_end: string | null;
  date_resolved: string | null;
  time_resolved: string | null;
  sla_count_hrs: number | null;
  downtime: string | null;
  sla_status: string | null;
  created_at: string;
  stores?: { store_name: string; store_code: string };
  stations?: { name: string };
  reported_by_user?: { first_name: string; last_name: string };
  serviced_by_user?: { first_name: string; last_name: string };
  store_managers?: { id: string; manager_name: string };
  request_types?: { id: string; name: string };
  problem_categories?: { id: string; name: string };
}

interface TicketsResponse {
  tickets: Ticket[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const fetchTickets = async (
  page: number,
  limit: number,
  statusFilter?: string,
  searchTerm?: string,
  startDate?: string,
  endDate?: string
): Promise<TicketsResponse> => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (statusFilter && statusFilter !== 'all') {
    params.append('status', statusFilter);
  }
  if (searchTerm) {
    params.append('search', searchTerm);
  }
  if (startDate) {
    params.append('startDate', startDate);
  }
  if (endDate) {
    params.append('endDate', endDate);
  }

  const response = await fetch(`/api/tickets/get?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tickets');
  }
  return response.json();
};

export default function TicketsPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string>('');
  const [isImportLogsModalOpen, setIsImportLogsModalOpen] = useState(false);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [showAll, setShowAll] = useState(false);

  // Fetch tickets with TanStack Query
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['tickets', currentPage, showAll ? 999999 : pageLimit, statusFilter, searchTerm, startDate, endDate],
    queryFn: () => fetchTickets(currentPage, showAll ? 999999 : pageLimit, statusFilter, searchTerm, startDate, endDate),
    enabled: !permissionsLoading && !checkingRole && hasPermission('manage_tickets'),
    staleTime: 30000, // 30 seconds
  });

  // Status options for dropdown
  const statusOptions = [
    { value: 'all', label: 'All Statuses', color: 'text-slate-400' },
    { value: 'open', label: 'Open', color: 'text-blue-400' },
    { value: 'in_progress', label: 'In Progress', color: 'text-yellow-400' },
    { value: 'on_hold', label: 'On Hold', color: 'text-orange-400' },
    { value: 'closed', label: 'Closed', color: 'text-green-400' },
    { value: 'replacement', label: 'Replacement', color: 'text-purple-400' },
    { value: 'revisit', label: 'Revisit', color: 'text-cyan-400' },
    { value: 'cancelled', label: 'Cancelled', color: 'text-red-400' },
    { value: 'completed', label: 'Completed', color: 'text-emerald-400' },
    { value: 'duplicate', label: 'Duplicate', color: 'text-pink-400' },
    { value: 'misroute', label: 'Misroute', color: 'text-amber-400' },
    { value: 'pending', label: 'Pending', color: 'text-indigo-400' },
  ];

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isStatusDropdownOpen]);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, searchTerm, startDate, endDate]);

  // Check user role using useEffect
  React.useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) {
        setCheckingRole(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(profile?.role === 'admin');
          setUserPosition((profile?.positions as any)?.name || '');
        }
      } catch (error) {
        console.error('Error checking user role:', error);
        setIsAdmin(false);
      } finally {
        setCheckingRole(false);
      }
    };

    if (user?.id) {
      checkUserRole();
    } else {
      setCheckingRole(false);
    }
  }, [user?.id]);

  // Permission checks
  const canCreateTicket = hasPermission('manage_tickets') && userPosition !== 'Field Engineer';
  const canDeleteTicket = hasPermission('delete_tickets');

  // Toast helper function
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string, details?: string[]) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, description, details, onClose: removeToast }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Generate import report as downloadable .txt file
  const generateImportReport = (result: any, fileName: string) => {
    const lines: string[] = [];
    const timestamp = new Date().toLocaleString();

    lines.push('='.repeat(80));
    lines.push('TICKET IMPORT REPORT');
    lines.push('='.repeat(80));
    lines.push(`File: ${fileName}`);
    lines.push(`Date: ${timestamp}`);
    lines.push('');
    lines.push('SUMMARY:');
    lines.push(`  - Successfully imported: ${result.success}`);
    lines.push(`  - Failed: ${result.failed}`);
    lines.push(`  - Skipped: ${result.skipped || 0}`);
    lines.push(`  - With missing data: ${result.warnings?.length || 0}`);
    lines.push('');

    // Errors section
    if (result.errors && result.errors.length > 0) {
      lines.push('='.repeat(80));
      lines.push('ERRORS (Failed Rows)');
      lines.push('='.repeat(80));
      result.errors.forEach((err: any) => {
        lines.push(`Row ${err.row}: ${err.error}`);
      });
      lines.push('');
    }

    // Skipped rows section
    if (result.skippedRows && result.skippedRows.length > 0) {
      lines.push('='.repeat(80));
      lines.push('SKIPPED ROWS');
      lines.push('='.repeat(80));
      result.skippedRows.forEach((skip: any) => {
        lines.push(`Row ${skip.row}: ${skip.reason}`);
      });
      lines.push('');
    }

    // Warnings section
    if (result.warnings && result.warnings.length > 0) {
      lines.push('='.repeat(80));
      lines.push('ROWS WITH MISSING DATA (Defaults Applied)');
      lines.push('='.repeat(80));
      result.warnings.forEach((warn: any) => {
        lines.push(`Row ${warn.row}:`);
        lines.push(`  Missing Fields: ${warn.missingFields.join(', ')}`);
        lines.push(`  Applied Defaults: ${warn.defaults}`);
        lines.push('');
      });
    }

    lines.push('='.repeat(80));
    lines.push('END OF REPORT');
    lines.push('='.repeat(80));

    // Create and download the file
    const reportContent = lines.join('\n');
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-report-${new Date().getTime()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleSuccess = () => {
    refetch();
  };

  const handleDeleteClick = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTicketToDelete(ticketId);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!ticketToDelete) return;

    setIsDeleting(true);

    try {
      const response = await fetch('/api/tickets/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ticketToDelete }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete ticket');
      }

      await refetch();
      setIsDeleteModalOpen(false);
      setTicketToDelete(null);
      showToast('success', 'Ticket Deleted', 'The ticket has been successfully deleted.');
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      showToast('error', 'Delete Failed', error.message || 'Failed to delete ticket');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTicketToDelete(null);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/tickets/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ticket_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error: any) {
      console.error('Error downloading template:', error);
      showToast('error', 'Download Failed', error.message || 'Failed to download template');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Invalid File Type', 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    const maxFileSize = 10 * 1024 * 1024;
    if (file.size > maxFileSize) {
      showToast('error', 'File Too Large', 'Maximum file size is 10MB.');
      return;
    }

    setIsImporting(true);
    setImportingFileName(file.name);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1];

          const validationResponse = await fetch('/api/tickets/validate-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData }),
          });

          const validationData = await validationResponse.json();

          if (!validationResponse.ok) {
            setValidationErrors(validationData.errors || ['Unknown validation error']);
            setShowValidationModal(true);
            setIsImporting(false);
            setImportingFileName('');
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }

          const response = await fetch('/api/tickets/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData,
              fileName: file.name
            }),
          });

          const importData = await response.json();

          if (!response.ok) {
            throw new Error(importData.error || importData.details || 'Failed to import file');
          }

          const { result } = importData;

          // Generate and download report if there are issues
          if (result.errors?.length > 0 || result.warnings?.length > 0 || result.skippedRows?.length > 0) {
            generateImportReport(result, file.name);
          }

          // Prepare messages
          const messages: string[] = [];

          if (result.failed > 0) {
            const errorSummary = result.errors?.slice(0, 10).map((e: any) =>
              `Row ${e.row}: ${e.error}`
            ) || [];
            messages.push(...errorSummary);
            if (result.failed > 10) {
              messages.push(`...and ${result.failed - 10} more errors`);
            }
          }

          if (result.skippedRows && result.skippedRows.length > 0) {
            if (messages.length > 0) messages.push(''); // Empty line separator
            messages.push('--- Skipped Rows ---');
            const skippedSummary = result.skippedRows.slice(0, 5).map((s: any) =>
              `Row ${s.row}: ${s.reason}`
            );
            messages.push(...skippedSummary);
            if (result.skippedRows.length > 5) {
              messages.push(`...and ${result.skippedRows.length - 5} more skipped rows`);
            }
          }

          if (result.warnings && result.warnings.length > 0) {
            if (messages.length > 0) messages.push(''); // Empty line separator
            messages.push('--- Rows with Missing Data (defaults applied) ---');
            const warningSummary = result.warnings.slice(0, 10).map((w: any) =>
              `Row ${w.row}: Missing [${w.missingFields.join(', ')}] - Applied defaults: ${w.defaults}`
            );
            messages.push(...warningSummary);
            if (result.warnings.length > 10) {
              messages.push(`...and ${result.warnings.length - 10} more rows with missing data`);
            }
          }

          if (result.failed > 0) {
            showToast(
              'warning',
              'Import Completed with Issues',
              `${result.success} imported, ${result.failed} failed${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}${result.warnings?.length > 0 ? `, ${result.warnings.length} with missing data` : ''}.`,
              messages.length > 0 ? messages : undefined
            );
          } else if (result.skipped > 0 || (result.warnings && result.warnings.length > 0)) {
            const hasIssues = result.skippedRows?.length > 0 || result.warnings?.length > 0;
            showToast(
              'warning',
              'Import Successful with Warnings',
              `${result.success} tickets imported${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}${result.warnings?.length > 0 ? `, ${result.warnings.length} with missing data` : ''}.${hasIssues ? ' A detailed report has been downloaded.' : ''}`,
              messages
            );
          } else {
            showToast('success', 'Import Successful!', `${result.success} tickets have been imported successfully.`);
          }

          await refetch();
        } catch (error: any) {
          console.error('Error importing file:', error);
          showToast('error', 'Import Failed', error.message || 'Failed to import file');
        } finally {
          setIsImporting(false);
          setImportingFileName('');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading file:', error);
      showToast('error', 'File Read Error', error.message || 'Failed to read file');
      setIsImporting(false);
      setImportingFileName('');
    }
  };

  // Filtering is now done server-side, just sort client-side
  const filteredTickets = React.useMemo(() => {
    if (!data?.tickets) return [];

    const tickets = [...data.tickets];
    return tickets.sort((a, b) => {
      const dateA = new Date(a.date_reported).getTime();
      const dateB = new Date(b.date_reported).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [data?.tickets, sortOrder]);

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase().replace(/_/g, ' ')) {
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
      case 'in progress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      case 'on hold': return 'bg-orange-500/20 text-orange-400 border-orange-500/20';
      case 'closed': return 'bg-green-500/20 text-green-400 border-green-500/20';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'sev1': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'sev2': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'sev3': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  // Show loading while checking permissions or fetching tickets
  if (permissionsLoading || checkingRole || isLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">{isLoading ? 'Loading tickets...' : 'Checking permissions...'}</p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('manage_tickets');

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to access tickets.</p>
            <p className="text-slate-500 text-sm mt-2">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/ticketing')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Tickets</h3>
            <p className="text-slate-400">{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const totalPages = data?.pagination.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets Management</h1>
          <p className="text-slate-400">
            {hasPermission('manage_tickets')
              ? 'Manage and track all support tickets.'
              : 'View tickets assigned to you.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canCreateTicket && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} />
              <span>Create Ticket</span>
            </button>
          )}

          <div className="relative" ref={actionsDropdownRef}>
            <button
              onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all shadow-lg shadow-slate-900/20 active:scale-95 whitespace-nowrap border border-slate-700"
            >
              <span>Actions</span>
              <ChevronDown size={16} className={`transition-transform duration-200 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isActionsDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="p-1 space-y-1">
                  <button
                    onClick={() => {
                      setShowInstructionsModal(true);
                      setIsActionsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-blue-400 hover:text-blue-300 hover:bg-slate-800 rounded-lg transition-colors font-medium"
                  >
                    <AlertCircle size={16} />
                    <span>Import Instructions</span>
                  </button>
                  <div className="border-t border-slate-700 my-1"></div>
                  <button
                    onClick={() => {
                      handleDownloadTemplate();
                      setIsActionsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <FileSpreadsheet size={16} />
                    <span>Download Template</span>
                  </button>
                  <button
                    onClick={() => {
                      handleImportClick();
                      setIsActionsDropdownOpen(false);
                    }}
                    disabled={isImporting}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isImporting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Upload size={16} />
                    )}
                    <span>{isImporting ? 'Importing...' : 'Import XLSX'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setIsImportLogsModalOpen(true);
                      setIsActionsDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <History size={16} />
                    <span>Import History</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-4">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          {/* Search Bar */}
          <div className="relative w-full mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Sort Button */}
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
              title={`Sort by ${sortOrder === 'asc' ? 'newest' : 'oldest'} first`}
            >
              <ArrowUpDown size={16} />
              <span className="text-sm font-medium whitespace-nowrap">{sortOrder === 'asc' ? 'Oldest First' : 'Newest First'}</span>
            </button>

            {/* Status Filter Dropdown */}
            <div className="relative flex-1 sm:flex-initial sm:min-w-[200px]" ref={statusDropdownRef}>
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
              >
                <Filter size={16} />
                <span className="text-sm font-medium">
                  {statusOptions.find(opt => opt.value === statusFilter)?.label || 'Filter by Status'}
                </span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isStatusDropdownOpen && (
                <div className="absolute left-0 right-0 sm:left-0 sm:right-auto sm:w-64 mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="max-h-96 overflow-y-auto">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors flex items-center justify-between border-b border-slate-800 last:border-0 ${
                          statusFilter === option.value ? 'bg-slate-800' : ''
                        }`}
                      >
                        <span className={`text-sm font-medium ${option.color}`}>
                          {option.label}
                        </span>
                        {statusFilter === option.value && (
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Temporarily commented out - Date Range Filter */}
        {/* <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar size={18} className="flex-shrink-0 text-white" />
            <span className="text-sm font-medium whitespace-nowrap">Date Range:</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <label htmlFor="start-date" className="text-sm text-slate-400 whitespace-nowrap">From:</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2 flex-1">
              <label htmlFor="end-date" className="text-sm text-slate-400 whitespace-nowrap">To:</label>
              <input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div> */}
      </div>


      {/* Tickets List */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed col-span-full">
            <TicketIcon size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No tickets found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your filters or create a new ticket.</p>
          </div>
        ) : (
          <>
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket)}
                className="group bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer shadow-md shadow-slate-950/30"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-mono text-slate-400 shrink-0">#{ticket.rcc_reference_number}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.status)} uppercase shrink-0`}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${getSeverityColor(ticket.sev)} shrink-0`}>
                      <AlertTriangle size={11} />
                      {ticket.sev}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Date & Time - Prominent Display */}
                  <div className="flex items-center gap-3 bg-slate-950/50 rounded-lg px-3 py-2 border border-slate-800">
                    <div className="flex items-center gap-2 flex-1">
                      <Calendar size={16} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-white">
                        {format(new Date(ticket.date_reported), 'MMM d, yyyy')}
                      </span>
                    </div>
                    <div className="w-px h-4 bg-slate-700"></div>
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-white">
                        {ticket.time_reported?.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  {/* Main Info */}
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors mb-1">
                      {ticket.request_types?.name || ticket.request_type} - {ticket.device}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-1">{ticket.request_detail}</p>
                  </div>

                  {/* Metadata */}
                  <div className="flex flex-col gap-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={13} className="text-slate-600 flex-shrink-0" />
                      <span className="truncate">{ticket.stores?.store_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <User size={13} className="text-slate-600 flex-shrink-0" />
                      <span className="truncate">
                        {ticket.serviced_by_user
                          ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
                          : 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageLimit}
          totalCount={data.pagination.total}
          showAll={showAll}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            if (size === 'all') {
              setShowAll(true);
              setCurrentPage(1);
            } else {
              setShowAll(false);
              setPageLimit(size);
              setCurrentPage(1);
            }
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      <AddTicketModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      <TicketDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        ticket={selectedTicket}
        onUpdate={(updatedTicket) => {
          setSelectedTicket(updatedTicket);
          refetch();
        }}
      />

      <ImportLoadingModal
        isOpen={isImporting}
        fileName={importingFileName}
      />

      <TicketImportLogsModal
        isOpen={isImportLogsModalOpen}
        onClose={() => setIsImportLogsModalOpen(false)}
      />

      {/* Validation Errors Modal */}
      {showValidationModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Validation Errors</h2>
              </div>
              <button
                onClick={() => setShowValidationModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
                <p className="text-red-200 font-medium">
                  Your file contains validation errors. Please fix the errors below and try again.
                </p>
              </div>

              <div className="space-y-2">
                {validationErrors.map((error, index) => (
                  <div key={index} className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm">
                    <p className="text-red-400 font-mono">{error}</p>
                  </div>
                ))}
              </div>

              {validationErrors.length >= 20 && (
                <div className="mt-4 text-center text-slate-400 text-sm">
                  Showing first 20 errors. Please fix these and re-upload to see more.
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Temporarily commented out - Delete Confirmation Modal */}
      {/* {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Delete Ticket</h2>
              </div>
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-slate-200">
                  Are you sure you want to delete this ticket? This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
