import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb', // Allow up to 50MB for multiple receipts
    },
  },
};

interface FileData {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // base64
}

interface UploadRequest {
  liquidation_id: string;
  files: FileData[];
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

    const { liquidation_id, files }: UploadRequest = req.body;

    if (!liquidation_id) {
      return res.status(400).json({ error: 'Liquidation ID is required' });
    }

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    // Verify the liquidation belongs to the user
    const { data: liquidation, error: liquidationError } = await supabaseAdmin
      .from('liquidations')
      .select('id, user_id')
      .eq('id', liquidation_id)
      .single();

    if (liquidationError || !liquidation) {
      return res.status(404).json({ error: 'Liquidation not found' });
    }

    if (liquidation.user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to upload to this liquidation' });
    }

    const uploadedFiles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.fileData || !file.fileName) {
        continue;
      }

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const sanitizedName = file.fileName
          .toLowerCase()
          .replace(/[^a-z0-9.-]/g, '-')
          .replace(/^\.+/, '')
          .replace(/\.+/g, '.');
        const fileName = `${timestamp}-${i}-${sanitizedName}`;

        // Storage path: receipts/<liquidation_id>/<filename>
        const storagePath = `${liquidation_id}/${fileName}`;

        // Convert base64 to buffer
        const buffer = Buffer.from(file.fileData, 'base64');

        // Check file size (max 10MB per file)
        if (buffer.length > 10 * 1024 * 1024) {
          console.error(`File ${file.fileName} exceeds 10MB limit`);
          continue;
        }

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('receipts')
          .upload(storagePath, buffer, {
            contentType: file.fileType || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading file:', uploadError);
          continue;
        }

        // Store the storage path (not public URL since bucket is private)
        // The path will be used to generate signed URLs when viewing
        const { data: attachment, error: attachmentError } = await supabaseAdmin
          .from('liquidation_attachments')
          .insert({
            liquidation_id: liquidation_id,
            file_name: file.fileName,
            file_path: storagePath, // Store the storage path, not public URL
            file_type: file.fileType,
            file_size: file.fileSize,
            uploaded_by: userId,
          })
          .select()
          .single();

        if (attachmentError) {
          console.error('Error saving attachment record:', attachmentError);
          continue;
        }

        uploadedFiles.push(attachment);
      } catch (error) {
        console.error('Error processing file:', error);
      }
    }

    return res.status(200).json({
      message: 'Receipts uploaded successfully',
      uploaded: uploadedFiles.length,
      attachments: uploadedFiles,
    });
  } catch (error: unknown) {
    console.error('Upload receipts error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to upload receipts';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
