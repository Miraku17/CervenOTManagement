import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { TimeTracker } from '@/components/TimeTracker';
import { CalendarView } from '@/components/CalendarView';
import { AIAnalyst } from '@/components/AIAnalyst';
import { UserProfile, WorkLog } from '@/types';
import { LogOut } from 'lucide-react';
import { withAuth } from '@/hoc/withAuth';
import { supabase } from '@/services/supabase';
import { useRouter } from 'next/router';

// Mock User Data
const MOCK_USER: UserProfile = {
  id: 'u-123',
  name: 'Alex Sterling',
  email: 'alex.sterling@cerventech.com',
  position: 'Senior Frontend Engineer',
  avatarUrl: 'https://picsum.photos/200/200',
  contactNumber: '+1 (555) 012-3456',
  address: '452 Innovation Blvd, Tech District, SF',
  department: 'Engineering'
};

// Helper to generate mock data for testing
const generateMockData = (): WorkLog[] => {
  const logs: WorkLog[] = [];
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    // Skip some days to simulate weekends or leaves, but keep it populated
    // 20% chance to skip a day
    if (Math.random() < 0.2) continue;

    const dateObj = new Date(year, month, day);
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    // On weekends, only work 30% of the time
    if (isWeekend && Math.random() > 0.3) continue;

    // Sometimes multiple sessions per day (10% chance)
    const sessions = Math.random() > 0.9 ? 2 : 1;

    for (let s = 0; s < sessions; s++) {
        // Random start time between 8 AM (8) and 6 PM (18)
        const startHour = 8 + Math.floor(Math.random() * 10); 
        const startMinute = Math.floor(Math.random() * 60);
        
        // Random duration between 2 hours and 6 hours
        const durationHours = 2 + Math.random() * 4;
        const durationSeconds = Math.floor(durationHours * 3600);
        
        const startTime = new Date(year, month, day, startHour, startMinute).getTime();
        const endTime = startTime + (durationSeconds * 1000);

        // Don't generate future logs
        if (startTime > Date.now()) continue;

        logs.push({
            id: `mock-${day}-${s}-${Math.random().toString(36).substr(2, 9)}`,
            date: dateObj.toISOString().split('T')[0],
            startTime: startTime,
            endTime: endTime,
            durationSeconds: durationSeconds,
            status: 'COMPLETED'
        });
    }
  }
  return logs.sort((a, b) => a.startTime - b.startTime);
};

const EmployeeDashboard: React.FC = () => {
  const router = useRouter();
  const [user] = useState<UserProfile>(MOCK_USER);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);

  const [activeLog, setActiveLog] = useState<WorkLog | null>(null);

  useEffect(() => {
    try {
      const savedLogs = localStorage.getItem('cerventch_worklogs');
      if (savedLogs) {
        const parsed = JSON.parse(savedLogs);
        setWorkLogs(parsed.length > 0 ? parsed : generateMockData());
      } else {
        setWorkLogs(generateMockData());
      }

      const savedActiveLog = localStorage.getItem('cerventch_activelog');
      if (savedActiveLog) {
        setActiveLog(JSON.parse(savedActiveLog));
      }
    } catch {
      setWorkLogs(generateMockData());
      setActiveLog(null);
    }
  }, []);

  // Persist logs
  useEffect(() => {
    localStorage.setItem('cerventch_worklogs', JSON.stringify(workLogs));
  }, [workLogs]);

  // Persist active session
  useEffect(() => {
    if (activeLog) {
      localStorage.setItem('cerventch_activelog', JSON.stringify(activeLog));
    } else {
      localStorage.removeItem('cerventch_activelog');
    }
  }, [activeLog]);

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

  const handleClockOut = (finalDurationSeconds: number, comment?: string) => {
    if (!activeLog) return;
    
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
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
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
                Employee Portal v2.1
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
          <div className="lg:col-span-2">
            <ProfileHeader user={user} />
          </div>
          <div className="lg:col-span-1">
            <TimeTracker 
              onClockIn={handleClockIn} 
              onClockOut={handleClockOut} 
              activeLog={activeLog} 
            />
          </div>
        </div>

        {/* Middle Row: AI & Quick Stats */}
        <div className="grid grid-cols-1">
             <AIAnalyst logs={workLogs} />
        </div>

        {/* Bottom Row: Calendar History */}
        <div>
          <CalendarView logs={workLogs} />
        </div>
        
      </main>
    </div>
  );
};

export default withAuth(EmployeeDashboard);