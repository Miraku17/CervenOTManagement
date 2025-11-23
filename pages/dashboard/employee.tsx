import React, { useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Clock, BarChart2, Zap } from 'lucide-react';
import Silk from '@/components/react_bits/Silk';
import { useUser } from '@/hooks/useUser';
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

  useEffect(() => {
    if (!loading && user) {
      if (user.role === 'admin') {
        router.replace('/admin/dashboard');
      } else {
        router.replace('/dashboard/employee');
      }
    }
  }, [user, loading, router]);

  // Render a loading state or the landing page
  if (loading || user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-slate-950 text-white overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Silk speed={1} scale={1.5} color="#1e40af" noiseIntensity={0.8} rotation={0.2} />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-20">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-600/20">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-white mb-0.5">
                   <path d="M2.5 18L12 2.5L21.5 18H2.5Z" />
                   <path d="M12 2.5V18" />
                   <path d="M7 18L12 10" />
                   <path d="M17 18L12 10" />
                </svg>
              </div>
              <span className="text-xl font-bold tracking-tight">Cerventech.HR</span>
            </div>
            <Link 
              href="/login"
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-colors"
            >
              <LogIn size={18} />
              Login
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen text-center px-4">
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-blue-200">
          Effortless Time & Attendance
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Streamline your workforce management with our intuitive time tracking, overtime management, and powerful analytics.
        </p>
        <Link 
          href="/login"
          className="mt-8 bg-blue-500 hover:bg-blue-400 text-white font-bold py-3 px-8 rounded-full text-lg transition-transform transform hover:scale-105"
        >
          Get Started
        </Link>
      </main>

      {/* Features Section */}
      <section className="relative z-10 bg-slate-900/50 backdrop-blur-md py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Everything You Need to Manage Your Team</h2>
            <p className="mt-2 text-slate-400">Powerful features for modern workforce management.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Clock size={28} className="text-blue-400" />}
              title="Seamless Time Tracking"
              description="Employees can clock in and out with a single click, providing accurate and reliable timesheets."
            />
            <FeatureCard
              icon={<BarChart2 size={28} className="text-blue-400" />}
              title="Overtime Management"
              description="Easily manage and approve overtime with our integrated comment and approval system."
            />
            <FeatureCard
              icon={<Zap size={28} className="text-blue-400" />}
              title="AI-Powered Insights"
              description="Leverage the power of Gemini to get intelligent insights into your team's productivity patterns."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 py-8 text-center text-slate-400">
        <p>&copy; {new Date().getFullYear()} Cerventech.HR. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default withAuth(EmployeeDashboard);