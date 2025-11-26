import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useUser';
import React, { ComponentType, useEffect, useState } from 'react';

interface WithAuthProps {
  // You can add any additional props here if needed
}

export const withAuth = <P extends object>(
  WrappedComponent: ComponentType<P>,
  requiredRole?: string
) => {
  const WithAuthComponent = (props: P & WithAuthProps) => {
    const { user, loading } = useUser();
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
      console.log('[withAuth] Check - loading:', loading, 'isRedirecting:', isRedirecting, 'user:', user?.email || 'none', 'requiredRole:', requiredRole);

      if (loading || isRedirecting) {
        console.log('[withAuth] Waiting... (loading or already redirecting)');
        return;
      }

      // Redirect to login if not authenticated
      if (!user) {
        console.log('[withAuth] No user found, redirecting to login');
        setIsRedirecting(true);
        router.replace('/auth/login');
        return;
      }

      // Check role-based access
      if (requiredRole && user.role !== requiredRole) {
        console.log('[withAuth] User role mismatch. Required:', requiredRole, 'Actual:', user.role);
        setIsRedirecting(true);
        const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
        console.log('[withAuth] Redirecting to:', redirectPath);
        router.replace(redirectPath);
        return;
      }

      // If no specific role required, redirect admins to their dashboard
      if (!requiredRole && user.role === 'admin') {
        console.log('[withAuth] Admin accessing employee area, redirecting to admin dashboard');
        setIsRedirecting(true);
        router.replace('/admin/dashboard');
        return;
      }

      console.log('[withAuth] Access granted for user:', user.email, 'role:', user.role);
    }, [user, loading, router, requiredRole, isRedirecting]);

    // Show loading state
    if (loading || isRedirecting || !user) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-8 h-8 text-white animate-pulse"
              >
                <path d="M2.5 18L12 2.5L21.5 18H2.5Z" />
                <path d="M12 2.5V18" />
                <path d="M7 18L12 10" />
                <path d="M17 18L12 10" />
              </svg>
            </div>
            <p className="text-white text-xl font-medium">Loading...</p>
          </div>
        </div>
      );
    }

    // Verify role access before rendering
    if (requiredRole && user.role !== requiredRole) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  WithAuthComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithAuthComponent;
};
