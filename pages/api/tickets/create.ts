import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    store_id,
    station,
    mod_id,
    rcc_reference_number,
    request_type,
    device,
    request_detail,
    problem_category,
    sev,
    date_reported,
    status,
    reported_by,
    serviced_by,
  } = req.body;

  // Validation
  if (!store_id || !station || !mod_id || !rcc_reference_number || !request_type || !device || !request_detail || !problem_category || !sev) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Create the ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert([
        {
          store_id,
          station,
          mod_id,
          rcc_reference_number: rcc_reference_number || null,
          request_type,
          device,
          request_detail,
          problem_category,
          sev,
          date_reported: date_reported || new Date().toISOString(),
          status: status || 'Open',
          reported_by: reported_by || null,
          serviced_by: serviced_by || null,
        },
      ])
      .select()
      .single();

    if (ticketError) {
      throw ticketError;
    }

    return res.status(201).json({ ticket });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ error: error.message || 'Failed to create ticket' });
  }
}
