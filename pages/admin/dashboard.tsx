import React, { useState, useMemo } from 'react';
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
import { Employee, ViewState } from '@/types';
import EmployeeManager from '@/components/admin_dashboard/EmployeeManager';
import EmployeeDetail from '@/components/admin_dashboard/EmployeeDetail';
// Mock Data Initialization
const MOCK_EMPLOYEES: Employee[] = [
  {
    id: '1',
    fullName: 'Sarah Connor',
    email: 'sarah.connor@staffsync.com',
    phone: '+1 (555) 012-3456',
    address: '123 Tech Blvd, Cyberdyne City, CA',
    position: 'Senior Software Engineer',
    department: 'Engineering',
    joinDate: '2022-03-15',
    avatarUrl: 'https://picsum.photos/200/200?random=1',
    status: 'Active'
  },
  {
    id: '2',
    fullName: 'John Smith',
    email: 'john.smith@staffsync.com',
    phone: '+1 (555) 987-6543',
    address: '456 Innovation Way, Austin, TX',
    position: 'Product Manager',
    department: 'Product',
    joinDate: '2021-11-01',
    avatarUrl: 'https://picsum.photos/200/200?random=2',
    status: 'Active'
  },
  {
    id: '3',
    fullName: 'Emily Chen',
    email: 'emily.chen@staffsync.com',
    phone: '+1 (555) 456-7890',
    address: '789 Design Ln, New York, NY',
    position: 'UX Designer',
    department: 'Design',
    joinDate: '2023-01-10',
    avatarUrl: 'https://picsum.photos/200/200?random=3',
    status: 'On Leave'
  }
];

const AdminDashboard: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  const handleAddEmployee = (newEmployee: Employee) => {
    setEmployees(prev => [newEmployee, ...prev]);
    // Navigate to list or detail after adding
    setCurrentView('EMPLOYEES'); 
  };

  const selectedEmployee = useMemo(() => 
    employees.find(e => e.id === selectedEmployeeId), 
  [employees, selectedEmployeeId]);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
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
          <h1 className="text-xl font-bold tracking-tight text-white">Cerventech<span className="text-blue-500">.Admin</span></h1>
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
            label="Settings" 
            isActive={false} 
            onClick={() => {}}
          />
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center gap-3 text-slate-400 hover:text-white w-full px-4 py-2 rounded-lg transition-colors">
            <LogOut size={20} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/95 md:hidden flex flex-col p-4">
           <div className="flex justify-between items-center mb-8">
             <h1 className="text-xl font-bold text-white">Cerventech<span className="text-blue-500">.Admin</span></h1>
             <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400">
               <X size={24} />
             </button>
           </div>
           <nav className="space-y-4">
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
           </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-20">
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
            <button className="p-2 text-slate-400 hover:text-blue-400 transition-colors relative">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
              AD
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {currentView === 'DASHBOARD' && (
              <DashboardHome employees={employees} />
            )}
            
            {currentView === 'EMPLOYEES' && (
              <EmployeeManager 
                employees={employees} 
                onSelectEmployee={handleSelectEmployee}
                onAddEmployee={handleAddEmployee}
              />
            )}

            {currentView === 'EMPLOYEE_DETAIL' && selectedEmployee && (
              <EmployeeDetail 
                employee={selectedEmployee} 
                onBack={() => handleNavigate('EMPLOYEES')}
              />
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