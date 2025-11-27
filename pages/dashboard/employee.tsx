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
import { withAuth } from '@/hoc/withAuth';

const EmployeeDashboard: React.FC = () => {
  const { user } = useUser();
  const router = useRouter();
  const [activeLog, setActiveLog] = useState<WorkLog | null>(null);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [isClocking, setIsClocking] = useState(false);
  const [toasts, setToasts] = useState<ToastProps[]>([]);
  const [isFetchingLogs, setIsFetchingLogs] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clockIn' | 'clockOut' | null>(null);
  const [pendingClockOutData, setPendingClockOutData] = useState<{ duration: number; comment?: string } | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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

  // Initialize session and location on mount
  useEffect(() => {
    if (user?.id) {
      checkActiveSession();
      requestLocationOnMount();
    }
  }, [user?.id]);

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
          clockInAddress: record.clock_in_address,
          clockOutAddress: record.clock_out_address,
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

  // Request location (used both on mount and for manual refresh)
  const requestLocation = async (showSuccessToast = true, retryCount = 0) => {
    if (isRequestingLocation) return;

    setIsRequestingLocation(true);
    setLocationError(null);

    try {
      let location = null;

      try {
        // Try high accuracy first
        location = await getUserLocation(true);
      } catch (err: any) {
        console.log('Location error:', err, 'Code:', err.code);

        // Error code 0 = kCLErrorLocationUnknown - location currently unknown but may become available
        if (err.code === 0 && retryCount < 2) {
          console.log(`Location unknown (attempt ${retryCount + 1}/3), retrying in 2 seconds...`);
          setIsRequestingLocation(false);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return requestLocation(showSuccessToast, retryCount + 1);
        } else if (err.code === 2) { // Position unavailable
          console.log('High accuracy position unavailable, trying low accuracy (network-based)...');
          try {
            location = await getUserLocation(false);
          } catch (lowAccErr: any) {
            console.log('Low accuracy also failed:', lowAccErr);
            throw err; // Throw original error
          }
        } else if (err.code === 3) { // Timeout
          console.log('High accuracy location timed out, trying low accuracy...');
          location = await getUserLocation(false);
        } else {
          throw err;
        }
      }

      console.log('Location obtained:', location);
      setCurrentLocation(location);

      // Get readable address from coordinates
      if (location) {
        const address = await getAddressFromCoords(location.latitude, location.longitude);
        console.log('Address obtained:', address);
        setCurrentAddress(address);

        if (address) {
          if (showSuccessToast) {
            showToast('success', 'Location accessed successfully');
          }
        } else {
          setLocationError('Could not determine address');
          showToast('warning', 'Location obtained but address unavailable. You can refresh location later.');
        }
      }
    } catch (locationError: any) {
      console.warn('Could not get location:', locationError);
      let errorMessage = 'Location access is required for clocking in/out.';

      if (locationError.code === 0) {
        errorMessage = 'Location currently unavailable. Please try moving near a window or outside, then refresh.';
      } else if (locationError.code === 1) {
        errorMessage = 'Permission denied';
        showToast('error', 'Location permission denied. Click the refresh button after enabling location in your browser.');
        // Store that permission was denied so we can show special UI
        setLocationError('denied');
        setIsRequestingLocation(false);
        return;
      } else if (locationError.code === 2) {
        errorMessage = 'Position unavailable';
        showToast('error', 'Location services unavailable. Please check: 1) System location is enabled, 2) You have internet/WiFi, 3) Site uses HTTPS');
      } else if (locationError.code === 3) {
        errorMessage = 'Location request timed out. Please move to an area with better signal.';
      }

      setLocationError(errorMessage);
      showToast('error', errorMessage);
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // Request location when component mounts
  const requestLocationOnMount = async () => {
    await requestLocation(true);
  };

  // Helper function to get user location
  const getUserLocation = (highAccuracy = true): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      // Check if site is using HTTPS (required for geolocation)
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      console.log('Site secure context:', isSecure);
      console.log(`Requesting location with ${highAccuracy ? 'high' : 'low'} accuracy...`);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location position received:', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date(position.timestamp).toISOString()
          });
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', {
            message: error.message,
            code: error.code,
            PERMISSION_DENIED: error.PERMISSION_DENIED,
            POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
            TIMEOUT: error.TIMEOUT
          });
          reject(error);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 30000, // Increased from 20s to 30s
          maximumAge: 0, // Changed from 60000 to 0 to always get fresh location
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

    // Check if we have location data
    if (!currentLocation || !currentAddress) {
      showToast('error', 'Location not available. Please wait or refresh location.');
      setIsClocking(false);
      return;
    }

    setIsClocking(true);
    try {
      const location = currentLocation;
      const address = currentAddress;

      console.log('Clock-in location:', location);
      console.log('Clock-in address:', address);

      // Call clock-in API
      const response = await fetch('/api/attendance/clock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
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

    // Check if we have location data
    if (!currentLocation || !currentAddress) {
      showToast('error', 'Location not available. Please wait or refresh location.');
      setIsClocking(false);
      return;
    }

    setIsClocking(true);
    try {
      const location = currentLocation;
      const address = currentAddress;

      console.log('Clock-out location:', location);
      console.log('Clock-out address:', address);

      // Call clock-out API
      const response = await fetch('/api/attendance/clock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
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
    console.log('[Employee Dashboard] Logout clicked');

    if (isLoggingOut) {
      console.log('[Employee Dashboard] Already logging out, ignoring');
      return;
    }

    console.log('[Employee Dashboard] Setting isLoggingOut to true');
    setIsLoggingOut(true);

    try {
      // Sign out from Supabase FIRST
      console.log('[Employee Dashboard] Calling supabase.auth.signOut()...');
      const { error } = await supabase.auth.signOut({ scope: 'global' });

      if (error) {
        console.error('[Employee Dashboard] Logout error:', error);
      } else {
        console.log('[Employee Dashboard] SignOut successful');
      }

      // Clear app-specific local storage after sign out
      console.log('[Employee Dashboard] Clearing app-specific localStorage items');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cerventch_activelog');
        // Add any other app-specific keys you want to clear
      }

      // Redirect to login
      console.log('[Employee Dashboard] Redirecting to login...');
      router.replace('/auth/login');
    } catch (error: any) {
      console.error('[Employee Dashboard] Logout error:', error);
      // Clear storage and redirect even on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('cerventch_activelog');
      }
      router.replace('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
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
              {/* Cerventech Logo */}
              <div className="w-8 h-8 rounded-lg flex items-center justify-center">
                <img src="/cerventech.png" alt="Cerventech Logo" className="h-full w-full object-contain rounded-full border-2 border-gray-300" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">
                Cerventech<span className="text-blue-500"> INC</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="hidden md:block text-sm text-slate-500 border-r border-slate-700 pr-4">
                Employee Portal v1.0
                </div>
                <button
                    onClick={handleLogout}
                    disabled={isLoggingOut}
                    className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoggingOut ? (
                      <>
                        <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                        <span>Logging out...</span>
                      </>
                    ) : (
                      <>
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </>
                    )}
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
              locationStatus={{
                hasLocation: !!currentLocation && !!currentAddress,
                isRequesting: isRequestingLocation,
                error: locationError,
                address: currentAddress,
              }}
              onRefreshLocation={() => requestLocation(true)}
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

export default withAuth(EmployeeDashboard, 'employee');