import React, { useState, useMemo, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  Bell, 
  Search,
  Menu,
  X
} from 'lucide-react';
import DashboardHome from '@/components/admin_dashboard/DashboardHome';
import { Employee, ViewState, WorkLog, Position } from '@/types';
import EmployeeManager from '@/components/admin_dashboard/EmployeeManager';
import EmployeeDetail from '@/components/admin_dashboard/EmployeeDetail';
import ExportDataView from '@/components/admin_dashboard/ExportDataView';
import EditTimeView from '@/components/admin_dashboard/EditTimeView';
import { withAuth } from '@/hoc/withAuth';
import { supabase } from '@/services/supabase';
import { useRouter } from 'next/router';





const AdminDashboard: React.FC = () => {
  const router = useRouter();
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [positions, setPositions] = useState<Position[]>([]);

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
    const { data, error } = await supabase
      .from('profiles')
      .select('*, positions(name)')
      .eq('role', 'employee');

    if (data) {
      const fetchedEmployees: Employee[] = data.map((profile: any) => ({
        id: profile.id,
        fullName: `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        contact_number: profile.contact_number || '',
        address: profile.address || '',
        position: profile.positions?.name || 'N/A',
        department: profile.department || 'N/A', // Assuming department exists or set a default
        joinDate: profile.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A',
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${profile.first_name}+${profile.last_name}`, // Static avatar
        status: 'Active', // Default status for now
      }));
      setEmployees(fetchedEmployees);
    }
    if (error) {
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

  const handleAddEmployee = async (newEmployee: Employee) => {
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

  const handleLogout = async () => {
    console.log('[Admin Dashboard] Logout clicked');

    if (isLoggingOut) {
      console.log('[Admin Dashboard] Already logging out, ignoring');
      return;
    }

    console.log('[Admin Dashboard] Setting isLoggingOut to true');
    setIsLoggingOut(true);

    try {
      // Try to sign out with a 2-second timeout
      console.log('[Admin Dashboard] Calling supabase.auth.signOut()...');

      const signOutPromise = supabase.auth.signOut({ scope: 'local' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SignOut timeout')), 2000)
      );

      try {
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('[Admin Dashboard] SignOut successful');
      } catch (error: any) {
        console.warn('[Admin Dashboard] SignOut timed out or failed:', error.message);
        // Continue anyway - we'll clear storage and redirect
      }

      // Clear local storage
      console.log('[Admin Dashboard] Clearing localStorage and sessionStorage');
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Always redirect to login
      console.log('[Admin Dashboard] Redirecting to login...');
      router.replace('/auth/login');
    } catch (error: any) {
      console.error('[Admin Dashboard] Unexpected logout error:', error);
      // Clear storage and redirect even on error
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      console.log('[Admin Dashboard] Forcing redirect after error...');
      router.replace('/auth/login');
    }
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
            icon={<Settings size={20} />} 
            label="Export" 
            isActive={currentView === 'EXPORT'} 
            onClick={() => handleNavigate('EXPORT')}
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Edit Time" 
            isActive={currentView === 'EDIT_TIME'}
            onClick={() => handleNavigate('EDIT_TIME')}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
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
           </nav>

           <div className="p-4 border-t border-slate-800 mt-auto">
              <button
                onClick={handleLogout}
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

export default withAuth(AdminDashboard, 'admin');