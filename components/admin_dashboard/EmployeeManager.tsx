import React, { useState, useMemo } from "react";
import {
  Search,
  Plus,
  FileDown,
  MapPin,
  Phone,
  Mail,
  Briefcase,
  Trash2,
  AlertTriangle,
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
  positions: Position[];
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({
  employees,
  onSelectEmployee,
  onAddEmployee,
  onDeleteEmployee,
  positions,
}) => {
  const { user } = useUser();
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    employee: Employee | null;
  }>({ isOpen: false, employee: null });
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDeleteClick = (e: React.MouseEvent, employee: Employee) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, employee });
  };

  const handleConfirmDelete = async () => {
    if (!deleteModal.employee || !onDeleteEmployee) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/delete-employee', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ employeeId: deleteModal.employee.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete employee');
      }

      // Call the parent's delete handler to update the state
      onDeleteEmployee(deleteModal.employee.id);

      // Close the modal
      setDeleteModal({ isOpen: false, employee: null });
    } catch (error: any) {
      alert(`Error deleting employee: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteModal({ isOpen: false, employee: null });
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
                        : "bg-amber-500"
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
                  onClick={(e) => handleDeleteClick(e, employee)}
                  className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                  title="Delete employee"
                >
                  <Trash2 size={18} />
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

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="p-3 bg-red-500/10 rounded-full">
                <AlertTriangle className="text-red-500" size={24} />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-white mb-2">
                  Delete Employee
                </h3>
                <p className="text-slate-400 text-sm">
                  Are you sure you want to delete{" "}
                  <span className="font-semibold text-white">
                    {deleteModal.employee.fullName}
                  </span>
                  ? This action cannot be undone and will remove the employee from
                  both the system and authentication.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={handleCancelDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete</span>
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
