import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, readSession, sessionCookieOptions } from '@/lib/session';

/**
 * Who is signed in.
 *
 * The profile is read from the database on every call rather than copied into the session at
 * sign-in. That way a role change or a closed account takes effect immediately: a token that
 * is still valid cannot keep privileges that no longer exist.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const technician = await prisma.technician.findUnique({
    where: { id: session.technicianId },
    select: { id: true, name: true, role: true },
  });

  if (!technician) {
    // The account behind the session is gone: the session is worth nothing, so it is cleared.
    const response = NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });

    return response;
  }

  return NextResponse.json(technician);
}
