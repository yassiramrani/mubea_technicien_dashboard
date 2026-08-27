import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [
      totalTechnicians,
      totalTools,
      availableTools,
      assignedTools,
      todayLogs,
      recentLogs,
      toolsByTechnician,
    ] = await Promise.all([
      prisma.technician.count(),
      prisma.tool.count(),
      prisma.tool.count({ where: { status: 'AVAILABLE' } }),
      prisma.tool.count({ where: { status: 'ASSIGNED' } }),
      prisma.log.count({
        where: { createdAt: { gte: today, lte: endOfDay } },
      }),
      prisma.log.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { technician: true, tool: true },
      }),
      prisma.technician.findMany({
        include: {
          tools: { where: { status: 'ASSIGNED' } },
        },
        orderBy: { name: 'asc' },
      }),
    ]);

    return NextResponse.json({
      totalTechnicians,
      totalTools,
      availableTools,
      assignedTools,
      todayLogs,
      recentLogs,
      toolsByTechnician: toolsByTechnician.map((t) => ({
        name: t.name,
        idNumber: t.idNumber,
        toolCount: t.tools.length,
        tools: t.tools.map((tool) => tool.name),
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
