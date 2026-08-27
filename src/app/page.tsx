'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowRight, Box, CheckCircle2, ClipboardList, Users, Wrench } from 'lucide-react';

type RecentLog = {
  id: string;
  action: string;
  createdAt: string;
  technician: { name: string };
  tool: { name: string };
};

type Stats = {
  totalTechnicians: number;
  totalTools: number;
  availableTools: number;
  assignedTools: number;
  todayLogs: number;
  recentLogs: RecentLog[];
  toolsByTechnician: { idNumber: string; name: string; toolCount: number; tools: string[] }[];
};

const initialStats: Stats = {
  totalTechnicians: 0,
  totalTools: 0,
  availableTools: 0,
  assignedTools: 0,
  todayLogs: 0,
  recentLogs: [],
  toolsByTechnician: [],
};

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));

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

  const widgets = [
    { label: 'Technicians', value: stats.totalTechnicians, icon: Users, color: '#dbeafe', iconColor: '#1e40af' },
    { label: 'Total Tools', value: stats.totalTools, icon: Wrench, color: '#ede9fe', iconColor: '#6d28d9' },
    { label: 'Available Tools', value: stats.availableTools, icon: CheckCircle2, color: '#d1fae5', iconColor: '#047857' },
    { label: 'Assigned Tools', value: stats.assignedTools, icon: ClipboardList, color: '#fef3c7', iconColor: '#b45309' },
    { label: 'Activity Today', value: stats.todayLogs, icon: Activity, color: '#fee2e2', iconColor: '#b91c1c' },
  ];

  return (
    <div>
      <h1 className="page-title">Overview</h1>

      {error && <p className="card" style={{ marginBottom: '1.5rem', color: 'var(--danger)' }}>Unable to load dashboard data.</p>}

      <div className="widget-grid">
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

      <div className="overview-columns">
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
            <h3>Tools By Technician</h3>
            <Link href="/technicians" className="btn btn-outline">
              Manage <ArrowRight size={16} />
            </Link>
          </div>
          {loading ? <p className="text-muted">Loading...</p> : stats.toolsByTechnician.length === 0 ? <p className="text-muted">No technicians found.</p> : (
            <table className="data-table">
              <thead>
                <tr><th>Technician</th><th>Assigned</th></tr>
              </thead>
              <tbody>
                {stats.toolsByTechnician.map((technician) => (
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
