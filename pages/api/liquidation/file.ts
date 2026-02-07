import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { sendLiquidationSubmittedEmail } from '@/lib/email';

// Increase body size limit for this API route
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

interface LiquidationItem {
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

interface LiquidationRequest {
  userId: string;
  cash_advance_id: string;
  store_id?: string;
  ticket_id?: string;
  liquidation_date: string;
  remarks: string;
  items: LiquidationItem[];
}

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

    const {
      cash_advance_id,
      store_id,
      ticket_id,
      liquidation_date,
      remarks,
      items,
    }: LiquidationRequest = req.body;

    // Validate required fields
    if (!cash_advance_id) {
      return res.status(400).json({ error: 'Cash advance is required' });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'At least one expense item is required' });
    }

    // Verify the cash advance belongs to the user and is approved
    const { data: cashAdvance, error: caError } = await supabaseAdmin
      .from('cash_advances')
      .select('*')
      .eq('id', cash_advance_id)
      .eq('requested_by', userId)
      .eq('status', 'approved')
      .eq('type', 'support')
      .single();

    if (caError || !cashAdvance) {
      return res.status(400).json({
        error: 'Invalid cash advance. Must be an approved support cash advance.',
      });
    }

    // Check if liquidation already exists for this cash advance
    const { data: existingLiquidation } = await supabaseAdmin
      .from('liquidations')
      .select('id')
      .eq('cash_advance_id', cash_advance_id)
      .single();

    if (existingLiquidation) {
      return res.status(400).json({
        error: 'A liquidation already exists for this cash advance.',
      });
    }

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
    const returnToCompany = cashAdvance.amount >= totalAmount
      ? cashAdvance.amount - totalAmount
      : 0;
    const reimbursement = totalAmount > cashAdvance.amount
      ? totalAmount - cashAdvance.amount
      : 0;

    // Create liquidation
    const { data: liquidation, error: liquidationError } = await supabaseAdmin
      .from('liquidations')
      .insert({
        cash_advance_id,
        user_id: userId,
        store_id: store_id || null,
        ticket_id: ticket_id ? parseInt(ticket_id) : null,
        liquidation_date,
        total_amount: totalAmount,
        return_to_company: returnToCompany,
        reimbursement: reimbursement,
        remarks: remarks || null,
        status: 'pending',
      })
      .select()
      .single();

    if (liquidationError) {
      console.error('Error creating liquidation:', liquidationError);
      throw new Error('Failed to create liquidation');
    }

    // Create liquidation items
    const itemsToInsert = processedItems.map((item) => ({
      liquidation_id: liquidation.id,
      ...item,
    }));

    const { data: createdItems, error: itemsError } = await supabaseAdmin
      .from('liquidation_items')
      .insert(itemsToInsert)
      .select();

    if (itemsError) {
      console.error('Error creating liquidation items:', itemsError);
      // Rollback - delete the liquidation
      await supabaseAdmin.from('liquidations').delete().eq('id', liquidation.id);
      throw new Error('Failed to create liquidation items');
    }

    // Send email notification to approvers (async, non-blocking)
    // COMMENTED OUT FOR TESTING
    /*
    (async () => {
      try {
        // Fetch user info
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('first_name, last_name, email')
          .eq('id', userId)
          .single();

        // Fetch store name if store_id is provided
        let storeName: string | undefined;
        if (store_id) {
          const { data: store } = await supabaseAdmin
            .from('stores')
            .select('store_name, store_code')
            .eq('id', store_id)
            .single();
          if (store) {
            storeName = `${store.store_name} (${store.store_code})`;
          }
        }

        // Fetch ticket reference if ticket_id is provided
        let ticketReference: string | undefined;
        if (ticket_id) {
          const { data: ticket } = await supabaseAdmin
            .from('tickets')
            .select('rcc_reference_number')
            .eq('id', parseInt(ticket_id))
            .single();
          if (ticket) {
            ticketReference = ticket.rcc_reference_number;
          }
        }

        if (userProfile) {
          await sendLiquidationSubmittedEmail({
            requesterName: `${userProfile.first_name} ${userProfile.last_name}`,
            requesterEmail: userProfile.email,
            cashAdvanceAmount: cashAdvance.amount,
            totalExpenses: totalAmount,
            returnToCompany,
            reimbursement,
            liquidationDate: liquidation_date,
            storeName,
            ticketReference,
            requestId: liquidation.id,
          });
        }
      } catch (emailError) {
        console.error('Failed to send liquidation notification email:', emailError);
      }
    })();
    */

    return res.status(201).json({
      message: 'Liquidation submitted successfully',
      liquidation: {
        ...liquidation,
        items: createdItems || processedItems,
      },
    });
  } catch (error: unknown) {
    console.error('File liquidation error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to submit liquidation';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);

