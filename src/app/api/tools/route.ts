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
    const { name } = body;

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
      },
    });

    return NextResponse.json(tool, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create tool' }, { status: 500 });
  }
}
