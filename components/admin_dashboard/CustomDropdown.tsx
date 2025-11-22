import React, { useState, useRef, useEffect } from 'react';
import { Employee } from '@/types';
import { ChevronDown, X } from 'lucide-react';

interface CustomDropdownProps {
  employees: Employee[];
  selectedEmployee: Employee | null;
  onSelectEmployee: (employee: Employee | null) => void;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({ employees, selectedEmployee, onSelectEmployee }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <label htmlFor="employee" className="block text-sm font-medium text-slate-400 mb-2">Select Employee</label>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white flex items-center justify-between cursor-pointer"
      >
        {selectedEmployee ? (
          <div className="flex items-center gap-3">
            <img src={selectedEmployee.avatarUrl} alt={selectedEmployee.fullName} className="w-6 h-6 rounded-full" />
            <span>{selectedEmployee.fullName}</span>
          </div>
        ) : (
          <span>-- Select an Employee --</span>
        )}
        <ChevronDown size={20} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
          <div className="p-2">
            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {filteredEmployees.map(emp => (
              <li
                key={emp.id}
                onClick={() => {
                  onSelectEmployee(emp);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
                className="flex items-center gap-3 px-4 py-2 hover:bg-slate-700 cursor-pointer"
              >
                <img src={emp.avatarUrl} alt={emp.fullName} className="w-6 h-6 rounded-full" />
                <span>{emp.fullName}</span>
              </li>
            ))}
            {filteredEmployees.length === 0 && (
              <li className="px-4 py-2 text-slate-400">No employees found.</li>
            )}
          </ul>
          {selectedEmployee && (
            <div className="p-2 border-t border-slate-700">
              <button
                onClick={() => {
                  onSelectEmployee(null);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white"
              >
                <X size={16} /> Clear Selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
