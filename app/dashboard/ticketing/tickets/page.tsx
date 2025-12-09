'use client';

import { useState, useEffect } from 'react';
import { Plus, Ticket as TicketIcon, Search, Filter, MoreHorizontal, Calendar, Clock, MapPin, AlertTriangle, ChevronRight } from 'lucide-react';
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

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch = 
      ticket.rcc_reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.stores?.store_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.request_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.device?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || ticket.status.toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
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
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400">Loading tickets...</p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <TicketIcon size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No tickets found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your filters or create a new ticket.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleTicketClick(ticket)}
                className="group bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition-all cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  {/* Left Section: Status & Main Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)} uppercase tracking-wide`}>
                        {ticket.status}
                      </span>
                      <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${getSeverityColor(ticket.sev)}`}>
                        <AlertTriangle size={12} />
                        {ticket.sev}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        #{ticket.rcc_reference_number}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors mb-1">
                        {ticket.request_type}
                        <span className="text-slate-500 font-normal mx-2">•</span>
                        <span className="text-base font-normal text-slate-300">{ticket.device}</span>
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2">{ticket.request_detail}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-slate-600" />
                        <span className="text-slate-300">{ticket.stores?.store_name}</span>
                        {ticket.stations?.name && (
                          <>
                            <span className="text-slate-600">/</span>
                            <span>{ticket.stations.name}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-slate-600" />
                        <span>{format(new Date(ticket.date_reported), 'MMM d, yyyy')}</span>
                        <Clock size={14} className="text-slate-600 ml-1" />
                        <span>{ticket.time_reported}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Metadata & Arrow */}
                  <div className="flex items-center justify-between md:justify-end md:w-48 gap-4 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4 mt-1 md:mt-0">
                    <div className="flex flex-col gap-1 text-right">
                      <div className="text-xs text-slate-500">Problem Category</div>
                      <div className="text-sm text-slate-300 font-medium">{ticket.problem_category}</div>
                    </div>
                    <ChevronRight className="text-slate-600 group-hover:text-white transition-colors" size={20} />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
