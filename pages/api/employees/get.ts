import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Fetch all employees from profiles table with all necessary fields
    const { data: employees, error } = await supabaseAdmin
      .from('profiles')
      .select('*, positions(name)')
      .order('first_name', { ascending: true });

    if (error) {
      throw error;
    }

    // Format the employee data to match the Employee interface
    const formattedEmployees = (employees || []).map((emp: any) => ({
      id: emp.id,
      employee_id: emp.employee_id || 'N/A',
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      firstName: emp.first_name || '',
      lastName: emp.last_name || '',
      fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim() || emp.email,
      email: emp.email,
      contact_number: emp.contact_number || '',
      address: emp.address || '',
      position: emp.positions?.name || 'N/A',
      department: emp.department || 'N/A',
      joinDate: emp.created_at ? new Date(emp.created_at).toLocaleDateString() : 'N/A',
      avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${emp.first_name}+${emp.last_name}`,
      status: emp.status === 'disabled' ? 'Terminated' : 'Active',
      role: emp.role,
      leave_credits: emp.leave_credits || 0,
    }));

    return res.status(200).json({ employees: formattedEmployees });
  } catch (error: any) {
    console.error('Error fetching employees:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch employees' });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
