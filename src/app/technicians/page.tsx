'use client';

import { useState, useEffect } from 'react';
import { exportToExcel } from '@/lib/exportToExcel';

type Technician = {
  id: string;
  name: string;
  idNumber: string;
  tools: any[];
};

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [name, setName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, []);

  const fetchTechnicians = async () => {
    try {
      const res = await fetch('/api/technicians');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error('Unable to load technicians');
      setTechnicians(data);
      setError(false);
    } catch (error) {
      setError(true);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTechnician = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !idNumber) return;

    try {
      const res = await fetch('/api/technicians', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idNumber }),
      });
      if (res.ok) {
        setName('');
        setIdNumber('');
        fetchTechnicians();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    const data = technicians.map(tech => ({
      ID: tech.id,
      Name: tech.name,
      IDNumber: tech.idNumber,
      AssignedToolsCount: tech.tools.length,
      AssignedToolsNames: tech.tools.map((t: any) => t.name).join(', '),
    }));
    exportToExcel(data, 'Mubea_Technicians');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Technicians Management</h1>
        <button onClick={handleExportExcel} className="btn btn-primary" disabled={technicians.length === 0}>
          Export Excel
        </button>
      </div>
      
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>Unable to load technicians. Check the database connection.</p>}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add New Technician</h3>
        <form onSubmit={handleAddTechnician} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">ID Number</label>
            <input 
              type="text" 
              className="form-input" 
              value={idNumber}
              onChange={(e) => setIdNumber(e.target.value)}
              placeholder="e.g. EMP-001"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>
            Add Technician
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Technicians List</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>ID Number</th>
                <th>Assigned Tools</th>
              </tr>
            </thead>
            <tbody>
              {technicians.map((tech) => (
                <tr key={tech.id}>
                  <td>{tech.name}</td>
                  <td>{tech.idNumber}</td>
                  <td>
                    <span className="badge badge-info">{tech.tools.length}</span>
                  </td>
                </tr>
              ))}
              {technicians.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center' }}>No technicians found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
