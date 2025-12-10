import React, { useState, useEffect } from 'react';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, Clock, Loader2, Edit2, Save, X, Key, CalendarDays } from 'lucide-react';
import { Employee, AttendanceRecord, Position } from '@/types';
import { format, parseISO, getDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { supabase } from '@/services/supabase';
import UpdatePasswordModal from './UpdatePasswordModal';
import { WorkScheduleCalendar } from '@/components/WorkScheduleCalendar';
import { useUser } from '@/hooks/useUser';

interface EmployeeDetailProps {
  employee: Employee;
  onBack: () => void;
  onUpdate?: (updatedEmployee: Employee) => void;
}

const EmployeeDetail: React.FC<EmployeeDetailProps> = ({ employee, onBack, onUpdate }) => {
  const { user } = useUser();
  const PHILIPPINE_TZ = 'Asia/Manila';
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [attendanceData, setAttendanceData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit mode states
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [positions, setPositions] = useState<Position[]>([]);
  const [editFormData, setEditFormData] = useState({
    firstName: '',
    lastName: '',
    employee_id: '',
    email: '',
    contact_number: '',
    address: '',
    positionId: '',
    role: '',
  });

  // New state for password modal and schedule modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Check if current user is Operations Manager
  const isOperationsManager = user?.position === 'Operations Manager';

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
      let firstName = '';
      let lastName = '';

      if (employee.firstName && employee.lastName) {
        firstName = employee.firstName;
        lastName = employee.lastName;
      } else {
        const nameParts = employee.fullName.split(' ');
        firstName = nameParts[0] || '';
        lastName = nameParts.slice(1).join(' ') || '';
      }

      // Try to find the current position
      const currentPosition = positions.find(p => p.name === employee.position);

      setEditFormData({
        firstName,
        lastName,
        employee_id: employee.employee_id || '',
        email: employee.email || '',
        contact_number: employee.contact_number || '',
        address: employee.address || '',
        positionId: currentPosition ? String(currentPosition.id) : '',
        role: employee.role || '',
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

        setAttendanceData(data);
      } catch (err: any) {
        console.error('Error fetching attendance:', err);
        setError(err.message);
        setAttendanceData(null);
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
          employee_id: editFormData.employee_id.trim(),
          email: editFormData.email.trim(),
          contact_number: editFormData.contact_number.trim(),
          address: editFormData.address.trim(),
          positionId: editFormData.positionId || undefined,
          role: editFormData.role,
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
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        fullName: `${editFormData.firstName} ${editFormData.lastName}`,
        employee_id: editFormData.employee_id,
        email: editFormData.email,
        contact_number: editFormData.contact_number,
        address: editFormData.address,
        position: updatedPosition?.name || employee.position,
        role: editFormData.role,
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
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors border border-slate-700"
            >
              <CalendarDays size={18} />
              <span>View Schedule</span>
            </button>
            {isOperationsManager && (
              <>
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
              </>
            )}
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
                      <label className="text-sm text-slate-400 mb-2 block">Employee ID</label>
                      <input
                        type="text"
                        value={editFormData.employee_id}
                        onChange={(e) => setEditFormData({ ...editFormData, employee_id: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      />
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

                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Role</label>
                      <select
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="employee">Employee</option>
                        <option value="admin">Admin</option>
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
                        {employee.employee_id && (
                          <p className="text-sm text-slate-500 mt-1">ID: {employee.employee_id}</p>
                        )}
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
                Attendance Log: <span className="text-blue-300">{formatInTimeZone(parseISO(selectedDate), PHILIPPINE_TZ, 'MMMM dd, yyyy')}</span>
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
                    {attendanceData?.sessions && attendanceData.sessions.length > 0 ? (
                      <>
                        {/* Summary Section */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-500 uppercase font-medium mb-1">Total Hours</p>
                            <p className="text-2xl font-bold text-emerald-400">
                              {attendanceData.totalHours ? `${attendanceData.totalHours} hrs` : '--'}
                            </p>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-500 uppercase font-medium mb-1">Sessions</p>
                            <p className="text-2xl font-bold text-blue-400">{attendanceData.sessionCount}</p>
                          </div>
                          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl text-center">
                            <p className="text-xs text-slate-500 uppercase font-medium mb-1">Status</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                              attendanceData.status === 'In Progress'
                                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {attendanceData.status}
                            </span>
                          </div>
                        </div>

                        {/* Sessions List */}
                        <div className="space-y-3">
                          {attendanceData.sessions.map((session: any, index: number) => (
                            <div key={session.id} className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-sm font-semibold text-slate-300">Session {index + 1}</span>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                  session.status === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                }`}>
                                  {session.status}
                                </span>
                                {session.duration && (
                                  <span className="text-xs text-emerald-400 font-medium ml-auto">
                                    {session.duration} hrs
                                  </span>
                                )}
                                {session.overtimeRequest && (
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                    session.overtimeRequest.status === 'approved'
                                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                                      : session.overtimeRequest.status === 'rejected'
                                      ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                                      : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                  }`}>
                                    OT: {session.overtimeRequest.status}
                                  </span>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Clock In</p>
                                  <p className="text-lg font-semibold text-white mb-1">{session.timeIn || '--:--'}</p>
                                  <p className="text-xs text-slate-400 truncate" title={session.clockInLocation?.address || 'No address'}>
                                    {session.clockInLocation?.address || 'No address'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-slate-500 uppercase font-medium mb-1">Clock Out</p>
                                  <p className="text-lg font-semibold text-white mb-1">{session.timeOut || '--:--'}</p>
                                  {session.timeOut && (
                                    <p className="text-xs text-slate-400 truncate" title={session.clockOutLocation?.address || 'No address'}>
                                      {session.clockOutLocation?.address || 'No address'}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Overtime Request Details */}
                              {session.overtimeRequest && (
                                <div className="mt-3 pt-3 border-t border-slate-800/50">
                                  {session.overtimeRequest.comment && (
                                    <div className="mb-2">
                                      <p className="text-xs text-slate-500 mb-1">Overtime Comment:</p>
                                      <p className="text-xs text-slate-300 italic">"{session.overtimeRequest.comment}"</p>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                                    {session.overtimeRequest.requestedAt && (
                                      <div>
                                        <span className="text-slate-500">Requested:</span> {formatInTimeZone(new Date(session.overtimeRequest.requestedAt), PHILIPPINE_TZ, 'MMM dd, hh:mm a')}
                                      </div>
                                    )}
                                    {session.overtimeRequest.approvedHours !== null && (
                                      <div>
                                        <span className="text-slate-500">Approved Hours:</span> {session.overtimeRequest.approvedHours} hrs
                                      </div>
                                    )}
                                    {session.overtimeRequest.reviewer && (
                                      <div className="col-span-2">
                                        <span className="text-slate-500">Reviewed by:</span> {session.overtimeRequest.reviewer.first_name} {session.overtimeRequest.reviewer.last_name}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
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
        employeeId={employee.id}
        employeeName={employee.fullName}
      />
      {/* Schedule Calendar Modal */}
      <WorkScheduleCalendar
        userId={employee.id}
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />
    </div>
  );
};

export default EmployeeDetail;
