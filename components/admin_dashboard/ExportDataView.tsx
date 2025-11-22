import React, { useState } from 'react';
import { Employee, WorkLog } from '@/types';

interface ExportDataViewProps {
  employees: Employee[];
}

const ExportDataView: React.FC<ExportDataViewProps> = ({ employees }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleExport = () => {
    const filteredLogs: (WorkLog & { employeeName: string; employeeEmail: string })[] = [];

    employees.forEach(employee => {
      if (employee.workLogs) {
        employee.workLogs.forEach(log => {
          const logDate = new Date(log.date);
          const start = startDate ? new Date(startDate) : null;
          const end = endDate ? new Date(endDate) : null;

          if ((!start || logDate >= start) && (!end || logDate <= end)) {
            filteredLogs.push({
              ...log,
              employeeName: employee.fullName,
              employeeEmail: employee.email,
            });
          }
        });
      }
    });

    if (filteredLogs.length === 0) {
      alert('No data to export for the selected date range.');
      return;
    }

    const csvContent = "data:text/csv;charset=utf-8," 
      + "Employee Name,Employee Email,Date,Start Time,End Time,Duration (seconds)\n"
      + filteredLogs.map(log => 
          `${log.employeeName},${log.employeeEmail},${log.date},${new Date(log.startTime).toLocaleTimeString()},${log.endTime ? new Date(log.endTime).toLocaleTimeString() : 'N/A'},${log.durationSeconds}`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `cerventech_hr_export_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900 p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Export Employee Data</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="startDate" className="block text-sm font-medium text-slate-400 mb-2">Start Date</label>
          <input
            type="date"
            id="startDate"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-slate-400 mb-2">End Date</label>
          <input
            type="date"
            id="endDate"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <button
        onClick={handleExport}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
      >
        Export to CSV
      </button>
    </div>
  );
};

export default ExportDataView;
