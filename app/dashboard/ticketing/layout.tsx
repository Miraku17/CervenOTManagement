'use client';

import React, { useState, useEffect } from 'react';
import { Store, LayoutDashboard, LogOut, Menu, Package, Monitor, FileText, X, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function TicketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoggingOut, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [isLoadingRole, setIsLoadingRole] = useState(true);

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

  const handleNavigate = (path: string) => {
    router.push(path);
    setIsMobileMenuOpen(false);
  };

  // Check if user has access to stores section
  // Stores: ONLY admin role (no position requirement)
  const hasStoresAccess = isAdmin;

  // Check if user has access to inventory sections (store inventory & asset inventory)
  // Inventory: admin OR employee role (basically everyone)
  const hasInventoryAccess = isAdmin || user !== null; // Everyone who is logged in

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center gap-3">
        <img
          src="/cerventech.png"
          alt="Cerventech Logo"
          className="w-10 h-10 rounded-full object-cover shadow-lg border-2 border-gray-300"
        />
        <h1 className="text-xl font-bold tracking-tight text-white">Cerventech Ticketing</h1>
      </div>

      <nav className="flex-1 px-4 space-y-2 py-4">
        {isAdmin ? (
          <button
            onClick={() => handleNavigate('/dashboard/admin')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Back to Admin</span>
          </button>
        ) : (
          <button
            onClick={() => handleNavigate('/dashboard/employee')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </button>
        )}

        {isAdmin && (
          <button
            onClick={() => handleNavigate('/dashboard/ticketing/overview')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              pathname === '/dashboard/ticketing/overview'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Overview</span>
          </button>
        )}

        {hasStoresAccess && (
          <button
            onClick={() => handleNavigate('/dashboard/ticketing/stores')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
              pathname === '/dashboard/ticketing/stores'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Store size={20} />
            <span className="font-medium">Stores</span>
          </button>
        )}

        {hasInventoryAccess && (
          <>
            <button
              onClick={() => handleNavigate('/dashboard/ticketing/store-inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                pathname === '/dashboard/ticketing/store-inventory'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Package size={20} />
              <span className="font-medium">Store Inventory</span>
            </button>

            <button
              onClick={() => handleNavigate('/dashboard/ticketing/asset-inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                pathname === '/dashboard/ticketing/asset-inventory'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Monitor size={20} />
              <span className="font-medium">Asset Inventory</span>
            </button>
          </>
        )}



        <button
          onClick={() => handleNavigate('/dashboard/ticketing/tickets')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
            pathname === '/dashboard/ticketing/tickets'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
              : 'text-slate-400 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <FileText size={20} />
          <span className="font-medium">Tickets</span>
        </button>
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
    </>
  );

  // Show loading state while fetching user info
  if (authLoading || isLoadingRole) {
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
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 border-r border-slate-800">
        <SidebarContent />
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
