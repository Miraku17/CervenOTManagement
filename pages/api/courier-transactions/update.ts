import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb', // Allow the invoice photo as base64
    },
  },
};

interface UpdateCourierTransactionRequest {
  id: string;
  transaction_date: string;
  ticket_id?: number | null;
  ticket_number?: string;
  pick_up_from: string;
  deliver_to: string;
  part_name?: string;
  courier?: string;
  reference_number?: string;
  amount?: string | number;
  store_id?: string | null;
  invoice?: {
    fileName: string;
    fileType: string;
    fileData: string; // base64
  } | null;
  remove_invoice?: boolean;
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

    const hasAccess = await userHasPermission(userId, 'manage_courier_transactions');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to manage courier transactions' });
    }

    const {
      id,
      transaction_date,
      ticket_id,
      ticket_number,
      pick_up_from,
      deliver_to,
      part_name,
      courier,
      reference_number,
      amount,
      store_id,
      invoice,
      remove_invoice,
    }: UpdateCourierTransactionRequest = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Transaction ID is required' });
    }
    if (!transaction_date) {
      return res.status(400).json({ error: 'Date is required' });
    }
    if (!pick_up_from?.trim()) {
      return res.status(400).json({ error: 'Pick up from is required' });
    }
    if (!deliver_to?.trim()) {
      return res.status(400).json({ error: 'Deliver to is required' });
    }

    const parsedAmount = parseFloat(String(amount ?? '0')) || 0;
    if (parsedAmount < 0) {
      return res.status(400).json({ error: 'Amount cannot be negative' });
    }

    // Fetch existing row (needed for invoice replacement/removal)
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('courier_transactions')
      .select('id, invoice_path')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return res.status(404).json({ error: 'Courier transaction not found' });
    }

    const updatePayload: Record<string, unknown> = {
      transaction_date,
      ticket_id: ticket_id || null,
      ticket_number: ticket_number?.trim() || null,
      pick_up_from: pick_up_from.trim(),
      deliver_to: deliver_to.trim(),
      part_name: part_name?.trim() || null,
      courier: courier?.trim() || null,
      reference_number: reference_number?.trim() || null,
      amount: parsedAmount,
      store_id: store_id || null,
      updated_at: new Date().toISOString(),
    };

    let warning: string | undefined;

    // Handle new invoice upload (replaces the old one)
    if (invoice?.fileData && invoice.fileName) {
      const buffer = Buffer.from(invoice.fileData, 'base64');

      if (buffer.length > 15 * 1024 * 1024) {
        warning = 'Invoice was not replaced: file exceeds 15MB';
      } else {
        const sanitizedName = invoice.fileName
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/^\.+/, '')
          .replace(/\.+/g, '.');
        const storagePath = `${id}/${Date.now()}-${sanitizedName}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from('courier-invoices')
          .upload(storagePath, buffer, {
            contentType: invoice.fileType || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading courier invoice:', uploadError);
          warning = 'Invoice was not replaced: ' + uploadError.message;
        } else {
          // Remove the old file after a successful upload
          if (existing.invoice_path) {
            await supabaseAdmin.storage.from('courier-invoices').remove([existing.invoice_path]);
          }
          updatePayload.invoice_path = storagePath;
          updatePayload.invoice_file_name = invoice.fileName;
        }
      }
    } else if (remove_invoice && existing.invoice_path) {
      await supabaseAdmin.storage.from('courier-invoices').remove([existing.invoice_path]);
      updatePayload.invoice_path = null;
      updatePayload.invoice_file_name = null;
    }

    const { data: transaction, error: updateError } = await supabaseAdmin
      .from('courier_transactions')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({ transaction, ...(warning ? { warning } : {}) });
  } catch (error: any) {
    console.error('Error updating courier transaction:', error);
    return res.status(500).json({ error: error.message || 'Failed to update courier transaction' });
  }
}

export default withAuth(handler);
