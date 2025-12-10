import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { WorkLog } from '@/types';

interface TimeTrackerProps {
  onClockIn: () => void;
  onClockOut: (duration: number, comment?: string) => void;
  activeLog: WorkLog | null;
  isLoading?: boolean;
  locationStatus?: {
    hasLocation: boolean;
    isRequesting: boolean;
    error: string | null;
    address: string | null;
  };
  onRefreshLocation?: () => void;
  todayOvertimeRequest?: {
    id: string;
    comment: string;
    status: string;
  } | null;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  onClockIn,
  onClockOut,
  activeLog,
  isLoading = false,
  locationStatus,
  onRefreshLocation,
  todayOvertimeRequest
}) => {
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

  // Reset overtime checkbox state if there's already a request today
  useEffect(() => {
    if (todayOvertimeRequest) {
      setIsOvertime(false);
      setOvertimeComment('');
      setOvertimeError(null);
    }
  }, [todayOvertimeRequest]);

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

  // Calculate hours worked
  const hoursWorked = elapsedSeconds / 3600;
  // Overtime is always eligible now per user request
  const isOvertimeEligible = true; 

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-xl flex flex-col items-center justify-center relative overflow-hidden h-full">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-slate-800 border border-slate-600 rounded-xl px-6 py-4 flex items-center gap-3 shadow-2xl">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="text-white font-medium">
                {isRunning ? 'Processing clock out...' : 'Processing clock in...'}
              </span>
            </div>
          </div>
        )}

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

            {/* Location Status */}
            {locationStatus && (
              <div className="mb-4">
                {locationStatus.error === 'denied' ? (
                  // Special UI for denied permission
                  <div className="p-4 rounded-lg bg-red-900/20 border border-red-500/50">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-400 mb-1">Location Permission Denied</p>
                        <p className="text-xs text-slate-300 mb-3">
                          To clock in/out, please enable location access:
                        </p>
                        <ol className="text-xs text-slate-400 space-y-1 mb-3 ml-4 list-decimal">
                          <li>Click the lock/info icon in your browser's address bar</li>
                          <li>Allow location access for this site</li>
                          <li>Click the button below to retry</li>
                        </ol>
                        {onRefreshLocation && (
                          <button
                            onClick={onRefreshLocation}
                            disabled={locationStatus.isRequesting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <RefreshCw className={`w-4 h-4 ${locationStatus.isRequesting ? 'animate-spin' : ''}`} />
                            {locationStatus.isRequesting ? 'Requesting...' : 'Request Location Again'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal location status display
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-700/30 border border-slate-600">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <MapPin className={`w-4 h-4 flex-shrink-0 ${locationStatus.hasLocation ? 'text-emerald-400' : 'text-amber-400'}`} />
                      <div className="flex-1 min-w-0">
                        {locationStatus.isRequesting ? (
                          <p className="text-xs text-slate-400">Requesting location...</p>
                        ) : locationStatus.hasLocation && locationStatus.address ? (
                          <p className="text-xs text-slate-300 truncate" title={locationStatus.address}>
                            {locationStatus.address.split(',').slice(0, 2).join(',')}
                          </p>
                        ) : locationStatus.error ? (
                          <p className="text-xs text-amber-400">{locationStatus.error}</p>
                        ) : (
                          <p className="text-xs text-slate-400">No location</p>
                        )}
                      </div>
                    </div>
                    {onRefreshLocation && (
                      <button
                        onClick={onRefreshLocation}
                        disabled={locationStatus.isRequesting}
                        className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Refresh location"
                      >
                        <RefreshCw className={`w-4 h-4 text-slate-400 ${locationStatus.isRequesting ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

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

            {/* Overtime Request Status - Always visible */}
            {todayOvertimeRequest && (
              <div className="mb-4 bg-blue-900/30 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    todayOvertimeRequest.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                    todayOvertimeRequest.status === 'approved' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                    'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {todayOvertimeRequest.status.toUpperCase()}
                  </div>
                </div>
                <p className="text-sm text-slate-200 font-semibold mb-1">Overtime Request Submitted Today</p>
                <p className="text-xs text-slate-400 italic mb-3">&quot;{todayOvertimeRequest.comment}&quot;</p>
                <p className="text-xs text-amber-400 font-medium flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Only one overtime request allowed per day</span>
                </p>
              </div>
            )}

            <div className="flex flex-col items-center gap-6 flex-1 justify-center">
                <div className="flex flex-col items-center">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Session Duration</div>
                    <div className="font-mono text-5xl md:text-6xl text-white font-bold tracking-wider tabular-nums drop-shadow-lg">
                        {formatTime(elapsedSeconds)}
                    </div>
                </div>

                <div className="text-slate-400 text-sm text-center">
                   {isRunning
                     ? (isOvertime ? 'Currently logging overtime work' : 'Currently logging work hours')
                     : 'Ready to start a new session'}
                </div>

                {isRunning && !todayOvertimeRequest && (
                  <div className="w-full space-y-3 px-4 py-3 bg-slate-700/30 rounded-lg border border-slate-600">
                    <div className="space-y-2">
                      <label className="flex items-center space-x-2 text-slate-300">
                        <input
                          type="checkbox"
                          className="form-checkbox h-4 w-4 text-blue-600 bg-slate-900 border-slate-500 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          checked={isOvertime}
                          onChange={(e) => {
                            setIsOvertime(e.target.checked);
                            if (!e.target.checked) setOvertimeError(null);
                          }}
                        />
                        <span>Mark as Overtime</span>
                      </label>
                    </div>
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
                    disabled={isLoading}
                    className={`
                        group relative flex items-center justify-center gap-3 px-8 py-4 rounded-xl w-full font-bold text-lg transition-all duration-300 transform shadow-lg
                        ${!isLoading && 'cursor-pointer active:scale-[0.98]'}
                        ${isLoading && 'opacity-70 cursor-not-allowed'}
                        ${isRunning
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20 ring-4 ring-rose-500/10'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20 ring-4 ring-blue-500/10'}
                        ${isLoading && 'hover:bg-opacity-100'}
                    `}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {isRunning ? 'Clocking Out...' : 'Clocking In...'}
                        </>
                    ) : isRunning ? (
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