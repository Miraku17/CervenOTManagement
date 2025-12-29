import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, Loader2, MapPin, RefreshCw } from 'lucide-react';
import { WorkLog } from '@/types';

interface TimeTrackerProps {
  onClockIn: () => void;
  onClockOut: (duration: number) => void;
  activeLog: WorkLog | null;
  isLoading?: boolean;
  locationStatus?: {
    hasLocation: boolean;
    isRequesting: boolean;
    error: string | null;
    address: string | null;
  };
  onRefreshLocation?: () => void;
}

export const TimeTracker: React.FC<TimeTrackerProps> = ({
  onClockIn,
  onClockOut,
  activeLog,
  isLoading = false,
  locationStatus,
  onRefreshLocation,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [now, setNow] = useState(new Date());
  const [hasMounted, setHasMounted] = useState(false);
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

  const handleClockOut = () => {
    onClockOut(elapsedSeconds);
  };

  const isRunning = !!activeLog;

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg h-full flex flex-col relative overflow-hidden">
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center rounded-xl">
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-6 py-4 flex items-center gap-3 shadow-2xl">
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              <span className="text-white font-medium text-sm">
                {isRunning ? 'Processing clock out...' : 'Processing clock in...'}
              </span>
            </div>
          </div>
        )}

        <div className="p-6 flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-slate-100 font-semibold flex items-center gap-2 text-lg">
                    <Clock className="w-5 h-5 text-blue-400" />
                    Time Tracker
                </h3>
                {isRunning ? (
                    <span className="animate-pulse flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                        LIVE SESSION
                    </span>
                ) : (
                    <div className="text-xs text-slate-400 font-medium px-2.5 py-1 bg-slate-800 rounded-full border border-slate-700">
                        Ready
                    </div>
                )}
            </div>

            {/* Location Status */}
            {locationStatus && (
              <div className="mb-6">
                {locationStatus.error === 'denied' ? (
                  // Special UI for denied permission
                  <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-red-400 mb-1">Location Permission Denied</p>
                        <p className="text-xs text-slate-400 mb-3">
                          To clock in/out, please enable location access in your browser settings.
                        </p>
                        {onRefreshLocation && (
                          <button
                            onClick={onRefreshLocation}
                            disabled={locationStatus.isRequesting}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
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
                  <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-full ${locationStatus.hasLocation ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {locationStatus.isRequesting ? (
                          <p className="text-xs text-slate-400">Acquiring location...</p>
                        ) : locationStatus.hasLocation && locationStatus.address ? (
                          <>
                             <p className="text-sm font-medium text-slate-200 truncate" title={locationStatus.address}>
                                {locationStatus.address.split(',')[0]}
                             </p>
                             <p className="text-xs text-slate-400 truncate">
                                {locationStatus.address.split(',').slice(1).join(',')}
                             </p>
                          </>
                        ) : locationStatus.error ? (
                          <p className="text-xs text-amber-400 font-medium">{locationStatus.error}</p>
                        ) : (
                          <p className="text-xs text-slate-500">Location not available</p>
                        )}
                      </div>
                    </div>
                    {onRefreshLocation && (
                      <button
                        onClick={onRefreshLocation}
                        disabled={locationStatus.isRequesting}
                        className="flex-shrink-0 p-2 rounded-md hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
                        title="Refresh location"
                      >
                        <RefreshCw className={`w-4 h-4 ${locationStatus.isRequesting ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col flex-1">
                {/* Timer Display */}
                <div className="flex flex-col items-center justify-center py-8 flex-1">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">
                        {isRunning ? 'Current Session' : 'Current Time'}
                    </div>
                    
                    {isRunning ? (
                         <div className="font-mono text-6xl md:text-7xl font-bold text-white tabular-nums tracking-tighter drop-shadow-lg">
                            {formatTime(elapsedSeconds)}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            <div className="text-5xl md:text-6xl font-bold text-white font-mono tracking-tight drop-shadow-md">
                                {hasMounted ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '00:00'}
                            </div>
                            <div className="text-blue-400 font-medium mt-2 text-sm uppercase tracking-wide">
                                {hasMounted ? now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }): ''}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    onClick={isRunning ? handleClockOut : onClockIn}
                    disabled={isLoading}
                    className={`
                        group relative flex items-center justify-center gap-3 px-6 py-4 rounded-lg w-full font-bold text-base transition-all duration-200 transform
                        ${!isLoading && 'hover:-translate-y-0.5 active:translate-y-0 shadow-lg hover:shadow-xl'}
                        ${isLoading && 'opacity-70 cursor-not-allowed'}
                        ${isRunning
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/20'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/20'}
                    `}
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            {isRunning ? 'Stopping...' : 'Starting...'}
                        </>
                    ) : isRunning ? (
                        <>
                            <Square className="w-5 h-5 fill-current" />
                            Clock Out
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 fill-current" />
                            Start Work Session
                        </>
                    )}
                </button>
            </div>
        </div>
    </div>
  );
};