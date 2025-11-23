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
      router.replace('/login');
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      router.replace('/dashboard/employee'); // Redirect to employee dashboard
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  return WithAuthComponent;
};
