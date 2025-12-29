'use client';

import { useState, useEffect } from 'react';
import ExportDataView from '@/components/admin_dashboard/ExportDataView';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccessAndFetchEmployees = async () => {
      // Wait for auth to complete before checking access
      if (authLoading) return;

      if (!user?.id) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        // Check access first
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('position_id, positions(name)')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user position:', profileError);
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        const userPosition = profile?.positions && (profile.positions as any).name;
        const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer', 'Help Desk Lead', 'Operations Technical Lead'];

        if (!allowedPositions.includes(userPosition)) {
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        setHasAccess(true);

        // If access granted, fetch employees
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.error('No active session');
          setIsLoading(false);
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
        setIsLoading(false);
      }
    };

    checkAccessAndFetchEmployees();
  }, [user?.id, authLoading]);

  if (authLoading || isLoading || hasAccess === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
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
            Only users with the following positions can access reports:
          </p>
          <ul className="text-blue-400 font-medium space-y-1">
            <li>Operations Manager</li>
            <li>Technical Support Lead</li>
            <li>Technical Support Engineer</li>
            <li>Help Desk Lead</li>
            <li>Operations Technical Lead</li>
          </ul>
          <p className="text-sm text-slate-400 mt-4">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <ExportDataView employees={employees} />;
}
