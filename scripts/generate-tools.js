/**
 * Bulk-generate tools with printable label IDs.
 *
 * Usage:
 *   node scripts/generate-tools.js             -> creates 50 tools: "Tool 001" .. "Tool 050"
 *   node scripts/generate-tools.js 20          -> creates 20 tools
 *   node scripts/generate-tools.js 20 "Drill " -> creates 20 tools named "Drill 001" ..
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

  if (!Number.isInteger(count) || count < 1 || count > 500) {
    throw new Error('Count must be a whole number between 1 and 500.');
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

  const pad = (value) => String(value).padStart(3, '0');

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
