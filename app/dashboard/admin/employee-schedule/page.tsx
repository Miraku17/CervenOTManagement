'use client';

import { useState, useEffect } from 'react';
import EmployeeScheduleView from '@/components/admin_dashboard/EmployeeScheduleView';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';
import { useUser } from '@/hooks/useUser';

export default function EmployeeSchedulePage() {
  const { user } = useUser();
  const [employees, setEmployees] = useState<Employee[]>([]);

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

  return <EmployeeScheduleView employees={employees} userPosition={user?.position} />;
}
