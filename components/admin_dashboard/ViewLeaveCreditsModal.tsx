import React, { useState, useEffect } from 'react';
import { X, Search, Loader2, Eye, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ViewLeaveCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  position: string;
  leave_credits: number;
}

export const ViewLeaveCreditsModal: React.FC<ViewLeaveCreditsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sortField, setSortField] = useState<'name' | 'credits'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    } else {
      setSearchTerm('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredEmployees(employees);
    } else {
      const filtered = employees.filter(emp => {
        const searchLower = searchTerm.toLowerCase();
        return (
          emp.first_name.toLowerCase().includes(searchLower) ||
          emp.last_name.toLowerCase().includes(searchLower) ||
          emp.employee_id.toLowerCase().includes(searchLower) ||
          emp.email.toLowerCase().includes(searchLower) ||
          emp.position.toLowerCase().includes(searchLower)
        );
      });
      setFilteredEmployees(filtered);
    }
  }, [searchTerm, employees]);

  const fetchEmployees = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/employees/get');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data.employees || []);
      setFilteredEmployees(data.employees || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: 'name' | 'credits') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    if (sortField === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB)
        : nameB.localeCompare(nameA);
    } else {
      return sortOrder === 'asc'
        ? a.leave_credits - b.leave_credits
        : b.leave_credits - a.leave_credits;
    }
  });

  const handleExportToExcel = () => {
    const exportData = sortedEmployees.map(emp => ({
      'Employee ID': emp.employee_id,
      'First Name': emp.first_name,
      'Last Name': emp.last_name,
      'Email': emp.email,
      'Position': emp.position,
      'Leave Credits': emp.leave_credits,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet['!cols'] = [
      { wch: 15 }, // Employee ID
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 20 }, // Position
      { wch: 15 }, // Leave Credits
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Credits');

    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `leave_credits_${date}.xlsx`);
  };

  const totalCredits = sortedEmployees.reduce((sum, emp) => sum + emp.leave_credits, 0);
  const averageCredits = sortedEmployees.length > 0
    ? (totalCredits / sortedEmployees.length).toFixed(2)
    : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Eye className="text-blue-400" size={24} />
              View Leave Credits
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              View all employees and their leave credits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Stats Bar */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">Total Employees</p>
            <p className="text-2xl font-bold text-white">{sortedEmployees.length}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">Total Credits</p>
            <p className="text-2xl font-bold text-emerald-400">{totalCredits}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500 uppercase mb-1">Average Credits</p>
            <p className="text-2xl font-bold text-blue-400">{averageCredits}</p>
          </div>
        </div>

        {/* Search and Export */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, ID, email, or position..."
              className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
          </div>
          <button
            onClick={handleExportToExcel}
            disabled={sortedEmployees.length === 0}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={18} />
            <span className="whitespace-nowrap">Export to Excel</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
              <p className="text-slate-400">Loading employees...</p>
            </div>
          ) : sortedEmployees.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <p>No employees found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-950/50 sticky top-0">
                  <tr className="border-b border-slate-800">
                    <th
                      className="px-4 py-3 text-left text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Employee
                        {sortField === 'name' && (
                          <span className="text-blue-400">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium hidden sm:table-cell">
                      Position
                    </th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium hidden md:table-cell">
                      Email
                    </th>
                    <th
                      className="px-4 py-3 text-right text-slate-400 font-medium cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('credits')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Leave Credits
                        {sortField === 'credits' && (
                          <span className="text-blue-400">
                            {sortOrder === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {sortedEmployees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-white font-medium">
                            {employee.first_name} {employee.last_name}
                          </p>
                          <p className="text-slate-500 text-xs">{employee.employee_id}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-300 hidden sm:table-cell">
                        {employee.position}
                      </td>
                      <td className="px-4 py-4 text-slate-400 text-xs hidden md:table-cell">
                        {employee.email}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-bold ${
                          employee.leave_credits === 0
                            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                            : employee.leave_credits < 5
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        }`}>
                          {employee.leave_credits}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
