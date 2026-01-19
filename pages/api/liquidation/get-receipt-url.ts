import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

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

    const { attachment_id } = req.query;

    if (!attachment_id || typeof attachment_id !== 'string') {
      return res.status(400).json({ error: 'Attachment ID is required' });
    }

    // Get the attachment and verify ownership through liquidation
    const { data: attachment, error: attachmentError } = await supabaseAdmin
      .from('liquidation_attachments')
      .select(`
        id,
        file_path,
        file_name,
        file_type,
        liquidations (
          id,
          user_id
        )
      `)
      .eq('id', attachment_id)
      .single();

    if (attachmentError || !attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    // Check if user owns the liquidation or is admin
    // Note: liquidations is returned as an object (not array) from single() join
    const liquidation = attachment.liquidations as { id: string; user_id: string } | { id: string; user_id: string }[] | null;
    const liquidationUserId = Array.isArray(liquidation) ? liquidation[0]?.user_id : liquidation?.user_id;
    const isAdmin = req.user?.role === 'admin';

    if (!isAdmin && liquidationUserId !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view this attachment' });
    }

    // Generate signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from('receipts')
      .createSignedUrl(attachment.file_path, 3600); // 1 hour expiry

    if (signedUrlError || !signedUrlData) {
      console.error('Error generating signed URL:', {
        error: signedUrlError,
        filePath: attachment.file_path,
        attachmentId: attachment_id,
      });
      return res.status(500).json({
        error: 'Failed to generate download URL',
        details: signedUrlError?.message || 'Unknown error',
        filePath: attachment.file_path,
      });
    }

    return res.status(200).json({
      url: signedUrlData.signedUrl,
      fileName: attachment.file_name,
      fileType: attachment.file_type,
    });
  } catch (error: unknown) {
    console.error('Get receipt URL error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to get receipt URL';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
