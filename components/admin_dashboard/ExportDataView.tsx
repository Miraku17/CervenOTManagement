import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '@/types';
import { Search, User, X, FileDown } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';

interface ExportDataViewProps {
  employees: Employee[];
}

const ExportDataView: React.FC<ExportDataViewProps> = ({ employees }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportType, setExportType] = useState<'attendance' | 'overtime'>('attendance');

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

  const convertToExcel = (data: any[], leaveRequests?: any[], schedules?: any[]) => {
    if (!data || data.length === 0) return null;

    // Get unique dates and sort them
    const allDates = Array.from(new Set(data.map(row => row.date))).sort();
    if (allDates.length === 0) return null;

    const startDate = allDates[0];
    const endDate = allDates[allDates.length - 1];

    // Generate all dates in range
    const dateRange: string[] = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);
    while (currentDate <= end) {
      dateRange.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Group attendance by user_id and date
    const attendanceMap = new Map<string, Map<string, any[]>>();
    for (const record of data) {
      const userId = record.user_id;
      if (!attendanceMap.has(userId)) {
        attendanceMap.set(userId, new Map());
      }
      const userAttendance = attendanceMap.get(userId)!;
      if (!userAttendance.has(record.date)) {
        userAttendance.set(record.date, []);
      }
      userAttendance.get(record.date)!.push(record);
    }

    // Create leave map (user_id -> dates that are leaves)
    const leaveMap = new Map<string, Set<string>>();
    if (leaveRequests) {
      for (const leave of leaveRequests) {
        if (!leaveMap.has(leave.employee_id)) {
          leaveMap.set(leave.employee_id, new Set());
        }
        // Add all dates in the leave range
        let leaveDate = new Date(leave.start_date);
        const leaveEnd = new Date(leave.end_date);
        while (leaveDate <= leaveEnd) {
          const dateStr = leaveDate.toISOString().split('T')[0];
          leaveMap.get(leave.employee_id)!.add(dateStr);
          leaveDate.setDate(leaveDate.getDate() + 1);
        }
      }
    }

    // Create rest day map (user_id -> dates that are rest days)
    const restDayMap = new Map<string, Set<string>>();
    if (schedules) {
      for (const schedule of schedules) {
        if (schedule.is_rest_day) {
          if (!restDayMap.has(schedule.employee_id)) {
            restDayMap.set(schedule.employee_id, new Set());
          }
          restDayMap.get(schedule.employee_id)!.add(schedule.date);
        }
      }
    }

    // Get unique employees sorted by name
    const employeeMap = new Map<string, { name: string; employeeId: string; userId: string }>();
    for (const record of data) {
      const userId = record.user_id;
      if (!employeeMap.has(userId)) {
        const firstName = record.profiles?.first_name || '';
        const lastName = record.profiles?.last_name || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const employeeId = record.profiles?.employee_id || 'NA';
        employeeMap.set(userId, { name: fullName, employeeId, userId });
      }
    }

    const sortedEmployees = Array.from(employeeMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Build the daily attendance report
    const reportData: any[][] = [];
    const rowStyles: { row: number; type: 'title' | 'header' | 'data' | 'leave' | 'restday' | 'total' }[] = [];

    // Title row
    reportData.push(['Print Attendance Report - Daily Attendance (New Attendance System)']);
    rowStyles.push({ row: 0, type: 'title' });
    reportData.push([]); // Empty row

    let currentRow = 2;

    for (const employee of sortedEmployees) {
      // Add header row for each employee section
      reportData.push(['Date', 'Employee Name', 'Employee ID', 'Time In', 'Time Out', 'Total Hours', 'Session Status']);
      rowStyles.push({ row: currentRow, type: 'header' });
      currentRow++;

      const userAttendance = attendanceMap.get(employee.userId) || new Map();
      const userLeaves = leaveMap.get(employee.userId) || new Set();
      const userRestDays = restDayMap.get(employee.userId) || new Set();

      let completedDays = 0;

      // Process each date in the range
      for (const date of dateRange) {
        if (userLeaves.has(date)) {
          // Leave day
          reportData.push([date, '', '', '', '', '', 'LEAVE']);
          rowStyles.push({ row: currentRow, type: 'leave' });
          currentRow++;
        } else if (userRestDays.has(date)) {
          // Rest day
          reportData.push([date, '', '', '', '', '', 'REST DAY']);
          rowStyles.push({ row: currentRow, type: 'restday' });
          currentRow++;
        } else if (userAttendance.has(date)) {
          // Attendance records for this date
          const records = userAttendance.get(date)!;
          for (const record of records) {
            const timeIn = record.time_in ? new Date(record.time_in).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '';
            const timeOut = record.time_out ? new Date(record.time_out).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }) : '';
            const status = record.time_out ? 'Completed' : 'Active';

            // Calculate total hours from time_in and time_out
            let totalHours = '';
            if (record.time_in && record.time_out) {
              const timeInDate = new Date(record.time_in);
              const timeOutDate = new Date(record.time_out);
              const diffMs = timeOutDate.getTime() - timeInDate.getTime();
              const hours = diffMs / (1000 * 60 * 60);
              totalHours = hours.toFixed(2);
            }

            reportData.push([
              date,
              employee.name,
              employee.employeeId,
              timeIn,
              timeOut,
              totalHours,
              status
            ]);
            rowStyles.push({ row: currentRow, type: 'data' });
            currentRow++;

            if (status === 'Completed') {
              completedDays++;
            }
          }
        }
        // If no attendance, leave, or rest day, skip the date (no row)
      }

      // Add total row
      reportData.push(['Total', completedDays.toString(), '', '', '', '', '']);
      rowStyles.push({ row: currentRow, type: 'total' });
      currentRow++;
      reportData.push([]); // Empty row before next employee
      currentRow++;
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(reportData);

    // Apply styling
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 },  // Date
      { wch: 25 },  // Employee Name
      { wch: 12 },  // Employee ID
      { wch: 12 },  // Time In
      { wch: 12 },  // Time Out
      { wch: 12 },  // Total Hours
      { wch: 15 }   // Session Status
    ];

    // Apply cell styles
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const rowStyle = rowStyles.find(rs => rs.row === R);

      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!worksheet[cellAddress]) continue;

        const cell = worksheet[cellAddress];

        // Initialize cell style
        if (!cell.s) cell.s = {};

        // Apply styles based on row type
        if (rowStyle) {
          switch (rowStyle.type) {
            case 'title':
              cell.s = {
                fill: { fgColor: { rgb: "000000" } },
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 14 },
                alignment: { horizontal: "left", vertical: "center" }
              };
              break;
            case 'header':
              cell.s = {
                fill: { fgColor: { rgb: "4472C4" } },
                font: { bold: true, color: { rgb: "FFFFFF" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              };
              break;
            case 'data':
              const isEvenRow = R % 2 === 0;
              cell.s = {
                fill: { fgColor: { rgb: isEvenRow ? "D9E2F3" : "FFFFFF" } },
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              };
              break;
            case 'leave':
            case 'restday':
              cell.s = {
                fill: { fgColor: { rgb: "FFFF00" } },
                font: { bold: true },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              };
              break;
            case 'total':
              cell.s = {
                fill: { fgColor: { rgb: "4472C4" } },
                font: { bold: true, color: { rgb: "FFFFFF" } },
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                }
              };
              break;
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Attendance');

    return workbook;
  };

  const convertOvertimeToExcel = (overtimeV2Data: any[]) => {
    if (!overtimeV2Data || overtimeV2Data.length === 0) return null;

    const overtimeData: any[][] = [];

    // Add headers for overtime_v2 data
    overtimeData.push([
      'Overtime Date',
      'Employee Name',
      'Employee ID',
      'Email',
      'OT Start Time',
      'OT End Time',
      'Total OT Hours',
      'Reason',
      'Level 1 Status',
      'Level 1 Reviewer',
      'Level 1 Comment',
      'Level 1 Reviewed At',
      'Level 2 Status',
      'Level 2 Reviewer',
      'Level 2 Comment',
      'Level 2 Reviewed At',
      'Final Status',
      'Requested At'
    ]);

    // Debug logging
    console.log('Overtime V2 records received:', overtimeV2Data.length);

    // Sort by date and employee name
    const sortedData = [...overtimeV2Data].sort((a, b) => {
      const dateCompare = a.overtime_date.localeCompare(b.overtime_date);
      if (dateCompare !== 0) return dateCompare;
      const nameA = `${a.profiles?.first_name || ''} ${a.profiles?.last_name || ''}`;
      const nameB = `${b.profiles?.first_name || ''} ${b.profiles?.last_name || ''}`;
      return nameA.localeCompare(nameB);
    });

    // Add overtime records
    for (const row of sortedData) {
      const firstName = row.profiles?.first_name || '';
      const lastName = row.profiles?.last_name || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const employeeId = row.profiles?.employee_id || 'NA';
      const email = row.profiles?.email || 'N/A';

      const formatTime = (time: string) => {
        if (!time) return 'N/A';
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
      };

      const otStartTime = formatTime(row.start_time);
      const otEndTime = formatTime(row.end_time);
      const totalOTHours = row.total_hours?.toFixed(2) || '0.00';
      const reason = row.reason || 'N/A';

      const level1Status = row.level1_status || 'Pending';
      const level1Reviewer = row.level1_reviewer_profile
        ? `${row.level1_reviewer_profile.first_name} ${row.level1_reviewer_profile.last_name}`
        : 'N/A';
      const level1Comment = row.level1_comment || 'N/A';
      const level1ReviewedAt = row.level1_reviewed_at
        ? new Date(row.level1_reviewed_at).toLocaleString()
        : 'N/A';

      const level2Status = row.level2_status || 'Pending';
      const level2Reviewer = row.level2_reviewer_profile
        ? `${row.level2_reviewer_profile.first_name} ${row.level2_reviewer_profile.last_name}`
        : 'N/A';
      const level2Comment = row.level2_comment || 'N/A';
      const level2ReviewedAt = row.level2_reviewed_at
        ? new Date(row.level2_reviewed_at).toLocaleString()
        : 'N/A';

      const finalStatus = row.final_status || row.status || 'Pending';
      const requestedAt = row.requested_at
        ? new Date(row.requested_at).toLocaleString()
        : 'N/A';

      overtimeData.push([
        row.overtime_date,
        fullName,
        employeeId,
        email,
        otStartTime,
        otEndTime,
        totalOTHours,
        reason,
        level1Status,
        level1Reviewer,
        level1Comment,
        level1ReviewedAt,
        level2Status,
        level2Reviewer,
        level2Comment,
        level2ReviewedAt,
        finalStatus,
        requestedAt
      ]);
    }

    // Create workbook with single sheet for overtime
    const workbook = XLSX.utils.book_new();
    const overtimeSheet = XLSX.utils.aoa_to_sheet(overtimeData);
    XLSX.utils.book_append_sheet(workbook, overtimeSheet, 'Overtime Requests');

    return workbook;
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

      // For overtime export, check overtimeV2 data; for attendance, check data
      if (exportType === 'overtime') {
        if (!result.overtimeV2 || result.overtimeV2.length === 0) {
          alert('No overtime requests found for the selected criteria.');
          return;
        }
      } else {
        if (!result.data || result.data.length === 0) {
          alert('No attendance records found for the selected criteria.');
          return;
        }
      }

      // Use appropriate conversion function based on export type
      const workbook = exportType === 'overtime'
        ? convertOvertimeToExcel(result.overtimeV2)
        : convertToExcel(result.data, result.leaveRequests, result.schedules);

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

      const filePrefix = exportType === 'overtime' ? 'overtime' : 'attendance';
      const filename = userId
        ? `${filePrefix}_${employeeName?.replace(/\s+/g, '_')}_${start}_${end}.xlsx`
        : `${filePrefix}_all_${start}_${end}.xlsx`;

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

        {/* Export Type Selection */}
        <div className="mt-6 pt-6 border-t border-slate-700/50">
          <label className="block text-sm font-medium text-slate-400 mb-3">Export Type</label>
          <div className="flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors flex-1">
              <input
                type="radio"
                name="exportType"
                value="attendance"
                checked={exportType === 'attendance'}
                onChange={(e) => setExportType(e.target.value as 'attendance' | 'overtime')}
                className="w-4 h-4 text-slate-400 bg-slate-900 border-slate-600 focus:ring-slate-500 focus:ring-1"
              />
              <div className="flex-1">
                <div className="text-white font-medium">Full Attendance</div>
                <div className="text-xs text-slate-500 mt-0.5">DTR summary and detailed records with overtime data</div>
              </div>
            </label>
            <label className="flex items-center gap-3 bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 cursor-pointer hover:bg-slate-800/50 transition-colors flex-1">
              <input
                type="radio"
                name="exportType"
                value="overtime"
                checked={exportType === 'overtime'}
                onChange={(e) => setExportType(e.target.value as 'attendance' | 'overtime')}
                className="w-4 h-4 text-slate-400 bg-slate-900 border-slate-600 focus:ring-slate-500 focus:ring-1"
              />
              <div className="flex-1">
                <div className="text-white font-medium">Overtime Requests Only</div>
                <div className="text-xs text-slate-500 mt-0.5">Records with overtime requests and approval details</div>
              </div>
            </label>
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
                Export All to Excel
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
                Export Individual Excel
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportDataView;
