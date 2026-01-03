import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '@/lib/apiAuth';
import { getUserPermissions } from '@/lib/permissions';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;
    const authenticatedUserId = req.user?.id;

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Only allow users to fetch their own permissions
    const targetUserId = typeof userId === 'string' ? userId : authenticatedUserId;

    if (targetUserId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Cannot fetch permissions for other users' });
    }

    const permissions = await getUserPermissions(targetUserId);

    console.log('🔑 [API] Fetched permissions for user:', targetUserId);
    console.log('🔑 [API] Permissions:', permissions);

    return res.status(200).json({ permissions });
  } catch (error: any) {
    console.error('Error fetching user permissions:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

export default withAuth(handler);
