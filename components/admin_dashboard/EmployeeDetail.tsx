import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock, Briefcase, Loader2, Edit2, Save, X, Key } from 'lucide-react';
import { Employee, AttendanceRecord, Position } from '@/types';
import { format, parseISO, getDay } from 'date-fns';
import { supabase } from '@/services/supabase';
import UpdatePasswordModal from './UpdatePasswordModal';

interface EmployeeDetailProps {
  employee: Employee;
  onBack: () => void;
  onUpdate?: (updatedEmployee: Employee) => void;
}

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, onUpdate }) => {
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendance, setAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    contact_number: '',
    address: '',
    positionId: '',
  });

  // New state for password modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Fetch positions
  useEffect(() => {
    const fetchPositions = async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (data) {
        setPositions(data);
      }
      if (error) {
        console.error('Error fetching positions:', error);
      }
    };
    fetchPositions();
  }, []);

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditMode && employee && positions.length > 0) {
      const nameParts = employee.fullName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Try to find the current position
      const currentPosition = positions.find(p => p.name === employee.position);

      setEditFormData({
        firstName,
        lastName,
        email: employee.email || '',
        contact_number: employee.contact_number || '',
        address: employee.address || '',
        positionId: currentPosition ? String(currentPosition.id) : '',
      });
    }
  }, [isEditMode, employee, positions]);

  // Fetch attendance data when date changes
  useEffect(() => {
    const fetchAttendance = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/attendance/user-details?userId=${employee.id}&date=${selectedDate}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch attendance');
        }

        if (data.attendance) {
          setAttendance({
            id: data.attendance.id,
            employeeId: data.attendance.userId,
            date: data.attendance.date,
            timeIn: data.attendance.timeIn || '-',
            timeOut: data.attendance.timeOut || '-',
            clockInAddress: data.attendance.clockInLocation?.address,
            clockOutAddress: data.attendance.clockOutLocation?.address,
            status: data.attendance.status,
            totalHours: data.attendance.totalHours ? parseFloat(data.attendance.totalHours) : undefined,
            overtimeComment: data.attendance.overtimeComment,
          });
        } else {
          setAttendance(null);
        }
      } catch (err: any) {
        console.error('Error fetching attendance:', err);
        setError(err.message);
        setAttendance(null);
      } finally {
        setIsLoading(false);
      }
    };

    if (employee.id) {
      fetchAttendance();
    }
  }, [selectedDate, employee.id]);

  const handleSaveEdit = async () => {
    setIsSaving(true);
    setError(null);

    // Validation
    if (!editFormData.firstName.trim() || !editFormData.lastName.trim()) {
      setError('First name and last name are required');
      setIsSaving(false);
      return;
    }

    if (!editFormData.email.trim()) {
      setError('Email is required');
      setIsSaving(false);
      return;
    }

    try {
      const response = await fetch('/api/update-employee', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: employee.id,
          firstName: editFormData.firstName.trim(),
          lastName: editFormData.lastName.trim(),
          email: editFormData.email.trim(),
          contact_number: editFormData.contact_number.trim(),
          address: editFormData.address.trim(),
          positionId: editFormData.positionId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update employee');
      }

      // Update the local employee data
      const updatedPosition = positions.find(p => String(p.id) === String(editFormData.positionId));
      const updatedEmployee: Employee = {
        ...employee,
        fullName: `${editFormData.firstName} ${editFormData.lastName}`,
        email: editFormData.email,
        contact_number: editFormData.contact_number,
        address: editFormData.address,
        position: updatedPosition?.name || employee.position,
      };

      // Call the parent's update handler
      if (onUpdate) {
        onUpdate(updatedEmployee);
      }

      setIsEditMode(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setError(null);
  };

  const handlePasswordUpdate = (newPassword: string) => {
    // For now, no functionality is required, just log it.
    console.log(`Employee ${employee.fullName} password updated to: ${newPassword}`);
    // In a real scenario, this would involve an API call to update the password.
    // Display a success toast/message to the user.
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>Back to Directory</span>
        </button>

        {!isEditMode && (
          <div className="flex gap-3">
            <button
              onClick={() => setIsPasswordModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Key size={18} />
              <span>Update Password</span>
            </button>
            <button
              onClick={() => setIsEditMode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              <Edit2 size={18} />
              <span>Edit Employee</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
          {error}
        </div>
      )}

      {/* Top Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-r from-blue-900/40 to-slate-900/0"></div>

        <div className="relative flex flex-col md:flex-row gap-8 items-start">
            <div className="shrink-0">
                <img
                    src={employee.avatarUrl}
                    alt={employee.fullName}
                    className="w-32 h-32 rounded-2xl border-4 border-slate-800 shadow-2xl object-cover"
                />
            </div>

            <div className="flex-1 space-y-4">
                {isEditMode ? (
                  // Edit Mode
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">First Name</label>
                        <input
                          type="text"
                          value={editFormData.firstName}
                          onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block">Last Name</label>
                        <input
                          type="text"
                          value={editFormData.lastName}
                          onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Position</label>
                      <select
                        value={editFormData.positionId}
                        onChange={(e) => setEditFormData({ ...editFormData, positionId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">Select Position</option>
                        {positions.map((pos) => (
                          <option key={pos.id} value={pos.id}>{pos.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block flex items-center gap-2">
                          <Mail size={16} />
                          Email
                        </label>
                        <input
                          type="email"
                          value={editFormData.email}
                          onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-sm text-slate-400 mb-2 block flex items-center gap-2">
                          <Phone size={16} />
                          Contact Number
                        </label>
                        <input
                          type="text"
                          value={editFormData.contact_number}
                          onChange={(e) => setEditFormData({ ...editFormData, contact_number: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm text-slate-400 mb-2 block flex items-center gap-2">
                        <MapPin size={16} />
                        Address
                      </label>
                      <input
                        type="text"
                        value={editFormData.address}
                        onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <Save size={18} />
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        <X size={18} />
                        <span>Cancel</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <>
                    <div>
                        <h1 className="text-3xl font-bold text-white">{employee.fullName}</h1>
                        <p className="text-lg text-blue-400 font-medium">{employee.position}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
                        <div className="flex items-center gap-3">
                            <Mail className="w-5 h-5 text-slate-500" />
                            <span>{employee.email}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Phone className="w-5 h-5 text-slate-500" />
                        <span>{employee.contact_number || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <MapPin className="w-5 h-5 text-slate-500" />
                            <span>{employee.address}</span>
                        </div>
                    </div>
                  </>
                )}
            </div>

            {!isEditMode && (
              <div className="flex flex-col gap-3">
                  <span className="px-4 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-sm font-medium text-center">
                      {employee.status}
                  </span>
                  {/* <span className="text-slate-500 text-sm">Joined {employee.joinDate}</span> */}
              </div>
            )}
        </div>
      </div>

      {/* Attendance Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Date Selector */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Calendar className="text-blue-400" size={20} />
                Select Date
            </h3>
            <p className="text-slate-400 text-sm mb-4">Choose a date to view entry and exit logs.</p>
            <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:bg-slate-900 transition-colors [color-scheme:dark]"
            />
        </div>

        {/* Log Details */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative">
            <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Clock className="text-blue-400" size={20} />
                Attendance Log: <span className="text-blue-300">{format(parseISO(selectedDate), 'MMMM dd, yyyy')}</span>
            </h3>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-blue-400 animate-spin mb-3" />
                    <p className="text-slate-400">Loading attendance data...</p>
                </div>
            ) : error ? (
                <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-center text-rose-400">
                    {error}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <AttendanceCard
                            label="Time In"
                            value={attendance?.timeIn || '--:--'}
                            color="emerald"
                            subtext={attendance?.clockInAddress || 'No address provided'}
                        />
                        <AttendanceCard
                            label="Time Out"
                            value={attendance?.timeOut || '--:--'}
                            color="amber"
                            subtext={attendance?.clockOutAddress || (attendance?.timeOut !== '-' ? 'No address provided' : null)}
                        />
                        <AttendanceCard
                            label="Total Hours"
                            value={attendance?.totalHours ? `${attendance.totalHours} hrs` : '--'}
                            color="blue"
                        />
                    </div>

                    {attendance?.status && (
                        <div className="mt-4 flex justify-center">
                            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
                                attendance.status === 'Present' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                attendance.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}>
                                Status: {attendance.status}
                            </span>
                        </div>
                    )}

                    {/* Overtime Comment Section */}
                    {attendance?.overtimeComment && (
                      <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-800">
                        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                          <svg 
                            xmlns="http://www.w3.org/2000/svg" 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className="text-blue-400"
                          >
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Overtime Comment
                        </h4>
                        <p className="text-slate-400 text-sm italic">
                          "{attendance.overtimeComment}"
                        </p>
                      </div>
                    )}

                    {!attendance && (
                        <div className="mt-6 p-4 bg-slate-800/50 rounded-xl border border-slate-800 text-center text-slate-400">
                            No records found for this date (possibly weekend or absent).
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
      {/* Password Update Modal */}
      <UpdatePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSubmit={handlePasswordUpdate}
        employeeName={employee.fullName}
      />
    </div>
  );
};

const AttendanceCard: React.FC<{ label: string; value: string; color: string; subtext?: string | null }> = ({ label, value, color, subtext }) => (
    <div className={`bg-slate-950 border border-slate-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center`}>
        <span className={`text-${color}-400 text-sm font-medium mb-2 uppercase tracking-wider`}>{label}</span>
        <span className="text-3xl font-bold text-white">{value}</span>
        {subtext && <span className="text-xs text-slate-500 mt-2 max-w-full truncate px-2" title={subtext}>{subtext}</span>}
    </div>
);

export default EmployeeDetail;
