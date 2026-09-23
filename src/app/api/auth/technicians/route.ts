import { NextResponse } from 'next/server';
import { clientKey, rateLimit } from '@/lib/rateLimit';
import { prisma } from '@/lib/prisma';

/**
 * The list of technicians, shown on the sign-in screen so a person can pick their name.
 *
 * It deliberately returns the bare minimum - an identifier and a name - and nothing else. The
 * full technician endpoint stays behind the session: a page that is reachable before signing in
 * must not become a way of reading the workshop's records.
 */

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const attempt = rateLimit(clientKey(request, 'signin-technicians'), 30, 60 * 1000);

  if (!attempt.allowed) {
    return NextResponse.json(
      { error: 'tooManyAttempts' },
      { status: 429, headers: { 'Retry-After': String(attempt.retryAfterSeconds) } },
    );
  }

  try {
    const technicians = await prisma.technician.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(technicians);
  } catch {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }
}
