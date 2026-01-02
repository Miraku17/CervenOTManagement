import { supabase } from '@/services/supabase';

/**
 * Enhanced fetch wrapper that automatically handles:
 * - 401 Unauthorized responses (expired tokens)
 * - Automatic logout and redirect
 * - JSON parsing
 */
export async function apiCall<T = any>(
  url: string,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);

    // Handle 401 Unauthorized - token expired
    if (response.status === 401) {
      console.error('🔴 [API] 401 Unauthorized - Token expired, logging out');

      // Sign out and redirect to login
      await supabase.auth.signOut();
      window.location.assign('/auth/login');

      throw new Error('Session expired. Please log in again.');
    }

    // Handle 403 Forbidden
    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({ error: 'Forbidden' }));
      console.error('🔴 [API] 403 Forbidden:', errorData);
      throw new Error(errorData.error || 'You do not have permission to perform this action');
    }

    // Handle other error responses
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    // Parse and return JSON response
    return await response.json();
  } catch (error) {
    console.error('🔴 [API] Request failed:', error);
    throw error;
  }
}

/**
 * Helper for GET requests
 */
export async function apiGet<T = any>(url: string): Promise<T> {
  return apiCall<T>(url, { method: 'GET' });
}

/**
 * Helper for POST requests
 */
export async function apiPost<T = any>(url: string, data?: any): Promise<T> {
  return apiCall<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper for PUT requests
 */
export async function apiPut<T = any>(url: string, data?: any): Promise<T> {
  return apiCall<T>(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
}

/**
 * Helper for DELETE requests
 */
export async function apiDelete<T = any>(url: string, data?: any): Promise<T> {
  return apiCall<T>(url, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
}
