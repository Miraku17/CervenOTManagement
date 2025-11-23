import React from 'react';
import { ProfileHeader } from '@/components/ProfileHeader';
import { TimeTracker } from '@/components/TimeTracker';
import { LogOut } from 'lucide-react';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/router';
import { supabase } from '@/services/supabase';



const EmployeeDashboard: React.FC = () => {
  const { user, loading } = useUser();
  const router = useRouter();

  // If user is not logged in or still loading, show a loading state or redirect
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#0B1121] text-slate-200 flex items-center justify-center">
        <div className="text-xl font-medium">Loading user data...</div>
      </div>
    );
  }

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
          <div className="lg:col-span-2">
            <ProfileHeader user={user} />
          </div>
          <div className="lg:col-span-1">
            <TimeTracker 
              onClockIn={() => {}} 
              onClockOut={() => {}} 
              activeLog={null} 
            />
          </div>
        </div>

      </main>
    </div>
  );
};

export default EmployeeDashboard;