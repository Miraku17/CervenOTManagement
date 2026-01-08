"use client"
import { useState, useEffect, useRef } from 'react';
import { Plus, Ticket as TicketIcon, Search, Filter, MoreHorizontal, Calendar, Clock, MapPin, AlertTriangle, Trash2, Loader2, X, AlertCircle, User, ArrowUpDown, Upload, FileSpreadsheet, History, ChevronDown } from 'lucide-react';
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

// Define the Ticket interface to match the API response and Modal props
interface Ticket {
  id: string;
  store_id: string;
  station_id: string;
  mod_id: string;
  reported_by: string;
  serviced_by: string;
  rcc_reference_number: string;
  date_reported: string;
  time_reported: string;
  date_responded: string | null;
  time_responded: string | null;
  request_type: string;
  device: string;
  request_detail: string;
  problem_category: string;
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
  manager_on_duty?: { manager_name: string };
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  // Toast helper function
  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string, details?: string[]) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message, description, details, onClose: removeToast }]);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  // Check user role and position
  useEffect(() => {
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

    checkUserRole();
  }, [user?.id]);

  const canCreateTicket = userPosition !== 'Field Engineer';
  const canDeleteTicket = userPosition === 'Operations Manager';

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/get');
      const data = await response.json();
      if (response.ok) {
        setTickets(data.tickets || []);
      } else if (response.status === 403) {
        console.error('Access denied: Admin role required');
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoading && !checkingRole) {
      if (hasPermission('manage_tickets')) {
        fetchTickets();
      } else {
        // User doesn't have permission, stop loading to show access denied message
        setLoading(false);
      }
    }
  }, [permissionsLoading, checkingRole, hasPermission]);

  const handleTicketClick = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleSuccess = () => {
    fetchTickets();
  };

  const handleDeleteClick = (ticketId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the detail modal
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

      // Refresh tickets list
      await fetchTickets();
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

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Invalid File Type', 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (10MB max)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxFileSize) {
      showToast('error', 'File Too Large', 'Maximum file size is 10MB.');
      return;
    }

    setIsImporting(true);
    setImportingFileName(file.name);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1]; // Remove data:application/... prefix

          // Step 1: Validate the file first
          const validationResponse = await fetch('/api/tickets/validate-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData }),
          });

          const validationData = await validationResponse.json();

          if (!validationResponse.ok) {
            // Show validation errors
            setValidationErrors(validationData.errors || ['Unknown validation error']);
            setShowValidationModal(true);
            setIsImporting(false);
            setImportingFileName('');
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }

          // Step 2: If validation passes, proceed with import
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

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || data.details || 'Failed to import file');
          }

          // Show success message
          const { result } = data;
          if (result.failed > 0) {
            const errorSummary = result.errors?.slice(0, 10).map((e: any) =>
              `Row ${e.row}: ${e.error}`
            ) || [];
            showToast(
              'warning',
              'Import Completed with Errors',
              `${result.success} tickets imported successfully, ${result.failed} failed.`,
              errorSummary.length > 0 ? [...errorSummary, result.failed > 10 ? `...and ${result.failed - 10} more errors` : ''].filter(Boolean) : undefined
            );
          } else {
            showToast('success', 'Import Successful!', `${result.success} tickets have been imported successfully.`);
          }

          // Refresh tickets
          await fetchTickets();
        } catch (error: any) {
          console.error('Error importing file:', error);
          showToast('error', 'Import Failed', error.message || 'Failed to import file');
        } finally {
          setIsImporting(false);
          setImportingFileName('');
          // Reset file input
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

  const filteredTickets = tickets
    .filter(ticket => {
      const matchesSearch =
        ticket.rcc_reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.stores?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.request_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.device?.toLowerCase().includes(searchTerm.toLowerCase());

      // Normalize DB status (snake_case) to match Filter (space separated)
      const normalizedTicketStatus = ticket.status.toLowerCase().replace(/_/g, ' ');
      const matchesStatus = statusFilter === 'all' || normalizedTicketStatus === statusFilter.toLowerCase();

      // Date filtering
      const ticketDate = new Date(ticket.date_reported);
      const matchesStartDate = !startDate || ticketDate >= new Date(startDate);
      const matchesEndDate = !endDate || ticketDate <= new Date(endDate);

      return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date_reported}T${a.time_reported}`);
      const dateB = new Date(`${b.date_reported}T${b.time_reported}`);
      return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase().replace(/_/g, ' ')) {
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
      case 'in progress': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      case 'on hold': return 'bg-orange-500/20 text-orange-400 border-orange-500/20';
      case 'closed': return 'bg-green-500/20 text-green-400 border-green-500/20';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'sev3': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'sev2': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'sev1': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  // Show loading while checking permissions or fetching tickets
  if (permissionsLoading || checkingRole || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">{loading ? 'Loading tickets...' : 'Checking permissions...'}</p>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets Management</h1>
          <p className="text-slate-400">{isAdmin ? 'Manage and track all support tickets.' : 'View tickets assigned to you.'}</p>
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
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="flex items-center gap-2 px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors mr-2"
            >
              <ArrowUpDown size={16} />
              <span className="text-sm font-medium whitespace-nowrap">{sortOrder === 'asc' ? 'Oldest' : 'Newest'}</span>
            </button>
            {['all', 'open', 'in progress', 'on hold', 'closed'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize whitespace-nowrap transition-colors border ${
                  statusFilter === status
                    ? 'bg-blue-600 text-white border-blue-500'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800">
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
        </div>
      </div>

      {/* Tickets List */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading ? (
          <>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-slate-900 border border-slate-800 rounded-lg p-4 animate-pulse h-[180px]">
                <div className="flex justify-between items-center mb-4">
                  <div className="h-4 bg-slate-800 rounded w-20"></div>
                  <div className="h-4 bg-slate-800 rounded w-16"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-5 bg-slate-800 rounded w-3/4"></div>
                  <div className="h-4 bg-slate-800 rounded w-full"></div>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                    <div className="h-3 bg-slate-800 rounded w-full"></div>
                  </div>
                </div>
              </div>
            ))}
          </>
        ) : filteredTickets.length === 0 ? (
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
                  {canDeleteTicket && (
                    <button
                      onClick={(e) => handleDeleteClick(ticket.id, e)}
                      className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors shrink-0"
                      title="Delete ticket"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Main Info */}
                  <div>
                    <h3 className="text-base font-semibold text-white group-hover:text-blue-400 transition-colors mb-1">
                      {ticket.request_type} - {ticket.device}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-1">{ticket.request_detail}</p>
                  </div>

                  {/* Metadata Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <MapPin size={13} className="text-slate-600 flex-shrink-0" />
                      <span className="truncate">{ticket.stores?.store_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar size={13} className="text-slate-600 flex-shrink-0" />
                      <span>{format(new Date(ticket.date_reported), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <User size={13} className="text-slate-600 flex-shrink-0" />
                      <span className="truncate">
                        {ticket.serviced_by_user
                          ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
                          : 'Unassigned'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock size={13} className="text-slate-600 flex-shrink-0" />
                      <span>{ticket.time_reported}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

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
          // Update the ticket in the local state
          setTickets(prev => prev.map(t => t.id === updatedTicket.id ? updatedTicket : t));
          setSelectedTicket(updatedTicket);
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
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

      {/* Import Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <AlertCircle size={20} className="text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white">Ticket Import Instructions</h2>
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              <div className="space-y-6">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <h3 className="text-blue-400 font-semibold mb-2">Before You Start</h3>
                  <ol className="list-decimal list-inside space-y-2 text-slate-300">
                    <li>Download the Excel template by clicking "Download Template"</li>
                    <li>Fill in your ticket data following the format in the template</li>
                    <li>Make sure all required fields are filled correctly</li>
                    <li>Save the file and click "Import XLSX" to upload</li>
                  </ol>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle size={18} className="text-yellow-400" />
                    Required Fields
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Store Code:</span>
                      <span className="text-slate-400"> Must match an existing store in your system (e.g., ST001, ST002)</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Station Name:</span>
                      <span className="text-slate-400"> Fallback station if device not found in inventory (e.g., Drive Thru, Front Counter)</span>
                      <div className="mt-1 text-xs text-slate-500">
                        Note: If Device matches inventory, that device's station will be used instead
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">RCC Reference Number:</span>
                      <span className="text-slate-400"> External reference number (e.g., RCC-2024-001)</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Date Reported:</span>
                      <span className="text-slate-400"> Format: MM/DD/YYYY (e.g., 01/15/2024)</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Time Reported:</span>
                      <span className="text-slate-400"> Format: HH:MM AM/PM (e.g., 09:30 AM)</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Device:</span>
                      <span className="text-slate-400"> Device description. Format: Category Brand Model Serial</span>
                      <div className="mt-1 text-xs text-slate-500">
                        Example: "POS NCR 7167 SN123456" or "Headset Plantronics CS540 SN789012"
                      </div>
                      <div className="mt-1 text-xs text-blue-400">
                        💡 If device exists in store inventory, its station will be used automatically
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                      <span className="font-semibold text-white">Severity:</span>
                      <span className="text-slate-400"> Must be exactly: sev1 (low), sev2 (medium), or sev3 (critical)</span>
                    </div>
                    <div className="bg-slate-950 border border-red-500/20 rounded-lg p-3 border-2">
                      <span className="font-semibold text-red-400">Reported By (Employee ID):</span>
                      <span className="text-slate-300"> MUST match an existing employee ID in your system (e.g., EMP001)</span>
                      <div className="mt-2 text-xs text-red-300">
                        ⚠️ The employee must exist in the system before importing.
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-red-500/20 rounded-lg p-3 border-2">
                      <span className="font-semibold text-red-400">Assigned To (Employee ID):</span>
                      <span className="text-slate-300"> MUST match an existing employee ID in your system (e.g., EMP100)</span>
                      <div className="mt-2 text-xs text-red-300">
                        ⚠️ This assigns the ticket to a technician/field engineer. Employee must exist in the system.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    Auto-Filled Fields
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="bg-slate-950 border border-green-500/20 rounded-lg p-3">
                      <span className="font-semibold text-green-400">Manager on Duty:</span>
                      <span className="text-slate-400"> Automatically assigned based on the store (uses first manager for the store)</span>
                      <div className="mt-1 text-xs text-slate-500">
                        No need to include this column in your import file
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-green-500/20 rounded-lg p-3">
                      <span className="font-semibold text-green-400">Station (Conditional):</span>
                      <span className="text-slate-400"> If Device matches store inventory, station is taken from device</span>
                      <div className="mt-1 text-xs text-slate-500">
                        Otherwise, Station Name column is used to find or create the station
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-3">Important Notes</h3>
                  <ul className="space-y-2 text-sm text-slate-300">
                    <li className="flex gap-2">
                      <span className="text-red-400">⚠️</span>
                      <span className="font-semibold">Both Reported By and Assigned To employee IDs are REQUIRED for every ticket</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-red-400">⚠️</span>
                      <span className="font-semibold">RCC Reference Number is REQUIRED for every ticket</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Maximum 1000 rows per import</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Maximum file size: 10MB</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Device field should match format: Category Brand Model Serial</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>If Device matches store inventory, its station will be used (Station Name column ignored)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Delete example rows from the template before importing your data</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Do not modify the header row (column names)</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>Test with a small batch first (5-10 tickets) to verify the format</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span>The system will validate your file before importing and show any errors</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <h3 className="text-amber-400 font-semibold mb-2">Common Errors to Avoid</h3>
                  <ul className="space-y-1 text-sm text-slate-300">
                    <li>✗ Leaving RCC Reference Number blank</li>
                    <li>✗ Leaving Reported By or Assigned To employee IDs blank</li>
                    <li>✗ Using employee names instead of employee IDs</li>
                    <li>✗ Wrong date format (use MM/DD/YYYY, not DD/MM/YYYY)</li>
                    <li>✗ Wrong time format (use 09:30 AM, not 9:30 or 09:30)</li>
                    <li>✗ Severity not lowercase (use "sev1" not "SEV1" or "Sev1")</li>
                    <li>✗ Store codes that don't exist in your system</li>
                    <li>✗ Reporter or Assigned employee IDs that don't exist in your system</li>
                    <li>✗ Device field not properly formatted (use Category Brand Model Serial)</li>
                    <li>✗ Device string doesn't exactly match inventory format (must be exact for auto station)</li>
                    <li>✗ Forgetting to remove example rows from template</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center gap-3">
              <div className="text-sm text-slate-400">
                Need help? View the Instructions sheet in the template file
              </div>
              <button
                onClick={() => setShowInstructionsModal(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Header */}
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

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                <p className="text-slate-200">
                  Are you sure you want to delete this ticket? This action cannot be undone.
                </p>
              </div>
            </div>

            {/* Footer */}
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
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
