import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';

/**
 * Hook to check user permissions based on their position
 */
export const usePermissions = () => {
  const { user, loading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPermissions = async () => {
      // Wait for auth to finish loading before checking permissions
      if (authLoading) {
        return; // Keep loading = true
      }

      if (!user?.id) {
        setPermissions([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/permissions/user?userId=${user.id}`);

        if (!response.ok) {
          throw new Error('Failed to fetch permissions');
        }

        const data = await response.json();
        setPermissions(data.permissions || []);
      } catch (error) {
        console.error('Error fetching permissions:', error);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [user?.id, authLoading]);

  const hasPermission = useCallback((permissionKey: string): boolean => {
    const result = permissions.includes(permissionKey);
    console.log(`🔍 hasPermission('${permissionKey}'):`, result, 'from', permissions);
    return result;
  }, [permissions]);

  return {
    permissions,
    hasPermission,
    loading,
  };
};
