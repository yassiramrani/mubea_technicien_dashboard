import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentProfile, requireSection } from '@/lib/auth';
import { canManageProfiles } from '@/lib/permissions';
import { ADMIN_ROLE, DEFAULT_TECHNICIAN_ROLE, isTechnicianRole } from '@/lib/technicianRoles';

/**
 * Adding a profile, or changing one, is reserved to an administrator.
 *
 * A profile decides what a person is allowed to do, and the administrator profile can hand
 * itself out again, so the right to create or change one cannot belong to the people it
 * governs. This rule holds whatever the section switch is set to: it is about a single action,
 * not about reaching a page.
 *
 * One exception, deliberately narrow and only for *creating*: while a deployment has no
 * administrator at all, the first one may be created, otherwise it could never acquire one.
 * The exception closes by itself as soon as the first administrator exists.
 */
async function refuseUnlessProfileManager(
  request: NextRequest,
  allowFirstAdministrator: boolean,
): Promise<NextResponse | null> {
  const actor = await currentProfile(request);

  if (canManageProfiles(actor?.role)) {
    return null;
  }

  if (allowFirstAdministrator) {
    const administrators = await prisma.technician.count({ where: { role: ADMIN_ROLE } });

    if (administrators === 0) {
      return null;
    }
  }

  return NextResponse.json({ error: 'adminOnly' }, { status: 403 });
}

export async function GET() {
  try {
    const technicians = await prisma.technician.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tools: true,
      },
    });
    return NextResponse.json(technicians);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch technicians' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const refusal = await requireSection(request, 'technicians');

  if (refusal) {
    return refusal;
  }

  const management = await refuseUnlessProfileManager(request, true);

  if (management) {
    return management;
  }

  try {
    const body = await request.json();
    const { name, idNumber, role } = body;

    if (!name || !idNumber) {
      return NextResponse.json({ error: 'Name and ID are required' }, { status: 400 });
    }

    const requestedRole = isTechnicianRole(role) ? role : DEFAULT_TECHNICIAN_ROLE;

    const technician = await prisma.technician.create({
      data: {
        name,
        idNumber,
        role: requestedRole,
      },
    });

    return NextResponse.json(technician, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create technician' }, { status: 500 });
  }
}

// Switches a profile between the standard one (take / return), the identification one
// (rename tools + photos) and the administrator one (full access).
export async function PUT(request: NextRequest) {
  const refusal = await requireSection(request, 'technicians');

  if (refusal) {
    return refusal;
  }

  const management = await refuseUnlessProfileManager(request, false);

  if (management) {
    return management;
  }

  try {
    const body = await request.json();
    const { id, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'Technician ID is required' }, { status: 400 });
    }

    if (!isTechnicianRole(role)) {
      return NextResponse.json({ error: 'Unknown technician role' }, { status: 400 });
    }

    const existed = await prisma.technician.findUnique({ where: { id }, select: { id: true } });

    if (!existed) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    const technician = await prisma.technician.update({
      where: { id },
      data: { role },
    });

    return NextResponse.json(technician);
  } catch (error) {
    console.error('Error updating technician:', error);
    return NextResponse.json({ error: 'Failed to update technician' }, { status: 500 });
  }
}
