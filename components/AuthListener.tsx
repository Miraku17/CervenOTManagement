'use client';

import { useEffect } from 'react';
import { setupAuthListener } from '@/services/supabase';

/**
 * Client component that sets up automatic logout on token expiration
 * This should be included once in the root layout
 */
export function AuthListener() {
  useEffect(() => {
    console.log('🔵 [AUTH LISTENER] Setting up auth state listener');
    setupAuthListener();
  }, []);

  return null;
}
