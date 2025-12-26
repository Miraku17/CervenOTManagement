'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  FileText,
  Calendar,
  FileUp,
  Ticket,
  AlertTriangle,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout, isLoggingOut, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);

  // Check if user is admin, redirect if not
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, positions(name)')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard/employee');
      }

      setUserPosition((profile?.positions as any)?.name || null);
    };

    checkAdminAccess();
  }, [user?.id, router]);

  // Check if user has access to overtime requests
  const hasOvertimeAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Admin Tech',
      'Technical Support Engineer',
      'Operations Technical Lead',
      'Operations Manager'
    ];
    return authorizedPositions.includes(userPosition);
  };

  // Check if user has access to edit time
  const hasEditTimeAccess = () => {
    return userPosition === 'Operations Manager';
  };

  // Check if user has access to leave requests
  const hasLeaveRequestsAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Operations Manager',
      'Technical Support Lead',
      'Technical Support Engineer'
    ];
    return authorizedPositions.includes(userPosition);
  };

  // Check if user has access to import schedule
  const hasImportScheduleAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Operations Manager',
      'Technical Support Lead',
      'Technical Support Engineer'
    ];
    return authorizedPositions.includes(userPosition);
  };

  // Check if user has access to reports
  const hasReportsAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Operations Manager',
      'Technical Support Lead',
      'Technical Support Engineer',
      'Help Desk Lead',
      'Operations Technical Lead'
    ];
    return authorizedPositions.includes(userPosition);
  };

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  const isActive = (path: string) => {
    if (!pathname) return false;
    if (path === '/dashboard/admin') {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  const getPageTitle = () => {
    if (!pathname) return 'Dashboard';

    if (pathname === '/dashboard/admin') return 'Dashboard';
    if (pathname.startsWith('/dashboard/admin/employees/')) return 'Employee Profile';
    if (pathname.startsWith('/dashboard/admin/employees')) return 'Employees';
    if (pathname.startsWith('/dashboard/admin/reports')) return 'Reports';
    if (pathname.startsWith('/dashboard/admin/edit-time')) return 'Edit Time';
    if (pathname.startsWith('/dashboard/admin/stale-sessions')) return 'Stale Sessions';
    if (pathname.startsWith('/dashboard/admin/overtime-requests')) return 'Overtime Requests';
    if (pathname.startsWith('/dashboard/admin/leave-requests')) return 'Leave Requests';
    if (pathname.startsWith('/dashboard/admin/import-schedule')) return 'Import Schedule';
    if (pathname.startsWith('/dashboard/admin/employee-schedule')) return 'Employee Schedule';
    if (pathname.startsWith('/dashboard/knowledge-base')) return 'Knowledge Base';

    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-56 bg-slate-900 border-r border-slate-800 transition-all duration-300">
        <div className="p-4 flex items-center gap-3 border-b border-slate-800/50">
          <img
            src="/cerventech.png"
            alt="Cerventech Logo"
            className="w-8 h-8 rounded-full object-cover shadow-lg border-2 border-gray-300"
          />
          <h1 className="text-lg font-bold tracking-tight text-white">Cerventech Inc.</h1>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar space-y-6">
          {/* Overview Section */}
          <div>
            <SidebarLabel>Overview</SidebarLabel>
            <div className="space-y-1">
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Dashboard"
                isActive={isActive('/dashboard/admin')}
                onClick={() => handleNavigate('/dashboard/admin')}
              />
            </div>
          </div>

          {/* Workforce Section */}
          <div>
            <SidebarLabel>Workforce</SidebarLabel>
            <div className="space-y-1">
              <SidebarItem
                icon={<Users size={18} />}
                label="Employees"
                isActive={isActive('/dashboard/admin/employees')}
                onClick={() => handleNavigate('/dashboard/admin/employees')}
              />
              <SidebarItem
                icon={<Calendar size={18} />}
                label="Employee Schedule"
                isActive={isActive('/dashboard/admin/employee-schedule')}
                onClick={() => handleNavigate('/dashboard/admin/employee-schedule')}
              />
              {hasImportScheduleAccess() && (
                <SidebarItem
                  icon={<FileUp size={18} />}
                  label="Import Schedule"
                  isActive={isActive('/dashboard/admin/import-schedule')}
                  onClick={() => handleNavigate('/dashboard/admin/import-schedule')}
                />
              )}
              {hasEditTimeAccess() && (
                <SidebarItem
                  icon={<Users size={18} />}
                  label="Edit Time"
                  isActive={isActive('/dashboard/admin/edit-time')}
                  onClick={() => handleNavigate('/dashboard/admin/edit-time')}
                />
              )}
              {hasEditTimeAccess() && (
                <SidebarItem
                  icon={<AlertTriangle size={18} />}
                  label="Stale Sessions"
                  isActive={isActive('/dashboard/admin/stale-sessions')}
                  onClick={() => handleNavigate('/dashboard/admin/stale-sessions')}
                />
              )}
            </div>
          </div>

          {/* Requests Section */}
          {(hasLeaveRequestsAccess() || hasOvertimeAccess()) && (
            <div>
              <SidebarLabel>Requests</SidebarLabel>
              <div className="space-y-1">
                {hasLeaveRequestsAccess() && (
                  <SidebarItem
                    icon={<Calendar size={18} />}
                    label="Leave Requests"
                    isActive={isActive('/dashboard/admin/leave-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/leave-requests')}
                  />
                )}
                {hasOvertimeAccess() && (
                  <SidebarItem
                    icon={<FileText size={18} />}
                    label="Overtime Requests"
                    isActive={isActive('/dashboard/admin/overtime-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/overtime-requests')}
                  />
                )}
              </div>
            </div>
          )}

          {/* System Section */}
          <div>
            <SidebarLabel>System</SidebarLabel>
            <div className="space-y-1">
              {hasReportsAccess() && (
                <SidebarItem
                  icon={<Settings size={18} />}
                  label="Reports"
                  isActive={isActive('/dashboard/admin/reports')}
                  onClick={() => handleNavigate('/dashboard/admin/reports')}
                />
              )}
              <SidebarItem
                icon={<BookOpen size={18} />}
                label="Knowledge Base"
                isActive={isActive('/dashboard/knowledge-base')}
                onClick={() => handleNavigate('/dashboard/knowledge-base')}
              />
            </div>
          </div>

          {/* Apps Section */}
          <div>
            <SidebarLabel>Apps</SidebarLabel>
            <div className="space-y-1">
              <SidebarItem
                icon={<Ticket size={18} />}
                label="Ticketing System"
                isActive={false}
                onClick={() => router.push('/dashboard/ticketing/stores')}
              />
            </div>
          </div>
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 text-slate-400 hover:text-white w-full px-3 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800"
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm font-medium">Logging out...</span>
              </>
            ) : (
              <>
                <LogOut size={18} />
                <span className="text-sm font-medium">Logout</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 md:hidden flex flex-col p-4">
          <div className="flex justify-between items-center mb-8">
            <div className="flex items-center gap-3">
              <img
                src="/cerventech.png"
                alt="Cerventech Logo"
                className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-gray-300"
              />
              <h1 className="text-xl font-bold text-white">Cerventech Inc.</h1>
            </div>
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400">
              <X size={24} />
            </button>
          </div>
          <nav className="space-y-4 flex-1">
            <SidebarItem
              icon={<LayoutDashboard size={24} />}
              label="Dashboard"
              isActive={isActive('/dashboard/admin')}
              onClick={() => handleNavigate('/dashboard/admin')}
            />
            <SidebarItem
              icon={<Users size={24} />}
              label="Employees"
              isActive={isActive('/dashboard/admin/employees')}
              onClick={() => handleNavigate('/dashboard/admin/employees')}
            />
            {hasReportsAccess() && (
              <SidebarItem
                icon={<Settings size={24} />}
                label="Reports"
                isActive={isActive('/dashboard/admin/reports')}
                onClick={() => handleNavigate('/dashboard/admin/reports')}
              />
            )}
            <SidebarItem
              icon={<BookOpen size={24} />}
              label="Knowledge Base"
              isActive={isActive('/dashboard/knowledge-base')}
              onClick={() => handleNavigate('/dashboard/knowledge-base')}
            />
            {hasEditTimeAccess() && (
              <SidebarItem
                icon={<Users size={24} />}
                label="Edit Time"
                isActive={isActive('/dashboard/admin/edit-time')}
                onClick={() => handleNavigate('/dashboard/admin/edit-time')}
              />
            )}
            {hasEditTimeAccess() && (
              <SidebarItem
                icon={<AlertTriangle size={24} />}
                label="Stale Sessions"
                isActive={isActive('/dashboard/admin/stale-sessions')}
                onClick={() => handleNavigate('/dashboard/admin/stale-sessions')}
              />
            )}
            {hasOvertimeAccess() && (
              <SidebarItem
                icon={<FileText size={24} />}
                label="Overtime Requests"
                isActive={isActive('/dashboard/admin/overtime-requests')}
                onClick={() => handleNavigate('/dashboard/admin/overtime-requests')}
              />
            )}
            {hasLeaveRequestsAccess() && (
              <SidebarItem
                icon={<Calendar size={24} />}
                label="Leave Requests"
                isActive={isActive('/dashboard/admin/leave-requests')}
                onClick={() => handleNavigate('/dashboard/admin/leave-requests')}
              />
            )}
            {hasImportScheduleAccess() && (
              <SidebarItem
                icon={<FileUp size={24} />}
                label="Import Schedule"
                isActive={isActive('/dashboard/admin/import-schedule')}
                onClick={() => handleNavigate('/dashboard/admin/import-schedule')}
              />
            )}
            <SidebarItem
              icon={<Calendar size={24} />}
              label="Employee Schedule"
              isActive={isActive('/dashboard/admin/employee-schedule')}
              onClick={() => handleNavigate('/dashboard/admin/employee-schedule')}
            />
            <SidebarItem
              icon={<Ticket size={24} />}
              label="Ticketing"
              isActive={false}
              onClick={() => router.push('/dashboard/ticketing')}
            />
          </nav>

          <div className="p-4 border-t border-slate-800 mt-auto">
            <button
              onClick={logout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 text-slate-400 hover:text-white w-full px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900"
            >
              {isLoggingOut ? (
                <>
                  <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  <span>Logging out...</span>
                </>
              ) : (
                <>
                  <LogOut size={24} />
                  <span>Logout</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button
              className="md:hidden p-2 text-slate-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h2 className="text-lg font-semibold text-white capitalize">
              {getPageTitle()}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard/employee')}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Users size={16} />
              <span className="hidden sm:inline">Employee View</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
              AD
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper Component for Sidebar Section Labels
const SidebarLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
    {children}
  </div>
);

// Helper Component for Sidebar Items
const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 group ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-white transition-colors"}>
      {icon}
    </span>
    <span className="font-medium text-sm">{label}</span>
  </button>
);
