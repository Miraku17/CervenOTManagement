import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock } from 'lucide-react';
import { WorkLog } from '@/types';

interface TimeTrackerProps {
  onClockIn: () => void;
  onClockOut: (duration: number, comment?: string) => void;
  activeLog: WorkLog | null;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({ onClockIn, onClockOut, activeLog }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [now, setNow] = useState(new Date());
  const [hasMounted, setHasMounted] = useState(false);
  const [isOvertime, setIsOvertime] = useState(false);
  const [overtimeComment, setOvertimeComment] = useState('');
  const [overtimeError, setOvertimeError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Effect for Live Clock
  useEffect(() => {
    const clockInterval = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    setHasMounted(true);
    return () => window.clearInterval(clockInterval);
  }, []);

  // Effect for Stopwatch
  useEffect(() => {
    if (activeLog && activeLog.status === 'IN_PROGRESS') {
      const startTime = activeLog.startTime;
      
      // Update immediately
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));

      // Start interval
      intervalRef.current = window.setInterval(() => {
        const currentNow = Date.now();
        setElapsedSeconds(Math.floor((currentNow - startTime) / 1000));
      }, 1000);
    } else {
      setElapsedSeconds(0);
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [activeLog]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  };

  const handleClockOutWithComment = () => {
    setOvertimeError(null);
    if (isOvertime && !overtimeComment.trim()) {
      setOvertimeError('Please add a comment for overtime work.');
      return;
    }
    onClockOut(elapsedSeconds, isOvertime ? overtimeComment : undefined);
    setIsOvertime(false);
    setOvertimeComment('');
  };

  const isRunning = !!activeLog;

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden h-full">
        {/* Ambient glow */}
        <div className={`absolute inset-0 opacity-20 transition-opacity duration-700 ${isRunning ? 'bg-blue-600 blur-3xl' : 'bg-transparent'}`}></div>

        <div className="z-10 w-full flex flex-col h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Time Tracker
                </h3>
                {isRunning && (
                    <span className="animate-pulse flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                        LIVE
                    </span>
                )}
            </div>

            {/* Current Date & Time Display */}
            <div className="flex flex-col items-center mb-6 border-b border-slate-700/50 pb-6">
                <div className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Current Time</div>
                <div className="text-4xl font-bold text-white font-mono tracking-tight">
                    {hasMounted ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '00:00:00'}
                </div>
                <div className="text-blue-400 font-medium mt-1 text-sm">
                    {hasMounted ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }): ''}
                </div>
            </div>

            <div className="flex flex-col items-center gap-6 flex-1 justify-center">
                <div className="flex flex-col items-center">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Session Duration</div>
                    <div className="font-mono text-5xl md:text-6xl text-white font-bold tracking-wider tabular-nums drop-shadow-lg">
                        {formatTime(elapsedSeconds)}
                    </div>
                </div>

                <div className="text-slate-400 text-sm text-center">
                   {isRunning ? 'Currently logging overtime work...' : 'Ready to start a new session'}
                </div>

                {isRunning && (
                  <div className="w-full space-y-3 px-4 py-3 bg-slate-700/30 rounded-lg border border-slate-600">
                    <label className="flex items-center space-x-2 text-slate-300">
                      <input 
                        type="checkbox" 
                        className="form-checkbox h-4 w-4 text-blue-600 bg-slate-900 border-slate-500 rounded focus:ring-blue-500"
                        checked={isOvertime}
                        onChange={(e) => {
                          setIsOvertime(e.target.checked);
                          if (!e.target.checked) setOvertimeError(null);
                        }}
                      />
                      <span>Mark as Overtime</span>
                    </label>
                    {isOvertime && (
                      <>
                        <textarea
                          className={`w-full bg-slate-800 border rounded-md p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 ${overtimeError ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-blue-500'}`}
                          placeholder="Add overtime comments..."
                          rows={2}
                          value={overtimeComment}
                          onChange={(e) => setOvertimeComment(e.target.value)}
                        />
                        {overtimeError && (
                          <p className="text-red-500 text-xs mt-1">{overtimeError}</p>
                        )}
                      </>
                    )}
                  </div>
                )}

                <button
                    onClick={isRunning ? handleClockOutWithComment : onClockIn}
                    className={`
                        group relative flex items-center justify-center gap-3 px-8 py-4 rounded-xl w-full font-bold text-lg transition-all duration-300 transform active:scale-[0.98] shadow-lg cursor-pointer
                        ${isRunning
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20 ring-4 ring-rose-500/10'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 ring-4 ring-blue-500/10'}
                    `}
                >
                    {isRunning ? (
                        <>
                            <Square className="w-5 h-5 fill-current" />
                            {isOvertime && overtimeComment ? 'Clock Out & Submit Overtime' : 'Clock Out'}
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 fill-current" />
                            Clock In
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};