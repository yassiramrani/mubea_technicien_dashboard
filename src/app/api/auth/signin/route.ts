import { NextResponse } from 'next/server';
import { isSignInConfigured, verifyTechnicianCode } from '@/lib/credentials';
import { clientKey, rateLimit } from '@/lib/rateLimit';
import { SESSION_COOKIE, createSession, isSessionConfigured, sessionCookieOptions } from '@/lib/session';
import { prisma } from '@/lib/prisma';

/**
 * Sign-in. Verifies a technician and a code, then hands back a signed session cookie.
 *
 * Runs in the Node.js runtime because the code is hashed with scrypt, which the Edge runtime
 * does not provide. The middleware never needs it: it only has to verify a signature.
 */

export const runtime = 'nodejs';

const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

/** Reads a string field from an untrusted body without trusting its shape. */
function readString(body: unknown, field: string): string {
  if (typeof body !== 'object' || body === null) {
    return '';
  }

  const value = (body as Record<string, unknown>)[field];

  return typeof value === 'string' ? value : '';
}

export async function POST(request: Request) {
  // Guessing a code is the obvious attack, so attempts are counted before anything else.
  const attempt = rateLimit(clientKey(request, 'signin'), MAX_ATTEMPTS, ATTEMPT_WINDOW_MS);

  if (!attempt.allowed) {
    return NextResponse.json(
      { error: 'tooManyAttempts' },
      { status: 429, headers: { 'Retry-After': String(attempt.retryAfterSeconds) } },
    );
  }

  if (!isSessionConfigured() || !isSignInConfigured()) {
    return NextResponse.json({ error: 'notConfigured' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalidRequest' }, { status: 400 });
  }

  const technicianId = readString(body, 'technicianId').trim();
  const code = readString(body, 'code');

  if (!technicianId || !code) {
    return NextResponse.json({ error: 'invalidRequest' }, { status: 400 });
  }

  const technician = await prisma.technician.findUnique({
    where: { id: technicianId },
    select: { id: true, idNumber: true, name: true },
  });

  // The code is always checked, even when the technician is unknown, and the answer is always
  // the same. Distinguishing "unknown name" from "wrong code" would tell an attacker which
  // half of the pair they already have.
  const accepted = verifyTechnicianCode(technician?.idNumber ?? '', code);

  if (!technician || !accepted) {
    return NextResponse.json({ error: 'wrongCode' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, name: technician.name });
  response.cookies.set(SESSION_COOKIE, await createSession(technician.id), sessionCookieOptions());

  return response;
}
