import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { TimeTracker } from '@/components/TimeTracker';
import { CalendarView } from '@/components/CalendarView';
import { ToastContainer, ToastProps } from '@/components/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LogOut } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/router';
import { supabase } from '@/services/supabase';
import { WorkLog } from '@/types';



const EmployeeDashboard: React.FC = () => {
  const { user, loading } = useUser();
  const router = useRouter();
  const [activeLog, setActiveLog] = useState<WorkLog | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [isClocking, setIsClocking] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clockIn' | 'clockOut' | null>(null);
  const [pendingClockOutData, setPendingClockOutData] = useState<{ duration: number; comment?: string } | null>(null);

  useEffect(() => {
    if (user?.id) {
      checkActiveSession();
    }
  }, [user?.id]);

  // Check for active clock-in session from database
  const checkActiveSession = async () => {
    if (!user?.id) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .is('time_out', null)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        // Restore active session from database
        const activeSession: WorkLog = {
          id: data.id,
          date: data.date,
          startTime: new Date(data.time_in).getTime(),
          endTime: null,
          durationSeconds: 0,
          status: 'IN_PROGRESS'
        };
        setActiveLog(activeSession);
        console.log('Restored active session:', activeSession);
      }
    } catch (error) {
      console.error('Error checking active session:', error);
    }
  };

  useEffect(() => {
    if (activeLog) {
      localStorage.setItem('cerventch_activelog', JSON.stringify(activeLog));
    } else {
      localStorage.removeItem('cerventch_activelog');
    }
  }, [activeLog]);

  // Fetch attendance records from database
  useEffect(() => {
    if (user?.id) {
      fetchAttendanceRecords();
    }
  }, [user?.id]);

  const fetchAttendanceRecords = async () => {
    if (!user?.id || isFetchingLogs) return;

    setIsFetchingLogs(true);
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', user.id)
        .not('time_out', 'is', null) // Only get records with clock out
        .order('date', { ascending: false });

      if (error) throw error;

      if (data) {
        // Convert attendance records to WorkLog format
        const logs: WorkLog[] = data.map((record) => ({
          id: record.id,
          date: record.date,
          startTime: new Date(record.time_in).getTime(),
          endTime: new Date(record.time_out).getTime(),
          durationSeconds: record.total_minutes ? record.total_minutes * 60 : 0,
          status: 'COMPLETED' as const,
          comment: record.overtime_comment || undefined,
        }));

        setWorkLogs(logs);
        console.log('Fetched attendance records:', logs);
      }
    } catch (error: any) {
      console.error('Error fetching attendance records:', error);
      showToast('error', 'Failed to load attendance history');
    } finally {
      setIsFetchingLogs(false);
    }
  };

  // Fetch current session data
  const fetchCurrentSession = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/attendance/current-session?userId=${user.id}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch current session');
      }

      if (data.session) {
        console.log('Current session data:', data.session);
        console.log('Duration (minutes):', data.session.duration_minutes);
        console.log('Clock in:', data.session.clock_in);
        console.log('Session end:', data.session.session_end);
        console.log('Has clocked out:', data.session.has_clocked_out);
        console.log('Clock in location:', data.session.clock_in_location);
        if (data.session.clock_out_location) {
          console.log('Clock out location:', data.session.clock_out_location);
        }
        return data.session;
      } else {
        console.log('No active session found');
        return null;
      }
    } catch (error: any) {
      console.error('Error fetching current session:', error);
      return null;
    }
  };

  // Toast notification helpers
  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: ToastProps = {
      id,
      type,
      message,
      onClose: removeToast,
    };
    setToasts((prev) => [...prev, newToast]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // If user is not logged in or still loading, show a loading state or redirect
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-200 flex flex-col items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
            <svg 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="w-8 h-8 text-white animate-pulse"
            >
               <path d="M2.5 18L12 2.5L21.5 18H2.5Z" />
               <path d="M12 2.5V18" />
               <path d="M7 18L12 10" />
               <path d="M17 18L12 10" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Cerventech<span className="text-blue-500">.HR</span>
          </h1>
        </div>
        <div className="mt-4 text-xl font-medium animate-text-glow">Loading...</div>
      </div>
    );
  }

  // Redirect to login if no authenticated user
  if (!user) {
    router.push('/auth/login');
    return null;
  }

  // Helper function to get user location
  const getUserLocation = (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  };

  // Helper function to reverse geocode (convert lat/lng to address)
  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<string | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'CerventechHR/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch address');
      }

      const data = await response.json();
      return data.display_name || null;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return null;
    }
  };

  // Wrapper functions that show confirmation modals
  const requestClockIn = () => {
    setConfirmAction('clockIn');
    setShowConfirmModal(true);
  };

  const requestClockOut = (duration: number, comment?: string) => {
    setPendingClockOutData({ duration, comment });
    setConfirmAction('clockOut');
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    if (confirmAction === 'clockIn') {
      handleClockIn();
    } else if (confirmAction === 'clockOut' && pendingClockOutData) {
      handleClockOut(pendingClockOutData.duration, pendingClockOutData.comment);
      setPendingClockOutData(null);
    }
    setShowConfirmModal(false);
    setConfirmAction(null);
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
    setConfirmAction(null);
    setPendingClockOutData(null);
  };

  const handleClockIn = async () => {
    if (!user?.id || isClocking) return;

    setIsClocking(true);
    try {
      // Get user location
      let location = null;
      let address = null;
      try {
        location = await getUserLocation();
        console.log('Clock-in location:', location);

        // Get readable address from coordinates
        if (location) {
          address = await getAddressFromCoords(location.latitude, location.longitude);
          console.log('Clock-in address:', address);
        }
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
        showToast('warning', 'Location access denied. Clocking in without location data.');
        // Continue without location if user denies permission
      }

      // Call clock-in API
      const response = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock in');
      }

      console.log('Clock-in successful:', data);

      // Update local state
      const now = Date.now();
      const todayStr = new Date(now).toISOString().split('T')[0];

      const newLog: WorkLog = {
        id: data.attendance.id,
        date: todayStr,
        startTime: now,
        endTime: null,
        durationSeconds: 0,
        status: 'IN_PROGRESS'
      };

      setActiveLog(newLog);
      showToast('success', 'Successfully clocked in!');

      // Fetch current session data to show in console
      setTimeout(() => {
        fetchCurrentSession();
      }, 500);
    } catch (error: any) {
      console.error('Clock-in error:', error);
      showToast('error', error.message || 'Failed to clock in. Please try again.');
    } finally {
      setIsClocking(false);
    }
  };

  const handleClockOut = async (finalDurationSeconds: number, comment?: string) => {
    if (!activeLog || !user?.id || isClocking) return;

    setIsClocking(true);
    try {
      // Get user location
      let location = null;
      let address = null;
      try {
        location = await getUserLocation();
        console.log('Clock-out location:', location);

        // Get readable address from coordinates
        if (location) {
          address = await getAddressFromCoords(location.latitude, location.longitude);
          console.log('Clock-out address:', address);
        }
      } catch (locationError) {
        console.warn('Could not get location:', locationError);
        showToast('warning', 'Location access denied. Clocking out without location data.');
        // Continue without location if user denies permission
      }

      // Call clock-out API
      const response = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: location?.latitude,
          longitude: location?.longitude,
          address: address,
          overtimeComment: comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to clock out');
      }

      console.log('Clock-out successful:', data);

      // Update local state
      const now = Date.now();
      const completedLog: WorkLog = {
        ...activeLog,
        endTime: now,
        durationSeconds: finalDurationSeconds,
        status: 'COMPLETED',
        comment: comment,
      };

      setWorkLogs(prev => [...prev, completedLog]);
      setActiveLog(null);

      const message = comment
        ? 'Successfully clocked out with overtime request!'
        : 'Successfully clocked out!';
      showToast('success', message);

      // Refresh attendance records from database
      fetchAttendanceRecords();
    } catch (error: any) {
      console.error('Clock-out error:', error);
      showToast('error', error.message || 'Failed to clock out. Please try again.');
    } finally {
      setIsClocking(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-slate-200 pb-20">
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title={confirmAction === 'clockIn' ? 'Clock In' : 'Clock Out'}
        message={
          confirmAction === 'clockIn'
            ? 'Are you ready to start your work session?'
            : 'Are you sure you want to end your work session?'
        }
        confirmText={confirmAction === 'clockIn' ? 'Start Work' : 'End Work'}
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        type={confirmAction === 'clockIn' ? 'info' : 'warning'}
      />

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-gradient-to-r from-slate-950/80 via-blue-950/80 to-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              {/* Pyramid Logo */}
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="w-5 h-5 text-white mb-0.5"
                >
                   <path d="M2.5 18L12 2.5L21.5 18H2.5Z" />
                   <path d="M12 2.5V18" />
                   <path d="M7 18L12 10" />
                   <path d="M17 18L12 10" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Cerventech<span className="text-blue-500">.HR</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="hidden md:block text-sm text-slate-500 border-r border-slate-700 pr-4">
                Employee Portal v1.0
                </div>
                <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Log Out
                </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Top Row: Profile & Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <ProfileHeader user={user} />
          </div>
          <div className="lg:col-span-2">
            <TimeTracker
              onClockIn={requestClockIn}
              onClockOut={requestClockOut}
              activeLog={activeLog}
              isLoading={isClocking}
            />
          </div>
        </div>

        <div>
          <CalendarView logs={workLogs} />
        </div>
      </main>
    </div>
  );
};

export default EmployeeDashboard;