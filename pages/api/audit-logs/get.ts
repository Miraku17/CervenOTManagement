import type { NextApiResponse } from 'next';
import { supabaseAdmin } from '@/lib/supabase-server';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { userHasPermission } from '@/lib/permissions';

interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  old_data: any;
  new_data: any;
  user_id: string;
  user_email: string;
  user_name: string;
  created_at: string;
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    if (!supabaseAdmin) {
      throw new Error('Database connection not available');
    }

    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check if user has view_audit_logs permission
    const hasAccess = await userHasPermission(req.user.id, 'view_audit_logs');

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to view audit logs'
      });
    }

    const auditLogs: AuditLog[] = [];

    // Fetch store inventory logs (created, updated, deleted) - limit to most recent 1000 records
    const { data: storeInventory, error: storeError } = await supabaseAdmin
      .from('store_inventory')
      .select('id, created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, serial_number')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (storeError) throw storeError;

    // Fetch asset inventory logs (created, updated, deleted) - limit to most recent 1000 records
    const { data: assetInventory, error: assetError } = await supabaseAdmin
      .from('asset_inventory')
      .select('id, created_at, updated_at, deleted_at, created_by, updated_by, deleted_by, serial_number')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (assetError) throw assetError;

    // Collect all unique user IDs
    const userIds = new Set<string>();
    for (const item of [...(storeInventory || []), ...(assetInventory || [])]) {
      if (item.created_by) userIds.add(item.created_by);
      if (item.updated_by) userIds.add(item.updated_by);
      if (item.deleted_by) userIds.add(item.deleted_by);
    }

    // Fetch all users at once
    const { data: users } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', Array.from(userIds));

    // Create a map for quick user lookup
    const userMap = new Map(
      (users || []).map(user => [user.id, user])
    );

    // Process store inventory logs
    for (const item of storeInventory || []) {
      // Created log
      if (item.created_by) {
        const user = userMap.get(item.created_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-created`,
            table_name: 'store_inventory',
            record_id: item.id,
            action: 'INSERT',
            old_data: null,
            new_data: { serial_number: item.serial_number },
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.created_at,
          });
        }
      }

      // Updated log
      if (item.updated_by && item.updated_at && item.updated_at !== item.created_at) {
        const user = userMap.get(item.updated_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-updated-${item.updated_at}`,
            table_name: 'store_inventory',
            record_id: item.id,
            action: 'UPDATE',
            old_data: null,
            new_data: null,
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.updated_at,
          });
        }
      }

      // Deleted log
      if (item.deleted_by && item.deleted_at) {
        const user = userMap.get(item.deleted_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-deleted`,
            table_name: 'store_inventory',
            record_id: item.id,
            action: 'DELETE',
            old_data: { serial_number: item.serial_number },
            new_data: null,
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.deleted_at,
          });
        }
      }
    }

    // Process asset inventory logs
    for (const item of assetInventory || []) {
      // Created log
      if (item.created_by) {
        const user = userMap.get(item.created_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-created`,
            table_name: 'asset_inventory',
            record_id: item.id,
            action: 'INSERT',
            old_data: null,
            new_data: { serial_number: item.serial_number },
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.created_at,
          });
        }
      }

      // Updated log
      if (item.updated_by && item.updated_at && item.updated_at !== item.created_at) {
        const user = userMap.get(item.updated_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-updated-${item.updated_at}`,
            table_name: 'asset_inventory',
            record_id: item.id,
            action: 'UPDATE',
            old_data: null,
            new_data: null,
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.updated_at,
          });
        }
      }

      // Deleted log
      if (item.deleted_by && item.deleted_at) {
        const user = userMap.get(item.deleted_by);
        if (user) {
          auditLogs.push({
            id: `${item.id}-deleted`,
            table_name: 'asset_inventory',
            record_id: item.id,
            action: 'DELETE',
            old_data: { serial_number: item.serial_number },
            new_data: null,
            user_id: user.id,
            user_email: user.email,
            user_name: `${user.first_name} ${user.last_name}`,
            created_at: item.deleted_at,
          });
        }
      }
    }

    // Sort all logs by created_at descending
    auditLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return res.status(200).json({
      logs: auditLogs,
      count: auditLogs.length,
    });
  } catch (error: any) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
  }
}

export default withAuth(handler, { requireRole: ['admin'] });
