import React, { useEffect } from 'react';
import Link from 'next/link';
import { LogIn, Clock, BarChart2, Zap } from 'lucide-react';
import Silk from '@/components/react_bits/Silk';
import { useUser } from '@/hooks/useUser';
import { useRouter } from 'next/router';

const LandingPage: React.FC = () => {
  const { user, loading } = useUser();
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

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
  <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 hover:border-blue-500/50 transition-all transform hover:-translate-y-1">
    <div className="mb-4 inline-block p-4 bg-slate-900 rounded-xl">{icon}</div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-slate-400">{description}</p>
  </div>
);

export default LandingPage;
