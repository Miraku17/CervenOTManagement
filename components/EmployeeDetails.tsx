import React from 'react';
import { UserProfile, WorkLog } from '@/types';
import { X } from 'lucide-react';

interface EmployeeDetailsProps {
  employee: UserProfile;
  onClose: () => void;
}

// Mock Work Log Data
const MOCK_WORK_LOGS: WorkLog[] = [
  {
    id: 'log-1',
    date: '2025-11-21',
    startTime: new Date('2025-11-21T09:00:00').getTime(),
    endTime: new Date('2025-11-21T17:00:00').getTime(),
    durationSeconds: 8 * 3600,
    status: 'COMPLETED',
  },
  {
    id: 'log-2',
    date: '2025-11-20',
    startTime: new Date('2025-11-20T09:05:00').getTime(),
    endTime: new Date('2025-11-20T17:30:00').getTime(),
    durationSeconds: 8.5 * 3600,
    status: 'COMPLETED',
  },
];

const EmployeeDetails: React.FC<EmployeeDetailsProps> = ({ employee, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-slate-700 rounded-full"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center mb-6">
          <img
            src={employee.avatarUrl}
            alt={employee.name}
            className="w-24 h-24 rounded-full mr-6"
          />
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className="text-slate-400">{employee.position}</p>
            <p className="text-sm text-slate-500">{employee.email}</p>
          </div>
        </div>
        <h3 className="text-xl font-bold mb-4">Work Logs</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time In</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Time Out</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Duration</th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {MOCK_WORK_LOGS.map((log) => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap">{log.date}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{new Date(log.startTime).toLocaleTimeString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{log.endTime ? new Date(log.endTime).toLocaleTimeString() : 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap">{(log.durationSeconds / 3600).toFixed(2)} hours</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDetails;
