import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          });
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          response.cookies.set({
            name,
            value: '',
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/forgot-password', '/auth/reset-password'];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Protected routes
  const isAdminRoute = pathname.startsWith('/admin');
  const isDashboardRoute = pathname.startsWith('/dashboard');
  const isProtectedRoute = isAdminRoute || isDashboardRoute;

  // If user is not authenticated and trying to access protected route
  if (!user && isProtectedRoute) {
    const redirectUrl = new URL('/auth/login', request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // If user is authenticated
  if (user) {
    // Fetch user role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role;

    // Redirect authenticated users away from login page
    if (isPublicRoute) {
      const redirectPath = userRole === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
      const redirectUrl = new URL(redirectPath, request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Role-based access control
    if (isAdminRoute && userRole !== 'admin') {
      // Non-admin users trying to access admin routes
      const redirectUrl = new URL('/dashboard/employee', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    if (isDashboardRoute && pathname.startsWith('/dashboard/employee') && userRole === 'admin') {
      // Admin users trying to access employee dashboard
      const redirectUrl = new URL('/admin/dashboard', request.url);
      return NextResponse.redirect(redirectUrl);
    }

    // Redirect root dashboard to role-specific dashboard
    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const redirectPath = userRole === 'admin' ? '/admin/dashboard' : '/dashboard/employee';
      const redirectUrl = new URL(redirectPath, request.url);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/auth/:path*',
  ],
};
