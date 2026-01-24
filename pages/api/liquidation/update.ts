import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

// Increase body size limit for this API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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
  liquidation_id: string;
  store_id?: string;
  ticket_id?: string;
  liquidation_date: string;
  remarks: string;
  items: LiquidationItem[];
  attachments_to_remove?: string[];
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', ['PUT']);
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

    const {
      liquidation_id,
      store_id,
      ticket_id,
      liquidation_date,
      remarks,
      items,
      attachments_to_remove,
    }: UpdateLiquidationRequest = req.body;

    // Validate required fields
    if (!liquidation_id) {
      return res.status(400).json({ error: 'Liquidation ID is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one expense item is required' });
    }

    // Verify the liquidation exists, belongs to the user, and is still pending
    const { data: existingLiquidation, error: fetchError } = await supabaseAdmin
      .from('liquidations')
      .select(`
        *,
        cash_advances (
          id,
          amount,
          requested_by
        )
      `)
      .eq('id', liquidation_id)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .single();

    if (fetchError || !existingLiquidation) {
      return res.status(404).json({
        error: 'Liquidation not found or cannot be edited. Only pending liquidations can be updated.',
      });
    }

    // Get cash advance amount for calculations
    const cashAdvanceAmount = existingLiquidation.cash_advances?.amount || 0;

    // Calculate total amount from items
    let totalAmount = 0;
    const processedItems = items.map((item) => {
      const jeep = parseFloat(item.jeep || '0') || 0;
      const bus = parseFloat(item.bus || '0') || 0;
      const fx_van = parseFloat(item.fx_van || '0') || 0;
      const gas = parseFloat(item.gas || '0') || 0;
      const toll = parseFloat(item.toll || '0') || 0;
      const meals = parseFloat(item.meals || '0') || 0;
      const lodging = parseFloat(item.lodging || '0') || 0;
      const others = parseFloat(item.others || '0') || 0;
      const itemTotal = jeep + bus + fx_van + gas + toll + meals + lodging + others;
      totalAmount += itemTotal;

      return {
        from_destination: item.from_destination || '',
        to_destination: item.to_destination || '',
        jeep,
        bus,
        fx_van,
        gas,
        toll,
        meals,
        lodging,
        others,
        total: itemTotal,
        remarks: item.remarks || '',
      };
    });

    // Calculate return to company and reimbursement
    const returnToCompany = cashAdvanceAmount >= totalAmount
      ? cashAdvanceAmount - totalAmount
      : 0;
    const reimbursement = totalAmount > cashAdvanceAmount
      ? totalAmount - cashAdvanceAmount
      : 0;

    // Update liquidation
    const { data: updatedLiquidation, error: updateError } = await supabaseAdmin
      .from('liquidations')
      .update({
        store_id: store_id || null,
        ticket_id: ticket_id ? parseInt(ticket_id) : null,
        liquidation_date,
        total_amount: totalAmount,
        return_to_company: returnToCompany,
        reimbursement: reimbursement,
        remarks: remarks || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', liquidation_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating liquidation:', updateError);
      throw new Error('Failed to update liquidation');
    }

    // Delete existing items
    const { error: deleteItemsError } = await supabaseAdmin
      .from('liquidation_items')
      .delete()
      .eq('liquidation_id', liquidation_id);

    if (deleteItemsError) {
      console.error('Error deleting old liquidation items:', deleteItemsError);
      throw new Error('Failed to update liquidation items');
    }

    // Insert new items
    const itemsToInsert = processedItems.map((item) => ({
      liquidation_id: liquidation_id,
      ...item,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('liquidation_items')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating liquidation items:', itemsError);
      throw new Error('Failed to create liquidation items');
    }

    // Handle attachment deletion if any
    if (attachments_to_remove && attachments_to_remove.length > 0) {
      // First, get the file paths for the attachments to delete
      const { data: attachmentsToDelete, error: fetchAttachmentsError } = await supabaseAdmin
        .from('liquidation_attachments')
        .select('id, file_path')
        .in('id', attachments_to_remove)
        .eq('liquidation_id', liquidation_id);

      if (fetchAttachmentsError) {
        console.error('Error fetching attachments to delete:', fetchAttachmentsError);
        // Continue without failing the whole update
      } else if (attachmentsToDelete && attachmentsToDelete.length > 0) {
        // Delete files from storage
        const filePaths = attachmentsToDelete.map((a) => a.file_path);
        const { error: storageError } = await supabaseAdmin.storage
          .from('receipts')
          .remove(filePaths);

        if (storageError) {
          console.error('Error deleting files from storage:', storageError);
          // Continue without failing - files might not exist
        }

        // Delete attachment records from database
        const { error: deleteAttachmentsError } = await supabaseAdmin
          .from('liquidation_attachments')
          .delete()
          .in('id', attachments_to_remove)
          .eq('liquidation_id', liquidation_id);

        if (deleteAttachmentsError) {
          console.error('Error deleting attachment records:', deleteAttachmentsError);
          // Continue without failing the whole update
        }
      }
    }

    return res.status(200).json({
      message: 'Liquidation updated successfully',
      liquidation: {
        ...updatedLiquidation,
        items: processedItems,
      },
    });
  } catch (error: unknown) {
    console.error('Update liquidation error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to update liquidation';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);

