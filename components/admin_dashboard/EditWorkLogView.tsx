import React, { useState } from 'react';
import { Employee, WorkLog } from '@/types';
import CustomDropdown from './CustomDropdown';

interface EditWorkLogViewProps {
  employees: Employee[];
  onUpdateLog: (employeeId: string, logId: string, newLog: Partial<WorkLog>) => void;
}

const EditWorkLogView: React.FC<EditWorkLogViewProps> = ({ employees, onUpdateLog }) => {
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [editingLog, setEditingLog] = useState<WorkLog | null>(null);

  const handleUpdate = () => {
    if (editingLog && selectedEmployee) {
      onUpdateLog(selectedEmployee.id, editingLog.id, {
        startTime: new Date(editingLog.startTime).getTime(),
        endTime: editingLog.endTime ? new Date(editingLog.endTime).getTime() : null,
      });
      setEditingLog(null);
    }
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', value: string) => {
    if (editingLog) {
      const [hours, minutes] = value.split(':').map(Number);
      const newDate = new Date(editingLog[field] || 0);
      newDate.setHours(hours, minutes);
      setEditingLog({ ...editingLog, [field]: newDate.getTime() });
    }
  };

  return (
    <div className="bg-slate-900 p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-white mb-6">Edit Employee Time Logs</h2>
      
      {/* Employee Selection */}
      <div className="mb-6">
        <CustomDropdown
          employees={employees}
          selectedEmployee={selectedEmployee}
          onSelectEmployee={setSelectedEmployee}
        />
      </div>

      {/* Work Logs Table */}
      {selectedEmployee && (
        <div>
          <h3 className="text-lg font-bold text-white mb-4">Work Logs for {selectedEmployee.fullName}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Start Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">End Time</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-slate-900 divide-y divide-slate-800">
                {selectedEmployee.workLogs?.map(log => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{log.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{new Date(log.startTime).toLocaleTimeString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{log.endTime ? new Date(log.endTime).toLocaleTimeString() : 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-right">
                      <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-700">Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editing Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-950/80 flex items-center justify-center z-50">
          <div className="bg-slate-800 p-8 rounded-lg shadow-2xl w-full max-w-md">
            <h3 className="text-xl font-bold text-white mb-6">Edit Log for {editingLog.date}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">Start Time</label>
                <input
                  type="time"
                  value={new Date(editingLog.startTime).toTimeString().slice(0, 5)}
                  onChange={(e) => handleTimeChange('startTime', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-2">End Time</label>
                <input
                  type="time"
                  value={editingLog.endTime ? new Date(editingLog.endTime).toTimeString().slice(0, 5) : ''}
                  onChange={(e) => handleTimeChange('endTime', e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="mt-8 flex justify-end gap-4">
              <button onClick={() => setEditingLog(null)} className="text-slate-400 hover:text-white px-4 py-2 rounded-lg">Cancel</button>
              <button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg">Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditWorkLogView;
