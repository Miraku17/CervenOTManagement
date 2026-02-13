import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    id,
    store_id,
    ticket_id,
    liquidation_date,
    remarks,
    status,
  } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    // Check if user has manage_liquidation permission
    const hasPermission = await userHasPermission(req.user?.id || '', 'manage_liquidation');

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to edit liquidation requests'
      });
    }

    // Check if the liquidation exists
    const { data: existingLiquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingLiquidation) {
      return res.status(404).json({ error: 'Liquidation not found' });
    }

    // Build the update payload with only provided fields
    const updatePayload: Record<string, unknown> = {};

    if (store_id !== undefined) {
      // Allow null for optional store
      if (store_id !== null && store_id !== '') {
        // Verify the store exists
        const { data: store, error: storeError } = await supabaseAdmin
          .from('stores')
          .select('id')
          .eq('id', store_id)
          .single();

        if (storeError || !store) {
          return res.status(400).json({ error: 'Invalid store selected' });
        }
        updatePayload.store_id = store_id;
      } else {
        updatePayload.store_id = null;
      }
    }

    if (ticket_id !== undefined) {
      // Allow null for optional ticket
      if (ticket_id !== null) {
        const { data: ticket, error: ticketError } = await supabaseAdmin
          .from('tickets')
          .select('id')
          .eq('id', ticket_id)
          .single();

        if (ticketError || !ticket) {
          return res.status(400).json({ error: 'Invalid ticket selected' });
        }
      }
      updatePayload.ticket_id = ticket_id;
    }

    if (liquidation_date !== undefined) {
      updatePayload.liquidation_date = liquidation_date;
    }

    if (remarks !== undefined) {
      updatePayload.remarks = remarks || null;
    }

    if (status !== undefined) {
      if (status !== 'pending' && status !== 'approved' && status !== 'rejected') {
        return res.status(400).json({ error: 'Invalid status. Must be "pending", "approved", or "rejected".' });
      }
      updatePayload.status = status;

      // If changing to approved/rejected, set approved_at if not already set
      if ((status === 'approved' || status === 'rejected') && !existingLiquidation.approved_at) {
        updatePayload.approved_at = new Date().toISOString();
        updatePayload.approved_by = req.user?.id;
      }

      // If changing back to pending, clear approval info and level approvals
      if (status === 'pending') {
        updatePayload.approved_at = null;
        updatePayload.approved_by = null;
        updatePayload.reviewer_comment = null;
        // Reset level 1 approval
        updatePayload.level1_approved_by = null;
        updatePayload.level1_approved_at = null;
        updatePayload.level1_reviewer_comment = null;
        // Reset level 2 approval
        updatePayload.level2_approved_by = null;
        updatePayload.level2_approved_at = null;
        updatePayload.level2_reviewer_comment = null;
      }
    }

    // Check if there's anything to update
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    // Update the liquidation
    const { data: updatedLiquidation, error: updateError } = await supabaseAdmin
      .from('liquidations')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        cash_advances(
          id,
          amount,
          date_requested,
          type
        ),
        stores(
          id,
          store_code,
          store_name
        ),
        tickets(
          id,
          rcc_reference_number
        ),
        liquidation_items(*),
        liquidation_attachments(*)
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    // Fetch the profile separately
    let profileData = null;
    if (updatedLiquidation?.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('id, first_name, last_name, email, employee_id')
        .eq('id', updatedLiquidation.user_id)
        .single();
      profileData = profile;
    }

    // Attach profile to liquidation
    const liquidationWithProfile = {
      ...updatedLiquidation,
      profiles: profileData
    };

    return res.status(200).json({
      message: 'Liquidation updated successfully',
      data: liquidationWithProfile
    });

  } catch (error: unknown) {
    console.error('Error updating liquidation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
