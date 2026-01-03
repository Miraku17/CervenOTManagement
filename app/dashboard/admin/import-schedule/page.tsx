'use client';

import { useEffect, useState } from 'react';
import ImportScheduleView from '@/components/admin_dashboard/ImportScheduleView';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { ShieldAlert } from 'lucide-react';

export default function ImportSchedulePage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();

  const isLoading = authLoading || permissionsLoading;

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('import_schedule');

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
            You don't have permission to import schedules.
          </p>
          <p className="text-sm text-slate-400 mt-4">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <ImportScheduleView />;
}
