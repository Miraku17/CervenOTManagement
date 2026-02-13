import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Allow up to 100MB for multiple receipts
    },
    responseLimit: false,
  },
  maxDuration: 300, // 5 minutes timeout for large uploads
};

interface FileData {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileData: string; // base64
  liquidation_item_id?: string; // Optional for backward compatibility
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

    // Validate file count (max 20 files per request)
    if (files.length > 20) {
      return res.status(400).json({
        error: `Too many files. Maximum 20 files per upload, received ${files.length}`
      });
    }

    console.log(`Processing ${files.length} file(s) for liquidation ${liquidation_id}`);

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

    // Verify the receipts bucket exists and is accessible
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets();

    if (bucketError) {
      console.error('Error listing storage buckets:', bucketError);
      return res.status(500).json({
        error: 'Storage service unavailable. Please contact administrator.',
        details: bucketError.message
      });
    }

    const receiptsBucket = buckets?.find(b => b.name === 'receipts');
    if (!receiptsBucket) {
      console.error('Receipts bucket does not exist');
      return res.status(500).json({
        error: 'Storage bucket not configured. Please contact administrator to create the "receipts" bucket in Supabase Storage.'
      });
    }

    console.log('Receipts bucket verified:', receiptsBucket);

    const uploadedFiles: any[] = [];
    const failedFiles: any[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (!file.fileData || !file.fileName) {
        failedFiles.push({
          fileName: file.fileName || 'Unknown',
          reason: 'Missing file data or filename'
        });
        continue;
      }

      try {
        // Convert base64 to buffer first to check actual size
        const buffer = Buffer.from(file.fileData, 'base64');
        const fileSizeMB = (buffer.length / (1024 * 1024)).toFixed(2);

        console.log(`Processing file ${i + 1}/${files.length}: ${file.fileName} (${fileSizeMB}MB)`);

        // Check file size (max 15MB per file after base64 decode)
        if (buffer.length > 15 * 1024 * 1024) {
          const errorMsg = `File too large: ${fileSizeMB}MB (max 15MB)`;
          console.error(`File ${file.fileName}: ${errorMsg}`);
          failedFiles.push({
            fileName: file.fileName,
            reason: errorMsg
          });
          continue;
        }

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

        // Upload to Supabase Storage (using admin client to bypass RLS)
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('receipts')
          .upload(storagePath, buffer, {
            contentType: file.fileType || 'application/octet-stream',
            upsert: false,
          });

        if (uploadError) {
          console.error('Error uploading file to storage:', {
            fileName: file.fileName,
            storagePath,
            error: uploadError,
            message: uploadError.message,
            statusCode: (uploadError as any).statusCode
          });
          failedFiles.push({
            fileName: file.fileName,
            reason: uploadError.message || 'Storage upload failed'
          });
          continue;
        }

        console.log('File uploaded successfully:', {
          fileName: file.fileName,
          storagePath,
          size: fileSizeMB + 'MB',
          uploadData
        });

        // Store the storage path (not public URL since bucket is private)
        // The path will be used to generate signed URLs when viewing
        const { data: attachment, error: attachmentError } = await supabaseAdmin
          .from('liquidation_attachments')
          .insert({
            liquidation_id: liquidation_id,
            liquidation_item_id: file.liquidation_item_id || null,
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
          failedFiles.push({
            fileName: file.fileName,
            reason: 'Database error: ' + attachmentError.message
          });
          // Try to delete the uploaded file since DB insert failed
          await supabaseAdmin.storage.from('receipts').remove([storagePath]);
          continue;
        }

        uploadedFiles.push(attachment);
      } catch (error) {
        console.error('Error processing file:', error);
        failedFiles.push({
          fileName: file.fileName,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Return response with details about successful and failed uploads
    const response: any = {
      uploaded: uploadedFiles.length,
      failed: failedFiles.length,
      total: files.length,
      attachments: uploadedFiles,
    };

    if (failedFiles.length > 0) {
      response.failedFiles = failedFiles;
      response.message = `Uploaded ${uploadedFiles.length} of ${files.length} files. ${failedFiles.length} failed.`;
    } else {
      response.message = `All ${uploadedFiles.length} files uploaded successfully`;
    }

    // Return 200 if at least one file uploaded, 400 if all failed
    const statusCode = uploadedFiles.length > 0 ? 200 : 400;

    console.log('Upload complete:', response);

    return res.status(statusCode).json(response);
  } catch (error: unknown) {
    console.error('Upload receipts error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'Failed to upload receipts';
    return res.status(500).json({ error: errorMessage });
  }
}

export default withAuth(handler);
