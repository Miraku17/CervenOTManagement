import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { sendCashAdvanceLevel1Email } from '@/lib/email';

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

    const { type, amount, date, purpose } = req.body;

    // Validate required fields
    if (!type || !['personal', 'support'].includes(type)) {
      return res.status(400).json({ error: 'Invalid cash advance type. Must be "personal" or "support".' });
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: 'Please provide a valid amount greater than 0.' });
    }

    if (!date) {
      return res.status(400).json({ error: 'Please provide a date.' });
    }

    // Create the cash advance request with level1_status set to pending
    const { data: cashAdvance, error: insertError } = await supabaseAdmin
      .from('cash_advances')
      .insert({
        type,
        amount: parseFloat(amount),
        purpose: purpose || null,
        requested_by: userId,
        date_requested: new Date(date).toISOString(),
        status: 'pending',
        level1_status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating cash advance request:', insertError);
      throw insertError;
    }

    // Fetch user profile for email
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single();

    // Send email notification to Level 1 approvers only (don't block the response on email failure)
    if (userProfile) {
      sendCashAdvanceLevel1Email({
        requesterName: `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Unknown',
        requesterEmail: userProfile.email || 'No email provided',
        type,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        purpose: purpose || undefined,
        requestId: cashAdvance.id,
        level: 'level1',
      }).catch((err) => {
        console.error('Failed to send Level 1 approver email notification:', err);
      });
    }

    return res.status(201).json({
      message: 'Cash advance request submitted successfully',
      cashAdvance,
    });
  } catch (error: any) {
    console.error('Cash advance request error:', error);
    return res.status(500).json({
      error: error.message || 'Failed to submit cash advance request',
    });
  }
}

export default withAuth(handler);
