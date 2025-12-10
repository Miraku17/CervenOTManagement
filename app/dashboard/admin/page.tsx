'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Bell,
  Search,
  Menu,
  X,
  FileText,
  Calendar,
  FileUp,
  Ticket
} from 'lucide-react';
import DashboardHome from '@/components/admin_dashboard/DashboardHome';
import { Employee, ViewState, WorkLog, Position } from '@/types';
import EmployeeManager from '@/components/admin_dashboard/EmployeeManager';
import EmployeeDetail from '@/components/admin_dashboard/EmployeeDetail';
import ExportDataView from '@/components/admin_dashboard/ExportDataView';
import EditTimeView from '@/components/admin_dashboard/EditTimeView';
import OvertimeRequestsView from '@/components/admin_dashboard/OvertimeRequestsView';
import LeaveRequestsView from '@/components/admin_dashboard/LeaveRequestsView';
import ImportScheduleView from '@/components/admin_dashboard/ImportScheduleView';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

const AdminDashboard: React.FC = () => {
  const { logout, isLoggingOut, user } = useAuth();
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);
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

      // Set user position for access control
      setUserPosition((profile?.positions as any)?.name || null);
    };

    checkAdminAccess();
  }, [user?.id, router]);

  // Fetch positions
  useEffect(() => {
    const fetchPositions = async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (data) {
        setPositions(data);
      }
      if (error) {
        console.error('Error fetching positions:', error);
      }
    };
    fetchPositions();
  }, []);

  // Fetch employees
  const fetchEmployees = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        console.error('No active session');
        return;
      }

      const response = await fetch('/api/employees/get', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch employees');
      }

      const data = await response.json();
      setEmployees(data.employees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    if (view !== 'EMPLOYEE_DETAIL') {
      setSelectedEmployeeId(null);
    }
    setIsMobileMenuOpen(false);
  };

  const handleSelectEmployee = (id: string) => {
    setSelectedEmployeeId(id);
    setCurrentView('EMPLOYEE_DETAIL');
  };

  const handleAddEmployee = async () => {
    await fetchEmployees();
    setCurrentView('EMPLOYEES');
  };

  const handleDeleteEmployee = (employeeId: string) => {
    // Remove the employee from the state
    setEmployees(prev => prev.filter(e => e.id !== employeeId));

    // If the deleted employee was selected, go back to employees list
    if (selectedEmployeeId === employeeId) {
      setSelectedEmployeeId(null);
      setCurrentView('EMPLOYEES');
    }
  };

  const handleUpdateEmployee = (updatedEmployee: Employee) => {
    // Update the employee in the state
    setEmployees(prev => prev.map(e => e.id === updatedEmployee.id ? updatedEmployee : e));
  };

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

  const selectedEmployee = useMemo(() =>
    employees.find(e => e.id === selectedEmployeeId),
  [employees, selectedEmployeeId]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <img
            src="/cerventech.png"
            alt="Cerventech Logo"
            className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-gray-300"
          />
          <h1 className="text-xl font-bold tracking-tight text-white">Cerventech Inc.</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4">
          <SidebarItem
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
            isActive={currentView === 'DASHBOARD'}
            onClick={() => handleNavigate('DASHBOARD')}
          />
          <SidebarItem
            icon={<Users size={20} />}
            label="Employees"
            isActive={currentView === 'EMPLOYEES' || currentView === 'EMPLOYEE_DETAIL'}
            onClick={() => handleNavigate('EMPLOYEES')}
          />
          <SidebarItem
            icon={<Users size={20} />}
            label="Edit Time"
            isActive={currentView === 'EDIT_TIME'}
            onClick={() => handleNavigate('EDIT_TIME')}
          />
          {hasOvertimeAccess() && (
            <SidebarItem
              icon={<FileText size={20} />}
              label="Overtime Requests"
              isActive={currentView === 'OVERTIME_REQUESTS'}
              onClick={() => handleNavigate('OVERTIME_REQUESTS')}
            />
          )}
          <SidebarItem
            icon={<Calendar size={20} />}
            label="Leave Requests"
            isActive={currentView === 'LEAVE_REQUESTS'}
            onClick={() => handleNavigate('LEAVE_REQUESTS')}
          />
          <SidebarItem
            icon={<FileUp size={20} />}
            label="Import Schedule"
            isActive={currentView === 'IMPORT_SCHEDULE'}
            onClick={() => handleNavigate('IMPORT_SCHEDULE')}
          />
          <SidebarItem
            icon={<Ticket size={20} />}
            label="Ticketing"
            isActive={false} // Always false as it navigates away
            onClick={() => router.push('/dashboard/ticketing/stores')}
          />
            <SidebarItem
            icon={<Settings size={20} />}
            label="Reports"
            isActive={currentView === 'EXPORT'}
            onClick={() => handleNavigate('EXPORT')}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={logout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 text-slate-400 hover:text-white w-full px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoggingOut ? (
              <>
                <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                <span>Logging out...</span>
              </>
            ) : (
              <>
                <LogOut size={20} />
                <span>Logout</span>
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
                isActive={currentView === 'DASHBOARD'}
                onClick={() => handleNavigate('DASHBOARD')}
              />
              <SidebarItem
                icon={<Users size={24} />}
                label="Employees"
                isActive={currentView === 'EMPLOYEES'}
                onClick={() => handleNavigate('EMPLOYEES')}
              />
              <SidebarItem
                icon={<Settings size={24} />}
                label="Export"
                isActive={currentView === 'EXPORT'}
                onClick={() => handleNavigate('EXPORT')}
              />
              <SidebarItem
                icon={<Users size={24} />}
                label="Edit Time"
                isActive={currentView === 'EDIT_TIME'}
                onClick={() => handleNavigate('EDIT_TIME')}
              />
              {hasOvertimeAccess() && (
                <SidebarItem
                  icon={<FileText size={24} />}
                  label="Overtime Requests"
                  isActive={currentView === 'OVERTIME_REQUESTS'}
                  onClick={() => handleNavigate('OVERTIME_REQUESTS')}
                />
              )}
              <SidebarItem
                icon={<Calendar size={24} />}
                label="Leave Requests"
                isActive={currentView === 'LEAVE_REQUESTS'}
                onClick={() => handleNavigate('LEAVE_REQUESTS')}
              />
              <SidebarItem
                icon={<FileUp size={24} />}
                label="Import Schedule"
                isActive={currentView === 'IMPORT_SCHEDULE'}
                onClick={() => handleNavigate('IMPORT_SCHEDULE')}
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
              {currentView === 'EMPLOYEE_DETAIL' ? 'Employee Profile' : currentView.replace('_', ' ').toLowerCase()}
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
            {currentView === 'DASHBOARD' && (
              <DashboardHome employees={employees} />
            )}

            {currentView === 'EMPLOYEES' && (
              <EmployeeManager
                employees={employees}
                onSelectEmployee={handleSelectEmployee}
                onAddEmployee={handleAddEmployee}
                onDeleteEmployee={handleDeleteEmployee}
                positions={positions}
              />
            )}

            {currentView === 'EMPLOYEE_DETAIL' && selectedEmployee && (
              <EmployeeDetail
                employee={selectedEmployee}
                onBack={() => handleNavigate('EMPLOYEES')}
                onUpdate={handleUpdateEmployee}
              />
            )}

            {currentView === 'EXPORT' && (
              <ExportDataView employees={employees} />
            )}

            {currentView === 'EDIT_TIME' && (
              <EditTimeView employees={employees} />
            )}

            {currentView === 'OVERTIME_REQUESTS' && (
              hasOvertimeAccess() ? (
                <OvertimeRequestsView />
              ) : (
                <div className="p-6 flex items-center justify-center min-h-[400px]">
                  <div className="text-center space-y-4">
                    <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                      <X className="w-8 h-8 text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
                      <p className="text-slate-400">You don't have permission to view overtime requests.</p>
                      <p className="text-slate-500 text-sm mt-2">Only authorized positions can access this feature.</p>
                    </div>
                  </div>
                </div>
              )
            )}

            {currentView === 'LEAVE_REQUESTS' && (
              <LeaveRequestsView />
            )}

            {currentView === 'IMPORT_SCHEDULE' && (
              <ImportScheduleView />
            )}

          </div>
        </div>
      </main>
    </div>
  );
};

// Helper Component for Sidebar Items
const SidebarItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
      isActive
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

export default AdminDashboard;
