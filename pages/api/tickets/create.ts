import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { formatInTimeZone } from 'date-fns-tz';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Check for restricted positions (even if admin)
  const userPosition = req.user?.position?.toLowerCase() || '';
  const restrictedPositions = ['field engineer'];
  if (restrictedPositions.includes(userPosition)) {
    return res.status(403).json({ error: 'Forbidden: Access denied for your position' });
  }

  const {
    store_id,
    station_id,
    mod_id,
    rcc_reference_number,
    kb_id,
    request_type,
    request_type_id,
    device,
    request_detail,
    problem_category,
    problem_category_id,
    sev,
    date_reported,
    time_reported,
    status,
    reported_by,
    serviced_by,
    serial_number,
  } = req.body;

  // Validation
  if (!store_id || !station_id || !rcc_reference_number || !request_type || !device || !request_detail || !problem_category || !sev) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    const PHILIPPINE_TZ = 'Asia/Manila';
    const currentTime = formatInTimeZone(new Date(), PHILIPPINE_TZ, 'HH:mm');

    let finalRequestTypeId = request_type_id || null;
    let finalProblemCategoryId = problem_category_id || null;

    // If no request_type_id provided but request_type text exists, find or create it
    if (!finalRequestTypeId && request_type) {
      // Check if it already exists
      const { data: existingRequestType } = await supabaseAdmin
        .from('request_types')
        .select('id')
        .eq('name', request_type)
        .single();

      if (existingRequestType) {
        finalRequestTypeId = existingRequestType.id;
      } else {
        // Create new request type
        const { data: newRequestType, error: rtError } = await supabaseAdmin
          .from('request_types')
          .insert([{ name: request_type }])
          .select('id')
          .single();

        if (rtError) {
          console.error('Error creating request type:', rtError);
        } else if (newRequestType) {
          finalRequestTypeId = newRequestType.id;
        }
      }
    }

    // If no problem_category_id provided but problem_category text exists, find or create it
    if (!finalProblemCategoryId && problem_category) {
      // Check if it already exists
      const { data: existingProblemCategory } = await supabaseAdmin
        .from('problem_categories')
        .select('id')
        .eq('name', problem_category)
        .single();

      if (existingProblemCategory) {
        finalProblemCategoryId = existingProblemCategory.id;
      } else {
        // Create new problem category
        const { data: newProblemCategory, error: pcError } = await supabaseAdmin
          .from('problem_categories')
          .insert([{ name: problem_category }])
          .select('id')
          .single();

        if (pcError) {
          console.error('Error creating problem category:', pcError);
        } else if (newProblemCategory) {
          finalProblemCategoryId = newProblemCategory.id;
        }
      }
    }

    // If serial_number is provided, check if it exists in asset_inventory
    // If not, create it using data from store_inventory
    if (serial_number && serial_number.trim() !== '' && serial_number.toUpperCase() !== 'N/A') {
      const { data: existingAsset } = await supabaseAdmin
        .from('asset_inventory')
        .select('id')
        .ilike('serial_number', serial_number)
        .is('deleted_at', null)
        .maybeSingle();

      if (!existingAsset) {
        // Asset doesn't exist, check if it's in store_inventory
        const { data: storeInventoryItem } = await supabaseAdmin
          .from('store_inventory')
          .select('category_id, brand_id, model_id, serial_number, under_warranty, warranty_date')
          .ilike('serial_number', serial_number)
          .is('deleted_at', null)
          .maybeSingle();

        if (storeInventoryItem) {
          // Create asset_inventory record
          const assetData: any = {
            serial_number: storeInventoryItem.serial_number,
            category_id: storeInventoryItem.category_id,
            brand_id: storeInventoryItem.brand_id,
            model_id: storeInventoryItem.model_id,
            status: 'In Use',
            under_warranty: storeInventoryItem.under_warranty || false,
          };

          // If under warranty, also save the warranty date
          if (storeInventoryItem.under_warranty && storeInventoryItem.warranty_date) {
            assetData.warranty_date = storeInventoryItem.warranty_date;
          }

          const { error: assetError } = await supabaseAdmin
            .from('asset_inventory')
            .insert([assetData]);

          if (assetError) {
            console.error('Error creating asset inventory:', assetError);
            // Don't fail the ticket creation if asset creation fails
          } else {
            console.log('Created asset inventory for serial number:', storeInventoryItem.serial_number);
          }
        }
      }
    }

    // Create the ticket
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert([
        {
          store_id,
          station_id,
          mod_id: mod_id || null,
          rcc_reference_number: rcc_reference_number || null,
          kb_id: kb_id || null,
          request_type,
          request_type_id: finalRequestTypeId,
          device,
          request_detail,
          problem_category,
          problem_category_id: finalProblemCategoryId,
          sev,
          date_reported: date_reported || new Date().toISOString(),
          time_reported: time_reported || currentTime,
          status: status || 'open',
          reported_by: reported_by || null,
          serviced_by: serviced_by || null,
          serial_number: serial_number || null,
        },
      ])
      .select()
      .single();

    if (ticketError) {
      throw ticketError;
    }

    // Link the ticket to asset_inventory if serial_number is provided
    if (ticket && serial_number && serial_number.trim() !== '' && serial_number.toUpperCase() !== 'N/A') {
      const { error: linkError } = await supabaseAdmin
        .from('asset_inventory')
        .update({ ticket_id: ticket.id })
        .ilike('serial_number', serial_number)
        .is('deleted_at', null);

      if (linkError) {
        console.error('Error linking ticket to asset:', linkError);
        // Don't fail the ticket creation if linking fails
      } else {
        console.log('Linked ticket', ticket.id, 'to asset with serial number:', serial_number);
      }
    }

    return res.status(201).json({ ticket });
  } catch (error: any) {
    console.error('Error creating ticket:', error);
    return res.status(500).json({ error: error.message || 'Failed to create ticket' });
  }
}

export default withAuth(handler, { requireRole: ['admin', 'employee'] });
