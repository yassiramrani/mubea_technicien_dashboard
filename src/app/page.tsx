'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Box, CheckCircle2, ClipboardList, Users, Wrench, Percent, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type RecentLog = {
  id: string;
  action: string;
  createdAt: string;
  technician: { name: string };
  tool: { name: string };
};

type TrendData = {
  date: string;
  taken: number;
  returned: number;
};

type UnreturnedTool = {
  id: string;
  name: string;
  technicianName: string;
};

type Stats = {
  totalTechnicians: number;
  totalTools: number;
  availableTools: number;
  assignedTools: number;
  todayLogs: number;
  recentLogs: RecentLog[];
  usageTrend?: TrendData[];
  unreturnedTools?: UnreturnedTool[];
  totalLogs: number;
  toolsByTechnician: { idNumber: string; name: string; toolCount: number; tools: string[] }[];
};

const initialStats: Stats = {
  totalTechnicians: 0,
  totalTools: 0,
  availableTools: 0,
  assignedTools: 0,
  todayLogs: 0,
  totalLogs: 0,
  recentLogs: [],
  usageTrend: [],
  unreturnedTools: [],
  toolsByTechnician: [],
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

const COLORS = ['#10b981', '#f59e0b']; // Available (green), Assigned (amber)

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error('Unable to load stats');
        setStats(await response.json());
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const utilizationRate = stats.totalTools > 0 ? Math.round((stats.assignedTools / stats.totalTools) * 100) : 0;

  const widgets = [
    { label: 'Technicians', value: stats.totalTechnicians, icon: Users, color: '#dbeafe', iconColor: '#1e40af' },
    { label: 'Total Tools', value: stats.totalTools, icon: Wrench, color: '#ede9fe', iconColor: '#6d28d9' },
    { label: 'Available', value: stats.availableTools, icon: CheckCircle2, color: '#d1fae5', iconColor: '#047857' },
    { label: 'Assigned', value: stats.assignedTools, icon: ClipboardList, color: '#fef3c7', iconColor: '#b45309' },
    { label: 'Utilization', value: `${utilizationRate}%`, icon: Percent, color: '#e0e7ff', iconColor: '#4338ca' },
    { label: 'Activity Today', value: stats.todayLogs, icon: Activity, color: '#fee2e2', iconColor: '#b91c1c' },
    { label: 'Total Movements', value: stats.totalLogs, icon: FileText, color: '#f3e8ff', iconColor: '#7e22ce' },
  ];

  const pieData = [
    { name: 'Available', value: stats.availableTools },
    { name: 'Assigned', value: stats.assignedTools }
  ];

  return (
    <div>
      <h1 className="page-title">Overview</h1>

      {error && <p className="card" style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>Unable to load dashboard data.</p>}

      <div className="widget-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {widgets.map(({ label, value, icon: Icon, color, iconColor }) => (
          <div className="widget-card" key={label}>
            <div className="widget-icon" style={{ backgroundColor: color, color: iconColor }}>
              <Icon size={22} />
            </div>
            <div>
              <div className="widget-value">{loading ? '-' : value}</div>
              <div className="widget-label">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="overview-columns" style={{ marginTop: '1.5rem' }}>
        <section className="card">
          <h3 style={{ marginBottom: '1rem' }}>Tool Status Distribution</h3>
          {loading ? <p className="text-muted">Loading chart...</p> : (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card">
          <h3 style={{ marginBottom: '1rem' }}>7-Day Activity Trend</h3>
          {loading ? <p className="text-muted">Loading chart...</p> : (
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.usageTrend || []}>
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis allowDecimals={false} tick={{fontSize: 12}} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="taken" name="Taken" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returned" name="Returned" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <div className="overview-columns" style={{ marginTop: '1.5rem' }}>
        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Recent Activity</h3>
            <Link href="/logs" className="btn btn-outline">
              View all <ArrowRight size={16} />
            </Link>
          </div>
          {loading ? <p className="text-muted">Loading...</p> : stats.recentLogs.length === 0 ? <p className="text-muted">No activity recorded yet.</p> : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {stats.recentLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                  <div>
                    <strong>{log.technician.name}</strong>
                    <div className="text-muted" style={{ fontSize: '0.875rem' }}>{log.action === 'TAKEN' ? 'Took' : 'Returned'} {log.tool.name}</div>
                  </div>
                  <time className="text-muted" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }} dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3>Top Active Technicians</h3>
            <Link href="/technicians" className="btn btn-outline">
              Manage <ArrowRight size={16} />
            </Link>
          </div>
          {loading ? <p className="text-muted">Loading...</p> : stats.toolsByTechnician.length === 0 ? <p className="text-muted">No technicians found.</p> : (
            <table className="data-table">
              <thead>
                <tr><th>Technician</th><th>Assigned Tools</th></tr>
              </thead>
              <tbody>
                {stats.toolsByTechnician.slice(0, 5).map((technician) => (
                  <tr key={technician.idNumber}>
                    <td><strong>{technician.name}</strong><div className="text-muted" style={{ fontSize: '0.75rem' }}>{technician.idNumber}</div></td>
                    <td><span className="badge badge-info">{technician.toolCount}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Unreturned Materials</h3>
          <Link href="/tools" className="btn btn-outline">
            View Tools <ArrowRight size={16} />
          </Link>
        </div>
        {loading ? <p className="text-muted">Loading...</p> : (!stats.unreturnedTools || stats.unreturnedTools.length === 0) ? <p className="text-muted">All materials are currently returned.</p> : (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Material Name</th>
                  <th style={{ position: 'sticky', top: 0, zIndex: 1 }}>Technician</th>
                </tr>
              </thead>
              <tbody>
                {stats.unreturnedTools.map((tool) => (
                  <tr key={tool.id}>
                    <td><strong>{tool.name}</strong></td>
                    <td>{tool.technicianName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Box size={22} color="var(--primary)" />
          <div><h3>Need to check a tool?</h3><p className="text-muted">Scan a QR code to assign or return equipment.</p></div>
        </div>
        <Link href="/scanner" className="btn btn-primary">Open scanner</Link>
      </div>
    </div>
  );
}
