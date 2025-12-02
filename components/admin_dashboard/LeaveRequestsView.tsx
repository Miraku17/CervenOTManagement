import React, { useState } from 'react';
import { Check, X, Calendar, AlertCircle, Clock } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    avatar_initials: string;
  };
  type: 'Vacation' | 'Sick Leave' | 'Personal' | 'Emergency';
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

// Mock Data
const MOCK_REQUESTS: LeaveRequest[] = [
  {
    id: '1',
    employee: {
      id: 'emp1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      avatar_initials: 'JD',
    },
    type: 'Vacation',
    startDate: '2023-11-15',
    endDate: '2023-11-20',
    totalDays: 5,
    reason: 'Family trip to Japan',
    status: 'pending',
    requestedAt: '2023-11-01T10:00:00Z',
  },
  {
    id: '2',
    employee: {
      id: 'emp2',
      name: 'Jane Smith',
      email: 'jane.smith@example.com',
      avatar_initials: 'JS',
    },
    type: 'Sick Leave',
    startDate: '2023-11-05',
    endDate: '2023-11-06',
    totalDays: 2,
    reason: 'Flu',
    status: 'approved',
    requestedAt: '2023-11-05T08:00:00Z',
    reviewedBy: 'Admin User',
    reviewedAt: '2023-11-05T09:30:00Z',
  },
  {
    id: '3',
    employee: {
      id: 'emp3',
      name: 'Robert Johnson',
      email: 'robert.j@example.com',
      avatar_initials: 'RJ',
    },
    type: 'Personal',
    startDate: '2023-12-01',
    endDate: '2023-12-01',
    totalDays: 1,
    reason: 'Personal appointments',
    status: 'rejected',
    requestedAt: '2023-11-10T14:20:00Z',
    reviewedBy: 'Admin User',
    reviewedAt: '2023-11-11T10:00:00Z',
  },
];

const LeaveRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<LeaveRequest[]>(MOCK_REQUESTS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const handleApprove = (id: string) => {
    setRequests(prev => prev.map(req => 
      req.id === id 
        ? { ...req, status: 'approved', reviewedBy: 'You', reviewedAt: new Date().toISOString() } 
        : req
    ));
  };

  const handleReject = (id: string) => {
    setRequests(prev => prev.map(req => 
      req.id === id 
        ? { ...req, status: 'rejected', reviewedBy: 'You', reviewedAt: new Date().toISOString() } 
        : req
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    }
  };

  const filteredRequests = requests.filter(req => 
    filter === 'all' ? true : req.status === filter
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Leave Requests</h2>
          <p className="text-slate-400 mt-1">Manage employee leave applications</p>
        </div>
        <div className="flex gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-400">
            <thead className="bg-slate-950/50 text-slate-200 font-medium border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Leave Type</th>
                <th className="px-6 py-4">Dates</th>
                <th className="px-6 py-4">Duration</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 w-1/4">Reason</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No leave requests found</p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((request) => (
                  <tr key={request.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                          {request.employee.avatar_initials}
                        </div>
                        <div>
                          <div className="font-medium text-slate-200">
                            {request.employee.name}
                          </div>
                          <div className="text-xs text-slate-500">{request.employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-medium text-blue-300">
                        {request.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-xs">
                        <span className="text-slate-300">From: {new Date(request.startDate).toLocaleDateString()}</span>
                        <span className="text-slate-500">To: {new Date(request.endDate).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-slate-300">
                      {request.totalDays} day{request.totalDays > 1 ? 's' : ''}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1.5">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(request.status)}`}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                        {request.status !== 'pending' && request.reviewedBy && (
                          <div className="flex flex-col">
                            <span className="text-xs text-slate-400 font-medium">
                              by {request.reviewedBy}
                            </span>
                            {request.reviewedAt && (
                              <span className="text-[10px] text-slate-500">
                                {new Date(request.reviewedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-300 truncate max-w-xs" title={request.reason}>
                      {request.reason}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {request.status === 'pending' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors"
                            title="Approve"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            className="p-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                            title="Reject"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestsView;
