import React from 'react';
import { X, MapPin, Clock, Loader2 } from 'lucide-react';

interface ActiveEmployee {
  id: string;
  userId: string;
  employeeName: string;
  firstName: string;
  lastName: string;
  email: string;
  employeeId: string;
  position: string;
  avatarSeed: string;
  timeIn: string;
  timeInRaw: string;
  clockInAddress: string;
  workingDuration: string;
  latitude: number | null;
  longitude: number | null;
}

interface ActiveEmployeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: ActiveEmployee[];
  isLoading: boolean;
}

export const ActiveEmployeesModal: React.FC<ActiveEmployeesModalProps> = ({
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
            <div className="p-2 rounded-xl bg-violet-500/10">
              <Clock className="w-6 h-6 text-violet-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Active Employees</h3>
              <p className="text-slate-400 text-sm mt-0.5">
                {isLoading ? 'Loading...' : `${employees.length} employee${employees.length !== 1 ? 's' : ''} currently working`}
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
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
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
                      className="w-12 h-12 rounded-full object-cover border-2 border-violet-500/30"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {employee.employeeName}
                        </p>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-emerald-400 bg-emerald-400/10 border border-emerald-400/20">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate">{employee.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-violet-400 font-medium">
                          ID: {employee.employeeId}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="text-xs text-slate-500 truncate">
                          {employee.position}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Work Details */}
                  <div className="space-y-2 bg-slate-900/50 border border-slate-800/50 rounded-lg p-3">
                    {/* Clock In Time */}
                    <div className="flex items-start gap-2">
                      <Clock className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400">Clocked In</p>
                        <p className="text-sm text-white font-medium">{employee.timeIn}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Duration</p>
                        <p className="text-sm text-emerald-400 font-semibold">
                          {employee.workingDuration}
                        </p>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="flex items-start gap-2 pt-2 border-t border-slate-800/50">
                      <MapPin className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 mb-1">Location</p>
                        <p className="text-xs text-slate-300 line-clamp-2" title={employee.clockInAddress}>
                          {employee.clockInAddress}
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
                <Clock className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">No employees are currently active</p>
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
