import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const technicians = await prisma.technician.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        tools: true,
      },
    });
    return NextResponse.json(technicians);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch technicians' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, idNumber } = body;

    if (!name || !idNumber) {
      return NextResponse.json({ error: 'Name and ID are required' }, { status: 400 });
    }

    const technician = await prisma.technician.create({
      data: { name, idNumber },
    });

    return NextResponse.json(technician, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create technician' }, { status: 500 });
  }
}
