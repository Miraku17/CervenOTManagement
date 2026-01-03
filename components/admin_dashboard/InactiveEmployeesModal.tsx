import React from 'react';
import { X, UserX, Clock, Loader2 } from 'lucide-react';

interface InactiveEmployee {
  id: string;
  employeeName: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  position: string;
  avatarSeed: string;
  lastClockOut: string | null;
  lastClockOutRaw: string | null;
}

interface InactiveEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: InactiveEmployee[];
  isLoading: boolean;
}

export const InactiveEmployeesModal: React.FC<InactiveEmployeesModalProps> = ({
  isOpen,
  onClose,
  employees,
  isLoading
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      style={{ zIndex: 10000 }}
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-slide-in-right flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-500/10">
              <UserX className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Inactive Employees</h3>
              <p className="text-slate-400 text-sm mt-0.5">
                {isLoading ? 'Loading...' : `${employees.length} employee${employees.length !== 1 ? 's' : ''} not currently working`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
            </div>
          ) : employees.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {employees.map((employee) => (
                <div
                  key={employee.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition-all"
                >
                  {/* Employee Header */}
                  <div className="flex items-start gap-3 mb-3">
                    <img
                      src={`https://api.dicebear.com/7.x/initials/svg?seed=${employee.avatarSeed}`}
                      alt={employee.employeeName}
                      className="w-12 h-12 rounded-full object-cover border-2 border-slate-700/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {employee.employeeName}
                        </p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-slate-400 bg-slate-800/50 border border-slate-700/50">
                          Offline
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{employee.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-400 font-medium">
                          ID: {employee.employeeId}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-500 truncate">
                          {employee.position}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Last Activity */}
                  <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400">Last Clock Out</p>
                        <p className="text-sm text-slate-300 font-medium">
                          {employee.lastClockOut || 'No recent activity'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                <UserX className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">All employees are currently active</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800 flex justify-end sticky bottom-0">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
