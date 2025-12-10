'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/services/supabase';
import { Loader2 } from 'lucide-react';

export default function TicketingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const redirectUser = async () => {
      if (loading) return;

      if (!user) {
        // Should be handled by middleware, but just in case
        router.push('/auth/login');
        return;
      }

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        const isAdmin = profile?.role === 'admin';
        const userPosition = (profile?.positions as any)?.name || null;
        const hasInventoryAccess = isAdmin && userPosition === 'Operations Manager';

        if (hasInventoryAccess) {
          router.push('/dashboard/ticketing/stores');
        } else {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error fetching role:', error);
        // Default to tickets if error
        router.push('/dashboard/ticketing/tickets');
      }
    };

    redirectUser();
  }, [router, user, loading]);

  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400">Redirecting...</p>
      </div>
    </div>
  );
}