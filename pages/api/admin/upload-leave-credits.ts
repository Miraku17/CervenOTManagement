import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

interface LeaveCreditsRow {
  employee_id: string;
  leave_credits: number;
}

interface UploadStats {
  total: number;
  successful: number;
  failed: number;
}

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

  // Check if user is admin
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized. Admin access required.' });
  }

  try {
    // Check if user has Operations Manager position
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('positions(name)')
      .eq('id', req.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return res.status(500).json({ error: 'Failed to verify user permissions' });
    }

    const userPosition = (userProfile as any)?.positions?.name;
    if (userPosition !== 'Operations Manager') {
      return res.status(403).json({
        error: 'Unauthorized. Only Operations Manager can upload leave credits.'
      });
    }

    // Parse the request body
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Invalid data format. Expected an array of records.' });
    }

    const stats: UploadStats = {
      total: data.length,
      successful: 0,
      failed: 0,
    };

    const errors: string[] = [];
    const successfulUpdates: string[] = [];

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i] as LeaveCreditsRow;
      const rowNumber = i + 2; // +2 because Excel rows start at 1 and we have a header row

      try {
        // Validate row data
        if (!row.employee_id || row.employee_id.toString().trim() === '') {
          errors.push(`Row ${rowNumber}: Missing employee_id`);
          stats.failed++;
          continue;
        }

        if (row.leave_credits === undefined || row.leave_credits === null) {
          errors.push(`Row ${rowNumber}: Missing leave_credits`);
          stats.failed++;
          continue;
        }

        const leaveCredits = Number(row.leave_credits);
        if (isNaN(leaveCredits) || leaveCredits < 0) {
          errors.push(`Row ${rowNumber}: Invalid leave_credits value (must be a non-negative number)`);
          stats.failed++;
          continue;
        }

        const employeeId = row.employee_id.toString().trim();

        // Find the employee by employee_id
        const { data: employee, error: findError } = await supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, employee_id')
          .eq('employee_id', employeeId)
          .single();

        if (findError || !employee) {
          errors.push(`Row ${rowNumber}: Employee with ID "${employeeId}" not found`);
          stats.failed++;
          continue;
        }

        // Update the employee's leave credits
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ leave_credits: leaveCredits })
          .eq('id', employee.id);

        if (updateError) {
          console.error(`Error updating employee ${employeeId}:`, updateError);
          errors.push(`Row ${rowNumber}: Failed to update leave credits for ${employeeId}`);
          stats.failed++;
          continue;
        }

        successfulUpdates.push(`${employee.first_name} ${employee.last_name} (${employeeId}): ${leaveCredits} credits`);
        stats.successful++;
      } catch (error: any) {
        console.error(`Error processing row ${rowNumber}:`, error);
        errors.push(`Row ${rowNumber}: ${error.message || 'Unexpected error'}`);
        stats.failed++;
      }
    }

    // Prepare response
    const message = stats.failed === 0
      ? `Successfully updated leave credits for ${stats.successful} employee${stats.successful !== 1 ? 's' : ''}.`
      : `Updated ${stats.successful} employee${stats.successful !== 1 ? 's' : ''}. ${stats.failed} failed.`;

    return res.status(200).json({
      message,
      stats,
      errors: errors.length > 0 ? errors : undefined,
      successfulUpdates: successfulUpdates.length > 0 ? successfulUpdates : undefined,
    });

  } catch (error: any) {
    console.error('Upload leave credits error:', error);
    return res.status(500).json({
      error: 'Failed to upload leave credits',
      details: error.message,
    });
  }
}

export default withAuth(handler);
