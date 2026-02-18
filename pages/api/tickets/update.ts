import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

// SLA Resolution Thresholds in hours (L2 Support)
const SLA_RESOLUTION_HOURS: Record<string, number> = {
  sev1: 4,    // 4 hours resolution
  sev2: 12,   // 12 hours resolution
  sev3: 24,   // 24 hours resolution
  sev4: 48,   // 48 hours resolution
};

// Calculate SLA status based on sla_count_hrs against resolution threshold
function calculateSLAStatus(
  sev: string | null,
  slaCountHrs: number | null
): 'Passed' | 'Failed' | null {
  const severity = sev?.toLowerCase();

  // Skip unknown severities
  if (!severity || !SLA_RESOLUTION_HOURS[severity]) {
    return null;
  }

  // Need sla_count_hrs to calculate SLA status
  if (slaCountHrs === null || slaCountHrs === undefined) {
    return null;
  }

  const thresholdHours = SLA_RESOLUTION_HOURS[severity];

  // Compare sla_count_hrs against threshold
  return slaCountHrs <= thresholdHours ? 'Passed' : 'Failed';
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'PUT' && req.method !== 'PATCH') {
    res.setHeader('Allow', ['PUT', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { id, ...updateData } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Ticket ID is required' });
    }

    // Check if user has manage_tickets permission
    const hasManageTickets = await userHasPermission(req.user.id, 'manage_tickets');

    if (!hasManageTickets) {
      return res.status(403).json({
        error: 'Unauthorized: You do not have permission to update tickets'
      });
    }

    // Fetch the existing ticket to get current data for SLA calculation
    const { data: existingTicket, error: fetchError } = await supabaseAdmin
      .from('tickets')
      .select('id, store_id, serviced_by, sev, date_reported, time_reported, date_responded, time_responded, date_resolved, time_resolved, date_ack, time_ack, date_attended, work_start, work_end, pause_time_start, pause_time_end, pause_time_start_2, pause_time_end_2, sla_count_hrs')
      .eq('id', id)
      .single();

    if (fetchError || !existingTicket) {
      console.error('Error fetching ticket for update:', fetchError);
      return res.status(404).json({
        error: 'Ticket not found',
        details: fetchError
      });
    }

    // Handle free-text MOD name: look up or create a store_managers record
    if (updateData.mod_name) {
      const managerName = (updateData.mod_name as string).trim();
      const storeId = existingTicket.store_id;

      if (managerName && storeId) {
        // Check if a manager with this name already exists for the store
        const { data: existingManager } = await supabaseAdmin
          .from('store_managers')
          .select('id')
          .eq('store_id', storeId)
          .ilike('manager_name', managerName)
          .maybeSingle();

        if (existingManager) {
          updateData.mod_id = existingManager.id;
        } else {
          // Create a new store_managers record
          const { data: newManager } = await supabaseAdmin
            .from('store_managers')
            .insert({ store_id: storeId, manager_name: managerName })
            .select('id')
            .single();

          if (newManager) {
            updateData.mod_id = newManager.id;
          }
        }
      }

      delete updateData.mod_name;
    }

    // Calculate SLA Count Hours: (Date Attended & Work End) - (Date & Time Acknowledge)
    // If pause exists: SLA Count - (Pause End - Pause Start)
    const dateAck = updateData.date_ack !== undefined ? updateData.date_ack : existingTicket.date_ack;
    const timeAck = updateData.time_ack !== undefined ? updateData.time_ack : existingTicket.time_ack;
    const dateAttended = updateData.date_attended !== undefined ? updateData.date_attended : existingTicket.date_attended;
    const workEnd = updateData.work_end !== undefined ? updateData.work_end : existingTicket.work_end;
    const workStart = updateData.work_start !== undefined ? updateData.work_start : existingTicket.work_start;
    const pauseStart = updateData.pause_time_start !== undefined ? updateData.pause_time_start : existingTicket.pause_time_start;
    const pauseEnd = updateData.pause_time_end !== undefined ? updateData.pause_time_end : existingTicket.pause_time_end;
    const pauseStart2 = updateData.pause_time_start_2 !== undefined ? updateData.pause_time_start_2 : existingTicket.pause_time_start_2;
    const pauseEnd2 = updateData.pause_time_end_2 !== undefined ? updateData.pause_time_end_2 : existingTicket.pause_time_end_2;

    if (dateAck && timeAck && dateAttended && workEnd) {
      try {
        // Validate time format (HH:MM or HH:MM:SS)
        const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;

        if (!timePattern.test(timeAck)) {
          return res.status(400).json({
            error: 'Invalid time format for Time Acknowledge. Expected format: HH:MM (e.g., 09:30)'
          });
        }

        if (!timePattern.test(workEnd)) {
          return res.status(400).json({
            error: 'Invalid time format for Work End. Expected format: HH:MM (e.g., 17:30)'
          });
        }

        // Validate pause time formats if provided
        if (pauseStart && !timePattern.test(pauseStart)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause Start. Expected format: HH:MM (e.g., 12:00)'
          });
        }

        if (pauseEnd && !timePattern.test(pauseEnd)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause End. Expected format: HH:MM (e.g., 13:00)'
          });
        }

        // Validate pause 2 time formats if provided
        if (pauseStart2 && !timePattern.test(pauseStart2)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause Start 2. Expected format: HH:MM (e.g., 14:00)'
          });
        }

        if (pauseEnd2 && !timePattern.test(pauseEnd2)) {
          return res.status(400).json({
            error: 'Invalid time format for Pause End 2. Expected format: HH:MM (e.g., 15:00)'
          });
        }

        // Parse acknowledge date and time
        const ackDate = new Date(dateAck);
        const [ackHours, ackMinutes] = timeAck.split(':');
        ackDate.setHours(parseInt(ackHours), parseInt(ackMinutes), 0, 0);

        // Validate acknowledge date is valid
        if (isNaN(ackDate.getTime())) {
          return res.status(400).json({
            error: 'Invalid Date Acknowledge. Please provide a valid date.'
          });
        }

        // Combine Date Attended + Work End time to create full work end timestamp
        const workEndDate = new Date(dateAttended);
        const [workEndHours, workEndMinutes] = workEnd.split(':');
        workEndDate.setHours(parseInt(workEndHours), parseInt(workEndMinutes), 0, 0);

        // Validate date attended is valid
        if (isNaN(workEndDate.getTime())) {
          return res.status(400).json({
            error: 'Invalid Date Attended. Please provide a valid date.'
          });
        }

        // Handle overnight work: if work_end time is earlier than work_start time,
        // assume work ended the next day
        if (workStart && timePattern.test(workStart)) {
          const [workStartHours, workStartMinutes] = workStart.split(':');
          const workStartTotalMinutes = parseInt(workStartHours) * 60 + parseInt(workStartMinutes);
          const workEndTotalMinutes = parseInt(workEndHours) * 60 + parseInt(workEndMinutes);

          // If work end time is earlier than work start time, it's overnight work
          if (workEndTotalMinutes < workStartTotalMinutes) {
            workEndDate.setDate(workEndDate.getDate() + 1);
          }
        }

        // Calculate difference in hours
        const diffInMs = workEndDate.getTime() - ackDate.getTime();

        if (diffInMs < 0) {
          return res.status(400).json({
            error: 'Work End cannot be earlier than Date/Time Acknowledge'
          });
        }

        let diffInHours = diffInMs / (1000 * 60 * 60);

        // Subtract pause time if both pause start and end exist
        if (pauseStart && pauseEnd) {
          // Parse pause times and calculate duration in hours
          const [pStartHours, pStartMinutes] = pauseStart.split(':');
          const [pEndHours, pEndMinutes] = pauseEnd.split(':');

          // Convert to total minutes for easier calculation
          let pauseStartMinutes = parseInt(pStartHours) * 60 + parseInt(pStartMinutes);
          let pauseEndMinutes = parseInt(pEndHours) * 60 + parseInt(pEndMinutes);

          // Handle overnight pause: if pause end is earlier than pause start, add 24 hours
          if (pauseEndMinutes <= pauseStartMinutes) {
            pauseEndMinutes += 24 * 60; // Add 24 hours (1440 minutes)
          }

          // Calculate pause duration in hours
          const pauseDurationMinutes = pauseEndMinutes - pauseStartMinutes;
          const pauseHours = pauseDurationMinutes / 60;

          // Validate pause duration doesn't exceed total work duration
          if (pauseHours > diffInHours) {
            return res.status(400).json({
              error: 'Pause duration cannot exceed total work duration'
            });
          }

          // Subtract pause duration from total SLA hours
          diffInHours = diffInHours - pauseHours;
        } else if ((pauseStart && !pauseEnd) || (!pauseStart && pauseEnd)) {
          // Validate both pause times are provided together
          return res.status(400).json({
            error: 'Both Pause Start and Pause End must be provided together'
          });
        }

        // Subtract pause 2 time if both pause start 2 and end 2 exist
        if (pauseStart2 && pauseEnd2) {
          // Parse pause 2 times and calculate duration in hours
          const [pStart2Hours, pStart2Minutes] = pauseStart2.split(':');
          const [pEnd2Hours, pEnd2Minutes] = pauseEnd2.split(':');

          // Convert to total minutes for easier calculation
          let pause2StartMinutes = parseInt(pStart2Hours) * 60 + parseInt(pStart2Minutes);
          let pause2EndMinutes = parseInt(pEnd2Hours) * 60 + parseInt(pEnd2Minutes);

          // Handle overnight pause: if pause 2 end is earlier than pause 2 start, add 24 hours
          if (pause2EndMinutes <= pause2StartMinutes) {
            pause2EndMinutes += 24 * 60; // Add 24 hours (1440 minutes)
          }

          // Calculate pause 2 duration in hours
          const pause2DurationMinutes = pause2EndMinutes - pause2StartMinutes;
          const pause2Hours = pause2DurationMinutes / 60;

          // Validate pause 2 duration doesn't exceed remaining work duration
          if (pause2Hours > diffInHours) {
            return res.status(400).json({
              error: 'Pause 2 duration cannot exceed remaining work duration'
            });
          }

          // Subtract pause 2 duration from total SLA hours
          diffInHours = diffInHours - pause2Hours;
        } else if ((pauseStart2 && !pauseEnd2) || (!pauseStart2 && pauseEnd2)) {
          // Validate both pause 2 times are provided together
          return res.status(400).json({
            error: 'Both Pause Start 2 and Pause End 2 must be provided together'
          });
        }

        // Round to 2 decimal places and ensure it's not negative
        updateData.sla_count_hrs = Math.max(0, Math.round(diffInHours * 100) / 100);
      } catch (error) {
        console.error('Error calculating SLA count hours:', error);
        return res.status(400).json({
          error: 'Failed to calculate SLA count hours. Please check all date and time values are correct.'
        });
      }
    } else if (updateData.date_ack === null || updateData.time_ack === null || updateData.date_attended === null || updateData.work_end === null) {
      // If required fields are being cleared, also clear sla_count_hrs
      updateData.sla_count_hrs = null;
    }

    // Calculate SLA Status (Passed/Failed) based on sla_count_hrs
    const sev = updateData.sev !== undefined ? updateData.sev : existingTicket.sev;
    const slaCountHrs = updateData.sla_count_hrs !== undefined ? updateData.sla_count_hrs : existingTicket.sla_count_hrs;

    // Calculate and set SLA status (using sla_count_hrs against threshold)
    const slaStatus = calculateSLAStatus(sev, slaCountHrs);

    if (slaStatus !== null) {
      updateData.sla_status = slaStatus;
    } else if (updateData.sla_count_hrs === null) {
      // Clear SLA status if sla_count_hrs is being cleared
      updateData.sla_status = null;
    }

    // Update the ticket
    const { data: ticket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updateData)
      .eq('id', id)
      .select(`
        *,
        stores (
          store_name,
          store_code
        ),
        stations (
          name
        ),
        reported_by_user:reported_by (
          first_name,
          last_name
        ),
        serviced_by_user:serviced_by (
          first_name,
          last_name
        ),
        store_managers:mod_id (
          id,
          manager_name
        )
      `)
      .single();

    if (updateError) {
      throw updateError;
    }

    // Handle defective asset: when ticket is closed and old_parts_serial has a value,
    // add it to defective assets (status = 'Broken') or create it if it doesn't exist
    const ticketStatus = updateData.status || ticket.status;
    const oldPartsSerial = updateData.old_parts_serial !== undefined ? updateData.old_parts_serial : ticket.old_parts_serial;

    if (ticketStatus && ticketStatus.toLowerCase() === 'closed' && oldPartsSerial && oldPartsSerial.trim() !== '' && oldPartsSerial.toUpperCase() !== 'N/A') {
      try {
        // Check if an asset with this serial number already exists
        const { data: existingAsset, error: assetLookupError } = await supabaseAdmin
          .from('asset_inventory')
          .select('id, status')
          .ilike('serial_number', oldPartsSerial.trim())
          .is('deleted_at', null)
          .maybeSingle();

        if (assetLookupError) {
          console.error('Error looking up old parts serial in assets:', assetLookupError);
        } else if (existingAsset) {
          // Asset exists — update its status to Broken
          const { error: updateAssetError } = await supabaseAdmin
            .from('asset_inventory')
            .update({ status: 'Broken', updated_by: req.user!.id })
            .eq('id', existingAsset.id);

          if (updateAssetError) {
            console.error('Error updating asset to Broken:', updateAssetError);
          } else {
            console.log('Updated asset', existingAsset.id, 'to Broken for old_parts_serial:', oldPartsSerial);
          }
        } else {
          // Asset doesn't exist — create it with status Broken
          // Try to get category_id and brand_id from the ticket's linked asset (via serial_number)
          let categoryId = null;
          let brandId = null;
          let modelId = null;
          let storeId = ticket.store_id || null;

          const ticketSerial = updateData.serial_number !== undefined ? updateData.serial_number : ticket.serial_number;
          if (ticketSerial && ticketSerial.trim() !== '' && ticketSerial.toUpperCase() !== 'N/A') {
            const { data: linkedAsset } = await supabaseAdmin
              .from('asset_inventory')
              .select('category_id, brand_id, model_id, store_id')
              .ilike('serial_number', ticketSerial.trim())
              .is('deleted_at', null)
              .maybeSingle();

            if (linkedAsset) {
              categoryId = linkedAsset.category_id;
              brandId = linkedAsset.brand_id;
              modelId = linkedAsset.model_id;
              storeId = linkedAsset.store_id || storeId;
            }
          }

          const { error: createAssetError } = await supabaseAdmin
            .from('asset_inventory')
            .insert({
              serial_number: oldPartsSerial.trim(),
              status: 'Broken',
              category_id: categoryId,
              brand_id: brandId,
              model_id: modelId,
              store_id: storeId,
              ticket_id: id,
              created_by: req.user!.id,
            });

          if (createAssetError) {
            console.error('Error creating defective asset for old_parts_serial:', createAssetError);
          } else {
            console.log('Created defective asset with serial:', oldPartsSerial, 'for ticket:', id);
          }
        }
      } catch (defectiveError) {
        // Don't fail the ticket update if defective asset handling fails
        console.error('Error handling defective asset:', defectiveError);
      }
    }

    // Handle asset_inventory linking if serial_number is in the update
    if (updateData.serial_number !== undefined) {
      // If serial_number was removed or cleared, clear the ticket_id from the old asset
      if (!updateData.serial_number || updateData.serial_number.trim() === '' || updateData.serial_number.toUpperCase() === 'N/A') {
        // Clear ticket_id from any asset that was linked to this ticket
        await supabaseAdmin
          .from('asset_inventory')
          .update({ ticket_id: null })
          .eq('ticket_id', id)
          .is('deleted_at', null);

        console.log('Cleared ticket_id from assets for ticket:', id);
      } else {
        // Serial number was added or changed
        // First, clear the ticket_id from any previously linked asset
        await supabaseAdmin
          .from('asset_inventory')
          .update({ ticket_id: null })
          .eq('ticket_id', id)
          .is('deleted_at', null);

        // Then link to the new asset by serial_number
        const { error: linkError } = await supabaseAdmin
          .from('asset_inventory')
          .update({ ticket_id: id })
          .ilike('serial_number', updateData.serial_number)
          .is('deleted_at', null);

        if (linkError) {
          console.error('Error linking ticket to new asset:', linkError);
        } else {
          console.log('Linked ticket', id, 'to asset with serial number:', updateData.serial_number);
        }
      }
    }

    return res.status(200).json({ ticket });
  } catch (error: any) {
    console.error('Error updating ticket:', error);
    return res.status(500).json({ error: error.message || 'Failed to update ticket' });
  }
}

export default withAuth(handler);
