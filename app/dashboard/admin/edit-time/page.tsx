'use client';

import { useState, useEffect } from 'react';
import EditTimeView from '@/components/admin_dashboard/EditTimeView';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';
import { useAuth } from '@/hooks/useAuth';
import { X } from 'lucide-react';

export default function EditTimePage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [userPosition, setUserPosition] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserPosition = async () => {
      if (!user?.id) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('positions(name)')
        .eq('id', user.id)
        .single();

      setUserPosition((profile?.positions as any)?.name || null);
      setLoading(false);
    };

    fetchUserPosition();
  }, [user?.id]);

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          console.error('No active session');
          return;
        }

        const response = await fetch('/api/employees/get', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch employees');
        }

        const data = await response.json();
        setEmployees(data.employees);
      } catch (error) {
        console.error('Error fetching employees:', error);
      }
    };

    fetchEmployees();
  }, []);

  const hasEditTimeAccess = () => {
    return userPosition === 'Operations Manager';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!hasEditTimeAccess()) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to edit time records.</p>
            <p className="text-slate-500 text-sm mt-2">Only Operations Managers can access this feature.</p>
          </div>
        </div>
      </div>
    );
  }

  return <EditTimeView employees={employees} />;
}
