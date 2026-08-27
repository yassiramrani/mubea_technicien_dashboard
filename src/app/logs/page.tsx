'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { exportToExcel } from '@/lib/exportToExcel';

type Log = {
  id: string;
  technician: { name: string, idNumber: string };
  tool: { name: string };
  action: string;
  createdAt: string;
};

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [date]);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs?date=${date}`);
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error('Unable to load logs');
      setLogs(data);
      setError(false);
    } catch (error) {
      setError(true);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Mubea Technician Tools Log', 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Date: ${date}`, 14, 30);

    const tableColumn = ["Time", "Technician", "ID Number", "Tool", "Action"];
    const tableRows = logs.map(log => [
      format(new Date(log.createdAt), 'HH:mm:ss'),
      log.technician.name,
      log.technician.idNumber,
      log.tool.name,
      log.action
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [0, 85, 164] }, // Mubea Blue
    });

    doc.save(`mubea_tools_report_${date}.pdf`);
  };

  const handleExportExcel = () => {
    const data = logs.map(log => ({
      Time: format(new Date(log.createdAt), 'HH:mm:ss'),
      Date: format(new Date(log.createdAt), 'yyyy-MM-dd'),
      TechnicianName: log.technician.name,
      TechnicianID: log.technician.idNumber,
      ToolName: log.tool.name,
      Action: log.action
    }));
    exportToExcel(data, `Mubea_Logs_${date}`);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Logs & Reports</h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={exportPDF} className="btn btn-primary" disabled={logs.length === 0 || undefined}>
            Export PDF
          </button>
          <button onClick={handleExportExcel} className="btn btn-primary" disabled={logs.length === 0 || undefined}>
            Export Excel
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="form-group" style={{ maxWidth: '300px', marginBottom: 0 }}>
          <label className="form-label">Filter by Date</label>
          <input 
            type="date" 
            className="form-input" 
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Daily Activity</h3>
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Unable to load logs. Check the database connection.</p>}
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Technician</th>
                <th>Tool</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{format(new Date(log.createdAt), 'HH:mm:ss')}</td>
                  <td>{log.technician.name} ({log.technician.idNumber})</td>
                  <td>{log.tool.name}</td>
                  <td>
                    <span className={`badge ${log.action === 'TAKEN' ? 'badge-warning' : 'badge-success'}`}>
                      {log.action}
                    </span>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>No logs found for this date.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
