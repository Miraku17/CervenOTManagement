import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if user has import_schedule permission (same as schedule import)
    const hasPermission = await userHasPermission(userId, 'import_schedule');
    if (!hasPermission) {
      return res.status(403).json({ error: 'You do not have permission to create holidays' });
    }

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { date, name, holiday_type, is_recurring } = req.body;

    // Validate required fields
    if (!date || !name) {
      return res.status(400).json({ error: 'Date and name are required' });
    }

    // Check if holiday with this date already exists
    const { data: existingHoliday } = await supabaseAdmin
      .from('holidays')
      .select('id')
      .eq('date', date)
      .is('deleted_at', null)
      .single();

    if (existingHoliday) {
      return res.status(400).json({ error: 'A holiday already exists for this date' });
    }

    // Insert new holiday
    const { data: newHoliday, error } = await supabaseAdmin
      .from('holidays')
      .insert({
        date,
        name,
        holiday_type: holiday_type || 'regular',
        is_recurring: is_recurring || false,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(201).json({ holiday: newHoliday });
  } catch (error: any) {
    console.error('Error creating holiday:', error);
    return res.status(500).json({ error: error.message || 'Failed to create holiday' });
  }
}

export default withAuth(handler);
