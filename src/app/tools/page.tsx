'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

type Tool = {
  id: string;
  name: string;
  qrCode: string;
  status: string;
  technician: any | null;
};

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [printingTool, setPrintingTool] = useState<Tool | null>(null);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      setTools(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setName('');
        fetchTools();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handlePrintQR = (tool: Tool) => {
    setPrintingTool(tool);
    setTimeout(() => {
      window.print();
      setPrintingTool(null);
    }, 100);
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
          }
        }
      `}} />

      {printingTool && (
        <div id="print-area">
          <h2 style={{ marginBottom: '1rem' }}>{printingTool.name}</h2>
          <QRCodeSVG value={printingTool.qrCode} size={256} />
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>{printingTool.qrCode}</p>
        </div>
      )}

      <h1 className="page-title">Tools Management</h1>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Add New Tool</h3>
        <form onSubmit={handleAddTool} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">Tool Name</label>
            <input 
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bosch Drill 500W"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>
            Add & Generate QR
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Tools Inventory</h3>
        {loading ? (
          <p>Loading...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id}>
                  <td>{tool.name}</td>
                  <td>
                    <span className={`badge ${tool.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                      {tool.status}
                    </span>
                  </td>
                  <td>{tool.technician ? tool.technician.name : '-'}</td>
                  <td>
                    <button onClick={() => handlePrintQR(tool)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                      Print QR
                    </button>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center' }}>No tools found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
