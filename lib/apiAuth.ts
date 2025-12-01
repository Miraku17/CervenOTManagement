import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from './supabase-server';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export const withAuth = (
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void,
  options?: {
    requireRole?: 'admin' | 'employee';
  }
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (!supabaseAdmin) {
      return res.status(500).json({ error: 'Server configuration error: Admin client not available' });
    }

    try {
      // Get the authorization header
      const authHeader = req.headers.authorization;

      if (!authHeader?.startsWith('Bearer ')) {
        // Try to get session from cookies (for browser requests)
        const cookies = req.headers.cookie;

        if (!cookies) {
          return res.status(401).json({ error: 'Unauthorized: No authentication provided' });
        }

        // Parse cookies to get the access token
        const cookieArr = cookies.split(';');
        const accessTokenCookie = cookieArr.find(c => c.trim().startsWith('sb-access-token='));

        if (!accessTokenCookie) {
          return res.status(401).json({ error: 'Unauthorized: No access token found' });
        }

        const accessToken = accessTokenCookie.split('=')[1];

        // Verify the token
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);

        if (error || !user) {
          console.error('[API Auth] Token verification failed:', error);
          return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        // Fetch user profile to get role
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('[API Auth] Failed to fetch user profile:', profileError);
        }

        // Attach user to request
        (req as AuthenticatedRequest).user = {
          id: user.id,
          email: user.email,
          role: profile?.role || 'employee',
        };

        // Check role if required
        if (options?.requireRole && profile?.role !== options.requireRole) {
          return res.status(403).json({
            error: `Forbidden: ${options.requireRole} role required`
          });
        }

        return handler(req as AuthenticatedRequest, res);
      }

      // Extract token from Bearer header
      const token = authHeader.split(' ')[1];

      // Verify the token
      const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !user) {
        console.error('[API Auth] Token verification failed:', error);
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
      }

      // Fetch user profile to get role
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('[API Auth] Failed to fetch user profile:', profileError);
      }

      // Attach user to request
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        role: profile?.role || 'employee',
      };

      // Check role if required
      if (options?.requireRole && profile?.role !== options.requireRole) {
        return res.status(403).json({
          error: `Forbidden: ${options.requireRole} role required`
        });
      }

      return handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('[API Auth] Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
