import React from 'react';
import { X, Calendar, Clock, MapPin, Monitor, AlertTriangle, User, FileText, CheckCircle, Box, Activity, Timer } from 'lucide-react';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  store_id: string;
  station_id: string;
  mod_id: string;
  reported_by: string;
  serviced_by: string;
  rcc_reference_number: string;
  date_reported: string;
  time_reported: string; // HH:mm:ss or similar
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

interface TicketDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  ticket: Ticket | null;
}

const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ isOpen, onClose, ticket }) => {
  if (!isOpen || !ticket) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'closed':
      case 'resolved':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev.toLowerCase()) {
      case 'critical':
        return 'text-red-400';
      case 'high':
        return 'text-orange-400';
      case 'medium':
        return 'text-yellow-400';
      case 'low':
        return 'text-blue-400';
      default:
        return 'text-slate-400';
    }
  };

  const DetailSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
        <Icon size={18} className="text-blue-400" />
        <h3 className="font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-6">
        {children}
      </div>
    </div>
  );

  const LabelValue = ({ label, value, fullWidth = false }: { label: string, value: React.ReactNode, fullWidth?: boolean }) => (
    <div className={`${fullWidth ? 'col-span-full' : ''}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</span>
      <div className="text-sm text-slate-300 font-medium break-words">{value || <span className="text-slate-600 italic">N/A</span>}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-900 sticky top-0 rounded-t-2xl z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-2.5 py-0.5 rounded-md text-xs font-medium border ${getStatusColor(ticket.status)} uppercase`}>
                {ticket.status}
              </span>
              <span className={`flex items-center gap-1.5 text-sm font-medium ${getSeverityColor(ticket.sev)}`}>
                <AlertTriangle size={14} />
                {ticket.sev} Priority
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
              {ticket.request_type}
              <span className="text-slate-500 text-lg font-normal">#{ticket.rcc_reference_number}</span>
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          
          <DetailSection title="General Information" icon={FileText}>
            <LabelValue label="RCC Reference" value={ticket.rcc_reference_number} />
            <LabelValue label="Date Reported" value={formatDate(ticket.date_reported)} />
            <LabelValue label="Time Reported" value={ticket.time_reported} />
            <LabelValue label="Problem Category" value={ticket.problem_category} />
            <LabelValue label="Device" value={ticket.device} />
            <LabelValue label="Request Detail" value={ticket.request_detail} fullWidth />
          </DetailSection>

          <DetailSection title="Location & Contact" icon={MapPin}>
            <LabelValue label="Store Name" value={ticket.stores?.store_name} />
            <LabelValue label="Store Code" value={ticket.stores?.store_code} />
            <LabelValue label="Station" value={ticket.stations?.name} />
            <LabelValue label="Manager on Duty (MOD)" value={ticket.manager_on_duty?.manager_name} />
          </DetailSection>

          <DetailSection title="People Involved" icon={User}>
            <LabelValue label="Reported By" value={ticket.reported_by_user ? `${ticket.reported_by_user.first_name} ${ticket.reported_by_user.last_name}` : ticket.reported_by} />
            <LabelValue label="Serviced By" value={ticket.serviced_by_user ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}` : ticket.serviced_by} />
          </DetailSection>

          <DetailSection title="Resolution & Action" icon={CheckCircle}>
            <LabelValue label="Action Taken" value={ticket.action_taken} fullWidth />
            <LabelValue label="Final Resolution" value={ticket.final_resolution} fullWidth />
            <LabelValue label="Date Resolved" value={formatDate(ticket.date_resolved)} />
            <LabelValue label="SLA Status" value={ticket.sla_status} />
          </DetailSection>

          <DetailSection title="Timeline & Metrics" icon={Timer}>
            <LabelValue label="Date Acknowledged" value={formatDate(ticket.date_ack)} />
            <LabelValue label="Time Acknowledged" value={ticket.time_ack} />
            <LabelValue label="Date Attended" value={formatDate(ticket.date_attended)} />
            <LabelValue label="Store Arrival" value={ticket.store_arrival} />
            <LabelValue label="Work Start" value={ticket.work_start} />
            <LabelValue label="Work End" value={ticket.work_end} />
            <LabelValue label="Downtime" value={ticket.downtime} />
            <LabelValue label="SLA Count (Hrs)" value={ticket.sla_count_hrs?.toString()} />
            <LabelValue label="Date Responded" value={formatDate(ticket.date_responded)} />
            <LabelValue label="Time Responded" value={ticket.time_responded} />
          </DetailSection>

           <DetailSection title="Parts Information" icon={Box}>
            <LabelValue label="Parts Replaced" value={ticket.parts_replaced} />
            <LabelValue label="New Parts Serial" value={ticket.new_parts_serial} />
            <LabelValue label="Old Parts Serial" value={ticket.old_parts_serial} />
          </DetailSection>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TicketDetailModal;
