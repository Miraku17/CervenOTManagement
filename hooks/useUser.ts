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

    const fetchUserProfile = async (authUser: User) => {
      console.log('[useUser] Fetching profile for user:', authUser.email);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*, positions(name)')
          .eq('id', authUser.id)
          .single();

        if (error) {
          console.error('[useUser] Error fetching user profile:', error);
          if (mounted) {
            console.log('[useUser] Setting user without profile data');
            setUser({ ...authUser });
          }
          return;
        }

        if (mounted) {
          console.log('[useUser] Profile fetched successfully. Role:', profile?.role);
          setUser({ ...authUser, ...profile });
        }
      } catch (err) {
        console.error('[useUser] Unexpected error fetching profile:', err);
        if (mounted) setUser({ ...authUser });
      }
    };

    const initializeAuth = async () => {
      try {
        console.log('[useUser] Initializing auth...');

        // Get the current session
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('[useUser] Error getting session:', error);
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        if (session?.user) {
          console.log('[useUser] Found existing session for user:', session.user.email);
          await fetchUserProfile(session.user);
        } else {
          console.log('[useUser] No existing session found');
          if (mounted) {
            setUser(null);
          }
        }

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('[useUser] Error initializing auth:', err);
        // Always ensure loading is set to false
        if (mounted) {
          setUser(null);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[useUser] Auth state changed:', event, session?.user?.email || 'no user');

      if (!mounted) {
        console.log('[useUser] Component unmounted, ignoring auth change');
        return;
      }

      if (event === 'PASSWORD_RECOVERY') {
        console.log('[useUser] Password recovery initiated, not setting user state');
        // Don't set user state during password recovery to prevent auto-redirect
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        console.log('[useUser] User signed out, clearing user state');
        setUser(null);
        setLoading(false);
      } else if (event === 'SIGNED_IN' && session?.user) {
        console.log('[useUser] User signed in:', session.user.email);
        await fetchUserProfile(session.user);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[useUser] Token refreshed for:', session.user.email);
        await fetchUserProfile(session.user);
      } else if (!session) {
        console.log('[useUser] No session, clearing user state');
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
};
