import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '@/types';
import { Search, User, X, FileDown } from 'lucide-react';

interface ExportDataViewProps {
  employees: Employee[];
}

const ExportDataView: React.FC<ExportDataViewProps> = ({ employees }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingIndividual, setIsExportingIndividual] = useState(false);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredEmployees = employees.filter(employee => 
    employee.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const convertToCSV = (data: any[]) => {
    if (!data || data.length === 0) return '';

    const headers = [
      'Date',
      'Employee Name',
      'Email',
      'Time In',
      'Time Out',
      'Total Minutes',
      'Total Hours',
      'Clock In Address',
      'Clock Out Address',
      'Has Overtime Request',
      'Overtime Status',
      'Overtime Comment',
      'Overtime Approved Hours',
      'Overtime Requested At',
      'Overtime Approved/Rejected At',
      'Overtime Reviewer'
    ];
    const csvRows = [headers.join(',')];

    for (const row of data) {
      const date = row.date;
      const firstName = row.profiles?.first_name || '';
      const lastName = row.profiles?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const email = row.profiles?.email || '';

      const timeInDate = row.time_in ? new Date(row.time_in) : null;
      const timeOutDate = row.time_out ? new Date(row.time_out) : null;

      const timeIn = timeInDate ? timeInDate.toLocaleTimeString() : 'N/A';
      const timeOut = timeOutDate ? timeOutDate.toLocaleTimeString() : 'N/A';

      let totalMinutes = 0;
      let totalHours = 0;

      if (timeInDate && timeOutDate) {
        const diffMs = timeOutDate.getTime() - timeInDate.getTime();
        totalMinutes = Math.floor(diffMs / 60000);
        totalHours = parseFloat((totalMinutes / 60).toFixed(2));
      }

      // Escape quotes in addresses and handle potentially missing location data
      const addressIn = row.clock_in_address ? `"${row.clock_in_address.replace(/"/g, '""')}"` : 'N/A';
      const addressOut = row.clock_out_address ? `"${row.clock_out_address.replace(/"/g, '""')}"` : 'N/A';

      // Handle overtime request data
      const hasOvertimeRequest = row.overtimeRequest ? 'Yes' : 'No';
      const overtimeStatus = row.overtimeRequest?.status || 'N/A';
      const overtimeComment = row.overtimeRequest?.comment
        ? `"${row.overtimeRequest.comment.replace(/"/g, '""')}"`
        : 'N/A';
      const overtimeApprovedHours = row.overtimeRequest?.approved_hours || 'N/A';
      const overtimeRequestedAt = row.overtimeRequest?.requested_at
        ? new Date(row.overtimeRequest.requested_at).toLocaleString()
        : 'N/A';
      const overtimeApprovedAt = row.overtimeRequest?.approved_at
        ? new Date(row.overtimeRequest.approved_at).toLocaleString()
        : 'N/A';
      const overtimeReviewer = row.overtimeRequest?.reviewer
        ? `"${row.overtimeRequest.reviewer.first_name} ${row.overtimeRequest.reviewer.last_name}"`
        : 'N/A';

      const values = [
        date,
        `"${fullName}"`, // Quote names to handle commas
        email,
        timeIn,
        timeOut,
        totalMinutes,
        totalHours,
        addressIn,
        addressOut,
        hasOvertimeRequest,
        overtimeStatus,
        overtimeComment,
        overtimeApprovedHours,
        overtimeRequestedAt,
        overtimeApprovedAt,
        overtimeReviewer
      ];
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  };

  const fetchAndDownload = async (
    start: string, 
    end: string, 
    type: 'all' | 'individual', 
    userId?: string, 
    employeeName?: string
  ) => {
    if (type === 'all') setIsExportingAll(true);
    else setIsExportingIndividual(true);

    try {
      const params = new URLSearchParams({
        startDate: start,
        endDate: end,
      });
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/admin/export-attendance?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch data');
      }

      if (!result.data || result.data.length === 0) {
        alert('No records found for the selected criteria.');
        return;
      }

      const csvString = convertToCSV(result.data);
      const blob = new Blob([csvString], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      const filename = userId 
        ? `attendance_${employeeName?.replace(/\s+/g, '_')}_${start}_${end}.csv` 
        : `attendance_all_${start}_${end}.csv`;
        
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      if (type === 'all') setIsExportingAll(false);
      else setIsExportingIndividual(false);
    }
  };

  const handleExportAll = () => {
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    fetchAndDownload(startDate, endDate, 'all');
  };

  const handleExportIndividual = () => {
    if (!selectedEmployee) {
      alert('Please select an employee.');
      return;
    }
    if (!startDate || !endDate) {
      alert('Please select both start and end dates.');
      return;
    }
    fetchAndDownload(startDate, endDate, 'individual', selectedEmployee.id, selectedEmployee.fullName);
  };

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchQuery('');
    setShowResults(false);
  };

  const handleClearSelection = () => {
    setSelectedEmployee(null);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-xl shadow-lg">
      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }
      `}</style>
      <div className="flex items-center gap-3 mb-8">
        <FileDown className="w-8 h-8 text-blue-500" />
        <h2 className="text-2xl font-bold text-white">Export Data</h2>
      </div>
      
      {/* Shared Date Filters */}
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Date Range
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-slate-400 mb-2">Start Date</label>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-slate-400 mb-2">End Date</label>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Section 1: Export All */}
        <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors">
          <h3 className="text-xl font-bold text-white mb-2">Bulk Export</h3>
          <p className="text-slate-400 mb-6 text-sm">
            Download attendance records for all employees within the selected date range.
          </p>
          <button
            onClick={handleExportAll}
            disabled={isExportingAll || isExportingIndividual}
            className={`w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-900/30 transition-all duration-200 flex items-center justify-center gap-2 ${
              isExportingAll ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isExportingAll ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Exporting...
              </>
            ) : (
              <>
                <FileDown size={20} />
                Export All to CSV
              </>
            )}
          </button>
        </div>

        {/* Section 2: Individual Export */}
        <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors relative">
          <h3 className="text-xl font-bold text-white mb-2">Individual Export</h3>
          <p className="text-slate-400 mb-6 text-sm">
            Search and export attendance records for a specific employee.
          </p>

          {!selectedEmployee ? (
            <div className="relative" ref={searchRef}>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search employee by name or email..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-600"
                />
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchQuery && (
                <div className="absolute z-10 w-full mt-2 bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {filteredEmployees.length > 0 ? (
                    filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        onClick={() => handleSelectEmployee(emp)}
                        className="w-full text-left px-4 py-3 hover:bg-slate-800 flex items-center gap-3 border-b border-slate-800 last:border-0 transition-colors"
                      >
                        <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-300">
                          {emp.fullName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">{emp.fullName}</div>
                          <div className="text-xs text-slate-500">{emp.email}</div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-slate-500 text-sm text-center">No employees found</div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500">
                  <User size={20} />
                </div>
                <div>
                  <div className="font-bold text-white">{selectedEmployee.fullName}</div>
                  <div className="text-xs text-slate-500">{selectedEmployee.email}</div>
                </div>
              </div>
              <button 
                onClick={handleClearSelection}
                className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          )}

          <button
            onClick={handleExportIndividual}
            disabled={!selectedEmployee || isExportingAll || isExportingIndividual}
            className={`w-full mt-4 font-bold py-3 px-4 rounded-lg shadow-lg transition-all duration-200 flex items-center justify-center gap-2 ${
              selectedEmployee && !isExportingAll && !isExportingIndividual
                ? 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-900/30' 
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {isExportingIndividual ? (
              <>
                 <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
                 Exporting...
              </>
            ) : (
              <>
                <FileDown size={20} />
                Export Individual CSV
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDataView;
