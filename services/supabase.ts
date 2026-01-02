import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase URL or anon key. Make sure to set them in your .env.local file.');
}

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);

/**
 * Sets up automatic logout when token expires or session is invalidated
 * Call this once in your root component/layout
 */
export function setupAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('🔔 [AUTH STATE CHANGE]', event, session ? 'Session exists' : 'No session');

    // Handle different auth events
    if (event === 'SIGNED_OUT') {
      console.log('🔴 [AUTH] User signed out - redirecting to login');
      window.location.assign('/auth/login');
    } else if (event === 'TOKEN_REFRESHED') {
      if (!session) {
        console.log('🔴 [AUTH] Token refresh failed - session expired');
        window.location.assign('/auth/login');
      } else {
        console.log('🟢 [AUTH] Token refreshed successfully');
      }
    } else if (event === 'USER_UPDATED' && !session) {
      console.log('🔴 [AUTH] User updated but no session - redirecting to login');
      window.location.assign('/auth/login');
    }
  });
}
