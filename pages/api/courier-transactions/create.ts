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

interface CreateCourierTransactionRequest {
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

    const hasAccess = await userHasPermission(userId, 'manage_courier_transactions');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to manage courier transactions' });
    }

    const {
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
    }: CreateCourierTransactionRequest = req.body;

    // Validate required fields
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

    // Insert the transaction first (invoice path is attached after upload)
    const { data: transaction, error: insertError } = await supabaseAdmin
      .from('courier_transactions')
      .insert({
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
        created_by: userId,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Upload the invoice photo if provided
    if (invoice?.fileData && invoice.fileName) {
      const buffer = Buffer.from(invoice.fileData, 'base64');

      if (buffer.length > 15 * 1024 * 1024) {
        return res.status(200).json({
          transaction,
          warning: 'Transaction saved, but invoice was not uploaded: file exceeds 15MB',
        });
      }

      const sanitizedName = invoice.fileName
        .toLowerCase()
        .replace(/[^a-z0-9.-]/g, '-')
        .replace(/^\.+/, '')
        .replace(/\.+/g, '.');
      const storagePath = `${transaction.id}/${Date.now()}-${sanitizedName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('courier-invoices')
        .upload(storagePath, buffer, {
          contentType: invoice.fileType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading courier invoice:', uploadError);
        return res.status(200).json({
          transaction,
          warning: 'Transaction saved, but invoice upload failed: ' + uploadError.message,
        });
      }

      const { data: updated, error: updateError } = await supabaseAdmin
        .from('courier_transactions')
        .update({ invoice_path: storagePath, invoice_file_name: invoice.fileName })
        .eq('id', transaction.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return res.status(201).json({ transaction: updated });
    }

    return res.status(201).json({ transaction });
  } catch (error: any) {
    console.error('Error creating courier transaction:', error);
    return res.status(500).json({ error: error.message || 'Failed to create courier transaction' });
  }
}

export default withAuth(handler);
