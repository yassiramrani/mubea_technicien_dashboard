import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isLabeler } from '@/lib/technicianRoles';
import { clientKey, rateLimit } from '@/lib/rateLimit';
import { SESSION_COOKIE, readSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // The session decides who is acting. The request body is never consulted for the
    // technician: otherwise anyone could record a movement under someone else's name.
    const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);

    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const limit = rateLimit(clientKey(request, 'scan'), 60, 60 * 1000);

    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Too many scans in a row' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = await request.json();
    const { qrCode } = body;

    if (typeof qrCode !== 'string' || qrCode.trim().length === 0) {
      return NextResponse.json({ error: 'QR Code is required' }, { status: 400 });
    }

    const technicianId = session.technicianId;

    // The role is read from the database rather than copied into the session, so a change of
    // profile applies at once instead of waiting for the session to expire.
    const technician = await prisma.technician.findUnique({
      where: { id: technicianId },
      select: { id: true, role: true },
    });

    if (!technician) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    // The identification profile must never create a movement: it only renames
    // tools and updates their photos, through /api/tools/lookup + PUT /api/tools.
    if (isLabeler(technician.role)) {
      return NextResponse.json({ error: 'This profile can only identify tools' }, { status: 403 });
    }

    const tool = await prisma.tool.findUnique({
      where: { qrCode },
    });

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Check current status
    if (tool.status === 'AVAILABLE') {
      // Assign to technician
      const [updatedTool] = await prisma.$transaction([
        prisma.tool.update({
          where: { id: tool.id },
          data: { status: 'ASSIGNED', technicianId },
        }),
        prisma.log.create({
          data: {
            technicianId,
            toolId: tool.id,
            action: 'TAKEN',
          },
        }),
      ]);
      return NextResponse.json({ message: 'Tool assigned successfully', action: 'TAKEN', tool: updatedTool }, { status: 200 });
    } else if (tool.status === 'ASSIGNED') {
      if (tool.technicianId !== technicianId) {
        return NextResponse.json({ error: 'Tool is currently assigned to another technician' }, { status: 400 });
      }
      
      // Return tool
      const [updatedTool] = await prisma.$transaction([
        prisma.tool.update({
          where: { id: tool.id },
          data: { status: 'AVAILABLE', technicianId: null },
        }),
        prisma.log.create({
          data: {
            technicianId,
            toolId: tool.id,
            action: 'RETURNED',
          },
        }),
      ]);
      return NextResponse.json({ message: 'Tool returned successfully', action: 'RETURNED', tool: updatedTool }, { status: 200 });
    }

    return NextResponse.json({ error: 'Invalid tool status' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed to process scan' }, { status: 500 });
  }
}
