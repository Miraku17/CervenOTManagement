// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Initialize Supabase SSR client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { pathname } = request.nextUrl;

  // Public routes (no login required)
  const isRootPath = pathname === '/' || pathname === '';
  const isAuthRoute = pathname.startsWith('/auth/login') ||
                      pathname.startsWith('/auth/forgot-password') ||
                      pathname.startsWith('/auth/reset-password');
  const isPublicRoute = isRootPath || isAuthRoute;

  // Protected routes
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isProtectedRoute = isDashboardRoute;

  // Get authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  // Redirect unauthenticated users from protected routes
  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/auth/login', request.url));
  }

  // If user is authenticated
  if (user) {
    // Fetch user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role || 'employee';

    // Redirect authenticated users visiting public routes to dashboard
    if (isPublicRoute) {
      const redirectPath =
        userRole === 'admin' ? '/dashboard/admin' : '/dashboard/employee';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Role-based access control
    if (pathname.startsWith('/dashboard/admin') && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard/employee', request.url));
    }

    if (pathname.startsWith('/dashboard/employee') && userRole === 'admin') {
      return NextResponse.redirect(new URL('/dashboard/admin', request.url));
    }

    // Redirect generic /dashboard root to role-specific dashboard
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const redirectPath =
        userRole === 'admin' ? '/dashboard/admin' : '/dashboard/employee';
      return NextResponse.redirect(new URL(redirectPath, request.url));
    }
  }

  return response;
}

// Apply middleware only to relevant routes
export const config = {
  matcher: ['/dashboard/:path*', '/auth/:path*', '/'],
};
