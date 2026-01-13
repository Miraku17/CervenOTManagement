import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
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
      return res.status(403).json({ error: 'You do not have permission to update holidays' });
    }

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const { id, date, name, holiday_type, is_recurring } = req.body;

    // Validate required fields
    if (!id) {
      return res.status(400).json({ error: 'Holiday ID is required' });
    }

    // Check if holiday exists
    const { data: existingHoliday } = await supabaseAdmin
      .from('holidays')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!existingHoliday) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    // If date is being changed, check for conflicts
    if (date) {
      const { data: conflictingHoliday } = await supabaseAdmin
        .from('holidays')
        .select('id')
        .eq('date', date)
        .neq('id', id)
        .is('deleted_at', null)
        .single();

      if (conflictingHoliday) {
        return res.status(400).json({ error: 'A holiday already exists for this date' });
      }
    }

    // Build update object
    const updateData: any = {};
    if (date !== undefined) updateData.date = date;
    if (name !== undefined) updateData.name = name;
    if (holiday_type !== undefined) updateData.holiday_type = holiday_type;
    if (is_recurring !== undefined) updateData.is_recurring = is_recurring;

    // Update holiday
    const { data: updatedHoliday, error } = await supabaseAdmin
      .from('holidays')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return res.status(200).json({ holiday: updatedHoliday });
  } catch (error: any) {
    console.error('Error updating holiday:', error);
    return res.status(500).json({ error: error.message || 'Failed to update holiday' });
  }
}

export default withAuth(handler);
