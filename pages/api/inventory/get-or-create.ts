import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { tableName, value } = req.body;

  if (!tableName || !value) {
    return res.status(400).json({ error: 'Table name and value are required' });
  }

  // Validate table name to prevent SQL injection
  const validTables = ['categories', 'brands', 'models', 'stations'];
  if (!validTables.includes(tableName)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    
    // First, try to find existing record (exclude soft-deleted)
    const { data: existing, error: findError } = await supabaseAdmin
      .from(tableName)
      .select('id, name')
      .eq('name', value)
      .is('deleted_at', null)
      .maybeSingle();

    if (findError) throw findError;

    if (existing) {
      // Return existing ID
      return res.status(200).json({ id: existing.id });
    }

    // Create new record
    const { data: newRecord, error: insertError } = await supabaseAdmin
      .from(tableName)
      .insert([{ name: value }])
      .select('id')
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({ id: newRecord.id });
  } catch (error: any) {
    console.error('Error in get-or-create:', error);
    return res.status(500).json({ error: error.message || 'Failed to get or create record' });
  }
}

export default withAuth(handler, { requireRole: 'admin', requirePosition: 'Operations Manager' });
