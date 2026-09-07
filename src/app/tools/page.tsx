'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Edit2 } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';
import { useTranslation } from '@/lib/LanguageContext';
import { jsPDF } from 'jspdf';
import { getCode128Bars, renderCode128DataUrl } from '@/lib/code128';

type Tool = {
  id: string;
  name: string;
  image?: string | null;
  qrCode: string;
  status: string;
  technician: any | null;
};

function Code128Barcode({ value }: { value: string }) {
  const { bars, modules } = getCode128Bars(value);

  return (
    <svg
      className="label-barcode"
      viewBox={`0 0 ${modules} 100`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Code 128 barcode for ${value}`}
    >
      <rect width={modules} height="100" fill="#ffffff" />
      {bars.map((bar, index) => <rect key={index} x={bar.x} y="0" width={bar.width} height="100" fill="#000000" />)}
    </svg>
  );
}

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

  // New state variables for inline name editing
  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

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
  const addBarcodeLabel = (doc: jsPDF, tool: Tool, x = 0, y = 0) => {
    const barcodeDataUrl = renderCode128DataUrl(tool.qrCode);

    // Label stock: 40 × 20 mm. The 2 mm left/right quiet area and 10 mm bars
    // keep the whole Code 128 symbol inside the printable portion of the sticker.
    doc.addImage(barcodeDataUrl, 'PNG', x + 2, y + 3, 36, 10);
    doc.setFontSize(7);
    doc.setTextColor(0, 0, 0);
    doc.text(tool.qrCode, x + 20, y + 16.5, { align: 'center' });
  };

  const handleDownloadThermalBarcodes = async () => {
    if (tools.length === 0) return;
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [40, 20],
      });

      for (let i = 0; i < tools.length; i++) {
        addBarcodeLabel(doc, tools[i]);

        if (i < tools.length - 1) {
          doc.addPage([40, 20], 'landscape');
        }
      }

      doc.save('Thermal_Barcode_Labels_40x20mm.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
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

  // New handler for updating the tool's name
  const handleUpdateName = async (toolId: string) => {
    if (!editingName.trim()) return;
    
    try {
      const res = await fetch('/api/tools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: toolId, name: editingName.trim() }),
      });
      
      if (res.ok) {
        fetchTools();
        setEditingToolId(null);
      } else {
        alert('Failed to update name');
      }
    } catch (error) {
      console.error(error);
      alert('Failed to update name');
    }
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

  const handlePrintBarcode = (tool: Tool) => {
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

 const handleDownloadAllBarcodes = async () => {
    if (tools.length === 0) return;
    try {
      const doc = new jsPDF();

      // A4 sheet setup for the same 40 × 20 mm label stock.
      const PAGE_LEFT_MARGIN = 17;
      const PAGE_TOP_MARGIN = 16;
      const LABEL_WIDTH = 40;
      const LABEL_HEIGHT = 20;
      const COLS = 4;

      let currentY = PAGE_TOP_MARGIN;
      let colIndex = 0;

      for (let i = 0; i < tools.length; i++) {
        addBarcodeLabel(doc, tools[i], PAGE_LEFT_MARGIN + (colIndex * LABEL_WIDTH), currentY);

        colIndex++;

        if (colIndex >= COLS) {
          colIndex = 0;
          currentY += LABEL_HEIGHT;

          if (currentY + LABEL_HEIGHT > 280) {
            doc.addPage();
            currentY = PAGE_TOP_MARGIN;
          }
        }
      }

      doc.save('All_Tools_Barcode_Labels_40x20mm.pdf');
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF');
    }
  };

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 40mm 20mm; margin: 0; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area {
            position: absolute; left: 0; top: 0; width: 40mm; height: 20mm;
            display: flex; flex-direction: column; align-items: center; padding: 3mm 2mm 0;
          }
          #print-area h2 { display: none; }
          #print-area .label-barcode { width: 36mm; height: 10mm; }
          #print-area p { margin-top: 1.5mm !important; font-size: 7pt !important; color: #000 !important; }
        }
      `}} />

      {printingTool && (
        <div id="print-area">
          <h2 style={{ marginBottom: '1rem' }}>{printingTool.name}</h2>
          <Code128Barcode value={printingTool.qrCode} />
          <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#666' }}>{printingTool.qrCode}</p>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tools Management</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleDownloadAllBarcodes} className="btn btn-outline" disabled={tools.length === 0}>
            {t('downloadBarcodeSheet')}
          </button>
          <button onClick={handleExportExcel} className="btn btn-primary" disabled={tools.length === 0}>
            {t('exportExcel')}
          </button>
            <button onClick={handleDownloadThermalBarcodes} className="btn btn-outline" disabled={tools.length === 0}>
              {t('downloadThermalBarcodes')}
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
                  
                  {/* Updated Name Column with Inline Editing */}
                  <td>
                    {editingToolId === tool.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', height: 'auto', width: '150px' }}
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateName(tool.id);
                            if (e.key === 'Escape') setEditingToolId(null);
                          }}
                        />
                        <button 
                          onClick={() => handleUpdateName(tool.id)} 
                          className="btn btn-primary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Save
                        </button>
                        <button 
                          onClick={() => setEditingToolId(null)} 
                          className="btn btn-outline" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{tool.name}</span>
                        <button 
                          onClick={() => {
                            setEditingToolId(tool.id);
                            setEditingName(tool.name);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '0.2rem', border: 'none', color: '#64748b', background: 'transparent' }}
                          title="Edit name"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    )}
                  </td>

                  <td>
                    <span className={`badge ${tool.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                      {tool.status}
                    </span>
                  </td>
                  <td>{tool.technician ? tool.technician.name : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => handlePrintBarcode(tool)} className="btn btn-outline" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                        {t('printBarcode')}
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
