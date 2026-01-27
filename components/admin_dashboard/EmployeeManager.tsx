import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  FileDown,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Ban,
  AlertTriangle,
  UserCheck,
} from "lucide-react";
import * as XLSX from 'xlsx';
import { Employee, Position } from "@/types";
import EmployeeForm from "@/components/admin_dashboard/EmployeeForm";
import { useUser } from "@/hooks/useUser";

interface EmployeeManagerProps {
  employees: Employee[];
  onSelectEmployee: (id: string) => void;
  onAddEmployee: (employee: Employee) => void;
  onDeleteEmployee?: (id: string) => void;
  onUpdateEmployee?: (id: string, updates: Partial<Employee>) => void;
  positions: Position[];
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  onSelectEmployee,
  onAddEmployee,
  onDeleteEmployee,
  onUpdateEmployee,
  positions,
}) => {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
    action: 'enable' | 'disable';
  }>({ isOpen: false, employee: null, action: 'disable' });
  const [isProcessing, setIsProcessing] = useState(false);

  // Check if current user is Operations Manager
  const isOperationsManager = user?.position === 'Operations Manager';

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(
      (e) =>
        e.fullName.toLowerCase().includes(term) ||
        e.email.toLowerCase().includes(term) ||
        e.employee_id?.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  const handleExportExcel = () => {
    // Sort employees alphabetically by fullName
    const sortedEmployees = [...employees].sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );

    // Prepare data for Excel
    const excelData = sortedEmployees.map((emp) => ({
      'Employee ID': emp.employee_id || 'N/A',
      'Full Name': emp.fullName,
      'Email': emp.email,
      'Position': emp.position,
      'Status': emp.status,
      'Contact': emp.contact_number || 'N/A',
      'Address': emp.address || 'N/A',
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // Employee ID
      { wch: 25 }, // Full Name
      { wch: 30 }, // Email
      { wch: 25 }, // Position
      { wch: 12 }, // Status
      { wch: 15 }, // Contact
      { wch: 40 }, // Address
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Add metadata sheet
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const metaData = [
      { Field: 'Report Title', Value: 'Employee Directory' },
      { Field: 'Generated Date', Value: today },
      { Field: 'Total Employees', Value: sortedEmployees.length },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Report Info');

    // Save file
    const filename = `CervenTech_Employees_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleStatusClick = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    const action = employee.status === 'Terminated' ? 'enable' : 'disable';
    setStatusModal({ isOpen: true, employee, action });
  };

  const handleConfirmStatusChange = async () => {
    if (!statusModal.employee) return;

    setIsProcessing(true);
    try {
      const isEnabling = statusModal.action === 'enable';
      const endpoint = isEnabling ? '/api/enable-employee' : '/api/delete-employee';
      const method = isEnabling ? 'POST' : 'DELETE';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeId: statusModal.employee.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${statusModal.action} employee`);
      }

      // Update the employee status in the list
      if (onUpdateEmployee) {
        onUpdateEmployee(statusModal.employee.id, {
          status: isEnabling ? 'Active' : 'Terminated'
        });
      }

      // Close the modal
      setStatusModal({ isOpen: false, employee: null, action: 'disable' });
    } catch (error: any) {
      alert(`Error ${statusModal.action === 'enable' ? 'enabling' : 'disabling'} employee: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelStatusChange = () => {
    setStatusModal({ isOpen: false, employee: null, action: 'disable' });
  };

  if (isCreating) {
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setIsCreating(false)}
          className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
        >
          ← Back to List
        </button>
        <EmployeeForm
          onSubmit={onAddEmployee}
          onCancel={() => setIsCreating(false)}
          positions={positions}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-lg">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleExportExcel}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2"
          >
            <FileDown size={18} />
            <span className="hidden sm:inline">Export All Data</span>
          </button>
          {isOperationsManager && (
            <button
              onClick={() => setIsCreating(true)}
              className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/40"
            >
              <Plus size={18} />
              <span className="font-medium">Add Employee</span>
            </button>
          )}
        </div>
      </div>

      {/* List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map((employee) => (
          <div
            key={employee.id}
            onClick={() => onSelectEmployee(employee.id)}
            className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 cursor-pointer hover:border-blue-500/50 transition-all hover:shadow-xl hover:shadow-blue-900/10"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <img
                    src={employee.avatarUrl}
                    alt={employee.fullName}
                    className="w-14 h-14 rounded-full object-cover border-2 border-slate-700 group-hover:border-blue-500 transition-colors"
                  />
                  <span
                    className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                      employee.status === "Active"
                        ? "bg-emerald-500"
                        : "bg-red-500"
                    }`}
                  ></span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">
                    {employee.fullName}
                  </h3>
                  <p className="text-slate-400 text-sm">{employee.position}</p>
                  <p className="text-slate-500 text-xs">ID: {employee.employee_id || "N/A"}</p>
                </div>
              </div>
              {isOperationsManager && (
                <button
                  onClick={(e) => handleStatusClick(e, employee)}
                  className={`p-2 rounded-lg transition-colors ${
                    employee.status === 'Terminated'
                      ? 'text-slate-500 hover:text-emerald-500 hover:bg-emerald-500/10'
                      : 'text-slate-500 hover:text-red-500 hover:bg-red-500/10'
                  }`}
                  title={employee.status === 'Terminated' ? 'Enable employee' : 'Terminate employee'}
                >
                  {employee.status === 'Terminated' ? <UserCheck size={18} /> : <Ban size={18} />}
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <Mail size={16} className="text-slate-500" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <Phone size={16} className="text-slate-500" />
                <span>{employee.contact_number || "N/A"}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <MapPin size={16} className="text-slate-500" />
                <span>{employee.address || "N/A"}</span>
              </div>
            </div>
          </div>
        ))}

        {filteredEmployees.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-slate-500">
            <Search size={48} className="mb-4 opacity-20" />
            <p>No employees found matching "{searchTerm}"</p>
          </div>
        )}
      </div>

      {/* Status Change Confirmation Modal */}
      {statusModal.isOpen && statusModal.employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className={`p-3 rounded-full ${
                statusModal.action === 'enable' ? 'bg-emerald-500/10' : 'bg-red-500/10'
              }`}>
                {statusModal.action === 'enable' ? (
                  <UserCheck className="text-emerald-500" size={24} />
                ) : (
                  <AlertTriangle className="text-red-500" size={24} />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  {statusModal.action === 'enable' ? 'Enable Employee' : 'Terminate Employee'}
                </h3>
                <p className="text-slate-400 text-sm">
                  {statusModal.action === 'enable' ? (
                    <>
                      Are you sure you want to enable{" "}
                      <span className="font-semibold text-white">
                        {statusModal.employee.fullName}
                      </span>
                      ? This will allow the employee to log in again.
                    </>
                  ) : (
                    <>
                      Are you sure you want to terminate{" "}
                      <span className="font-semibold text-white">
                        {statusModal.employee.fullName}
                      </span>
                      ? This will prevent the employee from logging in and mark their
                      account as terminated.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={handleCancelStatusChange}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStatusChange}
                disabled={isProcessing}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                  statusModal.action === 'enable'
                    ? 'bg-emerald-600 hover:bg-emerald-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{statusModal.action === 'enable' ? 'Enabling...' : 'Terminating...'}</span>
                  </>
                ) : (
                  <>
                    {statusModal.action === 'enable' ? <UserCheck size={16} /> : <Ban size={16} />}
                    <span>{statusModal.action === 'enable' ? 'Enable' : 'Terminate'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManager;
