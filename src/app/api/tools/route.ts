import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentBusinessDayBounds } from '@/lib/toolAvailability';

export async function GET() {
  try {
    const { start: today } = getCurrentBusinessDayBounds();

    const tools = await prisma.tool.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        technician: true,
        logs: {
          where: { action: 'TAKEN' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { createdAt: true },
        },
        // Total scans recorded for the tool, across both TAKEN and RETURNED.
        // A count of zero means the tool was never used since it was added.
        _count: { select: { logs: true } },
      },
    });

    return NextResponse.json(tools.map(({ logs, _count, ...tool }) => {
      const checkedOutAt = logs[0]?.createdAt ?? null;
      const isOverdue = tool.status === 'ASSIGNED' && checkedOutAt !== null && checkedOutAt < today;

      return { ...tool, checkedOutAt, isOverdue, usageCount: _count.logs };
    }));
  } catch {
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
    // Generate a compact label ID using safe uppercase characters. Eight characters
    // leave enough width for a reliably scannable Code 128 barcode on a 40 × 20 mm label.
    // The field remains named `qrCode` for backward-compatible scanner and database lookups.
    const safeChars = 'BCDFGHJKLNPRSTUVX';
    let qrCode = '';
    for (let i = 0; i < 8; i++) {
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
  } catch {
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

// Bulk-update the label print state. Used by the tools page to mark labels as
// printed after a batch run, and to flag a bad print for reprinting.
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { ids, labelPrinted } = body as { ids?: string[]; labelPrinted?: boolean };

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'At least one tool ID is required' }, { status: 400 });
    }

    if (typeof labelPrinted !== 'boolean') {
      return NextResponse.json({ error: 'labelPrinted must be a boolean' }, { status: 400 });
    }

    const result = await prisma.tool.updateMany({
      where: { id: { in: ids } },
      data: {
        labelPrinted,
        labelPrintedAt: labelPrinted ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, updated: result.count });
  } catch (error) {
    console.error('Error updating label state:', error);
    return NextResponse.json({ error: 'Failed to update label state' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope');
    const idsParam = searchParams.get('ids');

    // Bulk cleanup. `scope=unused` lets the server decide what "never used"
    // means so the client cannot accidentally widen the blast radius; `ids`
    // deletes an explicit, user-reviewed selection.
    if (scope === 'unused' || idsParam) {
      let candidateIds: string[];

      if (scope === 'unused') {
        const unused = await prisma.tool.findMany({
          where: { status: { not: 'ASSIGNED' }, logs: { none: {} } },
          select: { id: true },
        });
        candidateIds = unused.map((tool) => tool.id);
      } else {
        candidateIds = idsParam!.split(',').map((value) => value.trim()).filter(Boolean);
      }

      if (candidateIds.length === 0) {
        return NextResponse.json({ success: true, deleted: 0, skipped: 0 });
      }

      // A tool currently assigned to a technician is never deleted.
      const matching = await prisma.tool.findMany({
        where: { id: { in: candidateIds } },
        select: { id: true, status: true },
      });
      const deletableIds = matching
        .filter((tool) => tool.status !== 'ASSIGNED')
        .map((tool) => tool.id);
      const skipped = matching.length - deletableIds.length;
      const missing = candidateIds.length - matching.length;

      if (deletableIds.length > 0) {
        await prisma.log.deleteMany({ where: { toolId: { in: deletableIds } } });
        await prisma.tool.deleteMany({ where: { id: { in: deletableIds } } });
      }

      return NextResponse.json({ success: true, deleted: deletableIds.length, skipped, missing });
    }

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
  } catch {
    return NextResponse.json({ error: 'Failed to delete tool' }, { status: 500 });
  }
}
