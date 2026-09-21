import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TECHNICIAN_ROLE, isTechnicianRole } from '@/lib/technicianRoles';

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, idNumber, role } = body;

    if (!name || !idNumber) {
      return NextResponse.json({ error: 'Name and ID are required' }, { status: 400 });
    }

    const technician = await prisma.technician.create({
      data: {
        name,
        idNumber,
        role: isTechnicianRole(role) ? role : DEFAULT_TECHNICIAN_ROLE,
      },
    });

    return NextResponse.json(technician, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create technician' }, { status: 500 });
  }
}

// Switches a technician between the standard profile (take / return) and the
// identification profile (rename tools + photos only).
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, role } = body;

    if (!id) {
      return NextResponse.json({ error: 'Technician ID is required' }, { status: 400 });
    }

    if (!isTechnicianRole(role)) {
      return NextResponse.json({ error: 'Unknown technician role' }, { status: 400 });
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
