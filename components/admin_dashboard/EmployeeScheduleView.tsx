import React, { useState, useEffect, useRef } from 'react';
import { Employee } from '@/types';
import { Search, User, X, Calendar } from 'lucide-react';
import { WorkScheduleCalendar } from '@/components/WorkScheduleCalendar';

interface EmployeeScheduleViewProps {
  employees: Employee[];
}

const EmployeeScheduleView: React.FC<EmployeeScheduleViewProps> = ({ employees }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

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
    employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    employee.employee_id?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex items-center gap-3 mb-8">
        <Calendar className="w-8 h-8 text-blue-500" />
        <h2 className="text-2xl font-bold text-white">Employee Schedule</h2>
      </div>

      {/* Employee Search Section */}
      <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50 mb-8">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
          Search Employee
        </h3>
        <p className="text-slate-400 mb-6 text-sm">
          Search for an employee to view their work schedule.
        </p>

        {!selectedEmployee ? (
          <div className="relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search by name, email, or employee ID..."
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
                      <img
                        src={emp.avatarUrl}
                        alt={emp.fullName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-700"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-white">{emp.fullName}</div>
                        <div className="text-xs text-slate-500">{emp.email}</div>
                        <div className="text-xs text-slate-600">ID: {emp.employee_id || 'N/A'}</div>
                      </div>
                      <div className="text-xs text-slate-500">{emp.position}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-slate-500 text-sm text-center">No employees found</div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src={selectedEmployee.avatarUrl}
                alt={selectedEmployee.fullName}
                className="w-12 h-12 rounded-full object-cover border-2 border-blue-500"
              />
              <div>
                <div className="font-bold text-white text-lg">{selectedEmployee.fullName}</div>
                <div className="text-sm text-slate-400">{selectedEmployee.position}</div>
                <div className="text-xs text-slate-500">{selectedEmployee.email}</div>
              </div>
            </div>
            <button
              onClick={handleClearSelection}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Clear selection"
            >
              <X size={20} />
            </button>
          </div>
        )}
      </div>

      {/* Schedule Display Section */}
      {selectedEmployee ? (
        <>
          <div className="bg-slate-800/30 p-6 rounded-xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Calendar className="text-blue-400" />
              Work Schedule for {selectedEmployee.fullName}
            </h3>
            <div className="text-center py-12">
              <Calendar className="w-20 h-20 text-blue-500 mx-auto mb-4" />
              <p className="text-slate-400 mb-6">
                Click the button below to view {selectedEmployee.fullName}'s work schedule
              </p>
              <button
                onClick={() => setIsScheduleOpen(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto shadow-lg shadow-blue-900/40"
              >
                <Calendar size={20} />
                <span className="font-medium">View Schedule</span>
              </button>
            </div>
          </div>

          {/* Schedule Modal */}
          <WorkScheduleCalendar
            userId={selectedEmployee.id}
            isOpen={isScheduleOpen}
            onClose={() => setIsScheduleOpen(false)}
          />
        </>
      ) : (
        <div className="bg-slate-800/30 p-12 rounded-xl border border-slate-700 text-center">
          <Calendar className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-2">No Employee Selected</h3>
          <p className="text-slate-500 text-sm">
            Search and select an employee above to view their work schedule.
          </p>
        </div>
      )}
    </div>
  );
};

export default EmployeeScheduleView;
