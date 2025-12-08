import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseServer } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Fetch all employees from profiles table
    const { data: employees, error } = await supabaseServer
      .from('profiles')
      .select('id, first_name, last_name, email, employee_id')
      .order('first_name', { ascending: true });

    if (error) {
      throw error;
    }

    // Format the employee data
    const formattedEmployees = (employees || []).map(emp => ({
      id: emp.id,
      name: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
      employee_id: emp.employee_id,
      email: emp.email,
    }));

    return res.status(200).json({ employees: formattedEmployees });
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch employees' });
  }
}
