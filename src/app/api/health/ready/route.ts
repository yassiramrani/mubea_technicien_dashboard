import { prisma } from '@/lib/prisma';
import { isSessionConfigured } from '@/lib/session';
import { readiness } from '@/lib/readiness';

export const dynamic = 'force-dynamic';

// At most one database ping per five seconds per server instance.
let pending: Promise<Awaited<ReturnType<typeof readiness>>> | undefined;
let validUntil = 0;
export async function GET() {
  if (!pending || Date.now() >= validUntil) {
    validUntil = Date.now() + 5000;
    pending = readiness(() => prisma.$queryRaw`SELECT 1`, isSessionConfigured());
  }
  const result = await pending;
  return Response.json(result, { status: result.status === 'ok' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' } });
}
