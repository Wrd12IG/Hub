import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  
  // Read session/role cookies if set
  const userRole = request.cookies.get('hub_user_role')?.value || request.cookies.get('user_role')?.value;

  // Protect admin-only routes (/admin, /admin/*, /clients, /clients/*)
  const isAdminRoute = path.startsWith('/admin');
  const isClientsRoute = path.startsWith('/clients');

  if (isAdminRoute || isClientsRoute) {
    // If explicit client role cookie is detected on admin routes, redirect to unauthorized
    if (userRole === 'Cliente') {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/clients/:path*',
  ],
};
