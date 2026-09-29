import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, readSession } from '@/lib/session';
import { ENFORCE_ROLE_ACCESS, canAccess, type Section } from '@/lib/permissions';

/**
 * Authorization for the route handlers.
 *
 * The proxy already refuses an anonymous request. This module answers the next question: *which*
 * profile is asking, and may it reach this section? The role is read from the database on every
 * call rather than copied into the session cookie, so taking a profile away takes effect at once
 * instead of whenever the session happens to expire.
 *
 * Route handlers run in the Node.js runtime, which is why `prisma` may be imported here — and
 * why `proxy.ts`, which runs on every request, deliberately does not do this and only checks the
 * signature of the session.
 */

export type SessionProfile = {
  id: string;
  name: string;
  role: string;
};

/** The profile behind the session, or null when there is no usable session left. */
export async function currentProfile(request: NextRequest): Promise<SessionProfile | null> {
  const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (!session) {
    return null;
  }

  return prisma.technician.findUnique({
    where: { id: session.technicianId },
    select: { id: true, name: true, role: true },
  });
}

/**
 * The response to send back when the signed-in profile may not reach `section`, or null when the
 * request may continue.
 *
 * While `ENFORCE_ROLE_ACCESS` is false this answers null before touching the database, so the
 * guard costs nothing when it is off — and it is already in place on every route it protects.
 */
export async function requireSection(
  request: NextRequest,
  section: Section,
): Promise<NextResponse | null> {
  if (!ENFORCE_ROLE_ACCESS) {
    return null;
  }

  const profile = await currentProfile(request);

  if (!profile) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!canAccess(profile.role, section)) {
    return NextResponse.json(
      { error: 'This profile may not reach this section' },
      { status: 403 },
    );
  }

  return null;
}
