import React, { useState, useMemo } from 'react';
import { Search, Plus, Filter, MapPin, Phone, Mail, Briefcase } from 'lucide-react';
import { Employee } from '@/types';
import EmployeeForm from '@/components/admin_dashboard/EmployeeForm';

interface EmployeeManagerProps {
  employees: Employee[];
  onSelectEmployee: (id: string) => void;
  onAddEmployee: (employee: Employee) => void;
}

const EmployeeManager: React.FC<EmployeeManagerProps> = ({ employees, onSelectEmployee, onAddEmployee }) => {
  const [isCreating, setIsCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEmployees = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return employees.filter(e => 
      e.fullName.toLowerCase().includes(term) || 
      e.email.toLowerCase().includes(term)
    );
  }, [employees, searchTerm]);

  if (isCreating) {
    return (
      <div className="animate-fade-in">
        <button 
          onClick={() => setIsCreating(false)}
          className="text-slate-400 hover:text-white mb-4 flex items-center gap-2"
        >
          ← Back to List
        </button>
        <EmployeeForm onSubmit={onAddEmployee} onCancel={() => setIsCreating(false)} />
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
          <button className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl border border-slate-700 hover:bg-slate-700 hover:text-white transition-colors flex items-center gap-2">
            <Filter size={18} />
            <span className="hidden sm:inline">Filter</span>
          </button>
          <button 
            onClick={() => setIsCreating(true)}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg shadow-blue-900/40"
          >
            <Plus size={18} />
            <span className="font-medium">Add Employee</span>
          </button>
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
                    <span className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${employee.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors">{employee.fullName}</h3>
                  <p className="text-slate-400 text-sm">{employee.position}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <Mail size={16} className="text-slate-500" />
                <span className="truncate">{employee.email}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <Phone size={16} className="text-slate-500" />
                <span>{employee.phone}</span>
              </div>
              <div className="flex items-center gap-3 text-slate-400 text-sm">
                <Briefcase size={16} className="text-slate-500" />
                <span>{employee.department}</span>
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
    </div>
  );
};

export default EmployeeManager;
