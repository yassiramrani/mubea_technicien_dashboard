'use client';

import { useState, useEffect, useRef } from 'react';

type Technician = {
  id: string;
  name: string;
};

export default function ScannerPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [scanResult, setScanResult] = useState<{ text: string; type: 'success' | 'error'; tool?: any } | null>(null);
  const [error, setError] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTechnicians();
    // Auto focus the input when component mounts
    if (inputRef.current) {
      inputRef.current.focus();
    }
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
    }
  };

  const handleScanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTech) {
      setScanResult({ text: 'Please select a technician first!', type: 'error' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    
    const scannedCode = inputRef.current?.value.trim();
    if (!scannedCode) return;

    try {
      const res = await fetch('/api/tools/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: scannedCode, technicianId: selectedTech }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setScanResult({ text: data.message, type: 'success', tool: data.tool });
      } else {
        setScanResult({ text: `${data.error} (Scanned: "${scannedCode}")`, type: 'error' });
      }
    } catch (error) {
      setScanResult({ text: 'Failed to process scan', type: 'error' });
    } finally {
      // Clear the input for the next scan
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  };

  return (
    <div>
      <h1 className="page-title">Tool Scanner</h1>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Active Technician</h3>
        <div className="form-group" style={{ maxWidth: '400px' }}>
          <label className="form-label">Select Technician to assign/return tools</label>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>Unable to load technicians. Check the database connection.</p>}
          <select 
            className="form-input"
            value={selectedTech} 
            onChange={(e) => setSelectedTech(e.target.value)}
          >
            <option value="">-- Select Technician --</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>{tech.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Scan QR Code (Hardware Scanner)</h3>
        
        {scanResult && (
          <div style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '6px',
            backgroundColor: scanResult.type === 'success' ? '#d1fae5' : '#fee2e2',
            color: scanResult.type === 'success' ? '#065f46' : '#991b1b',
          }}>
            <p style={{ fontWeight: 600, marginBottom: scanResult.tool ? '0.5rem' : 0 }}>
              {scanResult.text}
            </p>
            {scanResult.tool && (
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.875rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '4px' }}>
                {scanResult.tool.image ? (
                  <img src={scanResult.tool.image} alt={scanResult.tool.name} style={{ width: '160px', height: '160px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textAlign: 'center', fontSize: '10px' }}>No Img</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span><strong>Tool:</strong> {scanResult.tool.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>New Status:</strong> {scanResult.tool.status}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleScanSubmit} style={{ maxWidth: '400px' }}>
          <div className="form-group">
            <label className="form-label">Scanner Input</label>
            <input 
              ref={inputRef}
              type="text" 
              className="form-input" 
              placeholder="Scan barcode here..."
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ display: 'none' }}>
            Process Scan
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
          Ensure your cursor is in the input box above, then scan the tool's QR code.
        </p>
      </div>
    </div>
  );
}
