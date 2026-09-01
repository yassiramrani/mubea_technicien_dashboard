import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function GET() {
  try {
    const tools = await prisma.tool.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        technician: true,
      },
    });
    return NextResponse.json(tools);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch tools' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, image } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Generate a unique QR code string using safe uppercase characters
    // Safe characters are the same on AZERTY and QWERTY keyboards (no numbers, no A, Q, Z, W, M)
    const safeChars = 'BCDFGHJKLNPRSTUVXY';
    let qrCode = '';
    for (let i = 0; i < 12; i++) {
      qrCode += safeChars.charAt(Math.floor(Math.random() * safeChars.length));
    }

    const tool = await prisma.tool.create({
      data: {
        name,
        qrCode,
        image,
      },
    });

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create tool' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, image, name } = body;

    if (!id) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    // Prepare the data object with whatever fields were sent from the frontend
    const updateData: { image?: string | null; name?: string } = {};
    if (image !== undefined) updateData.image = image;
    if (name !== undefined) updateData.name = name;

    const updatedTool = await prisma.tool.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updatedTool);
  } catch (error) {
    console.error('Error updating tool:', error);
    return NextResponse.json({ error: 'Failed to update tool' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Tool ID is required' }, { status: 400 });
    }

    const tool = await prisma.tool.findUnique({ where: { id } });

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    if (tool.status === 'ASSIGNED') {
      return NextResponse.json({ error: 'Cannot delete an assigned tool. Return it first.' }, { status: 400 });
    }

    // Delete related logs first, then the tool
    await prisma.log.deleteMany({ where: { toolId: id } });
    await prisma.tool.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
  }
}
