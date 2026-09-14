'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AlertTriangle, Trash2, Edit2, CheckCircle2, Printer, RotateCcw } from 'lucide-react';
import { exportToExcel } from '@/lib/exportToExcel';
import { useTranslation } from '@/lib/LanguageContext';
import { jsPDF } from 'jspdf';
import QRCode from 'react-qr-code';
import QRCodeLib from 'qrcode'; // Added for jsPDF generation

type Tool = {
  id: string;
  name: string;
  image?: string | null;
  qrCode: string;
  status: string;
  technician: { name: string } | null;
  checkedOutAt: string | null;
  isOverdue: boolean;
  labelPrinted: boolean;
  labelPrintedAt: string | null;
};

export function PrintQRCode({ value }: { value: string }) {
  return (
    <div className="label-qrcode">
      <QRCode
        size={256}
        style={{ height: "100%", width: "100%", display: "block" }}
        value={value}
        viewBox={`0 0 256 256`}
        level="M"
      />
    </div>
  );
}

export default function ToolsPage() {
  const { t, lang } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [name, setName] = useState('');
  const [image, setImage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const updateFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingToolId, setUploadingToolId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [printingTool, setPrintingTool] = useState<Tool | null>(null);
  const [error, setError] = useState(false);

  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Label printing state. The app must remember which labels were already
  // printed, otherwise a partial or bad print run can never be resumed.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reprintAll, setReprintAll] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelMessage, setLabelMessage] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState('');
  const reconcileScanRef = useRef<HTMLInputElement>(null);

  const fetchTools = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTools(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchTools]);

  const printedCount = useMemo(() => tools.filter((tool) => tool.labelPrinted).length, [tools]);
  const unprintedTools = useMemo(() => tools.filter((tool) => !tool.labelPrinted), [tools]);
  const selectedTools = useMemo(() => tools.filter((tool) => selectedIds.has(tool.id)), [tools, selectedIds]);
  const allSelected = tools.length > 0 && selectedIds.size === tools.length;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(tools.map((tool) => tool.id)));
  };

  const markLabelState = async (ids: string[], labelPrinted: boolean) => {
    if (ids.length === 0) return true;
    try {
      const res = await fetch('/api/tools', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, labelPrinted }),
      });
      if (!res.ok) throw new Error('Failed to update label state');
      await fetchTools();
      return true;
    } catch (error) {
      console.error(error);
      setLabelMessage(t('labelUpdateFailed'));
      return false;
    }
  };

  // Dynamically generate a QR Code Data URL for the PDF
  const addQrCodeLabel = async (doc: jsPDF, tool: Tool, x = 0, y = 0) => {
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(tool.qrCode, { margin: 0, width: 100 });
      
      // Shrunk QR code to 15x15mm and added 2.5mm top margin to center it vertically
      doc.addImage(qrDataUrl, 'PNG', x + 1.5, y + 2.5, 15, 15);
      
      doc.setTextColor(0, 0, 0);
      // Increased font size slightly and gave the text a wider maxWidth
      doc.setFontSize(8);
      doc.text(tool.name.substring(0, 18), x + 18, y + 8, { maxWidth: 20 }); 
      
      doc.setFontSize(7);
      doc.text(tool.qrCode, x + 18, y + 14, { maxWidth: 20 });
    } catch (err) {
      console.error('Failed to generate QR for PDF:', err);
    }
  };

  /**
   * Generates a PDF for the given tools and marks their labels as printed once
   * the file has been produced. Passing only the tools that still need a label
   * is what makes a partial or failed print run resumable.
   */
  const printLabels = async (list: Tool[], layout: 'thermal' | 'sheet') => {
    if (list.length === 0) return;

    setLabelBusy(true);
    setLabelMessage(null);

    try {
      if (layout === 'thermal') {
        const doc = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [40, 20], // Adjusted format to match your true label stock
        });

        for (let i = 0; i < list.length; i++) {
          await addQrCodeLabel(doc, list[i]);

          if (i < list.length - 1) {
            doc.addPage([40, 20], 'landscape');
          }
        }

        doc.save(`QR_labels_${list.length}_thermal_40x20mm.pdf`);
      } else {
        const doc = new jsPDF();
        const PAGE_LEFT_MARGIN = 17;
        const PAGE_TOP_MARGIN = 16;
        const LABEL_WIDTH = 40;
        const LABEL_HEIGHT = 20;
        const COLS = 4;

        let currentY = PAGE_TOP_MARGIN;
        let colIndex = 0;

        for (let i = 0; i < list.length; i++) {
          await addQrCodeLabel(doc, list[i], PAGE_LEFT_MARGIN + (colIndex * LABEL_WIDTH), currentY);
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

        doc.save(`QR_labels_${list.length}_sheet_A4.pdf`);
      }

      await markLabelState(list.map((tool) => tool.id), true);
      setLabelMessage(t('labelsPrintedCount').replace('{count}', String(list.length)));
    } catch (error) {
      console.error('Error generating PDF:', error);
      setLabelMessage(t('labelGenerateFailed'));
    } finally {
      setLabelBusy(false);
    }
  };

  // Tools that still need a label, unless the user explicitly asks for a full reprint.
  const handlePrintPendingLabels = (layout: 'thermal' | 'sheet') => {
    const list = reprintAll ? tools : unprintedTools;
    void printLabels(list, layout);
  };

  const handlePrintSelectedLabels = (layout: 'thermal' | 'sheet') => {
    void printLabels(selectedTools, layout);
  };

  /**
   * Reconcile mode: scan a physical label that is already on a tool and the app
   * marks that tool's label as printed. This is how an existing, unordered print
   * run can be recovered without reprinting or re-identifying anything.
   */
  const handleReconcileScan = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanValue.trim().toUpperCase();
    if (!code) return;

    setScanValue('');

    const match = tools.find((tool) => tool.qrCode.toUpperCase() === code);

    if (!match) {
      setLabelMessage(t('reconcileNotFound').replace('{code}', code));
      reconcileScanRef.current?.focus();
      return;
    }

    if (match.labelPrinted) {
      setLabelMessage(t('reconcileAlreadyPrinted').replace('{name}', match.name));
      reconcileScanRef.current?.focus();
      return;
    }

    await markLabelState([match.id], true);
    setLabelMessage(t('reconcileMarked').replace('{name}', match.name).replace('{code}', match.qrCode));
    reconcileScanRef.current?.focus();
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
      LabelPrinted: t.labelPrinted ? 'Yes' : 'No',
    }));
    exportToExcel(data, 'Mubea_Tools');
  };

  const formatCheckedOutAt = (value: string) =>
    new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  return (
    <div>
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          @page { size: 40mm 20mm; margin: 0; }
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          
          #print-area {
            position: absolute; left: 0; top: 0; width: 40mm; height: 20mm;
            display: flex; flex-direction: row; align-items: center; justify-content: flex-start;
            padding: 2mm; box-sizing: border-box; background: white;
          }
          
          /* Shrunk the QR code to 15mm to stop edge bleeding */
          #print-area .label-qrcode { 
            width: 15mm; height: 15mm; flex-shrink: 0; margin: 0; 
          }
          #print-area .label-qrcode svg {
            width: 100%; height: 100%; display: block;
          }
          
          /* Gave the text container more room and bigger font */
          #print-area .print-text { 
            margin-left: 2mm; display: flex; flex-direction: column; justify-content: center; 
            width: 20mm; overflow: hidden;
          }
          
          #print-area .print-name { 
            font-size: 8pt !important; font-weight: bold; color: #000 !important; 
            margin: 0; line-height: 1.1; word-wrap: break-word;
          }
          
          #print-area .print-id { 
            font-size: 7pt !important; color: #000 !important; margin: 1mm 0 0 0 !important; 
            word-wrap: break-word; line-height: 1.1;
          }
        }
      `}} />

      {printingTool && (
        <div id="print-area">
          <PrintQRCode value={printingTool.qrCode} />
          <div className="print-text">
            <p className="print-name">{printingTool.name}</p>
            <p className="print-id">{printingTool.qrCode}</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Tools Management</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleExportExcel} className="btn btn-primary" disabled={tools.length === 0}>
            {t('exportExcel')}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '0.5rem' }}>{t('labelPrinting')}</h3>
        <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          {t('labelsPrintedSummary')
            .replace('{printed}', String(printedCount))
            .replace('{total}', String(tools.length))}
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          <input
            type="checkbox"
            checked={reprintAll}
            onChange={(e) => setReprintAll(e.target.checked)}
          />
          {t('reprintAllLabels')}
        </label>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => handlePrintPendingLabels('thermal')}
            className="btn btn-primary"
            disabled={labelBusy || (reprintAll ? tools.length === 0 : unprintedTools.length === 0)}
          >
            <Printer size={14} style={{ marginRight: '0.35rem' }} />
            {t('printPendingThermal').replace('{count}', String(reprintAll ? tools.length : unprintedTools.length))}
          </button>
          <button
            onClick={() => handlePrintPendingLabels('sheet')}
            className="btn btn-outline"
            disabled={labelBusy || (reprintAll ? tools.length === 0 : unprintedTools.length === 0)}
          >
            {t('printPendingSheet').replace('{count}', String(reprintAll ? tools.length : unprintedTools.length))}
          </button>
          <button
            onClick={() => handlePrintSelectedLabels('thermal')}
            className="btn btn-outline"
            disabled={labelBusy || selectedTools.length === 0}
          >
            {t('printSelected').replace('{count}', String(selectedTools.length))}
          </button>
        </div>

        <form onSubmit={handleReconcileScan} style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '1rem' }}>
          <label className="form-label" htmlFor="reconcile-scan">{t('reconcileTitle')}</label>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{t('reconcileHint')}</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              id="reconcile-scan"
              ref={reconcileScanRef}
              type="text"
              className="form-input"
              value={scanValue}
              onChange={(e) => setScanValue(e.target.value)}
              placeholder={t('reconcilePlaceholder')}
              autoComplete="off"
              style={{ maxWidth: '260px' }}
            />
            <button type="submit" className="btn btn-outline" disabled={!scanValue.trim()}>
              {t('reconcileMark')}
            </button>
          </div>
        </form>

        {labelMessage && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{labelMessage}</p>
        )}
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
                <th style={{ width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t('selectAll')}
                  />
                </th>
                <th>{t('image')}</th>
                <th>{t('name')}</th>
                <th>{t('labelStatus')}</th>
                <th>{t('status')}</th>
                <th>{t('assignedTo')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {tools.map((tool) => (
                <tr key={tool.id} className={tool.isOverdue ? 'tool-overdue-row' : undefined}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(tool.id)}
                      onChange={() => toggleSelected(tool.id)}
                      aria-label={`${t('select')} ${tool.name}`}
                    />
                  </td>
                  <td>
                    <div 
                      onClick={() => handleUpdateImageClick(tool.id)}
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      title="Click to update image"
                    >
                      {tool.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tool.image} alt={tool.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>{t('noImage')}</div>
                      )}
                    </div>
                  </td>
                  
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {tool.labelPrinted ? (
                        <span className="badge badge-success" title={tool.labelPrintedAt ? formatCheckedOutAt(tool.labelPrintedAt) : undefined}>
                          {t('labelPrinted')}
                        </span>
                      ) : (
                        <span className="badge badge-warning">{t('labelToPrint')}</span>
                      )}
                      <button
                        onClick={() => markLabelState([tool.id], !tool.labelPrinted)}
                        className="btn btn-outline"
                        style={{ padding: '0.2rem', border: 'none', color: '#64748b', background: 'transparent' }}
                        title={tool.labelPrinted ? t('markLabelUnprinted') : t('markLabelPrinted')}
                      >
                        {tool.labelPrinted ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                    </div>
                  </td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${tool.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                        {tool.status}
                      </span>
                      {tool.isOverdue && (
                        <span
                          className="badge badge-danger"
                          title={`${t('checkedOut')}: ${formatCheckedOutAt(tool.checkedOutAt!)}`}
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          {t('overdue')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {tool.technician ? tool.technician.name : '-'}
                    {tool.isOverdue && tool.checkedOutAt && (
                      <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.2rem' }}>
                        {t('checkedOut')}: {formatCheckedOutAt(tool.checkedOutAt)}
                      </div>
                    )}
                  </td>
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
                  <td colSpan={7} style={{ textAlign: 'center' }}>{t('noTools')}</td>
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
