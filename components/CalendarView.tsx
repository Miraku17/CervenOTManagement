import React, { useMemo, useState, useEffect } from 'react';
import { WorkLog } from '@/types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, ArrowRight, History, MapPin } from 'lucide-react';

interface CalendarViewProps {
  logs: WorkLog[];
  userId?: string;
  activeLog?: WorkLog | null;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ logs, userId, activeLog }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay(); // 0 is Sunday

  // Group logs by date
  const logsByDate = useMemo(() => {
    const map: Record<string, WorkLog[]> = {};
    logs.forEach(log => {
      if (log.status === 'COMPLETED') {
        if (!map[log.date]) map[log.date] = [];
        map[log.date].push(log);
      }
    });
    return map;
  }, [logs]);

  const getDailyTotalSeconds = (date: string) => {
      return (logsByDate[date] || []).reduce((acc, log) => acc + log.durationSeconds, 0);
  };

  const isDateActive = (date: string) => {
      return activeLog && activeLog.date === date && activeLog.status === 'IN_PROGRESS';
  };

  const getDisplayHoursForDate = (date: string) => {
      // Check if this date has an active session
      if (isDateActive(date)) {
          return 'Active';
      }
      // Display hours from backend (backend handles position-based deductions)
      const totalSeconds = getDailyTotalSeconds(date);
      return (totalSeconds / 3600).toFixed(1);
  };

  const hasWorkForDate = (date: string) => {
       // Check if date has active session
       if (isDateActive(date)) return true;
       // Check if date has any completed work logs
       return getDailyTotalSeconds(date) > 0;
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleString('default', { month: 'long' });

  // Navigation functions
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

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 bg-slate-800/20 border border-transparent rounded-lg"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        
        const hours = getDisplayHoursForDate(dateStr);
        const hasWork = hasWorkForDate(dateStr);
        
        const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
        const isSelected = selectedDate === dateStr;

        days.push(
            <div
                key={d}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                    h-16 sm:h-20 md:h-24 p-1.5 sm:p-2 border rounded-lg flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-500/10' : ''}
                    ${!isSelected && isToday ? 'border-blue-500/50 bg-blue-500/5' : ''}
                    ${!isSelected && !isToday ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-600' : ''}
                    ${hasWork && !isSelected ? 'bg-slate-900/60' : ''}
                    ${!hasWork && !isSelected ? 'opacity-70 hover:opacity-100' : ''}
                `}
            >
                <div className="flex justify-between items-start z-10 relative">
                    <span className={`text-xs sm:text-sm font-medium ${isToday || isSelected ? 'text-blue-400' : 'text-slate-500'} group-hover:text-slate-300`}>{d}</span>
                    {hasWork && (
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                    )}
                </div>

                {hasWork ? (
                    <div className="mt-auto z-10 relative">
                        {isDateActive(dateStr) ? (
                            <span className="text-xs sm:text-sm font-bold text-amber-500 animate-pulse">Active</span>
                        ) : (
                            <>
                                <span className="text-sm sm:text-base md:text-lg font-bold text-slate-200">{hours}</span>
                                <span className="text-[10px] sm:text-xs text-slate-500 ml-0.5 sm:ml-1">hrs</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="mt-auto text-[10px] sm:text-xs text-slate-600 font-medium z-10 relative">-</div>
                )}
            </div>
        );
    }
    return days;
  };

  const formatTime = (timestamp: number) => {
      return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDuration = (seconds: number) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
  };

  // For the modal display
  const displayTotalHoursModal = useMemo(() => {
    if (!selectedDate) return "0.00";

    // If date is active, show "Active" instead of hours
    if (isDateActive(selectedDate)) {
      return "Active";
    }

    // Display hours from backend (backend handles position-based deductions)
    return (getDailyTotalSeconds(selectedDate) / 3600).toFixed(2);
  }, [selectedDate, logsByDate, activeLog]);

  return (
    <>
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-lg">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                    Work Calendar
                </h3>
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                   <span className="text-sm font-medium text-slate-300">{hasMounted ? `${monthName} ${viewYear}` : ''}</span>
                   <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5 border border-slate-700">
                       <button
                         onClick={goToPreviousMonth}
                         className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
                       >
                         <ChevronLeft className="w-4 h-4" />
                       </button>
                       <button
                         onClick={goToToday}
                         className="px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white transition-colors"
                       >
                         Today
                       </button>
                       <button
                         onClick={goToNextMonth}
                         className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 hover:text-white transition-colors"
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
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {hasMounted ? renderDays() : null}
            </div>
        </div>

        {/* Modal Overlay */}
        {selectedDate && (
            <div
                className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
                onClick={() => setSelectedDate(null)}
            >
                <div
                    className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden transform transition-all scale-100 max-h-[90vh] sm:max-h-[85vh] flex flex-col"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <div>
                            <h3 className="text-lg font-bold text-white">
                                {hasMounted ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : ''}
                            </h3>
                            <p className="text-slate-400 text-xs">Daily Log Details</p>
                        </div>
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    
                    <div className="p-4 overflow-y-auto flex-1 bg-slate-900/50">
                        {/* Show active session info if date is active */}
                        {isDateActive(selectedDate) && (
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                                    <span className="text-sm font-bold text-amber-500">Active Work Session</span>
                                </div>
                                <p className="text-xs text-slate-400">
                                    You have an ongoing work session. Clock out to see the final hours.
                                </p>
                                <div className="mt-2 text-xs font-mono text-slate-300">
                                    Started: {activeLog && formatTime(activeLog.startTime)}
                                </div>
                            </div>
                        )}
                        {(logsByDate[selectedDate] || []).length > 0 ? (
                            <div className="space-y-3">
                                {logsByDate[selectedDate].map((log, idx) => (
                                    <div key={log.id} className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-sm flex flex-col gap-3">
                                        <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Session {idx + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-slate-400">{formatDuration(log.durationSeconds)}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-0">
                                            <div className="flex-1">
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock In</span>
                                                <div className="flex items-center gap-1.5 font-mono text-sm text-white">
                                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                                    {formatTime(log.startTime)}
                                                </div>
                                                {log.clockInAddress && (
                                                    <div className="mt-1 flex items-start gap-1">
                                                        <MapPin className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0" />
                                                        <span className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                                                            {log.clockInAddress}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600 flex-shrink-0 mx-2" />
                                            <div className="flex-1 sm:text-right">
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock Out</span>
                                                <div className="flex items-center sm:justify-end gap-1.5 font-mono text-sm text-white">
                                                    <Clock className="w-3.5 h-3.5 text-rose-400 sm:order-2" />
                                                    {log.endTime ? formatTime(log.endTime) : '--:--'}
                                                </div>
                                                {log.clockOutAddress && (
                                                    <div className="mt-1 flex items-start sm:justify-end gap-1">
                                                        <MapPin className="w-3 h-3 text-slate-500 mt-0.5 flex-shrink-0 sm:order-2" />
                                                        <span className="text-[10px] text-slate-400 leading-tight line-clamp-2 text-right">
                                                            {log.clockOutAddress}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {log.comment && (
                                            <div className="pt-2 mt-2 border-t border-slate-700 bg-slate-900/30 -mx-4 -mb-4 px-4 py-3 rounded-b-lg">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        <div className="px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                                                            Overtime
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-slate-400 italic">&quot;{log.comment}&quot;</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 flex flex-col items-center justify-center">
                                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                    <History className="w-6 h-6 text-slate-500" />
                                </div>
                                <p className="text-sm text-slate-500">No records found for this date.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
                        <span className="text-sm font-medium text-slate-400">Total Hours</span>
                         {/* Hours from backend (includes position-based deductions) */}
                         <span className={`text-xl font-bold font-mono ${isDateActive(selectedDate) ? 'text-amber-500 animate-pulse' : 'text-blue-400'}`}>
                                {displayTotalHoursModal} {!isDateActive(selectedDate) && <span className="text-sm font-sans text-slate-500 font-normal">hrs</span>}
                        </span>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};