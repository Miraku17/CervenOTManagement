import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Position name is required.' });
  }

  try {
    // Check if position already exists
    const { data: existingPosition, error: checkError } = await supabaseAdmin
      .from('positions')
      .select('*')
      .ilike('name', name.trim())
      .single();

    if (existingPosition) {
      return res.status(409).json({
        error: 'Position already exists.',
        position: existingPosition
      });
    }

    // Insert new position
    const { data: newPosition, error: insertError } = await supabaseAdmin
      .from('positions')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      message: 'Position created successfully',
      position: newPosition
    });

  } catch (error: any) {
    console.error('Create-position error:', error.message);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred.' });
  }
}
