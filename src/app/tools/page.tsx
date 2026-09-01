'use client';

import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Trash2 } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';
import { useTranslation } from '@/lib/LanguageContext';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';

type Tool = {
  id: string;
  name: string;
  image?: string | null;
  qrCode: string;
  status: string;
  technician: any | null;
};

export default function ToolsPage() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingToolId, setUploadingToolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printingTool, setPrintingTool] = useState<Tool | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/tools');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error('Unable to load tools');
      setTools(data);
      setError(false);
    } catch (error) {
      setError(true);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 400;
          const MAX_HEIGHT = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          setImage(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      setImage('');
    }
  };

  const handleUpdateImageClick = (toolId: string) => {
    setUploadingToolId(toolId);
    if (updateFileInputRef.current) updateFileInputRef.current.click();
  };

  const handleUpdateImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingToolId) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const newImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        try {
          const res = await fetch('/api/tools', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: uploadingToolId, image: newImageBase64 }),
          });
          if (res.ok) {
            fetchTools();
          } else {
            alert('Failed to update image');
          }
        } catch (error) {
          console.error(error);
          alert('Failed to update image');
        } finally {
          setUploadingToolId(null);
          if (updateFileInputRef.current) updateFileInputRef.current.value = '';
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleAddTool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    try {
      const res = await fetch('/api/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image: image || null }),
      });
      if (res.ok) {
        setName('');
        setImage('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchTools();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteTool = async (tool: Tool) => {
    if (tool.status === 'ASSIGNED') {
      alert(t('cannotDeleteAssigned'));
      return;
    }

    if (!confirm(t('deleteConfirmation'))) return;

    try {
      const res = await fetch(`/api/tools?id=${tool.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to delete tool');
        return;
      }
      fetchTools();
    } catch (error) {
      console.error(error);
      alert('Failed to delete tool');
    }
  };

  const handlePrintQR = (tool: Tool) => {
    setPrintingTool(tool);
    setTimeout(() => {
      window.print();
      setPrintingTool(null);
    }, 100);
  };

  const handleExportExcel = () => {
    const data = tools.map(t => ({
      ID: t.id,
      Name: t.name,
      ImageURL: t.image || 'N/A',
      QRCode: t.qrCode,
      Status: t.status,
      AssignedTo: t.technician ? t.technician.name : 'None',
    }));
    exportToExcel(data, 'Mubea_Tools');
  };

  const handleDownloadAllQRs = async () => {
    if (tools.length === 0) return;
    try {
      const doc = new jsPDF();
      let x = 12; // Start slightly closer to the left edge
      let y = 15;
      const size = 20; // 20x20 mm QR code (fits 7 perfectly)
      const spacing = 6; // 6mm spacing between QR codes
      const maxRow = 7; // 7 QR codes per row
      let count = 0;

      for (let i = 0; i < tools.length; i++) {
        const tool = tools[i];
        
        // Generate QR code data URL
        const qrDataUrl = await QRCode.toDataURL(tool.qrCode, {
          width: 200,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        });

        // Add to PDF
        doc.addImage(qrDataUrl, 'PNG', x, y, size, size);
        doc.setFontSize(7); // Reduced font size to prevent overlapping
        doc.setTextColor(50, 50, 50);
        
        // Truncate name if too long
        const shortName = tool.name.length > 20 ? tool.name.substring(0, 18) + '...' : tool.name;
        doc.text(shortName, x + size/2, y + size + 4, { align: 'center' });
        doc.text(tool.qrCode, x + size/2, y + size + 7, { align: 'center' });

        count++;
        if (count % maxRow === 0) {
          x = 12;
          y += size + 12; // Move down (less vertical space needed now)
          if (y > 275) { // A4 is 297mm high, break near the bottom
            doc.addPage();
            y = 15;
          }
        } else {
          x += size + spacing; // Move right
        }
      }

      doc.save('All_Tools_QR_Codes.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tools Management</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleDownloadAllQRs} className="btn btn-outline" disabled={tools.length === 0}>
            Download All QRs
          </button>
          <button onClick={handleExportExcel} className="btn btn-primary" disabled={tools.length === 0}>
            {t('exportExcel')}
          </button>
        </div>
      </div>
      
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>{t('addNewTool')}</h3>
        <form onSubmit={handleAddTool} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('toolName')}</label>
            <input 
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bosch Drill 500W"
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('toolImageOptional')}</label>
            <input 
              type="file" 
              accept="image/*"
              className="form-input" 
              onChange={handleImageChange}
              ref={fileInputRef}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '38px' }}>
            {t('addGenerateQr')}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{t('toolsInventory')}</h3>
        {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{t('unableLoadTools')}</p>}
        {loading ? (
          <p>{t('loading')}</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('image')}</th>
                <th>{t('name')}</th>
                <th>{t('status')}</th>
                <th>{t('assignedTo')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id}>
                  <td>
                    <div 
                      onClick={() => handleUpdateImageClick(tool.id)}
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      title="Click to update image"
                    >
                      {tool.image ? (
                        <img src={tool.image} alt={tool.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>{t('noImage')}</div>
                      )}
                    </div>
                  </td>
                  <td>{tool.name}</td>
                  <td>
                    <span className={`badge ${tool.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                      {tool.status}
                    </span>
                  </td>
                  <td>{tool.technician ? tool.technician.name : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handlePrintQR(tool)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        {t('printQr')}
                      </button>
                      <button
                        onClick={() => handleDeleteTool(tool)}
                        className="btn btn-outline"
                        style={{
                          padding: '0.25rem 0.5rem',
                          fontSize: '0.75rem',
                          color: 'var(--danger)',
                          borderColor: 'var(--danger)',
                          opacity: tool.status === 'ASSIGNED' ? 0.4 : 1,
                          cursor: tool.status === 'ASSIGNED' ? 'not-allowed' : 'pointer',
                        }}
                        title={tool.status === 'ASSIGNED' ? t('returnBeforeDeleting') : t('deleteTool')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tools.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center' }}>{t('noTools')}</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      <input 
        type="file" 
        accept="image/*" 
        ref={updateFileInputRef} 
        onChange={handleUpdateImageChange} 
        style={{ display: 'none' }} 
      />
    </div>
  );
}
