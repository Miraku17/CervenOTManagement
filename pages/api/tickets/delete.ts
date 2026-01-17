import type { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'DELETE') {
    res.setHeader('Allow', ['DELETE']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id || '';

  // Check if user has delete_tickets permission
  const hasDeletePermission = await userHasPermission(userId, 'delete_tickets');

  if (!hasDeletePermission) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to delete tickets' });
  }

  try {
    const { id } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // 1. Get all attachments for this ticket
    const { data: attachments, error: fetchError } = await supabase
      .from('ticket_attachments')
      .select('file_path')
      .eq('ticket_id', id);

    if (fetchError) {
      console.error('Error fetching attachments:', fetchError);
    }

    // 2. Delete all files from storage
    if (attachments && attachments.length > 0) {
      const filePaths = attachments.map(att => att.file_path);
      const { error: storageError } = await supabase.storage
        .from('ticket-attachments')
        .remove(filePaths);

      if (storageError) {
        console.error('Error deleting files from storage:', storageError);
        // Continue with deletion even if storage cleanup fails
      }
    }

    // 3. Delete ticket_attachments records (if not handled by CASCADE)
    const { error: attachmentDeleteError } = await supabase
      .from('ticket_attachments')
      .delete()
      .eq('ticket_id', id);

    if (attachmentDeleteError) {
      console.error('Error deleting attachment records:', attachmentDeleteError);
      // Continue with ticket deletion
    }

    // 4. Delete the ticket
    const { error } = await supabase
      .from('tickets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting ticket:', error);
      throw error;
    }

    return res.status(200).json({
      message: 'Ticket deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete ticket error:', error);
    return res.status(500).json({
      error: 'Failed to delete ticket',
      details: error.message,
    });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
