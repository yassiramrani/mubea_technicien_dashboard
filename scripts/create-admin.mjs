#!/usr/bin/env node
/**
 * Creates — or updates — the administrator profile, and prints the line to paste into
 * `.env.local` so that profile can sign in.
 *
 * Usage:
 *   node --env-file=.env scripts/create-admin.mjs
 *   node --env-file=.env scripts/create-admin.mjs "ADMIN" "ADMIN-001"
 *   node --env-file=.env scripts/create-admin.mjs "ADMIN" "ADMIN-001" "the chosen code"
 *
 * The code is hashed with the same scrypt parameters as the rest of the application
 * (`src/lib/credentials.ts`) and only the hash is written down, never the code itself.
 *
 * An administrator needs a personal code: the shared workshop code is deliberately refused for
 * it, so that knowing the code of the floor cannot give anybody the profile of the manager.
 * The printed line keeps whatever personal codes are already configured, because they are read
 * back from MUBEA_TECHNICIAN_CODES when that variable is already loaded — pass the file that
 * holds it with `--env-file`, for example:
 *
 *   node --env-file=.env --env-file=.env.local scripts/create-admin.mjs
 */

import { randomInt, randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** No I, L, O, 0 or 1: the code has to survive being read out loud and typed on a phone. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const CODE_LENGTH = 20;

function generateCode() {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }

  return code;
}

function encodeCode(code) {
  const salt = randomBytes(SALT_LENGTH);
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

/** The personal codes already configured, so the printed line does not drop them. */
function existingCodes() {
  const raw = process.env.MUBEA_TECHNICIAN_CODES;

  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    console.warn('MUBEA_TECHNICIAN_CODES is set but is not valid JSON: starting from an empty map.');

    return {};
  }
}

const name = process.argv[2] ?? 'ADMIN';
const idNumber = process.argv[3] ?? 'ADMIN-001';
const code = process.argv[4] ?? generateCode();

const prisma = new PrismaClient();

try {
  const profile = await prisma.technician.upsert({
    where: { idNumber },
    update: { name, role: 'ADMIN' },
    create: { name, idNumber, role: 'ADMIN' },
  });

  const codes = existingCodes();
  codes[idNumber] = encodeCode(code);

  console.log('');
  console.log(`Profile : ${profile.name} (ID number ${profile.idNumber}), role ${profile.role}`);
  console.log(`Code    : ${code}`);
  console.log('');
  console.log('Paste this single line into .env.local, then restart the application:');
  console.log('');
  console.log(`MUBEA_TECHNICIAN_CODES=${JSON.stringify(codes)}`);
  console.log('');
} finally {
  await prisma.$disconnect();
}
