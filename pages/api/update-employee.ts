import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { employeeId, firstName, lastName, email, contact_number, address, positionId, employee_id: newEmployeeId, role } = req.body;
  // Build update object with only provided fields
  const updateData: any = {};

  if (firstName !== undefined) updateData.first_name = firstName;
  if (lastName !== undefined) updateData.last_name = lastName;
  if (email !== undefined) updateData.email = email;
  if (contact_number !== undefined) updateData.contact_number = contact_number;
  if (address !== undefined) updateData.address = address;
  if (newEmployeeId !== undefined) updateData.employee_id = newEmployeeId;
  // Only update positionId if it's provided and not an empty string
  if (positionId !== undefined && positionId !== '') {
    updateData.position_id = positionId;
  }
  if (role !== undefined && role !== '') {
    updateData.role = role;
  }

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({ error: 'No fields to update provided.' });
  }

  try {
    // Update the profile in the 'profiles' table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', employeeId)
      .select()
      .single();

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw new Error(`Failed to update profile: ${profileError.message}`);
    }

    // If email is being updated, update it in Supabase Auth as well
    if (email !== undefined || role !== undefined) {
      const authUpdateData: { email?: string; user_metadata?: { role: string } } = {};
      if (email !== undefined) {
        authUpdateData.email = email;
      }
      if (role !== undefined) {
        authUpdateData.user_metadata = { role: role };
      }

      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        employeeId,
        authUpdateData
      );

      if (authError) {
        console.error('Auth email update error:', authError);
        // Don't fail the entire request if auth update fails
        // The profile is already updated
        console.warn('Profile updated but auth email update failed');
      }
    }

    return res.status(200).json({
      message: 'Employee updated successfully',
      employee: profileData
    });

  } catch (error: any) {
    console.error('Update-employee error:', error.message);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while updating employee.'
    });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
