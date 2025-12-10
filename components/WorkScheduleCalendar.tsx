import React, { useMemo, useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, Coffee, Plane } from 'lucide-react';
import type { LeaveRequest } from '@/types';

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
}

export const WorkScheduleCalendar: React.FC<WorkScheduleCalendarProps> = ({ userId, isOpen, onClose }) => {
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    setHasMounted(true);
  }, []);

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
    return time;
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
      let bgClass = 'border-slate-700 bg-slate-900/50 opacity-60';
      if (hasLeave) {
        // Different colors based on leave status
        if (leaveRequest.status === 'approved') {
          bgClass = 'border-green-700 bg-green-900/30 hover:bg-green-900/40';
        } else if (leaveRequest.status === 'rejected') {
          bgClass = 'border-red-700 bg-red-900/30 hover:bg-red-900/40';
        } else {
          bgClass = 'border-amber-700 bg-amber-900/30 hover:bg-amber-900/40';
        }
      } else if (isRestDay) {
        bgClass = 'border-slate-700 bg-orange-900/20 hover:bg-orange-900/30';
      } else if (hasSchedule) {
        bgClass = 'border-slate-700 bg-slate-800 hover:bg-slate-750';
      }

      days.push(
        <div
          key={d}
          onClick={() => setSelectedDate(dateStr)}
          className={`
            h-16 sm:h-20 md:h-24 p-1.5 sm:p-2 border rounded-lg flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group
            ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-900/20' : ''}
            ${!isSelected && isToday ? 'border-blue-500/50 bg-blue-500/10' : ''}
            ${!isSelected && !isToday ? bgClass : ''}
          `}
        >
          <div className="flex justify-between items-start z-10 relative">
            <span className={`text-xs sm:text-sm font-medium ${isToday || isSelected ? 'text-blue-400' : 'text-slate-400'} group-hover:text-blue-300`}>
              {d}
            </span>
            {hasLeave ? (
              <Plane className={`w-3 h-3 sm:w-4 sm:h-4 ${
                leaveRequest.status === 'approved' ? 'text-green-400' :
                leaveRequest.status === 'rejected' ? 'text-red-400' :
                'text-amber-400'
              }`} />
            ) : isRestDay ? (
              <Coffee className="w-3 h-3 sm:w-4 sm:h-4 text-orange-400" />
            ) : hasSchedule ? (
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>
            ) : null}
          </div>

          {hasLeave ? (
            <div className="mt-auto z-10 relative">
              <span className={`text-[10px] sm:text-xs font-medium ${
                leaveRequest.status === 'approved' ? 'text-green-400' :
                leaveRequest.status === 'rejected' ? 'text-red-400' :
                'text-amber-400'
              }`}>
                {leaveRequest.leave_type}
              </span>
            </div>
          ) : isRestDay ? (
            <div className="mt-auto z-10 relative">
              <span className="text-[10px] sm:text-xs text-orange-400 font-medium">Rest Day</span>
            </div>
          ) : hasSchedule && schedule.shift_start && schedule.shift_end ? (
            <div className="mt-auto z-10 relative">
              <div className="text-[10px] sm:text-xs font-medium text-slate-300">
                {formatTime(schedule.shift_start)}
              </div>
              <div className="text-[8px] sm:text-[10px] text-slate-500">
                to {formatTime(schedule.shift_end)}
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
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      >
        <div
          className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-800 p-4 sm:p-5 flex justify-between items-center z-10">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
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
          <div className="p-4 sm:p-6">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4 md:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
          <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-base sm:text-lg">
            <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            Work Schedule
          </h3>
          <div className="flex items-center gap-3 sm:gap-4 text-slate-400 text-xs sm:text-sm w-full sm:w-auto justify-between sm:justify-start">
            <span className="font-medium">{hasMounted ? `${monthName} ${viewYear}` : ''}</span>
            <div className="flex gap-1">
              <button
                onClick={goToPreviousMonth}
                className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={goToToday}
                className="px-2 py-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 text-xs font-medium transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={goToNextMonth}
                className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
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
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {hasMounted ? renderDays() : null}
          </div>
        )}

              <div className="mt-4 pt-4 border-t border-slate-700 flex flex-wrap gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-slate-400">Scheduled</span>
                </div>
                <div className="flex items-center gap-2">
                  <Coffee className="w-3 h-3 text-orange-400" />
                  <span className="text-slate-400">Rest Day</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="w-3 h-3 text-green-400" />
                  <span className="text-slate-400">Leave (Approved)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="w-3 h-3 text-amber-400" />
                  <span className="text-slate-400">Leave (Pending)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="w-3 h-3 text-red-400" />
                  <span className="text-slate-400">Leave (Rejected)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Detail Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="bg-slate-900 border-t sm:border border-slate-700 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {hasMounted ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : ''}
                </h3>
                <p className="text-slate-400 text-xs">Schedule Details</p>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-5 bg-slate-900/50 space-y-4">
              {/* Leave Request Section */}
              {selectedLeaveRequest && (
                <div className={`rounded-xl p-4 border ${
                  selectedLeaveRequest.status === 'approved' ? 'bg-green-900/20 border-green-700/30' :
                  selectedLeaveRequest.status === 'rejected' ? 'bg-red-900/20 border-red-700/30' :
                  'bg-amber-900/20 border-amber-700/30'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <Plane className={`w-8 h-8 ${
                      selectedLeaveRequest.status === 'approved' ? 'text-green-400' :
                      selectedLeaveRequest.status === 'rejected' ? 'text-red-400' :
                      'text-amber-400'
                    }`} />
                    <div>
                      <h4 className={`text-lg font-bold ${
                        selectedLeaveRequest.status === 'approved' ? 'text-green-300' :
                        selectedLeaveRequest.status === 'rejected' ? 'text-red-300' :
                        'text-amber-300'
                      }`}>{selectedLeaveRequest.leave_type}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-wider">
                        {selectedLeaveRequest.status}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-500 uppercase block mb-1">Date Range</span>
                      <div className="text-sm text-white">
                        {new Date(selectedLeaveRequest.start_date).toLocaleDateString()} - {new Date(selectedLeaveRequest.end_date).toLocaleDateString()}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs text-slate-500 uppercase block mb-1">Reason</span>
                      <p className="text-sm text-slate-300">{selectedLeaveRequest.reason}</p>
                    </div>

                    {selectedLeaveRequest.reviewer && (
                      <div>
                        <span className="text-xs text-slate-500 uppercase block mb-1">Reviewed By</span>
                        <div className="text-sm text-slate-300">
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
              {selectedSchedule ? (
                selectedSchedule.is_rest_day ? (
                  <div className="bg-orange-900/20 border border-orange-700/30 rounded-xl p-4 text-center">
                    <Coffee className="w-12 h-12 text-orange-400 mx-auto mb-3" />
                    <h4 className="text-lg font-bold text-orange-300 mb-1">Rest Day</h4>
                    <p className="text-sm text-slate-400">No scheduled work for this day</p>
                  </div>
                ) : (
                  <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/50">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Details</span>
                      <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-slate-500 uppercase block mb-1">Start Time</span>
                        <div className="flex items-center gap-2 font-mono text-lg text-white">
                          <Clock className="w-4 h-4 text-blue-400" />
                          {formatTime(selectedSchedule.shift_start)}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-slate-500 uppercase block mb-1">End Time</span>
                        <div className="flex items-center gap-2 font-mono text-lg text-white">
                          <Clock className="w-4 h-4 text-rose-400" />
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
