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

    const adminUserId = req.user?.id;
    if (!adminUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const hasPermission = await userHasPermission(adminUserId, 'manage_liquidation');
    if (!hasPermission) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to download attachments' });
    }

    // Check position for confidentiality filtering (same as export endpoint)
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select('position_id, positions:position_id (name)')
      .eq('id', adminUserId)
      .single();

    const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
    const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');

    let confidentialUserIds: string[] = [];
    if (!isManagingDirector) {
      const { data: confidentialPositions } = await supabaseAdmin
        .from('positions')
        .select('id')
        .or('name.eq.HR,name.eq.Accounting');

      if (confidentialPositions && confidentialPositions.length > 0) {
        const positionIds = confidentialPositions.map((p) => p.id);
        const { data: confidentialUsers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('position_id', positionIds);
        confidentialUserIds = (confidentialUsers || []).map((u) => u.id);
      }
    }

    // Fetch all image attachments joined with their liquidation date
    let query = supabaseAdmin
      .from('liquidation_attachments')
      .select(`
        id,
        file_name,
        file_path,
        file_type,
        liquidation_id,
        liquidations!inner (
          liquidation_date,
          user_id
        )
      `)
      .order('liquidation_id');

    const { data: rawAttachments, error } = await query;

    if (error) throw error;

    // Filter by image type and confidentiality
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic)$/i;
    const filtered = (rawAttachments || []).filter((a: any) => {
      const isImage =
        a.file_type?.startsWith('image/') || imageExtensions.test(a.file_name || '');
      if (!isImage) return false;

      const userId = (a.liquidations as any)?.user_id;
      if (!isManagingDirector && confidentialUserIds.includes(userId)) return false;

      return true;
    });

    // Generate signed URLs (1 hour expiry)
    const attachmentsWithUrls = await Promise.all(
      filtered.map(async (attachment: any) => {
        if (!attachment.file_path) return null;

        try {
          const { data: signedUrlData } = await supabaseAdmin!.storage
            .from('receipts')
            .createSignedUrl(attachment.file_path, 3600);

          return {
            id: attachment.id,
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            liquidation_date: (attachment.liquidations as any)?.liquidation_date || 'unknown',
            signed_url: signedUrlData?.signedUrl || null,
          };
        } catch {
          return null;
        }
      })
    );

    const validAttachments = attachmentsWithUrls.filter(Boolean);

    return res.status(200).json({ attachments: validAttachments });
  } catch (error: unknown) {
    console.error('Download attachments error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch attachments';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
