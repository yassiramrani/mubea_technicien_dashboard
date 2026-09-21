import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PLACEHOLDER_NAME_PREFIX } from '@/lib/technicianRoles';

// Read-only label lookup used by the identification (LABELER) profile: scanning a
// label opens the tool card so its name and photo can be updated. Unlike
// /api/tools/scan this never changes the tool status and never writes a Log row.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const qrCode = searchParams.get('qrCode')?.trim();

    if (!qrCode) {
      return NextResponse.json({ error: 'QR code is required' }, { status: 400 });
    }

    const tool = await prisma.tool.findUnique({
      where: { qrCode },
      select: {
        id: true,
        qrCode: true,
        name: true,
        image: true,
        status: true,
        technician: { select: { name: true } },
      },
    });

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Progress counters so the technician knows how much identification is left.
    const [total, withoutPhoto] = await Promise.all([
      prisma.tool.count(),
      prisma.tool.count({ where: { OR: [{ image: null }, { image: '' }] } }),
    ]);

    const { technician, ...rest } = tool;

    return NextResponse.json({
      tool: {
        ...rest,
        technicianName: technician?.name ?? null,
        hasPlaceholderName: tool.name.startsWith(PLACEHOLDER_NAME_PREFIX),
      },
      stats: { total, withoutPhoto },
    });
  } catch (error) {
    console.error('Error looking up tool:', error);
    return NextResponse.json({ error: 'Failed to look up tool' }, { status: 500 });
  }
}
