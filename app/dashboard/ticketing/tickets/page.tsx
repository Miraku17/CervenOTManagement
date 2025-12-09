"use client"
import { useState, useEffect } from 'react';
import { Plus, Ticket as TicketIcon, Search, Filter, MoreHorizontal, Calendar, Clock, MapPin, AlertTriangle, Trash2, Loader2, X, AlertCircle, User, ArrowUpDown } from 'lucide-react';
import { format } from 'date-fns';
import AddTicketModal from '@/components/ticketing/AddTicketModal';
import TicketDetailModal from '@/components/ticketing/TicketDetailModal';

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
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [ticketToDelete, setTicketToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/get');
      const data = await response.json();
      if (response.ok) {
        setTickets(data.tickets || []);
      }
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

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
    } catch (error: any) {
      console.error('Error deleting ticket:', error);
      alert(error.message || 'Failed to delete ticket');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false);
    setTicketToDelete(null);
  };

  const filteredTickets = tickets
    .filter(ticket => {
      const matchesSearch = 
        ticket.rcc_reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.stores?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.request_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.device?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || ticket.status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const dateA = new Date(`${a.date_reported}T${a.time_reported}`);
      const dateB = new Date(`${b.date_reported}T${b.time_reported}`);
      return sortOrder === 'asc' ? dateA.getTime() - dateB.getTime() : dateB.getTime() - dateA.getTime();
    });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open': return 'bg-blue-500/20 text-blue-400 border-blue-500/20';
      case 'closed': 
      case 'resolved': return 'bg-green-500/20 text-green-400 border-green-500/20';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'high': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tickets Management</h1>
          <p className="text-slate-400">Manage and track all support tickets.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
        >
          <Plus size={20} />
          <span>Create Ticket</span>
        </button>
      </div>

      {/* Filters & Search */}
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
          {['all', 'open', 'pending', 'resolved', 'closed'].map((status) => (
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
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-sm font-mono text-slate-400">#{ticket.rcc_reference_number}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.status)} uppercase`}>
                      {ticket.status}
                    </span>
                    <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${getSeverityColor(ticket.sev)}`}>
                      <AlertTriangle size={11} />
                      {ticket.sev}
                    </span>
                  </div>
                  <button
                    onClick={(e) => handleDeleteClick(ticket.id, e)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                    title="Delete ticket"
                  >
                    <Trash2 size={16} />
                  </button>
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

      <AddTicketModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      <TicketDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        ticket={selectedTicket}
      />

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
    </div>
  );
}
