import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date');

  let dateFilter = {};
  if (dateStr) {
    const startOfDay = new Date(dateStr);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(dateStr);
    endOfDay.setHours(23, 59, 59, 999);

    dateFilter = {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };
  }

  try {
    const logs = await prisma.log.findMany({
      where: dateFilter,
      orderBy: { createdAt: 'desc' },
      include: {
        technician: true,
        tool: true,
      },
    });
    return NextResponse.json(logs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch logs' }, { status: 500 });
  }
}
