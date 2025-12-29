'use client';

import { useState, useEffect } from 'react';
import OvertimeRequestsView from '@/components/admin_dashboard/OvertimeRequestsView';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

export default function OvertimeRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);

  useEffect(() => {
    const fetchUserPosition = async () => {
      // Wait for auth to complete before checking access
      if (authLoading) return;

      if (!user?.id) {
        setUserPosition('');
        setIsCheckingAccess(false);
        return;
      }

      setIsCheckingAccess(true);
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('positions(name)')
          .eq('id', user.id)
          .single();

        setUserPosition((profile?.positions as any)?.name || '');
      } catch (error) {
        console.error('Error fetching user position:', error);
        setUserPosition('');
      } finally {
        setIsCheckingAccess(false);
      }
    };

    fetchUserPosition();
  }, [user?.id, authLoading]);

  const hasOvertimeAccess = () => {
    if (!userPosition) return false;
    const authorizedPositions = [
      'Admin Tech',
      'Technical Support Engineer',
      'Technical Support Lead',
      'Operations Technical Lead',
      'Operations Manager'
    ];
    return authorizedPositions.includes(userPosition);
  };

  if (authLoading || isCheckingAccess) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!hasOvertimeAccess()) {
    return (
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
    );
  }

  return <OvertimeRequestsView userPosition={userPosition} />;
}
