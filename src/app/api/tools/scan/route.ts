import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qrCode, technicianId } = body;

    if (!qrCode || !technicianId) {
      return NextResponse.json({ error: 'QR Code and Technician ID are required' }, { status: 400 });
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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to process scan' }, { status: 500 });
  }
}
