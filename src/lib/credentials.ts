import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/**
 * Verifies the code a technician types at sign-in.
 *
 * Two levels, so the workshop can be protected today and tightened later without touching a
 * line of code:
 *
 *  - a personal code per technician, keyed by the id number already stored in the database
 *    (`MUBEA_TECHNICIAN_CODES`, a JSON object: id number -> encoded hash);
 *  - a shared workshop code (`MUBEA_ACCESS_CODE_HASH`) for anyone who is not listed.
 *
 * When neither is configured, the answer is always no. A deployment that has not been given a
 * code must stay shut, never open by default.
 *
 * This module uses node:crypto and is therefore only imported from route handlers, which run
 * in the Node.js runtime. The middleware must never import it.
 */

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/**
 * Encodes a code as `scrypt$N$r$p$salt$hash`, with the parameters written into the value
 * itself. Raising the cost later will not invalidate the codes already in place.
 */
export function encodeCode(code: string, salt: Buffer = randomBytes(SALT_LENGTH)): string {
  const hash = scryptSync(code.normalize('NFKC'), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    hash.toString('base64'),
  ].join('$');
}

/** Checks a code against an encoded value, in constant time. */
export function verifyEncodedCode(code: string, encoded: string): boolean {
  const parts = encoded.split('$');

  if (parts.length !== 6 || parts[0] !== 'scrypt') {
    return false;
  }

  const [, encodedN, encodedR, encodedP, encodedSalt, encodedHash] = parts;

  const n = Number(encodedN);
  const r = Number(encodedR);
  const p = Number(encodedP);

  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  let expected: Buffer;
  let salt: Buffer;
  try {
    salt = Buffer.from(encodedSalt, 'base64');
    expected = Buffer.from(encodedHash, 'base64');
  } catch {
    return false;
  }

  let actual: Buffer;
  try {
    actual = scryptSync(code.normalize('NFKC'), salt, expected.length, { N: n, r, p });
  } catch {
    return false;
  }

  // timingSafeEqual throws when the lengths differ, so the length is checked first.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function personalCodes(): Record<string, string> {
  const raw = process.env.MUBEA_TECHNICIAN_CODES;

  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // A malformed value must not open the door: fall back to the shared code.
  }

  return {};
}

/** The shared workshop code, or null when it has not been configured. */
function sharedCode(): string | null {
  const value = process.env.MUBEA_ACCESS_CODE_HASH;

  return value && value.trim().length > 0 ? value.trim() : null;
}

/** True when at least one way of signing in exists, so the sign-in page can say so. */
export function isSignInConfigured(): boolean {
  return sharedCode() !== null || Object.keys(personalCodes()).length > 0;
}

/**
 * Verifies a code for one technician. The personal code is tried first; the shared workshop
 * code is the fallback.
 */
export function verifyTechnicianCode(idNumber: string, code: string): boolean {
  if (!code) {
    return false;
  }

  const personal = personalCodes()[idNumber];

  if (typeof personal === 'string' && verifyEncodedCode(code, personal)) {
    return true;
  }

  const shared = sharedCode();

  return shared !== null && verifyEncodedCode(code, shared);
}
