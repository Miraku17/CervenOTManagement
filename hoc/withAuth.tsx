import { useRouter } from 'next/router';
import { useUser } from '@/hooks/useUser';
import React, { ComponentType } from 'react';

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

    if (loading) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950">
          <p className="text-white">Loading...</p>
        </div>
      );
    }

    if (!user) {
      router.replace('/auth/login');
      return null;
    }

    // If a specific role is required for the page
    if (requiredRole) {
      if (user.role !== requiredRole) {
        // User does not have the required role, redirect to their default dashboard
        const redirectPath = user.role === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
        router.replace(redirectPath);
        return null;
      }
    } else {
      // If no role is required, it's a general page (e.g., employee dashboard).
      // Admins should not be here; they should be on their specific dashboard.
      if (user.role === 'admin') {
        router.replace('/admin/dashboard');
        return null;
      }
    }

    return <WrappedComponent {...props} />;
  };

  return WithAuthComponent;
};
