import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useUser';
import React, { ComponentType, useEffect, useState } from 'react';
import { LoadingScreen } from '@/components/LoadingScreen';

interface WithGuestProps {
  // You can add any additional props here if needed
}

export const withGuest = <P extends object>(
  WrappedComponent: ComponentType<P>
) => {
  const WithGuestComponent = (props: P & WithGuestProps) => {
    const { user, loading } = useUser();
    const router = useRouter();
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
      console.log('[withGuest] Check - loading:', loading, 'isRedirecting:', isRedirecting, 'user:', user?.email || 'none');

      if (loading || isRedirecting) {
        console.log('[withGuest] Waiting... (loading or already redirecting)');
        return;
      }

      // Redirect authenticated users to their dashboard
      if (user) {
        const dashboardPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
        console.log('[withGuest] User already logged in, redirecting to:', dashboardPath);
        setIsRedirecting(true);
        router.replace(dashboardPath);
        return;
      }

      console.log('[withGuest] Guest access granted');
    }, [user, loading, router, isRedirecting]);

    // Show loading state while checking authentication
    if (loading) {
      return <LoadingScreen message="Loading..." />;
    }

    // Don't render the component if redirecting
    if (isRedirecting || user) {
      return <LoadingScreen message="Redirecting..." />;
    }

    return <WrappedComponent {...props} />;
  };

  WithGuestComponent.displayName = `withGuest(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;

  return WithGuestComponent;
};
