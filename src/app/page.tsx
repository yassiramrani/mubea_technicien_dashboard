'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Users, Wrench, CheckCircle, AlertTriangle, Activity, Clock } from 'lucide-react';

type Stats = {
  totalTechnicians: number;
  totalTools: number;
  availableTools: number;
  assignedTools: number;
  todayLogs: number;
  recentLogs: {
    id: string;
    action: string;
    createdAt: string;
    technician: { name: string };
    tool: { name: string };
  }[];
  toolsByTechnician: {
    name: string;
    idNumber: string;
    toolCount: number;
    tools: string[];
  }[];
};

export default function OverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p>Loading dashboard...</p>;
  }

  if (!stats) {
    return <p>Failed to load dashboard data.</p>;
  }

  return (
    <div>
      <h1 className="page-title">Dashboard Overview</h1>

      {/* Summary Cards */}
      <div className="widget-grid">
        <div className="widget-card">
          <div className="widget-icon" style={{ backgroundColor: '#dbeafe', color: '#1e40af' }}>
            <Users size={22} />
          </div>
          <div>
            <p className="widget-value">{stats.totalTechnicians}</p>
            <p className="widget-label">Technicians</p>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon" style={{ backgroundColor: '#e0e7ff', color: '#3730a3' }}>
            <Wrench size={22} />
          </div>
          <div>
            <p className="widget-value">{stats.totalTools}</p>
            <p className="widget-label">Total Tools</p>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon" style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="widget-value">{stats.availableTools}</p>
            <p className="widget-label">Available</p>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon" style={{ backgroundColor: '#fef3c7', color: '#92400e' }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <p className="widget-value">{stats.assignedTools}</p>
            <p className="widget-label">Assigned</p>
          </div>
        </div>

        <div className="widget-card">
          <div className="widget-icon" style={{ backgroundColor: '#ede9fe', color: '#5b21b6' }}>
            <Activity size={22} />
          </div>
          <div>
            <p className="widget-value">{stats.todayLogs}</p>
            <p className="widget-label">Today&apos;s Actions</p>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="overview-columns">
        {/* Recent Activity */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={18} /> Recent Activity
          </h3>
          {stats.recentLogs.length === 0 ? (
            <p className="text-muted">No activity yet.</p>
          ) : (
            <div className="activity-list">
              {stats.recentLogs.map((log) => (
                <div key={log.id} className="activity-item">
                  <div className={`activity-dot ${log.action === 'TAKEN' ? 'dot-warning' : 'dot-success'}`} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.875rem' }}>
                      <strong>{log.technician.name}</strong>{' '}
                      {log.action === 'TAKEN' ? 'took' : 'returned'}{' '}
                      <strong>{log.tool.name}</strong>
                    </p>
                    <p className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {format(new Date(log.createdAt), 'MMM dd, HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools per Technician */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={18} /> Tools per Technician
          </h3>
          {stats.toolsByTechnician.length === 0 ? (
            <p className="text-muted">No technicians registered yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Technician</th>
                  <th>Tools Held</th>
                </tr>
              </thead>
              <tbody>
                {stats.toolsByTechnician.map((tech) => (
                  <tr key={tech.idNumber}>
                    <td>
                      <span style={{ fontWeight: 500 }}>{tech.name}</span>
                      <br />
                      <span className="text-muted" style={{ fontSize: '0.75rem' }}>{tech.idNumber}</span>
                    </td>
                    <td>
                      {tech.toolCount === 0 ? (
                        <span className="text-muted">None</span>
                      ) : (
                        <div>
                          <span className="badge badge-warning" style={{ marginBottom: '0.25rem' }}>
                            {tech.toolCount}
                          </span>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                            {tech.tools.join(', ')}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
