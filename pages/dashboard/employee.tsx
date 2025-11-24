import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { TimeTracker } from '@/components/TimeTracker';
import { CalendarView } from '@/components/CalendarView';
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

  useEffect(() => {
    const savedActiveLog = localStorage.getItem('cerventch_activelog');
    if (savedActiveLog) {
      setActiveLog(JSON.parse(savedActiveLog));
    }
  }, []);

  useEffect(() => {
    if (activeLog) {
      localStorage.setItem('cerventch_activelog', JSON.stringify(activeLog));
    } else {
      localStorage.removeItem('cerventch_activelog');
    }
  }, [activeLog]);

  // If user is not logged in or still loading, show a loading state or redirect
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0B1121] text-slate-200 flex flex-col items-center justify-center">
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

  const handleClockIn = () => {
    const now = Date.now();
    const todayStr = new Date(now).toISOString().split('T')[0];
    
    const newLog: WorkLog = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9),
      date: todayStr,
      startTime: now,
      endTime: null,
      durationSeconds: 0,
      status: 'IN_PROGRESS'
    };
    
    setActiveLog(newLog);
  };

  const handleClockOut = (finalDurationSeconds: number) => {
    if (!activeLog) return;
    
    const now = Date.now();
    const completedLog: WorkLog = {
      ...activeLog,
      endTime: now,
      durationSeconds: finalDurationSeconds,
      status: 'COMPLETED'
    };

    setWorkLogs(prev => [...prev, completedLog]);
    setActiveLog(null);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen bg-[#0B1121] text-slate-200 pb-20">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-[#0B1121]/80 backdrop-blur-md border-b border-slate-800">
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
              onClockIn={handleClockIn}
              onClockOut={handleClockOut}
              activeLog={activeLog}
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