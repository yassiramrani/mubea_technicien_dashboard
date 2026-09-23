#!/usr/bin/env node
/**
 * Builds the value to paste into MUBEA_ACCESS_CODE_HASH, or into one entry of
 * MUBEA_TECHNICIAN_CODES.
 *
 * Usage:
 *   node scripts/hash-access-code.mjs "the workshop code"
 *
 * The result is a `scrypt$N$r$p$salt$hash` string. The password itself is never stored, and
 * the parameters travel with the value, so the cost can be raised later without invalidating
 * the codes already in place.
 */

import { randomBytes, scryptSync } from 'node:crypto';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

const code = process.argv[2];

if (!code) {
  console.error('Usage: node scripts/hash-access-code.mjs "the workshop code"');
  process.exit(1);
}

const salt = randomBytes(SALT_LENGTH);
const hash = scryptSync(code.normalize('NFKC'), salt, KEY_LENGTH, {
  N: SCRYPT_N,
  r: SCRYPT_R,
  p: SCRYPT_P,
});

console.log(
  ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), hash.toString('base64')].join('$'),
);
