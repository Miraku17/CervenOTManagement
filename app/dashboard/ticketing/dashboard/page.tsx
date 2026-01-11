'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  AlertCircle,
  PauseCircle,
  UserX,
  Files,
  ArrowUpRight,
  X,
  Loader2
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import TicketDetailModal from '@/components/ticketing/TicketDetailModal';

interface DashboardStats {
  overdue: number;
  dueToday: number;
  open: number;
  onHold: number;
  inProgress: number;
  unassigned: number;
  total: number;
  byPriority: { name: string; value: number; color: string }[];
  byStatus: { name: string; value: number }[];
  byCategory: { name: string; value: number }[];
  topRecurringStores: { storeId: string; storeName: string; storeCode: string; ticketCount: number }[];
}

const fetchDashboardStats = async (): Promise<DashboardStats> => {
  const res = await fetch('/api/tickets/dashboard-stats');

  if (!res.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }

  return res.json();
};

const fetchAllTickets = async (): Promise<any[]> => {
  // Fetch ALL tickets by getting them in batches
  let allTickets: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`/api/tickets/get?page=${page}&limit=1000`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to fetch ticket data');
    }

    if (result.tickets && result.tickets.length > 0) {
      allTickets = allTickets.concat(result.tickets);
      console.log(`Fetched page ${page}: ${result.tickets.length} tickets. Total so far: ${allTickets.length}`);

      // Check if there are more pages
      if (result.pagination && page < result.pagination.totalPages) {
        page++;
      } else {
        hasMore = false;
      }
    } else {
      hasMore = false;
    }
  }

  console.log('Total tickets fetched:', allTickets.length);
  return allTickets;
};

export default function DashboardPage() {
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'open' | 'on_hold' | 'unassigned' | 'total' | 'store' | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const { data: stats, isLoading, error, refetch: refetchStats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 0, // Consider data stale immediately to ensure fresh data
  });

  // Fetch all tickets with TanStack Query for caching
  const { data: allTickets, isLoading: isLoadingTickets, refetch } = useQuery({
    queryKey: ['all-tickets'],
    queryFn: fetchAllTickets,
    staleTime: 30000, // Cache for 30 seconds
    enabled: showModal, // Only fetch when modal is open
    refetchOnMount: true, // Refetch when component mounts
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-slate-800 rounded"></div>
          <div className="h-4 w-32 bg-slate-800 rounded"></div>
        </div>

        {/* Top Cards Skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-24 bg-slate-800 rounded-xl"></div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-slate-800 rounded-xl"></div>
          <div className="h-80 bg-slate-800 rounded-xl"></div>
          <div className="h-80 bg-slate-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Failed to load dashboard</h3>
              <p className="text-slate-400 text-sm">
                {error instanceof Error ? error.message : 'An unknown error occurred'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const handleStatCardClick = (type: 'open' | 'on_hold' | 'unassigned' | 'total') => {
    setModalType(type);
    setSelectedStoreId(null);
    setShowModal(true);

    // Set title immediately
    switch (type) {
      case 'open':
        setModalTitle('Open Tickets');
        break;
      case 'on_hold':
        setModalTitle('Tickets on Hold');
        break;
      case 'unassigned':
        setModalTitle('Unassigned Tickets');
        break;
      case 'total':
        setModalTitle('In Progress Tickets');
        break;
    }
  };

  const handleStoreClick = (storeId: string, storeName: string) => {
    setModalType('store');
    setSelectedStoreId(storeId);
    setModalTitle(`${storeName} - All Tickets`);
    setShowModal(true);
  };

  // Filter tickets based on modal type
  const getFilteredTickets = () => {
    if (!allTickets || !modalType) return [];

    let filteredTickets = allTickets;

    console.log('Total tickets:', allTickets.length);
    console.log('Filter type:', modalType);

    // Check what statuses we actually have
    const uniqueStatuses = [...new Set(allTickets.map((t: any) => t.status))];
    console.log('Unique statuses in data:', uniqueStatuses);

    switch (modalType) {
      case 'open':
        filteredTickets = allTickets.filter((t: any) => {
          const status = t.status?.toLowerCase();
          return status === 'open';
        });
        break;
      case 'on_hold':
        filteredTickets = allTickets.filter((t: any) => {
          const status = t.status?.toLowerCase();
          return status === 'on_hold';
        });
        break;
      case 'unassigned':
        filteredTickets = allTickets.filter((t: any) => {
          const status = t.status?.toLowerCase();
          return !t.serviced_by && status !== 'closed';
        });
        break;
      case 'total':
        // Filter for in-progress tickets only
        filteredTickets = allTickets.filter((t: any) => {
          const status = t.status?.toLowerCase();
          return status === 'in_progress' || status === 'in progress';
        });
        break;
      case 'store':
        // Filter by selected store ID
        if (selectedStoreId) {
          console.log('Filtering for store ID:', selectedStoreId);
          console.log('All tickets count:', allTickets.length);

          // Debug: Log first few tickets to see their structure
          console.log('Sample tickets:', allTickets.slice(0, 3).map((t: any) => ({
            id: t.id,
            ref: t.rcc_reference_number,
            store_id: t.store_id,
            stores: t.stores
          })));

          filteredTickets = allTickets.filter((t: any) => {
            // Handle both direct store_id field and potential nested access
            const ticketStoreId = t.store_id || (t.stores && typeof t.stores === 'object' && !Array.isArray(t.stores) ? (t.stores as any).id : null);
            const matches = ticketStoreId && String(ticketStoreId) === String(selectedStoreId);
            if (!matches && t.stores) {
              // Log non-matching tickets that have store info to debug
              console.log('Non-match:', t.rcc_reference_number, 'store_id:', ticketStoreId, 'looking for:', selectedStoreId);
            }
            return matches;
          });

          console.log('Filtered tickets for store:', filteredTickets.length);

          // Check if there are tickets without store_id
          const ticketsWithoutStoreId = allTickets.filter((t: any) => !t.store_id).length;
          console.log('Tickets without store_id:', ticketsWithoutStoreId);
        }
        break;
    }

    console.log('Filtered tickets:', filteredTickets.length);

    return filteredTickets;
  };

  const modalTickets = getFilteredTickets();

  const handleTicketClick = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDetailModalOpen(true);
  };

  const handleTicketUpdate = (updatedTicket: any) => {
    setSelectedTicket(updatedTicket);
    // Optionally refetch data to update stats
    // queryClient.invalidateQueries(['all-tickets']);
    // queryClient.invalidateQueries(['dashboard-stats']);
  };

  const chartConfig = {
    SEV1: {
      label: "SEV1",
      color: "#ef4444",
    },
    SEV2: {
      label: "SEV2",
      color: "#f59e0b",
    },
    SEV3: {
      label: "SEV3",
      color: "#3b82f6",
    },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <LayoutDashboard className="text-blue-500" />
          Dashboard
        </h1>
        <span className="text-sm text-slate-400">
          Overview of ticketing performance
        </span>
      </div>

      {/* Top Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* <StatCard
          title="Overdue Tasks"
          value={stats.overdue}
          icon={Clock}
          iconBgColor="bg-blue-900/20"
          iconColor="text-blue-400"
          borderColor="border-l-blue-600"
        />
        <StatCard
          title="Tickets Due Today"
          value={stats.dueToday}
          icon={AlertCircle}
          iconBgColor="bg-blue-900/20"
          iconColor="text-blue-400"
          borderColor="border-l-blue-500"
        /> */}
        <StatCard
          title="Open Tickets"
          value={stats.open}
          icon={ArrowUpRight}
          iconBgColor="bg-blue-900/20"
          iconColor="text-blue-300"
          borderColor="border-l-blue-400"
          onClick={() => handleStatCardClick('open')}
        />
        <StatCard
          title="Tickets on Hold"
          value={stats.onHold}
          icon={PauseCircle}
          iconBgColor="bg-indigo-900/20"
          iconColor="text-indigo-400"
          borderColor="border-l-indigo-500"
          onClick={() => handleStatCardClick('on_hold')}
        />
        <StatCard
          title="Unassigned Tickets"
          value={stats.unassigned}
          icon={UserX}
          iconBgColor="bg-indigo-900/20"
          iconColor="text-indigo-300"
          borderColor="border-l-indigo-400"
          onClick={() => handleStatCardClick('unassigned')}
        />
        <StatCard
          title="In Progress Tickets"
          value={stats.inProgress}
          icon={Files}
          iconBgColor="bg-indigo-900/20"
          iconColor="text-indigo-400"
          borderColor="border-l-indigo-600"
          onClick={() => handleStatCardClick('total')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Unresolved Tickets by Priority */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Unresolved Tickets by Priority</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center relative min-h-[300px]">
            <ChartContainer config={chartConfig} className="w-full h-[250px]">
              <PieChart>
                <Pie
                  data={stats.byPriority}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {stats.byPriority.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-3xl font-bold text-white">
                {stats.byPriority.reduce((a, b) => a + b.value, 0)}
              </span>
              <span className="text-xs text-slate-400">Total</span>
            </div>
            {/* Legend */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4 text-xs flex-wrap px-4">
              {stats.byPriority.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-300">{item.name} ({Math.round(item.value / (stats.byPriority.reduce((a,b)=>a+b.value,0)||1) * 100)}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* All Tickets by Status */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">Tickets by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-5">
            {stats.byStatus.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-300">{item.name}</span>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(item.value / (Math.max(...stats.byStatus.map(s => s.value)) || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {stats.byStatus.length === 0 && (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No unresolved tickets
              </div>
            )}
          </CardContent>
        </Card>

        {/* New & Open Tickets Category-wise */}
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-lg">New & Open Tickets Category-wise</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 space-y-5">
             {stats.byCategory.map((item, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium text-slate-300 truncate pr-2" title={item.name}>{item.name}</span>
                  <span className="font-bold text-white">{item.value}</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-500"
                    style={{ width: `${(item.value / (Math.max(...stats.byCategory.map(s => s.value)) || 1)) * 100}%` }}
                  />
                </div>
              </div>
            ))}
             {stats.byCategory.length === 0 && (
              <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                No active tickets
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Modal for displaying tickets */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-6xl shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">{modalTitle}</h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {isLoadingTickets ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : modalTickets.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-slate-400">No tickets found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Ref #</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Store</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Request Type</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Device</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Severity</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Assigned To</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalTickets.map((ticket: any) => {
                        const servicedBy = ticket.serviced_by_user
                          ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
                          : 'Unassigned';

                        const sevColor = ticket.sev?.toUpperCase() === 'SEV1' ? 'text-red-400 bg-red-500/10' :
                                        ticket.sev?.toUpperCase() === 'SEV2' ? 'text-amber-400 bg-amber-500/10' :
                                        'text-blue-400 bg-blue-500/10';

                        const statusColor = ticket.status?.toLowerCase() === 'closed' ? 'text-emerald-400 bg-emerald-500/10' :
                                           ticket.status?.toLowerCase() === 'in progress' ? 'text-blue-400 bg-blue-500/10' :
                                           ticket.status?.toLowerCase() === 'on hold' || ticket.status?.toLowerCase() === 'on_hold' ? 'text-amber-400 bg-amber-500/10' :
                                           'text-slate-400 bg-slate-500/10';

                        return (
                          <tr
                            key={ticket.id}
                            onClick={() => handleTicketClick(ticket)}
                            className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4 text-sm text-slate-300 font-mono">{ticket.rcc_reference_number}</td>
                            <td className="py-3 px-4 text-sm text-slate-300">{ticket.stores?.store_name || 'N/A'}</td>
                            <td className="py-3 px-4 text-sm text-slate-300">{ticket.request_type || 'N/A'}</td>
                            <td className="py-3 px-4 text-sm text-slate-300">{ticket.device || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${sevColor}`}>
                                {ticket.sev || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${statusColor}`}>
                                {ticket.status?.replace(/_/g, ' ') || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-sm text-slate-300">{servicedBy}</td>
                            <td className="py-3 px-4 text-sm text-slate-400">{ticket.date_reported || 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-800 flex justify-between items-center">
              <span className="text-sm text-slate-400">
                {modalTickets.length} ticket{modalTickets.length !== 1 ? 's' : ''} found
              </span>
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        ticket={selectedTicket}
        onUpdate={handleTicketUpdate}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  borderColor,
  onClick
}: {
  title: string,
  value: number,
  icon: any,
  iconBgColor: string,
  iconColor: string,
  borderColor: string,
  onClick?: () => void
}) {
  return (
    <Card
      className={`bg-slate-900 border-slate-800 shadow-sm hover:shadow-lg transition-all duration-300 group border-l-4 ${borderColor} ${onClick ? 'cursor-pointer hover:scale-105' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="flex flex-col">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{title}</p>
            <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
          </div>
          <div className={`p-3 rounded-xl transition-colors duration-300 ${iconBgColor} group-hover:bg-opacity-100`}>
            <Icon className={`w-6 h-6 transition-colors duration-300 ${iconColor}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
