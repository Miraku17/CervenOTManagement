import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const {
    store_id,
    station_id,
    category_id,
    brand_id,
    model_id,
    serial_number,
    under_warranty,
    warranty_date
  } = req.body;
  const userId = req.user?.id;

  if (!store_id) {
    return res.status(400).json({ error: 'Store is required' });
  }

  if (!station_id) {
    return res.status(400).json({ error: 'Station is required' });
  }

  if (!serial_number) {
    return res.status(400).json({ error: 'Serial number is required' });
  }

  if (!category_id || !brand_id || !model_id) {
    return res.status(400).json({ error: 'Category, Brand, and Model are required' });
  }

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  try {

    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    // Create the inventory item with foreign keys and audit fields
    const { data: insertedItem, error: insertError } = await supabaseAdmin
      .from('store_inventory')
      .insert([
        {
          store_id,
          station_id,
          category_id,
          brand_id,
          model_id,
          serial_number,
          under_warranty: under_warranty || false,
          warranty_date: warranty_date || null,
          created_by: userId,
        },
      ])
      .select('id')
      .single();

    if (insertError) throw insertError;

    // Fetch the complete record
    const { data: inventoryItem, error: fetchError } = await supabaseAdmin
      .from('store_inventory')
      .select('*')
      .eq('id', insertedItem.id)
      .single();

    if (fetchError) throw fetchError;

    return res.status(200).json({
      message: 'Inventory item created successfully',
      item: inventoryItem,
    });
  } catch (error: any) {
    console.error('Error creating inventory item:', error);
    return res.status(500).json({ error: error.message || 'Failed to create inventory item' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
