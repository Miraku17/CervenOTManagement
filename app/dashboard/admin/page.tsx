'use client';

import { useState, useEffect } from 'react';
import DashboardHome from '@/components/admin_dashboard/DashboardHome';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';

export default function AdminDashboardPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Fetch employees
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

  useEffect(() => {
    fetchEmployees();
  }, []);

  return <DashboardHome employees={employees} />;
}
