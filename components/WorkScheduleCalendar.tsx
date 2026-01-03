import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Coffee, Plane, Edit2, Save, Trash2, CheckCircle, AlertCircle, AlertTriangle } from 'lucide-react';
import type { LeaveRequest } from '@/types';
import { usePermissions } from '@/hooks/usePermissions';

interface WorkSchedule {
  id: string;
  employee_id: string;
  date: string;
  shift_start: string | null;
  shift_end: string | null;
  is_rest_day: boolean;
  created_at?: string;
  updated_at?: string;
}

interface WorkScheduleCalendarProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  userPosition?: string;
  canEdit?: boolean;
}

export const WorkScheduleCalendar: React.FC<WorkScheduleCalendarProps> = ({ userId, isOpen, onClose, userPosition, canEdit = false }) => {
  // Use permissions hook directly in this component
  const { permissions } = usePermissions();

  // Check edit permission internally
  const canEditSchedules = useMemo(() => {
    const hasPermission = permissions.includes('edit_all_schedules');
    console.log('📅 WorkScheduleCalendar - Internal permission check:', hasPermission, 'permissions:', permissions);
    return hasPermission;
  }, [permissions]);

  // Debug: Log canEdit prop
  useEffect(() => {
    console.log('📅 WorkScheduleCalendar - canEdit prop (legacy):', canEdit);
    console.log('📅 WorkScheduleCalendar - canEditSchedules (internal):', canEditSchedules);
  }, [canEdit, canEditSchedules]);

  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const [editForm, setEditForm] = useState({
    shift_start: '',
    shift_end: '',
    is_rest_day: false,
  });

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    setHasMounted(true);
  }, []);

  // Auto-dismiss notification after 3 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: 'success', message: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ show: true, type, message });
  };

  // Fetch leave requests for the employee
  useEffect(() => {
    if (!userId) return;

    const fetchLeaveRequests = async () => {
      try {
        const response = await fetch(`/api/leave/employee?employeeId=${userId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch leave requests');
        }

        const result = await response.json();
        setLeaveRequests(result.data || []);
      } catch (error) {
        console.error('Error fetching leave requests:', error);
      }
    };

    fetchLeaveRequests();
  }, [userId]);

  // Fetch schedules when month/year changes
  useEffect(() => {
    if (!userId) return;

    const fetchSchedules = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/schedule/employee?userId=${userId}&month=${viewMonth + 1}&year=${viewYear}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch schedules');
        }

        const data = await response.json();
        setSchedules(data.schedules || []);
      } catch (error) {
        console.error('Error fetching schedules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedules();
  }, [userId, viewMonth, viewYear]);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();

  // Group schedules by date
  const schedulesByDate = useMemo(() => {
    const map: Record<string, WorkSchedule> = {};
    schedules.forEach(schedule => {
      map[schedule.date] = schedule;
    });
    return map;
  }, [schedules]);

  // Helper function to check if a date is within a leave request range
  const getLeaveRequestForDate = (dateStr: string): LeaveRequest | null => {
    const checkDate = new Date(dateStr);

    for (const leave of leaveRequests) {
      const startDate = new Date(leave.start_date);
      const endDate = new Date(leave.end_date);

      // Set time to midnight for accurate date comparison
      checkDate.setHours(0, 0, 0, 0);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (checkDate >= startDate && checkDate <= endDate) {
        return leave;
      }
    }

    return null;
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' });

  const goToPreviousMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const goToToday = () => {
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
  };

  const formatTime = (time: string | null) => {
    if (!time) return '--:--';
    // Remove seconds if present
    return time.split(':').slice(0, 2).join(':');
  };

  const handleEdit = (schedule: WorkSchedule | null, date: string) => {
    if (schedule) {
      setEditForm({
        shift_start: schedule.shift_start || '',
        shift_end: schedule.shift_end || '',
        is_rest_day: schedule.is_rest_day,
      });
    } else {
      setEditForm({
        shift_start: '',
        shift_end: '',
        is_rest_day: false,
      });
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!selectedDate) return;

    setIsSaving(true);
    try {
      const selectedSchedule = schedulesByDate[selectedDate];
      const method = selectedSchedule ? 'PUT' : 'POST';

      const payload = {
        employee_id: userId,
        date: selectedDate,
        shift_start: editForm.is_rest_day ? null : editForm.shift_start || null,
        shift_end: editForm.is_rest_day ? null : editForm.shift_end || null,
        is_rest_day: editForm.is_rest_day,
      };

      const response = await fetch('/api/admin/schedule', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save schedule');
      }

      const result = await response.json();

      // Update local schedules state
      setSchedules(prev => {
        const index = prev.findIndex(s => s.date === selectedDate && s.employee_id === userId);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = result.data;
          return updated;
        }
        return [...prev, result.data];
      });

      setIsEditing(false);
      showNotification('success', 'Schedule updated successfully');
    } catch (error: any) {
      console.error('Error saving schedule:', error);
      showNotification('error', error.message || 'Failed to save schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!selectedDate) return;

    const selectedSchedule = schedulesByDate[selectedDate];
    if (!selectedSchedule) return;

    setShowDeleteConfirm(false);
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/schedule', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedSchedule.id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete schedule');
      }

      // Remove from local state
      setSchedules(prev => prev.filter(s => s.id !== selectedSchedule.id));
      setSelectedDate(null);
      setIsEditing(false);
      showNotification('success', 'Schedule deleted successfully');
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      showNotification('error', error.message || 'Failed to delete schedule');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    const selectedSchedule = selectedDate ? schedulesByDate[selectedDate] : null;
    if (selectedSchedule) {
      setEditForm({
        shift_start: selectedSchedule.shift_start || '',
        shift_end: selectedSchedule.shift_end || '',
        is_rest_day: selectedSchedule.is_rest_day,
      });
    }
  };

  const renderDays = () => {
    const days = [];

    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(
        <div
          key={`empty-${i}`}
          className="h-16 sm:h-20 md:h-24 bg-slate-900/30 border border-slate-800 rounded-lg"
        />
      );
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const schedule = schedulesByDate[dateStr];
      const leaveRequest = getLeaveRequestForDate(dateStr);
      const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
      const isSelected = selectedDate === dateStr;
      const isRestDay = schedule?.is_rest_day;
      const hasSchedule = !!schedule;
      const hasLeave = !!leaveRequest;

      // Determine background color based on priority: leave > rest day > schedule
      let bgClass = 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60';
      if (hasLeave) {
        // Different colors based on leave status
        if (leaveRequest.status === 'approved') {
          bgClass = 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20';
        } else if (leaveRequest.status === 'rejected') {
          bgClass = 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20';
        } else {
          bgClass = 'border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20';
        }
      } else if (isRestDay) {
        bgClass = 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20';
      } else if (hasSchedule) {
        bgClass = 'border-slate-800 bg-slate-900/60 hover:bg-slate-800';
      }

      days.push(
        <div
          key={d}
          onClick={() => setSelectedDate(dateStr)}
          className={`
            min-h-[72px] sm:min-h-[90px] p-1.5 sm:p-2 border rounded-lg flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group
            ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/10' : ''}
            ${!isSelected && isToday ? 'border-blue-500/50 bg-blue-500/5' : ''}
            ${!isSelected && !isToday ? bgClass : ''}
          `}
        >
          <div className="flex justify-between items-start z-10 relative">
            <span className={`text-xs sm:text-sm font-medium ${isToday || isSelected ? 'text-blue-400' : 'text-slate-500'} group-hover:text-slate-300`}>
              {d}
            </span>
            {hasLeave ? (
              <Plane className={`w-3 h-3 sm:w-4 sm:h-4 ${
                leaveRequest.status === 'approved' ? 'text-emerald-500' :
                leaveRequest.status === 'rejected' ? 'text-red-500' :
                'text-amber-400'
              }`} />
            ) : isRestDay ? (
              <Coffee className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
            ) : hasSchedule ? (
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shadow-sm"></div>
            ) : null}
          </div>

          {hasLeave ? (
            <div className="mt-auto z-10 relative">
              <span className={`text-[9px] sm:text-xs font-medium truncate w-full block ${
                leaveRequest.status === 'approved' ? 'text-emerald-500' :
                leaveRequest.status === 'rejected' ? 'text-red-500' :
                'text-amber-500'
              }`}>
                {leaveRequest.leave_type}
              </span>
            </div>
          ) : isRestDay ? (
            <div className="mt-auto z-10 relative">
              <span className="text-[9px] sm:text-xs text-orange-500 font-medium">Rest Day</span>
            </div>
          ) : hasSchedule && schedule.shift_start && schedule.shift_end ? (
            <div className="mt-auto z-10 relative">
              <div className="text-[9px] sm:text-xs font-medium text-slate-300 leading-tight">
                {formatTime(schedule.shift_start)}
              </div>
              <div className="text-[9px] sm:text-[10px] text-slate-500 leading-tight mt-0.5">
                - {formatTime(schedule.shift_end)}
              </div>
            </div>
          ) : (
            <div className="mt-auto text-[10px] sm:text-xs text-slate-600 font-medium z-10 relative">-</div>
          )}
        </div>
      );
    }

    return days;
  };

  const selectedSchedule = selectedDate ? schedulesByDate[selectedDate] : null;
  const selectedLeaveRequest = selectedDate ? getLeaveRequestForDate(selectedDate) : null;

  if (!isOpen) return null;

  return (
    <>
      {/* Main Modal Overlay */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 h-full max-h-[85dvh] sm:max-h-[90vh] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-slate-900 border-b border-slate-800 p-4 sm:p-5 flex justify-between items-center z-10">
              <div>
                <h2 className="text-lg sm:text-2xl font-bold text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                  Work Schedule
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">View your assigned work schedule</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Calendar Content */}
            <div className="flex-1 overflow-y-auto p-2 sm:p-6 bg-slate-950/50 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
              <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-3 sm:p-4 md:p-6 shadow-sm min-h-full sm:min-h-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
            <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-base sm:text-lg">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
              Work Schedule
            </h3>
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-sm font-medium text-slate-300">{hasMounted ? `${monthName} ${viewYear}` : ''}</span>
              <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5 border border-slate-700">
                <button
                  onClick={goToPreviousMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-2 py-1 hover:bg-slate-700 rounded-md text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  onClick={goToNextMonth}
                  className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center text-[10px] sm:text-xs text-slate-500 font-medium uppercase tracking-wider">
            <div className="hidden sm:block">Sun</div>
            <div className="hidden sm:block">Mon</div>
            <div className="hidden sm:block">Tue</div>
            <div className="hidden sm:block">Wed</div>
            <div className="hidden sm:block">Thu</div>
            <div className="hidden sm:block">Fri</div>
            <div className="hidden sm:block">Sat</div>
            <div className="sm:hidden">S</div>
            <div className="sm:hidden">M</div>
            <div className="sm:hidden">T</div>
            <div className="sm:hidden">W</div>
            <div className="sm:hidden">T</div>
            <div className="sm:hidden">F</div>
            <div className="sm:hidden">S</div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {hasMounted ? renderDays() : null}
            </div>
          )}

                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-3 sm:gap-4 text-xs pb-4 sm:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-blue-500"></div>
                    <span className="text-slate-400">Scheduled</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Coffee className="w-3 h-3 text-orange-500" />
                    <span className="text-slate-400">Rest Day</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="w-3 h-3 text-emerald-500" />
                    <span className="text-slate-300">Approved</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="w-3 h-3 text-amber-500" />
                    <span className="text-slate-400">Pending</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Plane className="w-3 h-3 text-red-500" />
                    <span className="text-slate-400">Rejected</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Date Detail Modal */}
      {selectedDate && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {hasMounted ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : ''}
                </h3>
                <p className="text-slate-400 text-xs">Schedule Details</p>
              </div>
              <div className="flex items-center gap-2">
                {canEditSchedules && !selectedLeaveRequest && !isEditing && (
                  <button
                    onClick={() => handleEdit(selectedSchedule, selectedDate)}
                    className="p-2 hover:bg-slate-800 rounded-full text-blue-400 hover:text-blue-300 transition-colors"
                    title="Edit schedule"
                  >
                    <Edit2 className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}
                <button
                  onClick={() => setSelectedDate(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            <div className="p-3 sm:p-5 bg-slate-900/50 space-y-4">
              {/* Leave Request Section */}
              {selectedLeaveRequest && (
                <div className={`rounded-xl p-4 border ${
                  selectedLeaveRequest.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20' :
                  selectedLeaveRequest.status === 'rejected' ? 'bg-red-500/10 border-red-500/20' :
                  'bg-amber-500/10 border-amber-500/20'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Plane className={`w-8 h-8 ${
                      selectedLeaveRequest.status === 'approved' ? 'text-emerald-500' :
                      selectedLeaveRequest.status === 'rejected' ? 'text-red-500' :
                      'text-amber-500'
                    }`} />
                    <div>
                      <h4 className={`text-lg font-bold ${
                        selectedLeaveRequest.status === 'approved' ? 'text-emerald-400' :
                        selectedLeaveRequest.status === 'rejected' ? 'text-red-400' :
                        'text-amber-400'
                      }`}>{selectedLeaveRequest.leave_type}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        {selectedLeaveRequest.status}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-400 uppercase block mb-1 font-semibold">Date Range</span>
                      <div className="text-sm text-white">
                        {new Date(selectedLeaveRequest.start_date).toLocaleDateString()} - {new Date(selectedLeaveRequest.end_date).toLocaleDateString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-slate-400 uppercase block mb-1 font-semibold">Reason</span>
                      <p className="text-sm text-slate-300">{selectedLeaveRequest.reason}</p>
                    </div>

                    {selectedLeaveRequest.reviewer && (
                      <div>
                        <span className="text-xs text-slate-400 uppercase block mb-1 font-semibold">Reviewed By</span>
                        <div className="text-sm text-white">
                          {selectedLeaveRequest.reviewer.first_name} {selectedLeaveRequest.reviewer.last_name}
                        </div>
                        {selectedLeaveRequest.reviewed_at && (
                          <div className="text-xs text-slate-500">
                            on {new Date(selectedLeaveRequest.reviewed_at).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Schedule Section */}
              {isEditing ? (
                <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm space-y-4">
                  <div className="flex items-center justify-between mb-2 pb-3 border-b border-slate-700">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Edit Schedule</span>
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-600">
                      <input
                        type="checkbox"
                        id="is_rest_day"
                        checked={editForm.is_rest_day}
                        onChange={(e) => setEditForm({ ...editForm, is_rest_day: e.target.checked })}
                        className="w-4 h-4 text-orange-500 bg-slate-700 border-slate-600 rounded focus:ring-orange-500"
                      />
                      <label htmlFor="is_rest_day" className="text-sm font-medium text-slate-300">
                        Mark as Rest Day
                      </label>
                    </div>

                    {!editForm.is_rest_day && (
                      <>
                        <div>
                          <label className="text-xs text-slate-400 uppercase block mb-2 font-semibold">
                            Start Time
                          </label>
                          <input
                            type="time"
                            value={editForm.shift_start}
                            onChange={(e) => setEditForm({ ...editForm, shift_start: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-400 uppercase block mb-2 font-semibold">
                            End Time
                          </label>
                          <input
                            type="time"
                            value={editForm.shift_end}
                            onChange={(e) => setEditForm({ ...editForm, shift_end: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                            style={{ colorScheme: 'dark' }}
                          />
                        </div>
                      </>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                      {selectedSchedule && (
                        <button
                          onClick={handleDelete}
                          disabled={isSaving}
                          className="p-2 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                          title="Delete schedule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : selectedSchedule ? (
                selectedSchedule.is_rest_day ? (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
                    <Coffee className="w-12 h-12 text-orange-500 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-orange-400 mb-1">Rest Day</h4>
                    <p className="text-sm text-muted-foreground">No scheduled work for this day</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Details</span>
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-slate-400 uppercase block mb-1 font-semibold">Start Time</span>
                        <div className="flex items-center gap-2 font-mono text-lg text-white">
                          <Clock className="w-4 h-4 text-white" />
                          {formatTime(selectedSchedule.shift_start)}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-slate-400 uppercase block mb-1 font-semibold">End Time</span>
                        <div className="flex items-center gap-2 font-mono text-lg text-white">
                          <Clock className="w-4 h-4 text-white" />
                          {formatTime(selectedSchedule.shift_end)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              ) : !selectedLeaveRequest && (
                <div className="text-center py-10 text-slate-500 flex flex-col items-center">
                  <CalendarIcon className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">No schedule found for this date</p>
                  {canEditSchedules && (
                    <button
                      onClick={() => handleEdit(null, selectedDate)}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <Edit2 className="w-4 h-4" />
                      Add Schedule
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white">Delete Schedule</h3>
                  <p className="text-sm text-slate-400">This action cannot be undone</p>
                </div>
              </div>

              <p className="text-slate-300 mb-6">
                Are you sure you want to delete this schedule entry? This will permanently remove the schedule for{' '}
                <span className="font-semibold text-white">
                  {selectedDate && hasMounted ? new Date(selectedDate).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'long',
                    day: 'numeric'
                  }) : ''}
                </span>.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isSaving}
                  className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  {isSaving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Notification Modal */}
      {notification.show && typeof document !== 'undefined' && createPortal(
        <div className="fixed top-4 right-4 z-[99999] animate-in slide-in-from-top-2 duration-300">
          <div className={`
            flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl border min-w-[300px]
            ${notification.type === 'success'
              ? 'bg-emerald-500 border-emerald-400 text-white'
              : 'bg-red-500 border-red-400 text-white'}
          `}>
            {notification.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium flex-1">{notification.message}</p>
            <button
              onClick={() => setNotification({ show: false, type: 'success', message: '' })}
              className="p-1 hover:bg-white/20 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};