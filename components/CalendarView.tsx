import React, { useMemo, useState, useEffect} from 'react';
import { WorkLog } from '@/types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, ArrowRight, History } from 'lucide-react';

interface CalendarViewProps {
  logs: WorkLog[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ logs }) => {
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
        days.push(<div key={`empty-${i}`} className="h-16 sm:h-20 md:h-24 bg-slate-900/30 border border-slate-800 rounded-lg"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const totalSeconds = getDailyTotalSeconds(dateStr);
        const hours = (totalSeconds / 3600).toFixed(1);
        const hasWork = totalSeconds > 0;
        const isToday = d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();
        const isSelected = selectedDate === dateStr;

        days.push(
            <div
                key={d}
                onClick={() => setSelectedDate(dateStr)}
                className={`
                    h-16 sm:h-20 md:h-24 p-1.5 sm:p-2 border rounded-lg flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-900/20' : ''}
                    ${!isSelected && isToday ? 'border-blue-500/50 bg-blue-500/10' : ''}
                    ${!isSelected && !isToday ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-500' : ''}
                    ${hasWork && !isSelected ? 'bg-slate-800' : ''}
                    ${!hasWork && !isSelected ? 'opacity-70 hover:opacity-100' : ''}
                `}
            >
                <div className="flex justify-between items-start z-10 relative">
                    <span className={`text-xs sm:text-sm font-medium ${isToday || isSelected ? 'text-blue-400' : 'text-slate-400'} group-hover:text-blue-300`}>{d}</span>
                    {hasWork && (
                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    )}
                </div>

                {hasWork ? (
                    <div className="mt-auto z-10 relative">
                        <span className="text-sm sm:text-base md:text-lg font-bold text-slate-200">{hours}</span>
                        <span className="text-[10px] sm:text-xs text-slate-500 ml-0.5 sm:ml-1">hrs</span>
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

  return (
    <>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 sm:p-4 md:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-base sm:text-lg">
                    <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
                    Work Calendar
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
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {hasMounted ? renderDays() : null}
            </div>
        </div>

        {/* Modal Overlay */}
        {selectedDate && (
            <div
                className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity"
                onClick={() => setSelectedDate(null)}
            >
                <div
                    className="bg-slate-900 border-t sm:border border-slate-700 w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 max-h-[90vh] sm:max-h-none"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-4 sm:p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-white">
                                {hasMounted ? new Date(selectedDate).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' }) : ''}
                            </h3>
                            <p className="text-slate-400 text-xs">Daily Log Details</p>
                        </div>
                        <button
                            onClick={() => setSelectedDate(null)}
                            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                    </div>
                    
                    <div className="p-3 sm:p-5 max-h-[60vh] overflow-y-auto bg-slate-900/50">
                        {(logsByDate[selectedDate] || []).length > 0 ? (
                            <div className="space-y-3">
                                {logsByDate[selectedDate].map((log, idx) => (
                                    <div key={log.id} className="bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-700 flex flex-col gap-3">
                                        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Session {idx + 1}</span>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <span className="text-[10px] sm:text-xs text-slate-400">{formatDuration(log.durationSeconds)}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-slate-200 pt-1 gap-3 sm:gap-0">
                                            <div className="flex-1">
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock In</span>
                                                <div className="flex items-center gap-1.5 font-mono text-sm sm:text-base text-white">
                                                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
                                                    {formatTime(log.startTime)}
                                                </div>
                                                <div className="mt-1 text-[10px] text-slate-400 max-w-full sm:max-w-[120px] truncate" title={log.clockInAddress || 'No address provided'}>
                                                    {log.clockInAddress || 'No address provided'}
                                                </div>
                                            </div>
                                            <ArrowRight className="hidden sm:block w-4 h-4 text-slate-600 flex-shrink-0" />
                                            <div className="flex-1 sm:text-right">
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock Out</span>
                                                <div className="flex items-center sm:justify-end gap-1.5 font-mono text-sm sm:text-base text-white">
                                                    <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-400 sm:order-2" />
                                                    {log.endTime ? formatTime(log.endTime) : '--:--'}
                                                </div>
                                                {log.endTime && (
                                                    <div className="mt-1 text-[10px] text-slate-400 max-w-full sm:max-w-[120px] truncate sm:ml-auto" title={log.clockOutAddress || 'No address provided'}>
                                                        {log.clockOutAddress || 'No address provided'}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {log.comment && (
                                            <div className="pt-2 mt-2 border-t border-slate-700/50">
                                                <div className="flex items-start gap-2">
                                                    <div className="flex-shrink-0 mt-0.5">
                                                        <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-[10px] font-bold text-amber-400 uppercase tracking-wider">
                                                            Overtime
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-sm text-slate-300 leading-relaxed">{log.comment}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-10 text-slate-500 flex flex-col items-center">
                                <History className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No records found for this date.</p>
                            </div>
                        )}
                    </div>

                    <div className="p-3 sm:p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400 text-xs sm:text-sm font-medium">Total Hours</span>
                        <span className="text-lg sm:text-xl font-bold text-blue-400 font-mono">
                             {(getDailyTotalSeconds(selectedDate) / 3600).toFixed(2)} <span className="text-xs font-sans text-slate-500 font-normal">hrs</span>
                        </span>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};