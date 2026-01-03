import { NextApiResponse } from 'next';
import { supabaseAdmin as supabase } from '@/lib/supabase-server';
import { withAuth, type AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (!supabase) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { id, action, adminId, level, comment } = req.body;

  if (!id || !action || !['approve', 'reject'].includes(action) || !level || !['level1', 'level2'].includes(level)) {
    return res.status(400).json({ message: 'Invalid request parameters. Required: id, action (approve/reject), adminId, level (level1/level2)' });
  }

  try {
    const now = new Date().toISOString();

    // Use the authenticated user ID from withAuth middleware
    const actualAdminId = req.user?.id || adminId;

    // Check level-specific authorization using permissions
    if (level === 'level1') {
      const hasPermission = await userHasPermission(actualAdminId, 'approve_overtime_level1');
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission for level 1 approval'
        });
      }
    }

    if (level === 'level2') {
      const hasPermission = await userHasPermission(actualAdminId, 'approve_overtime_level2');
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden: You do not have permission for level 2 approval'
        });
      }
    }

    // Get current overtime request to check current status
    const { data: currentRequest, error: fetchError } = await supabase
      .from('overtime_v2')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;

    // Update object
    const updates: any = {
      updated_at: now,
    };

    if (level === 'level1') {
      // Level 1 approval
      updates.level1_reviewer = actualAdminId;
      updates.level1_status = action === 'approve' ? 'approved' : 'rejected';
      updates.level1_reviewed_at = now;
      if (comment) {
        updates.level1_comment = comment;
      }

      // If level 1 is rejected, set final_status to rejected
      if (action === 'reject') {
        updates.final_status = 'rejected';
        updates.status = 'rejected';
        updates.approved_at = now;
      }
    } else if (level === 'level2') {
      // Level 2 approval - can only happen if level 1 is approved
      if (currentRequest.level1_status !== 'approved') {
        return res.status(400).json({ message: 'Level 1 approval required before level 2 approval' });
      }

      updates.level2_reviewer = actualAdminId;
      updates.level2_status = action === 'approve' ? 'approved' : 'rejected';
      updates.level2_reviewed_at = now;
      if (comment) {
        updates.level2_comment = comment;
      }

      // Set final status based on level 2 decision
      updates.final_status = action === 'approve' ? 'approved' : 'rejected';
      updates.status = action === 'approve' ? 'approved' : 'rejected';
      updates.approved_at = now;
    }

    console.log(`Updating overtime_v2 request ${id} at ${level}:`, updates);

    const { data, error } = await supabase
      .from('overtime_v2')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    console.log(`Overtime request ${level} ${action} successfully:`, data);

    return res.status(200).json({ message: `Overtime request ${level} ${action}ed`, data });

  } catch (error: any) {
    console.error('Error updating overtime request:', error);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}

export default withAuth(handler, { requireRole: 'admin' });
