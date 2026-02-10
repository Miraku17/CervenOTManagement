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

    // Check if user has manage_liquidation permission
    const hasPermission = await userHasPermission(adminUserId, 'manage_liquidation');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to export liquidations',
      });
    }

    // Get current user's position to check if they can export HR and Accounting liquidations
    const { data: currentUserProfile } = await supabaseAdmin
      .from('profiles')
      .select(`
        position_id,
        positions:position_id (name)
      `)
      .eq('id', adminUserId)
      .single();

    const currentUserPosition = (currentUserProfile?.positions as any)?.name || '';
    // Only Managing Director can export HR and Accounting liquidations
    const isManagingDirector = currentUserPosition.toLowerCase().includes('managing director');

    console.log('Liquidation Export - User position:', currentUserPosition, 'Is Managing Director:', isManagingDirector);

    // Get confidential position IDs to filter requests (HR and Accounting)
    let confidentialUserIds: string[] = [];
    if (!isManagingDirector) {
      // Get HR and Accounting position IDs
      const { data: confidentialPositions } = await supabaseAdmin
        .from('positions')
        .select('id')
        .or('name.eq.HR,name.eq.Accounting');

      if (confidentialPositions && confidentialPositions.length > 0) {
        const positionIds = confidentialPositions.map(p => p.id);

        // Get all user IDs with these positions
        const { data: confidentialUsers } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('position_id', positionIds);

        confidentialUserIds = (confidentialUsers || []).map(u => u.id);
        console.log('Liquidation Export - Confidential user IDs to exclude:', confidentialUserIds);
      }
    }

    const { startDate, endDate, userId } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }

    // Build query for liquidations
    let query = supabaseAdmin
      .from('liquidations')
      .select(
        `
        *,
        cash_advances (
          id,
          amount,
          date_requested,
          type
        ),
        stores (
          id,
          store_code,
          store_name
        ),
        tickets (
          id,
          rcc_reference_number
        ),
        liquidation_items (
          id,
          from_destination,
          to_destination,
          jeep,
          bus,
          fx_van,
          gas,
          toll,
          meals,
          lodging,
          others,
          total,
          remarks
        ),
        liquidation_attachments (
          id,
          file_name,
          file_path,
          file_type,
          file_size
        )
      `
      )
      .gte('liquidation_date', startDate as string)
      .lte('liquidation_date', endDate as string)
      .order('liquidation_date', { ascending: true });

    // Filter by specific user if provided
    if (userId) {
      query = query.eq('user_id', userId as string);
    }

    // Filter out HR and Accounting liquidations if user is not Managing Director
    if (!isManagingDirector && confidentialUserIds.length > 0) {
      // Exclude liquidations requested by HR and Accounting
      query = query.filter('user_id', 'not.in', `(${confidentialUserIds.join(',')})`);
      console.log('Liquidation Export - Applied filter to exclude confidential requests (HR, Accounting)');
    }

    const { data: liquidations, error } = await query;

    if (error) {
      console.error('Error fetching liquidations for export:', error);
      throw error;
    }

    // Fetch profiles for the user_ids
    const userIds = [...new Set(liquidations?.map((l) => l.user_id).filter(Boolean) || [])];

    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, employee_id')
        .in('id', userIds);

      if (profiles) {
        profilesMap = profiles.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Fetch approver profiles
    const approverIds = [...new Set(liquidations?.map((l) => l.approved_by).filter(Boolean) || [])];
    let approversMap: Record<string, any> = {};
    if (approverIds.length > 0) {
      const { data: approvers } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', approverIds);

      if (approvers) {
        approversMap = approvers.reduce((acc, approver) => {
          acc[approver.id] = approver;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Attach profiles to liquidations
    let liquidationsWithProfiles = liquidations?.map((liq) => ({
      ...liq,
      profiles: liq.user_id ? profilesMap[liq.user_id] || null : null,
      approver: liq.approved_by ? approversMap[liq.approved_by] || null : null,
    })) || [];

    // For individual export, generate signed URLs for attachments
    const includeAttachmentUrls = !!userId;
    if (includeAttachmentUrls) {
      liquidationsWithProfiles = await Promise.all(
        liquidationsWithProfiles.map(async (liq) => {
          if (!liq.liquidation_attachments || liq.liquidation_attachments.length === 0) {
            return liq;
          }

          const attachmentsWithUrls = await Promise.all(
            liq.liquidation_attachments.map(async (attachment: any) => {
              if (!attachment.file_path) return attachment;

              try {
                const { data: signedUrlData } = await supabaseAdmin!.storage
                  .from('receipts')
                  .createSignedUrl(attachment.file_path, 3600); // 1 hour expiry

                return {
                  ...attachment,
                  signed_url: signedUrlData?.signedUrl || null,
                };
              } catch (err) {
                console.error('Error generating signed URL:', err);
                return attachment;
              }
            })
          );

          return {
            ...liq,
            liquidation_attachments: attachmentsWithUrls,
          };
        })
      );
    }

    return res.status(200).json({
      liquidations: liquidationsWithProfiles,
      includeAttachments: includeAttachmentUrls,
    });
  } catch (error: unknown) {
    console.error('Export liquidations error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to export liquidations';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
