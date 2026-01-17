import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const userId = req.user?.id || '';
  const userPosition = req.user?.position?.toLowerCase();

  if (!supabaseAdmin) {
    return res.status(500).json({ error: 'Database connection not available' });
  }

  // Field Engineers cannot create new lookup values
  if (userPosition === 'field engineer') {
    return res.status(403).json({
      error: 'Forbidden: Field Engineers cannot create new categories, brands, models, or stations'
    });
  }

  // Check if user has position-based access (asset or operations manager)
  const hasPositionAccess = userPosition === 'asset' || userPosition === 'operations manager';

  // Check if user has manage_store_inventory permission
  const hasManagePermission = await userHasPermission(userId, 'manage_store_inventory');

  // Check if user has edit-only access from store_inventory_edit_access table
  const { data: editAccess } = await supabaseAdmin
    .from('store_inventory_edit_access')
    .select('can_edit')
    .eq('profile_id', userId)
    .maybeSingle();

  const hasEditAccess = editAccess?.can_edit === true;

  // User must have at least one form of access
  if (!hasPositionAccess && !hasManagePermission && !hasEditAccess) {
    return res.status(403).json({
      error: 'Forbidden: You do not have permission to create new categories, brands, models, or stations'
    });
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
    // Tables with soft delete support
    const tablesWithSoftDelete = ['categories', 'brands', 'models'];

    // First, try to find existing record (exclude soft-deleted for supported tables)
    let query = supabaseAdmin
      .from(tableName)
      .select('id, name')
      .eq('name', value);

    // Only filter by deleted_at if the table supports soft delete
    if (tablesWithSoftDelete.includes(tableName)) {
      query = query.is('deleted_at', null);
    }

    const { data: existing, error: findError } = await query.maybeSingle();

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

export default withAuth(handler);
