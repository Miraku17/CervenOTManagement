import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { Employee } from '@/types';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { email, firstName, lastName, contact_number, address, positionId, role } = req.body;

  if (!email || !firstName || !lastName || !positionId) {
    return res.status(400).json({ error: 'Email, first name, last name, and position are required.' });
  }

  // Validate role
  const userRole = role && (role === 'admin' || role === 'employee') ? role : 'employee';

  try {
    // 1. Create the user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true, // Auto-confirm the email
      password: Math.random().toString(36).slice(-12), // temporary password (user sets own password later)
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed.');

    const userId = authData.user.id;

    // 2. Insert the corresponding profile into the 'profiles' table
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      contact_number: contact_number || null,
      address: address || null,
      position_id: positionId,
      role: userRole,
      // status: 'Active',
      created_at: new Date().toISOString(),
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw profileError;
    }

    const newEmployee: Partial<Employee> = {
      id: userId,
      fullName: `${firstName} ${lastName}`,
      email,
      contact_number: contact_number || null,
      address,
      position: positionId,
      joinDate: new Date().toISOString().split('T')[0],
      // status: 'Active',
    };

    return res.status(201).json({ message: 'Employee created successfully', employee: newEmployee });

  } catch (error: any) {
    console.error('Create-employee error:', error.message);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
}
