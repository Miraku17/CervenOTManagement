import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  if (!supabase) {
    console.error('Supabase admin client not available');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const { id } = req.query;

  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Please provide a valid overtime request id.' });
  }

  try {
    // First, verify the request exists and belongs to the user
    const { data: existingRequest, error: fetchError } = await supabase
      .from('overtime_v2')
      .select('*')
      .eq('id', id)
      .eq('requested_by', userId)
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ error: 'Overtime request not found.' });
    }

    // Check if the request is still pending (level1_status is null or pending)
    if (existingRequest.level1_status && existingRequest.level1_status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot delete overtime request. It has already been reviewed.'
      });
    }

    // Delete the overtime request
    const { error: deleteError } = await supabase
      .from('overtime_v2')
      .delete()
      .eq('id', id)
      .eq('requested_by', userId);

    if (deleteError) throw deleteError;

    return res.status(200).json({
      message: 'Overtime request deleted successfully'
    });

  } catch (error: any) {
    console.error('Delete overtime request error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to delete overtime request. Please try again.'
    });
  }
}

export default withAuth(handler);
