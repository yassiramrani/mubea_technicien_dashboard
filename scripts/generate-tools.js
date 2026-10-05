/**
 * Bulk-generate tools with printable label IDs.
 *
 * Usage:
 *   node scripts/generate-tools.js               -> creates 50 tools: "Tool 001" .. "Tool 050"
 *   node scripts/generate-tools.js 20            -> creates 20 tools
 *   node scripts/generate-tools.js 20 "Drill "   -> creates 20 tools named "Drill 001" ..
 *   node scripts/generate-tools.js 50 "mubea" 1  -> creates 50 tools named "mubea1" .. "mubea50"
 *
 * The optional third argument is the minimum number of digits used for the
 * counter (default 3). Use 1 when you want unpadded names such as "mubea1".
 *
 * New tools start with labelPrinted = false, so they appear in the
 * "Print pending labels" count on the Tools page and nowhere else.
 *
 * The sequence continues after the highest existing number for the chosen
 * prefix, so running it twice never creates duplicate names.
 *
 * To undo: on the Tools page use "Select unused" then "Delete selected".
 * (Only safe while the new tools have never been scanned.)
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');

// Prisma Client does not read .env at runtime (Next.js does that for the web app),
// so a standalone script has to load it before the client is constructed.
// Anything already present in the environment wins, so explicit overrides and CI
// stay in control.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;

  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;

    const raw = match[2].trim();
    const quoted =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"));

    if (!process.env[match[1]]) {
      process.env[match[1]] = quoted ? raw.slice(1, -1) : raw;
    }
  }
}

loadEnvFile(path.join(__dirname, '..', '.env'));

const prisma = new PrismaClient();

// Must stay identical to the character set used by POST /api/tools.
const SAFE_CHARS = 'BCDFGHJKLNPRSTUVX';
const CODE_LENGTH = 8;

function makeCode(existingCodes) {
  let code;
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)],
    ).join('');
  } while (existingCodes.has(code));
  existingCodes.add(code);
  return code;
}

async function main() {
  const count = Number.parseInt(process.argv[2] ?? '50', 10);
  const prefix = process.argv[3] ?? 'Tool ';
  const minDigits = Number.parseInt(process.argv[4] ?? '3', 10);

  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new Error('Count must be a whole number between 1 and 500.');
  }

  if (!Number.isInteger(minDigits) || minDigits < 1 || minDigits > 10) {
    throw new Error('Minimum digits must be a whole number between 1 and 10.');
  }

  const existingTools = await prisma.tool.findMany({ select: { name: true, qrCode: true } });
  const existingCodes = new Set(existingTools.map((tool) => tool.qrCode));

  // Continue after the highest existing number so re-runs never duplicate names.
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const namePattern = new RegExp(`^${escapedPrefix}(\\d+)$`);
  const highest = existingTools.reduce((max, tool) => {
    const match = namePattern.exec(tool.name);
    return match ? Math.max(max, Number.parseInt(match[1], 10)) : max;
  }, 0);

  const pad = (value) => String(value).padStart(minDigits, '0');

  const rows = Array.from({ length: count }, (_, index) => ({
    name: `${prefix}${pad(highest + index + 1)}`,
    qrCode: makeCode(existingCodes),
  }));

  const created = await prisma.tool.createMany({ data: rows });

  console.log(`Created ${created.count} tool(s): ${rows[0].name} .. ${rows[rows.length - 1].name}`);
  console.log(
    rows
      .map((row) => `  ${row.name}  ->  ${row.qrCode}`)
      .join('\n'),
  );

  const total = await prisma.tool.count();
  const pending = await prisma.tool.count({ where: { labelPrinted: false } });
  console.log(`\nTotal tools: ${total} | awaiting a label: ${pending}`);
  console.log('Open the Tools page and use "Print pending labels".');
}

main()
  .catch((error) => {
    console.error('Failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
