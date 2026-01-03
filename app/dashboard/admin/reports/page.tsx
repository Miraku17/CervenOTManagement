'use client';

import { useState, useEffect } from 'react';
import ExportDataView from '@/components/admin_dashboard/ExportDataView';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  const isLoading = authLoading || permissionsLoading;

  useEffect(() => {
    const fetchEmployees = async () => {
      if (isLoading || !user?.id) return;

      // Only fetch if user has permission
      if (!hasPermission('view_reports')) return;

      setIsLoadingEmployees(true);
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
        console.error('Error:', error);
      } finally {
        setIsLoadingEmployees(false);
      }
    };

    fetchEmployees();
  }, [user?.id, isLoading, hasPermission]);

  // Show loading state while checking permissions
  if (isLoading || isLoadingEmployees) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">
            {isLoadingEmployees ? 'Loading employees...' : 'Checking permissions...'}
          </p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('view_reports');
  const canExport = hasPermission('export_data');

  // Show access denied if no permission
  if (!hasAccess) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
              <ShieldAlert size={32} className="text-red-500" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Access Denied</h2>
          <p className="text-slate-300 mb-2">
            You don't have permission to view reports.
          </p>
          <p className="text-sm text-slate-400 mt-4">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <ExportDataView employees={employees} canExport={canExport} />;
}
