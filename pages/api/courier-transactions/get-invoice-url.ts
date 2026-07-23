import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
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
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view courier transactions' });
    }

    const { transaction_id } = req.query;
    if (!transaction_id || typeof transaction_id !== 'string') {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }

    const { data: transaction, error: fetchError } = await supabaseAdmin
      .from('courier_transactions')
      .select('id, invoice_path, invoice_file_name')
      .eq('id', transaction_id)
      .single();

    if (fetchError || !transaction) {
      return res.status(404).json({ error: 'Courier transaction not found' });
    }

    if (!transaction.invoice_path) {
      return res.status(404).json({ error: 'No invoice uploaded for this transaction' });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('courier-invoices')
      .createSignedUrl(transaction.invoice_path, 3600);

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', signedUrlError);
      return res.status(500).json({
        error: 'Failed to generate invoice URL',
        details: signedUrlError?.message || 'Unknown error',
      });
    }

    return res.status(200).json({
      url: signedUrlData.signedUrl,
      fileName: transaction.invoice_file_name,
    });
  } catch (error: any) {
    console.error('Get courier invoice URL error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get invoice URL' });
  }
}

export default withAuth(handler);
