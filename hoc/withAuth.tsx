import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useUser';
import React, { ComponentType, useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';

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

    // Show loading or redirecting state
    if (loading || isRedirecting || !user) {
      const message = isRedirecting ? 'Redirecting...' : 'Loading...';
      return <LoadingScreen message={message} />;
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
