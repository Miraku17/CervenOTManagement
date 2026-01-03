import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  // Check if user is authenticated
  if (!req.user?.id) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {
    // Check if user has permission to manage leave credits
    const hasPermission = await userHasPermission(req.user.id, 'manage_leave_credits');
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to update leave credits.'
      });
    }

    // Parse the request body
    const { employeeId, leaveCredits } = req.body;

    if (!employeeId) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    if (leaveCredits === undefined || leaveCredits === null) {
      return res.status(400).json({ error: 'Leave credits value is required' });
    }

    const credits = Number(leaveCredits);
    if (isNaN(credits) || credits < 0) {
      return res.status(400).json({ error: 'Leave credits must be a non-negative number' });
    }

    // Check if employee exists
    const { data: employee, error: findError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, employee_id, leave_credits')
      .eq('id', employeeId)
      .single();

    if (findError || !employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    // Update the employee's leave credits
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ leave_credits: credits })
      .eq('id', employeeId);

    if (updateError) {
      console.error('Error updating leave credits:', updateError);
      return res.status(500).json({ error: 'Failed to update leave credits' });
    }

    return res.status(200).json({
      message: `Successfully updated leave credits for ${employee.first_name} ${employee.last_name}`,
      employee: {
        id: employee.id,
        employee_id: employee.employee_id,
        first_name: employee.first_name,
        last_name: employee.last_name,
        previous_credits: employee.leave_credits,
        new_credits: credits,
      },
    });

  } catch (error: any) {
    console.error('Update employee leave credits error:', error);
    return res.status(500).json({
      error: 'Failed to update leave credits',
      details: error.message,
    });
  }
}

export default withAuth(handler);
