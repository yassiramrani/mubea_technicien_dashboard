'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/LanguageContext';

type Technician = {
  id: string;
  name: string;
};

// 1. Helper function moved outside the component for cleaner scope
function decodeAzerty(input: string): string {
  const azertyToQwertyMap: Record<string, string> = {
    ',': 'm',
    ')': '-',
    '&': '1',
    'é': '2',
    '"': '3',
    "'": '4',
    '(': '5',
    '-': '6',
    'è': '7',
    '_': '8',
    'ç': '9',
    'à': '0',
  };

  return input
    .split('')
    .map((char) => azertyToQwertyMap[char] ?? char)
    .join('');
}

export default function ScannerPage() {
  const { t } = useTranslation();
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
      setScanResult({ text: t('pleaseSelectTechnician'), type: 'error' });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    
    // 2. Get the raw scanned value
    const rawScannedCode = inputRef.current?.value.trim();
    if (!rawScannedCode) return;

    // 3. Decode the AZERTY layout to standard QWERTY
    const decodedCode = decodeAzerty(rawScannedCode);

    try {
      const res = await fetch('/api/tools/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 4. Send the decoded code to your API
        body: JSON.stringify({ qrCode: decodedCode, technicianId: selectedTech }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setScanResult({ text: data.message, type: 'success', tool: data.tool });
      } else {
        setScanResult({ text: `${data.error} (Scanned: "${decodedCode}")`, type: 'error' });
      }
    } catch (error) {
      setScanResult({ text: t('failedProcessScan'), type: 'error' });
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
      <h1 className="page-title">{t('toolScanner')}</h1>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>{t('activeTechnician')}</h3>
        <div className="form-group" style={{ maxWidth: '400px' }}>
          <label className="form-label">{t('selectTechnician')}</label>
          {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem' }}>{t('unableLoadTechnicians')}</p>}
          <select 
            className="form-input"
            value={selectedTech} 
            onChange={(e) => setSelectedTech(e.target.value)}
          >
            <option value="">{t('selectTechnicianOption')}</option>
            {technicians.map(tech => (
              <option key={tech.id} value={tech.id}>{tech.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{t('scanQrHardware')}</h3>
        
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
                  <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, textAlign: 'center', fontSize: '10px' }}>{t('noImage')}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                    <span><strong>{t('tool')}:</strong> {scanResult.tool.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span><strong>{t('newStatus')}:</strong> {scanResult.tool.status}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleScanSubmit} style={{ maxWidth: '400px' }}>
          <div className="form-group">
            <label className="form-label">{t('scannerInput')}</label>
            <input 
              ref={inputRef}
              type="text" 
              className="form-input" 
              placeholder={t('scanBarcode')}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ display: 'none' }}>
            {t('processScan')}
          </button>
        </form>
        <p className="text-muted" style={{ fontSize: '0.875rem', marginTop: '1rem' }}>
          {t('scanInstructions')}
        </p>
      </div>
    </div>
  );
}