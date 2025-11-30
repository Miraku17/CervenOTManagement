import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/services/supabase';
import { useUser } from './useUser';

interface LoginCredentials {
  email: string;
  password: string;
}

export const useAuth = () => {
  const { user, loading } = useUser();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const login = async ({ email, password }: LoginCredentials) => {
    console.log('[useAuth] Login attempt for:', email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[useAuth] Login error:', error);
      throw error;
    }

    if (!data.user) {
      console.error('[useAuth] No user data returned');
      throw new Error('Failed to sign in. Please try again.');
    }

    console.log('[useAuth] Sign in successful for:', data.user.email);

    // Fetch the user's profile to determine their role
    console.log('[useAuth] Fetching user profile...');
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (profileError) {
      console.error('[useAuth] Profile fetch error:', profileError);
      // Even if profile fetch fails, redirect to default dashboard
      console.log('[useAuth] Redirecting to default employee dashboard');
      return '/dashboard/employee';
    }

    // Return the dashboard path based on role
    const dashboardPath = profile?.role === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
    console.log('[useAuth] Login successful, dashboard:', dashboardPath);
    return dashboardPath;
  };

  const logout = async () => {
    console.log('[useAuth] Logout initiated');

    if (isLoggingOut) {
      console.log('[useAuth] Already logging out, ignoring');
      return;
    }

    console.log('[useAuth] Setting isLoggingOut to true');
    setIsLoggingOut(true);

    try {
      // Try to sign out with a 2-second timeout
      console.log('[useAuth] Calling supabase.auth.signOut()...');

      const signOutPromise = supabase.auth.signOut({ scope: 'local' });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SignOut timeout')), 2000)
      );

      try {
        await Promise.race([signOutPromise, timeoutPromise]);
        console.log('[useAuth] SignOut successful');
      } catch (error: any) {
        console.warn('[useAuth] SignOut timed out or failed:', error.message);
        // Continue anyway - we'll clear storage and redirect
      }

      // Clear local storage
      console.log('[useAuth] Clearing localStorage and sessionStorage');
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }

      // Redirect to login
      console.log('[useAuth] Redirecting to login...');
      router.replace('/auth/login');
    } catch (error: any) {
      console.error('[useAuth] Unexpected logout error:', error);
      // Clear storage and redirect even on error
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
      }
      console.log('[useAuth] Forcing redirect after error...');
      router.replace('/auth/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return {
    user,
    loading,
    login,
    logout,
    isLoggingOut,
  };
};
