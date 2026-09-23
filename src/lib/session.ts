/**
 * Session handling for the technician dashboard.
 *
 * A session is a compact token signed with the server secret and stored in an httpOnly
 * cookie: the browser cannot read it, and cannot forge it either. The middleware verifies it
 * on every request, so an unauthenticated visitor never reaches a page or an API route.
 *
 * This file deliberately uses only Web Crypto and the WHATWG text/encoding APIs. The Next.js
 * middleware runs on the Edge runtime, where node:crypto and Buffer do not exist; keeping the
 * same implementation everywhere avoids one signature check that behaves differently from the
 * other, which is exactly the kind of detail that turns a guard into a decoration.
 */

export const SESSION_COOKIE = 'mubea_session';

/** Twelve hours: one workshop shift, so a technician is not asked to sign in mid-day. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;

export type Session = {
  /** The technician the person signed in as. */
  technicianId: string;
  /** Unix seconds. */
  expiresAt: number;
};

const encoder = new TextEncoder();

function secret(): string | null {
  const value = process.env.MUBEA_SESSION_SECRET;

  return value && value.length >= 32 ? value : null;
}

/** True when the deployment is configured, so callers can answer a clear refusal otherwise. */
export function isSessionConfigured(): boolean {
  return secret() !== null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function hmacKey(): Promise<CryptoKey> {
  const value = secret();
  if (!value) {
    throw new Error(
      'MUBEA_SESSION_SECRET must be set to at least 32 characters. Generate one with: openssl rand -base64 48',
    );
  }

  return crypto.subtle.importKey(
    'raw',
    encoder.encode(value),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/** Builds the cookie value for a technician who has just been authenticated. */
export async function createSession(
  technicianId: string,
  now: number = Date.now(),
): Promise<string> {
  const payload: Session = {
    technicianId,
    expiresAt: Math.floor(now / 1000) + SESSION_TTL_SECONDS,
  };

  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(), encoder.encode(body));

  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

/**
 * Returns the session when the token is authentic and still valid, otherwise null.
 * A tampered token, a token signed with another secret and an expired token all give null.
 *
 * The signature is checked with crypto.subtle.verify, which compares in constant time: a
 * byte-by-byte comparison would leak, through its timing, how much of a forged signature was
 * correct, and that is enough to rebuild one.
 */
export async function readSession(
  token: string | undefined,
  now: number = Date.now(),
): Promise<Session | null> {
  if (!token) {
    return null;
  }

  const separator = token.lastIndexOf('.');
  if (separator <= 0) {
    return null;
  }

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let key: CryptoKey;
  try {
    key = await hmacKey();
  } catch {
    // Misconfigured deployment: no usable secret, so nothing can be trusted.
    return null;
  }

  let authentic: boolean;
  try {
    authentic = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(body),
    );
  } catch {
    return null;
  }

  if (!authentic) {
    return null;
  }

  let payload: Session;
  try {
    payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as Session;
  } catch {
    return null;
  }

  if (typeof payload?.technicianId !== 'string' || typeof payload?.expiresAt !== 'number') {
    return null;
  }

  if (payload.expiresAt * 1000 <= now) {
    return null;
  }

  return payload;
}

/** Cookie attributes shared by the sign-in and sign-out responses. */
export function sessionCookieOptions(): {
  httpOnly: true;
  secure: true;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    // The application is only ever served over HTTPS, including on Vercel.
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
