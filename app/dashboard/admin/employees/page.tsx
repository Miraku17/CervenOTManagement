'use client';

import { useState, useEffect } from 'react';
import EmployeeManager from '@/components/admin_dashboard/EmployeeManager';
import { Employee, Position } from '@/types';
import { supabase } from '@/services/supabase';
import { useRouter } from 'next/navigation';

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);

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

  // Fetch positions
  useEffect(() => {
    const fetchPositions = async () => {
      const { data, error } = await supabase.from('positions').select('*');
      if (data) {
        setPositions(data);
      }
      if (error) {
        console.error('Error fetching positions:', error);
      }
    };
    fetchPositions();
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSelectEmployee = (id: string) => {
    router.push(`/dashboard/admin/employees/${id}`);
  };

  const handleAddEmployee = async () => {
    await fetchEmployees();
  };

  const handleDeleteEmployee = (employeeId: string) => {
    setEmployees(prev => prev.filter(e => e.id !== employeeId));
  };

  return (
    <EmployeeManager
      employees={employees}
      onSelectEmployee={handleSelectEmployee}
      onAddEmployee={handleAddEmployee}
      onDeleteEmployee={handleDeleteEmployee}
      positions={positions}
    />
  );
}
