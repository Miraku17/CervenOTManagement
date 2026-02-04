'use client';

import React, { useState, useEffect } from 'react';
import { Store, LayoutDashboard, LogOut, Menu, Package, Monitor, FileText, X, ArrowLeft, PieChart, History, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function TicketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoggingOut, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);
  const [hasAssetEditAccess, setHasAssetEditAccess] = useState(false);
  const [hasStoreInventoryEditAccess, setHasStoreInventoryEditAccess] = useState(false);

  useEffect(() => {
    const checkUserRole = async () => {
      if (!user?.id) return;

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user role:', error);
          return;
        }

        setIsAdmin(profile?.role === 'admin');
        setUserPosition((profile?.positions as any)?.name || null);
      } catch (error) {
        console.error('Error checking user role:', error);
      } finally {
        setIsLoadingRole(false);
      }
    };

    checkUserRole();
  }, [user?.id]);

  // Check if user has edit-only access to assets
  useEffect(() => {
    const checkAssetEditAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: editAccess } = await supabase
          .from('assets_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        setHasAssetEditAccess(editAccess?.can_edit === true);
      } catch (error) {
        // User not in assets_edit_access table, which is fine
        setHasAssetEditAccess(false);
      }
    };

    checkAssetEditAccess();
  }, [user?.id]);

  // Check if user has edit-only access to store inventory
  useEffect(() => {
    const checkStoreInventoryEditAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: editAccess } = await supabase
          .from('store_inventory_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        setHasStoreInventoryEditAccess(editAccess?.can_edit === true);
      } catch (error) {
        // User not in store_inventory_edit_access table, which is fine
        setHasStoreInventoryEditAccess(false);
      }
    };

    checkStoreInventoryEditAccess();
  }, [user?.id]);

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  // Check if user has access to stores section
  // Stores: Permission-based (all positions except HR and Accounting)
  const hasStoresAccess = hasPermission('view_stores');

  // Check if user has access to store inventory
  // Store Inventory: Permission-based access OR edit-only access from store_inventory_edit_access table
  const hasStoreInventoryAccess = hasPermission('manage_store_inventory') || hasStoreInventoryEditAccess;

  // Check if user has access to asset inventory
  // Asset Inventory: Permission-based access OR edit-only access from assets_edit_access table
  const hasAssetInventoryAccess = hasPermission('manage_assets') || hasAssetEditAccess;

  // Check if user has access to audit logs
  // Audit Logs: Permission-based access
  const hasAuditLogsAccess = hasPermission('view_audit_logs');

  // Check if user has access to tickets
  const hasTicketsAccess = hasPermission('manage_tickets');

  // Check if user has access to overview
  const hasOverviewAccess = hasPermission('view_ticket_overview');

  const SidebarContent = ({ isOpen = true }: { isOpen?: boolean }) => (
    <>
      <div className={`p-4 flex items-center ${isOpen ? 'gap-3' : 'justify-center'} border-b border-slate-800/50 min-h-[65px]`}>
        <img
          src="/cerventech.png"
          alt="Cerventech Logo"
          className="w-8 h-8 rounded-full object-cover shadow-lg border-2 border-gray-300"
        />
        <h1 className={`text-lg font-bold tracking-tight text-white transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
          Cerventech Ticketing
        </h1>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto custom-scrollbar space-y-6">
        {/* Navigation Section */}
        <div>
          <SidebarLabel isOpen={isOpen}>Navigation</SidebarLabel>
          <div className="space-y-1">
            {isAdmin ? (
              <button
                onClick={() => handleNavigate('/dashboard/admin')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white group`}
                title={!isOpen ? "Back to Admin" : undefined}
              >
                <LayoutDashboard size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Back to Admin
                </span>
              </button>
            ) : (
              <button
                onClick={() => handleNavigate('/dashboard/employee')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white group`}
                title={!isOpen ? "Back to Dashboard" : undefined}
              >
                <ArrowLeft size={18} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Back to Dashboard
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Analytics Section */}
        {hasOverviewAccess && (
          <div>
            <SidebarLabel isOpen={isOpen}>Analytics</SidebarLabel>
            <div className="space-y-1">
              <button
                onClick={() => handleNavigate('/dashboard/ticketing/overview')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                  pathname === '/dashboard/ticketing/overview'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={!isOpen ? "Dashboard" : undefined}
              >
                <LayoutDashboard size={18} className={pathname === '/dashboard/ticketing/overview' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Dashboard
                </span>
              </button>

              <button
                onClick={() => handleNavigate('/dashboard/ticketing/dashboard')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                  pathname === '/dashboard/ticketing/dashboard'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={!isOpen ? "Ticket Queue" : undefined}
              >
                <PieChart size={18} className={pathname === '/dashboard/ticketing/dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Ticket Queue
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Inventory Section */}
        {(hasStoresAccess || hasStoreInventoryAccess || hasAssetInventoryAccess) && (
          <div>
            <SidebarLabel isOpen={isOpen}>Inventory</SidebarLabel>
            <div className="space-y-1">
              {hasStoresAccess && (
                <button
                  onClick={() => handleNavigate('/dashboard/ticketing/stores')}
                  className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/ticketing/stores'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen ? "Stores" : undefined}
                >
                  <Store size={18} className={pathname === '/dashboard/ticketing/stores' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                  <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                    Stores
                  </span>
                </button>
              )}

              {hasStoreInventoryAccess && (
                <button
                  onClick={() => handleNavigate('/dashboard/ticketing/store-inventory')}
                  className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/ticketing/store-inventory'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen ? "Store Inventory" : undefined}
                >
                  <Package size={18} className={pathname === '/dashboard/ticketing/store-inventory' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                  <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                    Store Inventory
                  </span>
                </button>
              )}

              {hasAssetInventoryAccess && (
                <button
                  onClick={() => handleNavigate('/dashboard/ticketing/asset-inventory')}
                  className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/ticketing/asset-inventory'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen ? "Asset Inventory" : undefined}
                >
                  <Monitor size={18} className={pathname === '/dashboard/ticketing/asset-inventory' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                  <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                    Asset Inventory
                  </span>
                </button>
              )}

              {hasAssetInventoryAccess && (
                <button
                  onClick={() => handleNavigate('/dashboard/ticketing/defective-assets')}
                  className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                    pathname === '/dashboard/ticketing/defective-assets'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  title={!isOpen ? "Defective Assets" : undefined}
                >
                  <AlertTriangle size={18} className={pathname === '/dashboard/ticketing/defective-assets' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                  <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                    Defective Assets
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Work Section */}
        {hasTicketsAccess && (
          <div>
            <SidebarLabel isOpen={isOpen}>Work</SidebarLabel>
            <div className="space-y-1">
              <button
                onClick={() => handleNavigate('/dashboard/ticketing/tickets')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                  pathname === '/dashboard/ticketing/tickets'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={!isOpen ? "Tickets" : undefined}
              >
                <FileText size={18} className={pathname === '/dashboard/ticketing/tickets' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Tickets
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Management Section */}
        {hasAuditLogsAccess && (
          <div>
            <SidebarLabel isOpen={isOpen}>Management</SidebarLabel>
            <div className="space-y-1">
              <button
                onClick={() => handleNavigate('/dashboard/ticketing/audit-logs')}
                className={`w-full flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} py-2 rounded-lg transition-all duration-200 group ${
                  pathname === '/dashboard/ticketing/audit-logs'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
                title={!isOpen ? "Audit Logs" : undefined}
              >
                <History size={18} className={pathname === '/dashboard/ticketing/audit-logs' ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors'} />
                <span className={`font-medium text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${isOpen ? 'opacity-100 max-w-full' : 'opacity-0 max-w-0 hidden'}`}>
                  Audit Logs
                </span>
              </button>
            </div>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-slate-800">
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className={`flex items-center ${isOpen ? 'gap-3 px-3' : 'justify-center px-0'} text-slate-400 hover:text-white w-full py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800`}
          title={!isOpen ? "Logout" : undefined}
        >
          {isLoggingOut ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              <span className={`text-sm font-medium ${!isOpen && 'hidden'}`}>Logging out...</span>
            </>
          ) : (
            <>
              <LogOut size={18} />
              <span className={`text-sm font-medium ${!isOpen && 'hidden'}`}>Logout</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  // Show loading state while fetching user info
  if (authLoading || isLoadingRole || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <img
            src="/cerventech.png"
            alt="Cerventech Logo"
            className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-gray-300 animate-spin"
          />
          <p className="text-slate-400 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 border-b border-slate-800 flex items-center px-4 z-20">
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors mr-3"
        >
          <Menu size={24} />
        </button>
        <div className="flex items-center gap-3">
          <img
            src="/cerventech.png"
            alt="Cerventech Logo"
            className="w-8 h-8 rounded-full object-cover border border-gray-300"
          />
          <span className="font-bold text-white">Ticketing</span>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative w-64 h-full bg-slate-900 border-r border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
            <SidebarContent isOpen={true} />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside 
        className={`hidden md:flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300 relative ${
          isSidebarOpen ? 'w-56' : 'w-20'
        }`}
      >
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-1/2 transform -translate-y-1/2 bg-slate-800 border border-slate-700 text-slate-400 hover:text-white rounded-full p-1 shadow-md z-10 hover:bg-slate-700 transition-colors"
          title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
        <SidebarContent isOpen={isSidebarOpen} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative pt-16 md:pt-0">
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
