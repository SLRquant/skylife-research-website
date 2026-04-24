import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Note: Firebase auth is client-side, so we can't verify tokens server-side
  // without additional setup. This proxy primarily handles redirects.
  // Actual auth checking happens in the ProtectedRoute component.

  const { pathname } = request.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // For protected routes, let the client-side component handle auth
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
