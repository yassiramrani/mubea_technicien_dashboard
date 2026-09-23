import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, readSession } from '@/lib/session';

/**
 * The door. Every request must carry a valid session before it reaches a page or an API route.
 *
 * Two answers, deliberately different: an API call gets a 401 so the client can react, while a
 * page is redirected to the sign-in screen with the intended destination kept aside.
 *
 * When the application is not configured with a session secret, no session can ever be valid,
 * so everything is refused. That is the intended behaviour: an unconfigured deployment must be
 * closed rather than quietly open.
 */

const PUBLIC_PREFIXES = ['/signin', '/api/auth'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = '/signin';
  url.search = '';
  url.searchParams.set('next', pathname);

  return NextResponse.redirect(url);
}

export const config = {
  /**
   * Everything except the build output and the static files: those carry no data, and asking
   * for a session to serve a stylesheet would only make the sign-in page fail to render.
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)',
  ],
};
