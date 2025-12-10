import type { NextApiRequest, NextApiResponse } from 'next';
import { supabaseAdmin } from './supabase-server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    email?: string;
    role?: string;
    position?: string;
  };
}

export const withAuth = (
  handler: (req: AuthenticatedRequest, res: NextApiResponse) => Promise<void> | void,
  options?: {
    requireRole?: string | string[];
    requirePosition?: string | string[];
  }
) => {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // If we have an admin client, we can use it for role fetching later.
    // If not, we might have issues fetching roles if RLS doesn't allow it for the user.
    if (!supabaseAdmin) {
      console.warn('Admin client not available - some role checks might fail');
    }

    try {
      let user = null;
      const authHeader = req.headers.authorization;

      // 1. Try Bearer Token (Header)
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        if (supabaseAdmin) {
           const { data, error } = await supabaseAdmin.auth.getUser(token);
           if (!error && data.user) {
             user = data.user;
           }
        }
      } 
      
      // 2. Try Cookies (if no user found yet)
      if (!user) {
         // Create a temporary Supabase client to validate the session from cookies
         const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
              cookies: {
                getAll() {
                  return Object.keys(req.cookies).map((name) => ({ name, value: req.cookies[name] || '' }));
                },
                setAll(cookiesToSet) {
                  // We can attempt to set cookies on the response if the session refreshes,
                  // but for a simple API check, we mostly just need to read.
                  try {
                    const currentCookies = res.getHeader('Set-Cookie');
                    let newCookies: string[] = Array.isArray(currentCookies) ? currentCookies : (currentCookies ? [String(currentCookies)] : []);
                    
                    cookiesToSet.forEach(({ name, value, options }) => {
                       let cookieString = `${name}=${value}`;
                       if (options.maxAge) cookieString += `; Max-Age=${options.maxAge}`;
                       if (options.domain) cookieString += `; Domain=${options.domain}`;
                       if (options.path) cookieString += `; Path=${options.path}`;
                       if (options.httpOnly) cookieString += `; HttpOnly`;
                       if (options.secure) cookieString += `; Secure`;
                       if (options.sameSite) cookieString += `; SameSite=${options.sameSite}`;
                       newCookies.push(cookieString);
                    });
                    
                    if (newCookies.length > 0) {
                        res.setHeader('Set-Cookie', newCookies);
                    }
                  } catch (e) {
                    console.error('Error setting cookies in API route', e);
                  }
                },
              },
            }
          );
          
          const { data, error } = await supabase.auth.getUser();
          if (!error && data.user) {
            user = data.user;
          }
      }

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token or session' });
      }

      // Fetch user profile to get role and position
      // We use supabaseAdmin to bypass RLS for reading the role, to be safe.
      let role = 'employee';
      let position: string | undefined;
      
      if (supabaseAdmin) {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        if (profileError) {
          console.error('[API Auth] Failed to fetch user profile:', profileError);
        } else {
           role = profile?.role || 'employee';
           // Extract position name safely
           position = (profile?.positions as any)?.name; 
        }
      }

      // Attach user to request
      (req as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email,
        role: role,
        position: position,
      };

      // Check authorization
      if (options) {
        const { requireRole, requirePosition } = options;
        
        const allowedRoles = requireRole 
          ? (Array.isArray(requireRole) ? requireRole : [requireRole]) 
          : [];
          
        const allowedPositions = requirePosition 
          ? (Array.isArray(requirePosition) ? requirePosition : [requirePosition]) 
          : [];

        // Determine if specific restrictions are in place
        const hasRoleRestriction = allowedRoles.length > 0;
        const hasPositionRestriction = allowedPositions.length > 0;

        // Assume authorized initially, then check restrictions
        let isAuthorized = true;

        if (hasRoleRestriction) {
          if (!allowedRoles.includes(role)) {
            isAuthorized = false;
          }
        }

        if (hasPositionRestriction) {
          if (!(position && allowedPositions.includes(position))) {
            isAuthorized = false;
          }
        }

        if ((hasRoleRestriction || hasPositionRestriction) && !isAuthorized) {
           return res.status(403).json({ error: 'Forbidden' });
        }
      }

      return handler(req as AuthenticatedRequest, res);
    } catch (error) {
      console.error('[API Auth] Unexpected error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
};
