import { useState, useEffect } from 'react';
import { supabase } from '@/services/supabase';
import { User } from '@supabase/supabase-js';

interface UserProfile extends User {
  first_name?: string;
  last_name?: string;
  positions?: { name: string };
  contact_number?: string;
  address?: string;
  role?: string;
}

export const useUser = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const user = session.user;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, positions(name)')
          .eq('id', user.id)
          .single();
        
        setUser({ ...user, ...profile });
      }
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        const user = session.user;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, positions(name)')
          .eq('id', user.id)
          .single();

        setUser({ ...user, ...profile });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};
