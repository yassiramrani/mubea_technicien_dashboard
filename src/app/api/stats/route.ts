import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalTechnicians,
      totalTools,
      availableTools,
      assignedTools,
      todayLogs,
      recentLogs,
      toolsByTechnician,
      logsLast7Days,
      unreturnedTools,
      totalLogs,
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
      prisma.log.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true, action: true },
      }),
      prisma.tool.findMany({
        where: { status: 'ASSIGNED' },
        include: { technician: true },
        orderBy: { name: 'asc' },
      }),
      prisma.log.count(),
    ]);

    const usageTrend = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      return { date: dateStr, taken: 0, returned: 0, fullDate: d.toDateString() };
    });

    logsLast7Days.forEach(log => {
      const logDateStr = new Date(log.createdAt).toDateString();
      const trendItem = usageTrend.find(t => t.fullDate === logDateStr);
      if (trendItem) {
        if (log.action === 'TAKEN') trendItem.taken++;
        if (log.action === 'RETURNED') trendItem.returned++;
      }
    });

    return NextResponse.json({
      totalTechnicians,
      totalTools,
      availableTools,
      assignedTools,
      todayLogs,
      recentLogs,
      usageTrend,
      unreturnedTools: unreturnedTools.map(t => ({
        id: t.id,
        name: t.name,
        technicianName: t.technician?.name || 'Unknown'
      })),
      totalLogs,
      toolsByTechnician: toolsByTechnician.map((t) => ({
        name: t.name,
        idNumber: t.idNumber,
        toolCount: t.tools.length,
        tools: t.tools.map((tool) => tool.name),
      })).sort((a, b) => b.toolCount - a.toolCount),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
