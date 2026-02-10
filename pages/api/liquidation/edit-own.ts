import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

interface LiquidationItem {
  id?: string;
  from_destination: string;
  to_destination: string;
  jeep: string;
  bus: string;
  fx_van: string;
  gas: string;
  toll: string;
  meals: string;
  lodging: string;
  others: string;
  remarks: string;
}

interface UpdateLiquidationRequest {
  id: string;
  cash_advance_id?: string;
  store_id?: string;
  ticket_id?: number | null;
  liquidation_date?: string;
  remarks?: string | null;
  liquidation_items?: LiquidationItem[];
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    id,
    cash_advance_id,
    store_id,
    ticket_id,
    liquidation_date,
    remarks,
    liquidation_items
  }: UpdateLiquidationRequest = req.body;

  if (!id) {
    return res.status(400).json({ error: 'Missing required field: id' });
  }

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Supabase admin client not available' });
  }

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Check if the liquidation request exists, belongs to the user, and is pending
    const { data: existingLiquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select('*, liquidation_items(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingLiquidation) {
      return res.status(404).json({ error: 'Liquidation request not found or does not belong to you' });
    }

    // Only allow editing if status is pending
    if (existingLiquidation.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot edit liquidation that has already been processed. Only pending liquidations can be edited.'
      });
    }

    // Build the update payload with only provided fields
    const updatePayload: Record<string, unknown> = {};

    if (cash_advance_id !== undefined) {
      updatePayload.cash_advance_id = cash_advance_id;
    }

    if (store_id !== undefined) {
      updatePayload.store_id = store_id;
    }

    if (ticket_id !== undefined) {
      updatePayload.ticket_id = ticket_id;
    }

    if (liquidation_date !== undefined) {
      updatePayload.liquidation_date = liquidation_date;
    }

    if (remarks !== undefined) {
      updatePayload.remarks = remarks;
    }

    // Calculate total amounts if liquidation_items is provided
    if (liquidation_items && liquidation_items.length > 0) {
      let totalAmount = 0;

      // Process liquidation items
      for (const item of liquidation_items) {
        const itemTotal =
          parseFloat(item.jeep || '0') +
          parseFloat(item.bus || '0') +
          parseFloat(item.fx_van || '0') +
          parseFloat(item.gas || '0') +
          parseFloat(item.toll || '0') +
          parseFloat(item.meals || '0') +
          parseFloat(item.lodging || '0') +
          parseFloat(item.others || '0');

        totalAmount += itemTotal;
      }

      updatePayload.total_amount = totalAmount;

      // Calculate return_to_company or reimbursement
      if (cash_advance_id) {
        const { data: cashAdvance } = await supabaseAdmin
          .from('cash_advances')
          .select('amount')
          .eq('id', cash_advance_id)
          .single();

        const cashAdvanceAmount = cashAdvance?.amount || 0;
        const diff = cashAdvanceAmount - totalAmount;

        if (diff > 0) {
          updatePayload.return_to_company = diff;
          updatePayload.reimbursement = 0;
        } else {
          updatePayload.return_to_company = 0;
          updatePayload.reimbursement = Math.abs(diff);
        }
      }
    }

    // Update the liquidation
    const { data: updatedLiquidation, error: updateError } = await supabaseAdmin
      .from('liquidations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Update liquidation items if provided
    if (liquidation_items && liquidation_items.length > 0) {
      // Delete existing items
      await supabaseAdmin
        .from('liquidation_items')
        .delete()
        .eq('liquidation_id', id);

      // Insert new items
      const itemsToInsert = liquidation_items.map(item => {
        const itemTotal =
          parseFloat(item.jeep || '0') +
          parseFloat(item.bus || '0') +
          parseFloat(item.fx_van || '0') +
          parseFloat(item.gas || '0') +
          parseFloat(item.toll || '0') +
          parseFloat(item.meals || '0') +
          parseFloat(item.lodging || '0') +
          parseFloat(item.others || '0');

        return {
          liquidation_id: id,
          from_destination: item.from_destination || '',
          to_destination: item.to_destination || '',
          jeep: parseFloat(item.jeep || '0'),
          bus: parseFloat(item.bus || '0'),
          fx_van: parseFloat(item.fx_van || '0'),
          gas: parseFloat(item.gas || '0'),
          toll: parseFloat(item.toll || '0'),
          meals: parseFloat(item.meals || '0'),
          lodging: parseFloat(item.lodging || '0'),
          others: parseFloat(item.others || '0'),
          total: itemTotal,
          remarks: item.remarks || '',
        };
      });

      const { error: itemsError } = await supabaseAdmin
        .from('liquidation_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw itemsError;
      }
    }

    return res.status(200).json({
      message: 'Liquidation updated successfully',
      data: updatedLiquidation
    });

  } catch (error: unknown) {
    console.error('Error updating liquidation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
