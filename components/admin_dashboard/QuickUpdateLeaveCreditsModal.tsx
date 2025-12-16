import React, { useState, useEffect } from 'react';
import { X, Save, Search, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface QuickUpdateLeaveCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  leave_credits: number;
}

export const QuickUpdateLeaveCreditsModal: React.FC<QuickUpdateLeaveCreditsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [newLeaveCredits, setNewLeaveCredits] = useState<string>('');
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchEmployees();
    } else {
      // Reset state when modal closes
      setSearchTerm('');
      setSelectedEmployee(null);
      setNewLeaveCredits('');
      setMessage(null);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Don't show dropdown if an employee is already selected
    if (selectedEmployee) {
      setShowDropdown(false);
      return;
    }

    if (searchTerm.trim() === '') {
      setFilteredEmployees([]);
      setShowDropdown(false);
    } else {
      const filtered = employees.filter(emp => {
        const searchLower = searchTerm.toLowerCase();
        return (
          emp.first_name.toLowerCase().includes(searchLower) ||
          emp.last_name.toLowerCase().includes(searchLower) ||
          emp.employee_id.toLowerCase().includes(searchLower) ||
          emp.email.toLowerCase().includes(searchLower)
        );
      });
      setFilteredEmployees(filtered);
      setShowDropdown(true);
    }
  }, [searchTerm, employees, selectedEmployee]);

  const fetchEmployees = async () => {
    setIsLoadingEmployees(true);
    try {
      const response = await fetch('/api/employees/get');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error: any) {
      console.error('Error fetching employees:', error);
      setMessage({ type: 'error', text: 'Failed to load employees' });
    } finally {
      setIsLoadingEmployees(false);
    }
  };

  const handleSelectEmployee = (employee: Employee) => {
    setSelectedEmployee(employee);
    setSearchTerm(`${employee.first_name} ${employee.last_name} (${employee.employee_id})`);
    setNewLeaveCredits(employee.leave_credits.toString());
    setShowDropdown(false);
    setMessage(null);
  };

  const handleUpdate = async () => {
    if (!selectedEmployee) {
      setMessage({ type: 'error', text: 'Please select an employee' });
      return;
    }

    const credits = parseFloat(newLeaveCredits);
    if (isNaN(credits) || credits < 0) {
      setMessage({ type: 'error', text: 'Please enter a valid leave credits amount (0 or greater)' });
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/update-employee-leave-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          leaveCredits: credits,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update leave credits');
      }

      setMessage({ type: 'success', text: `Successfully updated leave credits for ${selectedEmployee.first_name} ${selectedEmployee.last_name}` });

      // Update the employee in the local list
      setEmployees(prev => prev.map(emp =>
        emp.id === selectedEmployee.id ? { ...emp, leave_credits: credits } : emp
      ));

      // Call onSuccess callback after a short delay
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 1500);
      }
    } catch (error: any) {
      console.error('Error updating leave credits:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to update leave credits' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    if (!isUpdating) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Save className="text-emerald-400" size={24} />
              Quick Update Leave Credits
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Search and update an employee's leave credits
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isUpdating}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Employee Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Search Employee
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  // Clear selected employee when user starts typing again
                  if (selectedEmployee && e.target.value !== `${selectedEmployee.first_name} ${selectedEmployee.last_name} (${selectedEmployee.employee_id})`) {
                    setSelectedEmployee(null);
                  }
                }}
                onFocus={() => {
                  if (searchTerm && !selectedEmployee) {
                    setShowDropdown(true);
                  }
                }}
                placeholder="Search by name, ID, or email..."
                disabled={isLoadingEmployees || isUpdating}
                className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {isLoadingEmployees && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 animate-spin" />
              )}
              {selectedEmployee && !isUpdating && (
                <button
                  onClick={() => {
                    setSelectedEmployee(null);
                    setSearchTerm('');
                    setNewLeaveCredits('');
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 transition-colors"
                  title="Clear selection"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Dropdown */}
            {showDropdown && filteredEmployees.length > 0 && (
              <div className="absolute z-10 w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                {filteredEmployees.map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => handleSelectEmployee(employee)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-800 transition-colors border-b border-slate-800 last:border-b-0"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">
                          {employee.first_name} {employee.last_name}
                        </p>
                        <p className="text-slate-400 text-sm">
                          {employee.employee_id} • {employee.email}
                        </p>
                      </div>
                      <div className="text-emerald-400 text-sm font-medium">
                        {employee.leave_credits} credits
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {showDropdown && searchTerm && filteredEmployees.length === 0 && !isLoadingEmployees && (
              <div className="absolute z-10 w-full mt-2 bg-slate-950 border border-slate-700 rounded-lg shadow-xl p-4 text-center text-slate-400">
                No employees found
              </div>
            )}
          </div>

          {/* Selected Employee Info */}
          {selectedEmployee && (
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-500 uppercase mb-2">Selected Employee</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </p>
                  <p className="text-slate-400 text-sm">{selectedEmployee.employee_id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Current Credits</p>
                  <p className="text-emerald-400 font-bold text-lg">{selectedEmployee.leave_credits}</p>
                </div>
              </div>
            </div>
          )}

          {/* Leave Credits Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              New Leave Credits
            </label>
            <input
              type="number"
              value={newLeaveCredits}
              onChange={(e) => setNewLeaveCredits(e.target.value)}
              placeholder="Enter leave credits..."
              min="0"
              step="0.5"
              disabled={!selectedEmployee || isUpdating}
              className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg border flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex-shrink-0 mt-0.5">
                {message.type === 'success' ? (
                  <CheckCircle className="text-emerald-400" size={20} />
                ) : (
                  <AlertCircle className="text-red-400" size={20} />
                )}
              </div>
              <p className={`text-sm ${
                message.type === 'success' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {message.text}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isUpdating}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdate}
            disabled={!selectedEmployee || isUpdating || !newLeaveCredits}
            className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isUpdating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Save size={18} />
                Update Credits
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
