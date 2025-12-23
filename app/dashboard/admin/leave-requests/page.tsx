'use client';

import { useEffect, useState } from 'react';
import LeaveRequestsView from '@/components/admin_dashboard/LeaveRequestsView';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { ShieldAlert } from 'lucide-react';

export default function LeaveRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) {
        setHasAccess(false);
        setIsLoading(false);
        return;
      }

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('position_id, positions(name)')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Error fetching user position:', error);
          setHasAccess(false);
          setIsLoading(false);
          return;
        }

        const userPosition = profile?.positions && (profile.positions as any).name;
        const allowedPositions = ['Operations Manager', 'Technical Support Lead', 'Technical Support Engineer'];

        if (allowedPositions.includes(userPosition)) {
          setHasAccess(true);
        } else {
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [user?.id]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading...</p>
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
            Only users with the following positions can access leave requests:
          </p>
          <ul className="text-blue-400 font-medium space-y-1">
            <li>Operations Manager</li>
            <li>Technical Support Lead</li>
            <li>Technical Support Engineer</li>
          </ul>
          <p className="text-sm text-slate-400 mt-4">
            If you believe you should have access, please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  return <LeaveRequestsView />;
}
