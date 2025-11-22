import React, { useMemo, useState, useEffect} from 'react';
import { WorkLog } from '@/types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Clock, ArrowRight, History } from 'lucide-react';

interface CalendarViewProps {
  logs: WorkLog[];
}

export const CalendarView: React.FC<CalendarViewProps> = ({ logs }) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay(); // 0 is Sunday

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

  const monthName = today.toLocaleString('default', { month: 'long' });

  const renderDays = () => {
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push(<div key={`empty-${i}`} className="h-24 bg-slate-900/30 border border-slate-800 rounded-lg"></div>);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const totalSeconds = getDailyTotalSeconds(dateStr);
        const hours = (totalSeconds / 3600).toFixed(1);
        const hasWork = totalSeconds > 0;
        const isToday = d === today.getDate();
        const isSelected = selectedDate === dateStr;

        days.push(
            <div 
                key={d} 
                onClick={() => setSelectedDate(dateStr)}
                className={`
                    h-24 p-2 border rounded-lg flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden group
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-900/20' : ''}
                    ${!isSelected && isToday ? 'border-blue-500/50 bg-blue-500/10' : ''}
                    ${!isSelected && !isToday ? 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-slate-500' : ''}
                    ${hasWork && !isSelected ? 'bg-slate-800' : ''}
                    ${!hasWork && !isSelected ? 'opacity-70 hover:opacity-100' : ''}
                `}
            >
                <div className="flex justify-between items-start z-10 relative">
                    <span className={`text-sm font-medium ${isToday || isSelected ? 'text-blue-400' : 'text-slate-400'} group-hover:text-blue-300`}>{d}</span>
                    {hasWork && (
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                    )}
                </div>
                
                {hasWork ? (
                    <div className="mt-auto z-10 relative">
                        <span className="text-lg font-bold text-slate-200">{hours}</span>
                        <span className="text-xs text-slate-500 ml-1">hrs</span>
                    </div>
                ) : (
                    <div className="mt-auto text-xs text-slate-600 font-medium z-10 relative">-</div>
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
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-400" />
                    Work Calendar
                </h3>
                <div className="flex items-center gap-4 text-slate-400 text-sm">
                   <span>{hasMounted ? `${monthName} ${currentYear}` : ''}</span>
                   <div className="flex gap-1">
                       <button className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 disabled"><ChevronLeft className="w-4 h-4" /></button>
                       <button className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-slate-300 disabled"><ChevronRight className="w-4 h-4" /></button>
                   </div>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs text-slate-500 font-medium uppercase tracking-wider">
                <div>Sun</div>
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div>Sat</div>
            </div>
            <div className="grid grid-cols-7 gap-2">
                {hasMounted ? renderDays() : null}
            </div>
        </div>

        {/* Modal Overlay */}
        {selectedDate && (
            <div 
                className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm transition-opacity"
                onClick={() => setSelectedDate(null)}
            >
                <div 
                    className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
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
                    
                    <div className="p-5 max-h-[60vh] overflow-y-auto bg-slate-900/50">
                        {(logsByDate[selectedDate] || []).length > 0 ? (
                            <div className="space-y-3">
                                {logsByDate[selectedDate].map((log, idx) => (
                                    <div key={log.id} className="bg-slate-800 rounded-xl p-4 border border-slate-700 flex flex-col gap-3">
                                        <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Session {idx + 1}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400">{formatDuration(log.durationSeconds)}</span>
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between text-slate-200 pt-1">
                                            <div>
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock In</span>
                                                <div className="flex items-center gap-1.5 font-mono text-base text-white">
                                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                                    {formatTime(log.startTime)}
                                                </div>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-slate-600" />
                                            <div className="text-right">
                                                <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Clock Out</span>
                                                <div className="flex items-center justify-end gap-1.5 font-mono text-base text-white">
                                                    {log.endTime ? formatTime(log.endTime) : '--:--'}
                                                    <Clock className="w-3.5 h-3.5 text-rose-400" />
                                                </div>
                                            </div>
                                        </div>
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

                    <div className="p-4 bg-slate-800 border-t border-slate-700 flex justify-between items-center">
                        <span className="text-slate-400 text-sm font-medium">Total Hours</span>
                        <span className="text-xl font-bold text-blue-400 font-mono">
                             {(getDailyTotalSeconds(selectedDate) / 3600).toFixed(2)} <span className="text-xs font-sans text-slate-500 font-normal">hrs</span>
                        </span>
                    </div>
                </div>
            </div>
        )}
    </>
  );
};