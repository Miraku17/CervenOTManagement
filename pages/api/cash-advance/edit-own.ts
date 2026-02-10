import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id, type, amount, purpose, date_requested } = req.body;

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

    // Check if the cash advance request exists, belongs to the user, and is pending
    const { data: existingRequest, error: fetchError } = await supabaseAdmin
      .from('cash_advances')
      .select('*')
      .eq('id', id)
      .eq('requested_by', userId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingRequest) {
      return res.status(404).json({ error: 'Cash advance request not found or does not belong to you' });
    }

    // Only allow editing if status is pending
    if (existingRequest.status !== 'pending') {
      return res.status(400).json({
        error: 'Cannot edit cash advance request that has already been processed. Only pending requests can be edited.'
      });
    }

    // Build the update payload with only provided fields
    const updatePayload: Record<string, unknown> = {};

    if (type !== undefined) {
      if (type !== 'personal' && type !== 'support') {
        return res.status(400).json({ error: 'Invalid type. Must be "personal" or "support".' });
      }
      updatePayload.type = type;
    }

    if (amount !== undefined) {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number.' });
      }
      updatePayload.amount = parsedAmount;
    }

    if (purpose !== undefined) {
      updatePayload.purpose = purpose || null;
    }

    if (date_requested !== undefined) {
      updatePayload.date_requested = date_requested;
    }

    // Check if there's anything to update
    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No fields provided to update.' });
    }

    // Update the cash advance request
    const { data: updatedRequest, error: updateError } = await supabaseAdmin
      .from('cash_advances')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    return res.status(200).json({
      message: 'Cash advance request updated successfully',
      data: updatedRequest
    });

  } catch (error: unknown) {
    console.error('Error updating cash advance request:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
