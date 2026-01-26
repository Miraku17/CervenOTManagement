'use client';

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Calendar,
  FileUp,
  Ticket,
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  Wallet,
  Receipt
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout, isLoggingOut, user } = useAuth();
  const { hasPermission } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(true);

  // Check if user is admin, redirect if not
  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user?.id) {
        setIsLoadingPosition(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, positions(name)')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard/employee');
        return;
      }

      setUserPosition((profile?.positions as any)?.name || null);
      setIsLoadingPosition(false);
    };

    checkAdminAccess();
  }, [user?.id, router]);

  // Check if user has access to overtime requests
  const hasOvertimeAccess = () => {
    return hasPermission('view_overtime');
  };

  // Check if user has access to edit time
  const hasEditTimeAccess = () => {
    return hasPermission('edit_time_entries');
  };

  // Check if user has access to leave requests
  const hasLeaveRequestsAccess = () => {
    return hasPermission('view_leave');
  };

  // Check if user has access to import schedule
  const hasImportScheduleAccess = () => {
    return hasPermission('import_schedule');
  };

  // Check if user has access to reports
  const hasReportsAccess = () => {
    return hasPermission('view_reports');
  };

  // Check if user has access to cash flow
  const hasCashFlowAccess = () => {
    return hasPermission('manage_cash_flow');
  };

  // Check if user has access to liquidation management
  const hasLiquidationAccess = () => {
    return hasPermission('manage_liquidation');
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
    if (pathname.startsWith('/dashboard/admin/holidays')) return 'Holidays';
    if (pathname.startsWith('/dashboard/admin/cash-flow-requests')) return 'Cash Advance Requests';
    if (pathname.startsWith('/dashboard/admin/liquidation-requests')) return 'Liquidation Requests';
    if (pathname.startsWith('/dashboard/knowledge-base')) return 'Knowledge Base';

    return 'Dashboard';
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside 
        className={`hidden md:flex flex-col bg-slate-900 border-slate-800 transition-all duration-300 relative ${
          isSidebarOpen ? 'w-56 border-r' : 'w-20 border-r'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 shadow-md z-10 hover:bg-slate-700 transition-colors"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className={`p-4 flex items-center ${isSidebarOpen ? 'gap-3' : 'justify-center'} border-b border-slate-800/50 min-h-[65px]`}>
          <img
            src="/cerventech.png"
            alt="Cerventech Logo"
            className="w-8 h-8 rounded-full object-cover shadow-lg border-2 border-gray-300"
          />
          <h1 className={`text-lg font-bold tracking-tight text-white transition-opacity duration-200 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            Cerventech Inc.
          </h1>
        </div>

          <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar space-y-6">
          {/* Overview Section */}
          <div>
            <SidebarLabel isOpen={isSidebarOpen}>Overview</SidebarLabel>
            <div className="space-y-1">
              <SidebarItem
                icon={<LayoutDashboard size={18} />}
                label="Dashboard"
                isActive={isActive('/dashboard/admin')}
                onClick={() => handleNavigate('/dashboard/admin')}
                isOpen={isSidebarOpen}
              />
            </div>
          </div>

          {/* Workforce Section */}
          <div>
            <SidebarLabel isOpen={isSidebarOpen}>Workforce</SidebarLabel>
            <div className="space-y-1">
              <SidebarItem
                icon={<Users size={18} />}
                label="Employees"
                isActive={isActive('/dashboard/admin/employees')}
                onClick={() => handleNavigate('/dashboard/admin/employees')}
                isOpen={isSidebarOpen}
              />
              {hasPermission('view_all_schedules') && (
                <SidebarItem
                  icon={<Calendar size={18} />}
                  label="Employee Schedule"
                  isActive={isActive('/dashboard/admin/employee-schedule')}
                  onClick={() => handleNavigate('/dashboard/admin/employee-schedule')}
                  isOpen={isSidebarOpen}
                />
              )}
              {hasImportScheduleAccess() && (
                <SidebarItem
                  icon={<FileUp size={18} />}
                  label="Import Schedule"
                  isActive={isActive('/dashboard/admin/import-schedule')}
                  onClick={() => handleNavigate('/dashboard/admin/import-schedule')}
                  isOpen={isSidebarOpen}
                />
              )}
              {hasEditTimeAccess() && (
                <SidebarItem
                  icon={<Users size={18} />}
                  label="Edit Time"
                  isActive={isActive('/dashboard/admin/edit-time')}
                  onClick={() => handleNavigate('/dashboard/admin/edit-time')}
                  isOpen={isSidebarOpen}
                />
              )}
              {hasEditTimeAccess() && (
                <SidebarItem
                  icon={<AlertTriangle size={18} />}
                  label="Stale Sessions"
                  isActive={isActive('/dashboard/admin/stale-sessions')}
                  onClick={() => handleNavigate('/dashboard/admin/stale-sessions')}
                  isOpen={isSidebarOpen}
                />
              )}
            </div>
          </div>

          {/* Requests Section */}
          {(hasLeaveRequestsAccess() || hasOvertimeAccess() || hasCashFlowAccess() || hasLiquidationAccess()) && (
            <div>
              <SidebarLabel isOpen={isSidebarOpen}>Requests</SidebarLabel>
              <div className="space-y-1">
                {hasLeaveRequestsAccess() && (
                  <SidebarItem
                    icon={<Calendar size={18} />}
                    label="Leave Requests"
                    isActive={isActive('/dashboard/admin/leave-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/leave-requests')}
                    isOpen={isSidebarOpen}
                  />
                )}
                {hasOvertimeAccess() && (
                  <SidebarItem
                    icon={<FileText size={18} />}
                    label="Overtime Requests"
                    isActive={isActive('/dashboard/admin/overtime-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/overtime-requests')}
                    isOpen={isSidebarOpen}
                  />
                )}
                {hasCashFlowAccess() && (
                  <SidebarItem
                    icon={<Wallet size={18} />}
                    label="Cash Advance"
                    isActive={isActive('/dashboard/admin/cash-flow-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/cash-flow-requests')}
                    isOpen={isSidebarOpen}
                  />
                )}
                {hasLiquidationAccess() && (
                  <SidebarItem
                    icon={<Receipt size={18} />}
                    label="Liquidations"
                    isActive={isActive('/dashboard/admin/liquidation-requests')}
                    onClick={() => handleNavigate('/dashboard/admin/liquidation-requests')}
                    isOpen={isSidebarOpen}
                  />
                )}
              </div>
            </div>
          )}

          {/* System Section */}
          <div>
            <SidebarLabel isOpen={isSidebarOpen}>System</SidebarLabel>
            <div className="space-y-1">
              {hasReportsAccess() && (
                <SidebarItem
                  icon={<Settings size={18} />}
                  label="Reports"
                  isActive={isActive('/dashboard/admin/reports')}
                  onClick={() => handleNavigate('/dashboard/admin/reports')}
                  isOpen={isSidebarOpen}
                />
              )}
              {hasImportScheduleAccess() && (
                <SidebarItem
                  icon={<CalendarCheck size={18} />}
                  label="Holidays"
                  isActive={isActive('/dashboard/admin/holidays')}
                  onClick={() => handleNavigate('/dashboard/admin/holidays')}
                  isOpen={isSidebarOpen}
                />
              )}
              <SidebarItem
                icon={<BookOpen size={18} />}
                label="Knowledge Base"
                isActive={isActive('/dashboard/knowledge-base')}
                onClick={() => handleNavigate('/dashboard/knowledge-base')}
                isOpen={isSidebarOpen}
              />
            </div>
          </div>

          {/* Apps Section */}
          {!isLoadingPosition && userPosition !== null && hasPermission('manage_tickets') && (
            <div>
              <SidebarLabel isOpen={isSidebarOpen}>Apps</SidebarLabel>
              <div className="space-y-1">
                {userPosition.toLowerCase() === 'asset' || userPosition.toLowerCase() === 'assets' ? (
                  <SidebarItem
                    icon={<Ticket size={18} />}
                    label="Assets"
                    isActive={false}
                    onClick={() => router.push('/dashboard/ticketing/asset-inventory')}
                    isOpen={isSidebarOpen}
                  />
                ) : (
                  <SidebarItem
                    icon={<Ticket size={18} />}
                    label="Ticketing System"
                    isActive={false}
                    onClick={() => router.push('/dashboard/ticketing/tickets')}
                    isOpen={isSidebarOpen}
                  />
                )}
              </div>
            </div>
          )}
        </nav>

        <div className="p-3 border-t border-slate-800">
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className={`flex items-center ${isSidebarOpen ? 'gap-3 px-3' : 'justify-center px-0'} text-slate-400 hover:text-white w-full py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800`}
            title={!isSidebarOpen ? "Logout" : undefined}
          >
            {isLoggingOut ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span className={`text-sm font-medium ${!isSidebarOpen && 'hidden'}`}>Logging out...</span>
              </>
            ) : (
              <>
                <LogOut size={18} />
                <span className={`text-sm font-medium ${!isSidebarOpen && 'hidden'}`}>Logout</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 md:hidden flex flex-col">
          <div className="flex justify-between items-center p-4 mb-4 border-b border-slate-800">
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
          <nav className="space-y-4 flex-1 overflow-y-auto px-4">
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
            {hasImportScheduleAccess() && (
              <SidebarItem
                icon={<CalendarCheck size={24} />}
                label="Holidays"
                isActive={isActive('/dashboard/admin/holidays')}
                onClick={() => handleNavigate('/dashboard/admin/holidays')}
              />
            )}
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
            {hasCashFlowAccess() && (
              <SidebarItem
                icon={<Wallet size={24} />}
                label="Cash Advance"
                isActive={isActive('/dashboard/admin/cash-flow-requests')}
                onClick={() => handleNavigate('/dashboard/admin/cash-flow-requests')}
              />
            )}
            {hasLiquidationAccess() && (
              <SidebarItem
                icon={<Receipt size={24} />}
                label="Liquidations"
                isActive={isActive('/dashboard/admin/liquidation-requests')}
                onClick={() => handleNavigate('/dashboard/admin/liquidation-requests')}
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
            {hasPermission('view_all_schedules') && (
              <SidebarItem
                icon={<Calendar size={24} />}
                label="Employee Schedule"
                isActive={isActive('/dashboard/admin/employee-schedule')}
                onClick={() => handleNavigate('/dashboard/admin/employee-schedule')}
              />
            )}
            {!isLoadingPosition && userPosition !== null && hasPermission('manage_tickets') && (
              <>
                {userPosition.toLowerCase() === 'asset' || userPosition.toLowerCase() === 'assets' ? (
                  <SidebarItem
                    icon={<Ticket size={24} />}
                    label="Assets"
                    isActive={false}
                    onClick={() => {
                      router.push('/dashboard/ticketing/asset-inventory');
                      setIsMobileMenuOpen(false);
                    }}
                  />
                ) : (
                  <SidebarItem
                    icon={<Ticket size={24} />}
                    label="Ticketing"
                    isActive={false}
                    onClick={() => {
                      router.push('/dashboard/ticketing/tickets');
                      setIsMobileMenuOpen(false);
                    }}
                  />
                )}
              </>
            )}
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button
              onClick={logout}
              disabled={isLoggingOut}
              className="flex items-center gap-3 text-slate-400 hover:text-white w-full px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 hover:bg-slate-800"
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
const SidebarLabel: React.FC<{ children: React.ReactNode; isOpen: boolean }> = ({ children, isOpen }) => (
  <div className={`px-3 mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider ${!isOpen && 'hidden'}`}>
    {children}
  </div>
);

// Helper Component for Sidebar Items
const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  isOpen?: boolean;
}> = ({ icon, label, isActive, onClick, isOpen = true }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
      isActive
        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
    title={!isOpen ? label : undefined}
  >
    <span className={isActive ? "text-white" : "text-slate-400 group-hover:text-white transition-colors"}>
      {icon}
    </span>
    <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
      {label}
    </span>
  </button>
);
