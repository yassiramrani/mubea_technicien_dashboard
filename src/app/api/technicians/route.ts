import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { currentProfile, requireSection } from '@/lib/auth';
import {
  ADMIN_ROLE,
  DEFAULT_TECHNICIAN_ROLE,
  isAdmin,
  isTechnicianRole,
} from '@/lib/technicianRoles';

/**
 * Handing out the administrator profile is not like choosing a work profile.
 *
 * It is the one role that can hand itself out again, so the right to assign it — or to take it
 * away — belongs to an administrator. There is a single exception: while a deployment has no
 * administrator at all, the first one may be created, otherwise it could never acquire one.
 * That exception closes by itself as soon as the first administrator exists.
 */
async function refuseAdminGrant(
  request: NextRequest,
  nextRole: string,
  currentRole?: string,
): Promise<NextResponse | null> {
  const grants = nextRole === ADMIN_ROLE && currentRole !== ADMIN_ROLE;
  const removes = currentRole === ADMIN_ROLE && nextRole !== ADMIN_ROLE;

  if (!grants && !removes) {
    return null;
  }

  const actor = await currentProfile(request);

  if (isAdmin(actor?.role)) {
    return null;
  }

  if (grants && (await prisma.technician.count({ where: { role: ADMIN_ROLE } })) === 0) {
    return null;
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

  try {
    const body = await request.json();
    const { name, idNumber, role } = body;

    if (!name || !idNumber) {
      return NextResponse.json({ error: 'Name and ID are required' }, { status: 400 });
    }

    const requestedRole = isTechnicianRole(role) ? role : DEFAULT_TECHNICIAN_ROLE;

    const grantRefusal = await refuseAdminGrant(request, requestedRole);

    if (grantRefusal) {
      return grantRefusal;
    }

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

  try {
    const body = await request.json();
    const { id, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'Technician ID is required' }, { status: 400 });
    }

    if (!isTechnicianRole(role)) {
      return NextResponse.json({ error: 'Unknown technician role' }, { status: 400 });
    }

    const before = await prisma.technician.findUnique({
      where: { id },
      select: { role: true },
    });

    if (!before) {
      return NextResponse.json({ error: 'Technician not found' }, { status: 404 });
    }

    const grantRefusal = await refuseAdminGrant(request, role, before.role);

    if (grantRefusal) {
      return grantRefusal;
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
