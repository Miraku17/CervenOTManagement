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
    let mounted = true;

    const fetchUserProfile = async (authUser: User): Promise<UserProfile> => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, positions(name)')
          .eq('id', authUser.id)
          .single();

        if (error) {
          console.warn('[useUser] Profile fetch error:', error.message);
          return { ...authUser };
        }

        return { ...authUser, ...profile };
      } catch (err) {
        console.error('[useUser] Unexpected error fetching profile:', err);
        return { ...authUser };
      }
    };

    // Initialize auth state
    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!mounted) return;

      if (authUser) {
        const userProfile = await fetchUserProfile(authUser);
        if (mounted) {
          setUser(userProfile);
          setLoading(false);
        }
      } else {
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      console.log('[useUser] Auth event:', event);

      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED':
          if (session?.user) {
            const userProfile = await fetchUserProfile(session.user);
            setUser(userProfile);
          }
          setLoading(false);
          break;

        case 'SIGNED_OUT':
          setUser(null);
          setLoading(false);
          break;

        case 'PASSWORD_RECOVERY':
          setUser(null);
          setLoading(false);
          break;

        default:
          if (!session) {
            setUser(null);
            setLoading(false);
          }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};
