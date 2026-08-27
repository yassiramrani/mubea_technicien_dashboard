import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [
      totalTechnicians,
      totalTools,
      assignedTools,
      todayLogsCount
    ] = await Promise.all([
      prisma.technician.count(),
      prisma.tool.count(),
      prisma.tool.count({ where: { status: 'ASSIGNED' } }),
      prisma.log.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          }
        }
      })
    ]);

    const availableTools = totalTools - assignedTools;

    return NextResponse.json({
      totalTechnicians,
      totalTools,
      availableTools,
      assignedTools,
      todayLogsCount,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
