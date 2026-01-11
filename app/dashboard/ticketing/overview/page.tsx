'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Calendar, ShieldAlert, Ticket, Store, AlertTriangle, Activity, FileDown, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { StatCard } from '@/components/admin_dashboard/StatCard';
import * as XLSX from 'xlsx-js-style';

interface TicketStats {
  total: number;
  byStore: { store_id: string; store_name: string; count: number }[];
  byFieldEngineer: { engineer_name: string; count: number }[];
  bySeverity: { severity: string; count: number }[];
  byProblemCategory: { category: string; count: number }[];
}

export default function TicketOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalTickets, setModalTickets] = useState<any[]>([]);
  const [loadingModal, setLoadingModal] = useState(false);
  const [isExportingModal, setIsExportingModal] = useState(false);

  const isLoading = authLoading || permissionsLoading;

  useEffect(() => {
    const fetchStats = async () => {
      if (isLoading || !user?.id) return;

      // Only fetch if user has permission
      if (!hasPermission('view_ticket_overview')) return;

      setLoadingStats(true);
      try {
        const params = new URLSearchParams();
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const response = await fetch(`/api/tickets/stats?${params.toString()}`);
        const data = await response.json();
        if (response.ok) {
          setStats(data);
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [user?.id, isLoading, hasPermission, startDate, endDate]);

  const handleExportToExcel = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/tickets/export?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ticket data');
      }

      if (!result.tickets || result.tickets.length === 0) {
        alert('No ticket data found for the selected date range.');
        return;
      }

      // Convert tickets to Excel
      const workbook = convertTicketsToExcel(result.tickets);

      if (!workbook) {
        alert('Failed to generate Excel file.');
        return;
      }

      // Write workbook to binary string
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const filename = startDate && endDate
        ? `tickets_${startDate}_${endDate}.xlsx`
        : `tickets_all.xlsx`;

      a.download = filename;
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

  const convertTicketsToExcel = (tickets: any[]) => {
    if (!tickets || tickets.length === 0) return null;

    const ticketData: any[][] = [];

    // Add title row
    ticketData.push(['Ticket Export Report']);
    ticketData.push([]); // Empty row

    // Add headers
    ticketData.push([
      'Ticket ID',
      'Store Name',
      'Store Code',
      'Station',
      'RCC Reference Number',
      'Date Reported',
      'Time Reported',
      'Request Type',
      'Device',
      'Problem Category',
      'Severity',
      'Status',
      'Request Detail',
      'Reported By',
      'Serviced By',
      'Manager on Duty',
      'Date Responded',
      'Time Responded',
      'Date Acknowledged',
      'Time Acknowledged',
      'Date Attended',
      'Store Arrival',
      'Work Start',
      'Work End',
      'Date Resolved',
      'Action Taken',
      'Final Resolution',
      'Parts Replaced',
      'New Parts Serial',
      'Old Parts Serial',
      'SLA Count (hrs)',
      'Downtime',
      'SLA Status'
    ]);

    // Add ticket data
    for (const ticket of tickets) {
      const storeName = (ticket.stores as any)?.store_name || 'N/A';
      const storeCode = (ticket.stores as any)?.store_code || 'N/A';
      const stationName = (ticket.stations as any)?.name || 'N/A';
      const reportedBy = ticket.reported_by_user
        ? `${ticket.reported_by_user.first_name} ${ticket.reported_by_user.last_name}`
        : 'N/A';
      const servicedBy = ticket.serviced_by_user
        ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
        : 'N/A';
      const managerOnDuty = (ticket.manager_on_duty as any)?.manager_name || 'N/A';

      ticketData.push([
        ticket.id || '',
        storeName,
        storeCode,
        stationName,
        ticket.rcc_reference_number || '',
        ticket.date_reported || '',
        ticket.time_reported || '',
        ticket.request_type || '',
        ticket.device || '',
        ticket.problem_category || '',
        ticket.sev || '',
        ticket.status || '',
        ticket.request_detail || '',
        reportedBy,
        servicedBy,
        managerOnDuty,
        ticket.date_responded || '',
        ticket.time_responded || '',
        ticket.date_ack || '',
        ticket.time_ack || '',
        ticket.date_attended || '',
        ticket.store_arrival || '',
        ticket.work_start || '',
        ticket.work_end || '',
        ticket.date_resolved || '',
        ticket.action_taken || '',
        ticket.final_resolution || '',
        ticket.parts_replaced || '',
        ticket.new_parts_serial || '',
        ticket.old_parts_serial || '',
        ticket.sla_count_hrs || '',
        ticket.downtime || '',
        ticket.sla_status || ''
      ]);
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(ticketData);

    // Apply styling
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Set column widths
    const colWidths = [
      { wch: 12 },  // Ticket ID
      { wch: 20 },  // Store Name
      { wch: 12 },  // Store Code
      { wch: 15 },  // Station
      { wch: 18 },  // RCC Reference
      { wch: 12 },  // Date Reported
      { wch: 12 },  // Time Reported
      { wch: 15 },  // Request Type
      { wch: 15 },  // Device
      { wch: 18 },  // Problem Category
      { wch: 10 },  // Severity
      { wch: 12 },  // Status
      { wch: 30 },  // Request Detail
      { wch: 20 },  // Reported By
      { wch: 20 },  // Serviced By
      { wch: 20 },  // Manager
      { wch: 12 },  // Date Responded
      { wch: 12 },  // Time Responded
      { wch: 12 },  // Date Ack
      { wch: 12 },  // Time Ack
      { wch: 12 },  // Date Attended
      { wch: 12 },  // Store Arrival
      { wch: 12 },  // Work Start
      { wch: 12 },  // Work End
      { wch: 12 },  // Date Resolved
      { wch: 30 },  // Action Taken
      { wch: 30 },  // Final Resolution
      { wch: 20 },  // Parts Replaced
      { wch: 18 },  // New Parts Serial
      { wch: 18 },  // Old Parts Serial
      { wch: 12 },  // SLA Count
      { wch: 12 },  // Downtime
      { wch: 12 }   // SLA Status
    ];
    worksheet['!cols'] = colWidths;

    // Apply cell styles
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        const cell = worksheet[cellAddress];

        // Initialize cell style
        if (!cell.s) cell.s = {};

        // Title row (row 0)
        if (R === 0) {
          cell.s = {
            fill: { fgColor: { rgb: "1e40af" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }
        // Header row (row 2)
        else if (R === 2) {
          cell.s = {
            fill: { fgColor: { rgb: "3b82f6" } },
            font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
            alignment: { horizontal: "center", vertical: "center", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "000000" } },
              bottom: { style: "thin", color: { rgb: "000000" } },
              left: { style: "thin", color: { rgb: "000000" } },
              right: { style: "thin", color: { rgb: "000000" } }
            }
          };
        }
        // Data rows
        else if (R > 2) {
          const isEvenRow = (R - 3) % 2 === 0;
          cell.s = {
            fill: { fgColor: { rgb: isEvenRow ? "dbeafe" : "FFFFFF" } },
            alignment: { horizontal: "left", vertical: "top", wrapText: true },
            border: {
              top: { style: "thin", color: { rgb: "cbd5e1" } },
              bottom: { style: "thin", color: { rgb: "cbd5e1" } },
              left: { style: "thin", color: { rgb: "cbd5e1" } },
              right: { style: "thin", color: { rgb: "cbd5e1" } }
            }
          };
        }
      }
    }

    // Merge cells for title
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 32 } }];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Tickets');

    return workbook;
  };

  const handleExportModalData = async () => {
    if (modalTickets.length === 0) {
      alert('No tickets to export');
      return;
    }

    setIsExportingModal(true);
    try {
      // Convert modal tickets to Excel
      const workbook = convertTicketsToExcel(modalTickets);

      if (!workbook) {
        alert('Failed to generate Excel file.');
        return;
      }

      // Write workbook to binary string
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Create filename based on modal title and date range
      const sanitizedTitle = modalTitle.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
      const filename = startDate && endDate
        ? `${sanitizedTitle}_${startDate}_${endDate}.xlsx`
        : `${sanitizedTitle}.xlsx`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExportingModal(false);
    }
  };

  const handleStatCardClick = async (type: 'total' | 'top_sev' | 'category' | 'store') => {
    setLoadingModal(true);
    setShowModal(true);


    console.log("Handle Star Card Clicked")
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/tickets/export?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch ticket data');
      }

      let filteredTickets = result.tickets || [];
      let title = '';

      switch (type) {
        case 'total':
          title = 'All Tickets';
          // No filtering needed
          break;
        case 'top_sev':
          // Find the top severity dynamically
          const topSev = stats?.bySeverity.reduce((prev, current) =>
            (current.count > prev.count) ? current : prev,
            stats.bySeverity[0] || { severity: 'N/A', count: 0 }
          );
          if (topSev) {
            title = `Top Severity Tickets (${topSev.severity.toUpperCase()})`;
            filteredTickets = filteredTickets.filter((t: any) => t.sev?.toUpperCase() === topSev.severity.toUpperCase());
          }
          break;
        case 'category':
          const topCategory = stats?.byProblemCategory[0];
          if (topCategory) {
            title = `Tickets - ${topCategory.category}`;
            filteredTickets = filteredTickets.filter((t: any) => t.problem_category === topCategory.category);
          }
          break;
        case 'store':
          const topStore = stats?.byStore[0];
          if (topStore) {
            title = `Tickets - ${topStore.store_name}`;
            console.log('Filtering for store:', topStore.store_name, 'ID:', topStore.store_id);
            console.log('Total tickets before filter:', filteredTickets.length);
            filteredTickets = filteredTickets.filter((t: any) => {
              const matches = t.store_id === topStore.store_id;
              return matches;
            });
            console.log('Filtered tickets:', filteredTickets.length);
          }
          break;
      }

      setModalTitle(title);
      setModalTickets(filteredTickets);
    } catch (error) {
      console.error('Error fetching modal data:', error);
      alert('Failed to load ticket details. Please try again.');
      setShowModal(false);
    } finally {
      setLoadingModal(false);
    }
  };

  // Show loading while checking permissions
  if (isLoading || loadingStats) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">
            {loadingStats ? 'Loading overview...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('view_ticket_overview');

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to view the overview page.</p>
            <p className="text-slate-500 text-sm mt-2">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/ticketing/tickets')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go to Tickets
          </button>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // Color palette for charts
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#84cc16'];

  // Custom Tooltip Component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg shadow-xl shadow-black/50">
          <p className="text-slate-300 text-xs font-semibold mb-1">{label}</p>
          <p className="text-white text-sm font-bold">
            {payload[0].value} Tickets
          </p>
        </div>
      );
    }
    return null;
  };

  // Prepare data for charts
  const storeData = stats.byStore.slice(0, 10).map((item, index) => ({
    name: item.store_name,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const fieldEngineerData = stats.byFieldEngineer.slice(0, 10).map((item, index) => ({
    name: item.engineer_name,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const severityData = stats.bySeverity.map(item => ({
    name: item.severity,
    value: item.count,
    color: item.severity.toUpperCase() === 'SEV1' ? '#ef4444' : item.severity.toUpperCase() === 'SEV2' ? '#f59e0b' : '#3b82f6'
  }));

  const problemCategoryData = stats.byProblemCategory.slice(0, 8).map((item, index) => ({
    name: item.category,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  // Calculate Summary Stats (case-insensitive)
  // Find the top severity (the one with the highest count)
  const topSeverity = stats.bySeverity.reduce((prev, current) =>
    (current.count > prev.count) ? current : prev,
    stats.bySeverity[0] || { severity: 'N/A', count: 0 }
  );
  const topSevPercentage = stats.total > 0 ? ((topSeverity.count / stats.total) * 100).toFixed(1) : '0';

  const topCategory = stats.byProblemCategory[0];
  const topStore = stats.byStore[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Ticketing Analytics</h1>
          <p className="text-slate-400">Analyze ticket performance and trends.</p>
        </div>
        <button
          onClick={handleExportToExcel}
          disabled={isExporting || loadingStats}
          className={`flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all duration-200 shadow-lg ${
            isExporting || loadingStats ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Exporting...
            </>
          ) : (
            <>
              <FileDown size={18} />
              Export to Excel
            </>
          )}
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2 text-slate-400 mb-3">
          <Calendar size={18} className="text-white" />
          <span className="text-sm font-medium text-white">Filtered by: Date Range</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="analytics-start-date" className="text-sm text-slate-400 whitespace-nowrap">From:</label>
            <input
              id="analytics-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
            />
          </div>
          <div className="flex items-center gap-2 flex-1">
            <label htmlFor="analytics-end-date" className="text-sm text-slate-400 whitespace-nowrap">To:</label>
            <input
              id="analytics-end-date"
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

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Tickets"
          value={stats.total.toString()}
          change={startDate || endDate ? "In selected range" : "All time"}
          icon={<Ticket />}
          color="blue"
          onClick={() => handleStatCardClick('total')}
        />
        <StatCard
          title={`Top SEV (${topSeverity.severity.toUpperCase()})`}
          value={topSeverity.count.toString()}
          change={`${topSevPercentage}% of total`}
          icon={<AlertTriangle />}
          color="rose"
          onClick={() => handleStatCardClick('top_sev')}
        />
        <StatCard
          title="Top Category"
          value={topCategory?.category || 'N/A'}
          change={topCategory ? `${topCategory.count} tickets` : 'No data'}
          icon={<Activity />}
          color="amber"
          onClick={() => handleStatCardClick('category')}
        />
        <StatCard
          title="Top Store"
          value={topStore?.store_name || 'N/A'}
          change={topStore ? `${topStore.count} tickets` : 'No data'}
          icon={<Store />}
          color="emerald"
          onClick={() => handleStatCardClick('store')}
        />
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Tickets Assigned per Store */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Store size={18} className="text-blue-400" />
            Tickets Assigned per Store
          </h3>
          <div className="h-[350px] w-full">
            {storeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={storeData} margin={{ left: 0, right: 0, bottom: 60, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                  <XAxis
                    dataKey="name"
                    stroke="#94a3b8"
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval={0}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {storeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 2. Tickets Assigned per FE */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
             <Activity size={18} className="text-purple-400" />
             Tickets Assigned per FE
          </h3>
          <div className="h-[350px] w-full">
            {fieldEngineerData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fieldEngineerData} layout="vertical" margin={{ left: 100, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={90}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {fieldEngineerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 3. Tickets per Severity */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-400" />
            Tickets per Severity
          </h3>
          <div className="h-[350px] w-full relative">
            {severityData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      iconType="circle"
                      formatter={(value) => <span className="text-slate-300 ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Stats */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-[calc(50%+18px)] text-center pointer-events-none">
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Total</p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>

        {/* 4. Top Drivers in Problem Category */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20 hover:border-slate-700 transition-colors">
          <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
            <Ticket size={18} className="text-emerald-400" />
            Problem Categories
          </h3>
          <div className="h-[350px] w-full">
            {problemCategoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={problemCategoryData} layout="vertical" margin={{ left: 120, right: 10, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                  <XAxis 
                    type="number" 
                    stroke="#94a3b8" 
                    allowDecimals={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#94a3b8"
                    width={110}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: '#334155', opacity: 0.1 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {problemCategoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">No data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Stores with Highest Number of Tickets */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl shadow-lg shadow-slate-950/20">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Store size={18} className="text-blue-400" />
          Stores with Highest Number of Tickets
        </h3>
        <p className="text-sm text-slate-400 mb-6">
          Stores generating the most support requests
        </p>
        {stats.byStore && stats.byStore.length > 0 ? (
          <div className="space-y-3">
            {stats.byStore.slice(0, 10).map((store, index) => (
              <div
                key={store.store_id}
                onClick={() => handleStatCardClick('store')}
                className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:bg-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 font-bold text-sm group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-blue-300 transition-colors">
                      {store.store_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-blue-400 group-hover:text-blue-300 transition-colors">
                    {store.count}
                  </span>
                  <span className="text-xs text-slate-400 whitespace-nowrap">
                    {store.count === 1 ? 'ticket' : 'tickets'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            No store data available
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-7xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-6 border-b border-slate-800 gap-3 sm:gap-0">
              <div className="flex items-center gap-3">
                <Ticket className="text-blue-400" size={24} />
                <h2 className="text-xl sm:text-2xl font-bold text-white">{modalTitle}</h2>
                <span className="text-slate-400 text-sm">({modalTickets.length} tickets)</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleExportModalData}
                  disabled={isExportingModal || loadingModal || modalTickets.length === 0}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-all duration-200 ${
                    isExportingModal || loadingModal || modalTickets.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {isExportingModal ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden sm:inline">Exporting...</span>
                    </>
                  ) : (
                    <>
                      <FileDown size={18} />
                      <span className="hidden sm:inline">Export Data</span>
                      <span className="sm:hidden">Export</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              {loadingModal ? (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400">Loading tickets...</p>
                  </div>
                </div>
              ) : modalTickets.length === 0 ? (
                <div className="flex items-center justify-center h-64">
                  <p className="text-slate-400">No tickets found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-slate-900 z-10">
                      <tr className="border-b border-slate-800">
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Ticket ID</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Store</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Device</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Problem</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Severity</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Status</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Date Reported</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-semibold text-sm">Serviced By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalTickets.map((ticket, index) => {
                        const storeName = (ticket.stores as any)?.store_name || 'N/A';
                        const servicedBy = ticket.serviced_by_user
                          ? `${ticket.serviced_by_user.first_name} ${ticket.serviced_by_user.last_name}`
                          : 'Unassigned';

                        const sevColor = ticket.sev?.toUpperCase() === 'SEV1' ? 'text-red-400 bg-red-500/10' :
                                        ticket.sev?.toUpperCase() === 'SEV2' ? 'text-amber-400 bg-amber-500/10' :
                                        'text-blue-400 bg-blue-500/10';

                        const normalizedStatus = (ticket.status || '').toLowerCase().replace(/_/g, ' ');
                        const statusColor = normalizedStatus === 'closed' ? 'text-emerald-400 bg-emerald-500/10' :
                                           normalizedStatus === 'in progress' ? 'text-blue-400 bg-blue-500/10' :
                                           normalizedStatus === 'on hold' ? 'text-amber-400 bg-amber-500/10' :
                                           'text-slate-400 bg-slate-500/10';

                        return (
                          <tr
                            key={ticket.id}
                            className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${
                              index % 2 === 0 ? 'bg-slate-900/50' : ''
                            }`}
                          >
                            <td className="py-3 px-4 text-white font-mono text-xs">{String(ticket.id).slice(0, 8)}...</td>
                            <td className="py-3 px-4 text-slate-300 text-sm">{storeName}</td>
                            <td className="py-3 px-4 text-slate-300 text-sm">{ticket.device || 'N/A'}</td>
                            <td className="py-3 px-4 text-slate-300 text-sm max-w-xs truncate">
                              {ticket.problem_category || 'N/A'}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${sevColor}`}>
                                {ticket.sev || 'N/A'}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${statusColor}`}>
                                {(ticket.status || 'N/A').replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300 text-sm">
                              {ticket.date_reported || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-slate-300 text-sm">{servicedBy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800 bg-slate-900/50">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
