'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import EmployeeDetail from '@/components/admin_dashboard/EmployeeDetail';
import { Employee } from '@/types';
import { supabase } from '@/services/supabase';

export default function EmployeeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const employeeId = params.id as string;

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployee = async () => {
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
        const foundEmployee = data.employees.find((e: Employee) => e.id === employeeId);

        if (foundEmployee) {
          setEmployee(foundEmployee);
        } else {
          router.push('/dashboard/admin/employees');
        }
      } catch (error) {
        console.error('Error fetching employee:', error);
        router.push('/dashboard/admin/employees');
      } finally {
        setLoading(false);
      }
    };

    if (employeeId) {
      fetchEmployee();
    }
  }, [employeeId, router]);

  const handleBack = () => {
    router.push('/dashboard/admin/employees');
  };

  const handleUpdate = (updatedEmployee: Employee) => {
    setEmployee(updatedEmployee);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  return (
    <EmployeeDetail
      employee={employee}
      onBack={handleBack}
      onUpdate={handleUpdate}
    />
  );
}
