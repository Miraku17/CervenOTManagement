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
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasAccess = await userHasPermission(userId, 'manage_courier_transactions');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to manage courier transactions' });
    }

    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    // Fetch the row first so we can clean up the invoice file
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('courier_transactions')
      .select('id, invoice_path')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Courier transaction not found' });
    }

    const { error: deleteError } = await supabaseAdmin
      .from('courier_transactions')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Remove the invoice photo from storage (best-effort)
    if (existing.invoice_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('courier-invoices')
        .remove([existing.invoice_path]);
      if (storageError) {
        console.error('Error removing courier invoice from storage:', storageError);
      }
    }

    return res.status(200).json({ message: 'Courier transaction deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting courier transaction:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete courier transaction' });
  }
}

export default withAuth(handler);
