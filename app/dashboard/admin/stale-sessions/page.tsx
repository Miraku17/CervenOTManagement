'use client';

import { useState, useEffect } from 'react';
import StaleSessionsView from '@/components/admin_dashboard/StaleSessionsView';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

export default function StaleSessionsPage() {
  const { user } = useAuth();
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPosition = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('positions(name)')
        .eq('id', user.id)
        .single();

      setUserPosition((profile?.positions as any)?.name || null);
      setLoading(false);
    };

    fetchUserPosition();
  }, [user?.id]);

  const hasEditTimeAccess = () => {
    return userPosition === 'Operations Manager';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasEditTimeAccess()) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to manage stale sessions.</p>
          </div>
        </div>
      </div>
    );
  }

  return <StaleSessionsView />;
}
