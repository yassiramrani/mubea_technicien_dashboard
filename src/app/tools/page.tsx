'use client';

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode';
import { AlertTriangle, Trash2, Edit2, CheckCircle2, Printer, RotateCcw, Camera, X, Search, Download, ChevronLeft, ChevronRight, QrCode } from 'lucide-react';
import { filterInventory, type InventoryStatus, type InventorySort, type LabelFilter } from '@/lib/inventoryFilters';
import { exportToExcel } from '@/lib/exportToExcel';
import { useTranslation } from '@/lib/LanguageContext';
import { jsPDF } from 'jspdf';
import QRCode from 'react-qr-code';
import QRCodeLib from 'qrcode'; // Added for jsPDF generation
import ParetoCard from './ParetoCard';

// While a label stays in front of the camera the decoder fires the same code
// several times per second, so repeats are ignored for this long.
const RECONCILE_DEDUPE_MS = 4000;

type Tool = {
  id: string;
  name: string;
  image?: string | null;
  qrCode: string;
  status: string;
  technician: { name: string; idNumber?: string } | null;
  checkedOutAt: string | null;
  isOverdue: boolean;
  usageCount: number;
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

function ToolsInventory({ initialSearch, initialStatus }: { initialSearch: string; initialStatus: InventoryStatus }) {
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
  const [search, setSearch] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<InventoryStatus>(initialStatus);
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all');
  const [sort, setSort] = useState<InventorySort>(initialStatus === 'overdue' ? 'oldest' : 'name');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);

  const [editingToolId, setEditingToolId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  // Label printing state. The app must remember which labels were already
  // printed, otherwise a partial or bad print run can never be resumed.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reprintAll, setReprintAll] = useState(false);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelMessage, setLabelMessage] = useState<string | null>(null);
  const [cleanupBusy, setCleanupBusy] = useState(false);
  const [inventoryMessage, setInventoryMessage] = useState<string | null>(null);
  const [scanValue, setScanValue] = useState('');
  const [scannedCount, setScannedCount] = useState(0);
  const [reconcileCameraOpen, setReconcileCameraOpen] = useState(false);
  const [reconcileCameraStarting, setReconcileCameraStarting] = useState(false);
  const [reconcileCameraError, setReconcileCameraError] = useState<string | null>(null);
  const reconcileScanRef = useRef<HTMLInputElement>(null);
  const reconcileScannerRef = useRef<Html5QrcodeInstance | null>(null);
  const toolsRef = useRef<Tool[]>([]);
  const lastReconcileScanRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const reconcileProcessorRef = useRef<(rawCode: string) => Promise<void>>(async () => undefined);

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
  // "Unused" means never scanned since the tool was added (no history at all).
  const unusedTools = useMemo(() => tools.filter((tool) => tool.usageCount === 0), [tools]);
  const selectedTools = useMemo(() => tools.filter((tool) => selectedIds.has(tool.id)), [tools, selectedIds]);
  const filteredTools = useMemo(() => filterInventory(tools, {
    search, status: statusFilter, label: labelFilter, sort, lang,
  }), [tools, search, statusFilter, labelFilter, sort, lang]);
  const pageCount = Math.max(1, Math.ceil(filteredTools.length / pageSize));
  const unusedFiltered = filteredTools.filter((tool) => tool.usageCount === 0 && tool.status !== 'ASSIGNED');
  const currentPage = Math.min(page, pageCount - 1);
  const visibleTools = filteredTools.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const allSelected = visibleTools.length > 0 && visibleTools.every((tool) => selectedIds.has(tool.id));
  const resetViewSelection = () => { setPage(0); setSelectedIds(new Set()); };
  const clearFilters = () => {
    setSearch(''); setStatusFilter('all'); setLabelFilter('all'); setSort('name'); resetViewSelection();
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleTools.forEach((tool) => { if (allSelected) next.delete(tool.id); else next.add(tool.id); });
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Assigned tools are left out: they must be returned before they can be removed.
  const selectUnusedTools = () => {
    setSelectedIds(new Set(unusedFiltered.map((tool) => tool.id)));
  };

  const handleBulkDeleteSelected = async () => {
    const deletable = selectedTools.filter((tool) => tool.status !== 'ASSIGNED');
    const assignedCount = selectedTools.length - deletable.length;

    if (deletable.length === 0) {
      setInventoryMessage(t('deleteSelectedNone'));
      return;
    }

    if (!confirm(t('deleteSelectedConfirm').replace('{count}', String(deletable.length)))) return;

    setCleanupBusy(true);
    setInventoryMessage(null);

    try {
      const query = deletable.map((tool) => tool.id).join(',');
      const res = await fetch(`/api/tools?ids=${encodeURIComponent(query)}`, { method: 'DELETE' });
      const data = (await res.json()) as { deleted?: number; skipped?: number; error?: string };

      if (!res.ok) throw new Error(data.error ?? 'Failed to delete tools');

      setSelectedIds(new Set());
      await fetchTools();

      const parts = [t('deleteSelectedDone').replace('{count}', String(data.deleted ?? 0))];
      if (assignedCount > 0) {
        parts.push(t('deleteSelectedSkipped').replace('{count}', String(assignedCount)));
      }
      setInventoryMessage(parts.join(' '));
    } catch (error) {
      console.error(error);
      setInventoryMessage(t('deleteSelectedFailed'));
    } finally {
      setCleanupBusy(false);
    }
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
  const processReconcileCode = async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    const match = toolsRef.current.find((tool) => tool.qrCode.toUpperCase() === code);

    if (!match) {
      setLabelMessage(t('reconcileNotFound').replace('{code}', code));
      return;
    }

    if (match.labelPrinted) {
      setLabelMessage(t('reconcileAlreadyPrinted').replace('{name}', match.name));
      return;
    }

    await markLabelState([match.id], true);
    setScannedCount((count) => count + 1);
    setLabelMessage(t('reconcileMarked').replace('{name}', match.name).replace('{code}', match.qrCode));
  };

  const handleReconcileScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = scanValue.trim();
    if (!code) return;
    setScanValue('');
    void processReconcileCode(code)
      .catch(console.error)
      .finally(() => reconcileScanRef.current?.focus());
  };

  const stopReconcileCamera = useCallback(async () => {
    setReconcileCameraOpen(false);
    const scanner = reconcileScannerRef.current;
    reconcileScannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch (error) {
      console.error('Unable to release reconcile camera:', error);
    }
  }, []);

  // Stable identity on purpose: the camera must keep running between scans
  // instead of restarting every time the tool list is refreshed.
  const handleReconcileCameraSuccess = useCallback((decodedText: string) => {
    const code = decodedText.trim().toUpperCase();
    if (!code) return;

    const now = Date.now();
    const previous = lastReconcileScanRef.current;
    if (previous.code === code && now - previous.at < RECONCILE_DEDUPE_MS) return;
    lastReconcileScanRef.current = { code, at: now };

    void reconcileProcessorRef.current(decodedText);
  }, []);

  const openReconcileCamera = () => {
    lastReconcileScanRef.current = { code: '', at: 0 };
    setReconcileCameraError(null);
    setReconcileCameraOpen(true);
  };

  // Keep the latest values reachable from the stable camera callbacks.
  useEffect(() => {
    toolsRef.current = tools;
  }, [tools]);

  useEffect(() => {
    reconcileProcessorRef.current = processReconcileCode;
  });

  useEffect(() => {
    if (!reconcileCameraOpen) return;

    let cancelled = false;
    const startCamera = async () => {
      setReconcileCameraStarting(true);
      setReconcileCameraError(null);

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode('reconcile-camera-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        reconcileScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          handleReconcileCameraSuccess,
          () => undefined,
        );

        if (!cancelled) setReconcileCameraStarting(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Unable to start reconcile camera:', error);
        setReconcileCameraError(t('cameraUnavailable'));
        setReconcileCameraStarting(false);
        setReconcileCameraOpen(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      const scanner = reconcileScannerRef.current;
      reconcileScannerRef.current = null;
      if (!scanner) return;
      void (async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
        } catch (error) {
          console.error('Unable to release reconcile camera:', error);
        }
      })();
    };
  }, [reconcileCameraOpen, handleReconcileCameraSuccess, t]);

  useEffect(() => () => {
    void stopReconcileCamera();
  }, [stopReconcileCamera]);

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

  const handleExportExcel = async () => {
    setExporting(true);
    const data = filteredTools.map(t => ({
      ID: t.id,
      Name: t.name,
      ImageURL: t.image || 'N/A',
      QRCode: t.qrCode,
      Status: t.status,
      AssignedTo: t.technician ? t.technician.name : 'None',
      TechnicianID: t.technician?.idNumber || '',
      CheckedOutAt: t.status === 'ASSIGNED' && t.checkedOutAt ? formatCheckedOutAt(t.checkedOutAt) : '',
      Overdue: t.isOverdue ? 'Yes' : 'No',
      Uses: t.usageCount,
      LabelPrinted: t.labelPrinted ? 'Yes' : 'No',
    }));
    try { await exportToExcel(data, 'Mubea_Tools_Filtered'); }
    catch { setInventoryMessage(t('exportFailed')); }
    finally { setExporting(false); }
  };

  const formatCheckedOutAt = (value: string) =>
    new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Casablanca' }).format(new Date(value));

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

      <div className="page-header">
        <div><h1 className="page-title">{t('toolManagement')}</h1><p className="page-description">{t('inventoryDescription')}</p></div>
        <div className="header-actions">
          <button onClick={() => void handleExportExcel()} className="btn btn-outline" disabled={filteredTools.length === 0 || loading || error || exporting}>
            <Download size={16} aria-hidden="true" />{t(exporting ? 'exporting' : 'exportFiltered')}
          </button>
          <Link href="/scanner" className="btn btn-primary"><QrCode size={17} aria-hidden="true" />{t('openScanner')}</Link>
        </div>
      </div>

      <details className="inventory-details" onToggle={(event) => {
        if (!event.currentTarget.open && reconcileCameraOpen) void stopReconcileCamera();
      }}>
      <summary>{t('labelPrinting')} · {printedCount}/{tools.length}</summary>
      <div className="card">
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

        <div style={{ marginTop: '1.25rem', borderTop: '1px solid var(--border, #e2e8f0)', paddingTop: '1rem' }}>
          <label className="form-label" htmlFor="reconcile-scan">{t('reconcileTitle')}</label>
          <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>{t('reconcileHint')}</p>

          <form onSubmit={handleReconcileScan} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
            {reconcileCameraOpen ? (
              <button type="button" onClick={() => void stopReconcileCamera()} className="btn btn-outline">
                <X size={16} aria-hidden="true" style={{ marginRight: '0.35rem' }} />
                {t('closeCamera')}
              </button>
            ) : (
              <button type="button" onClick={openReconcileCamera} className="btn btn-primary">
                <Camera size={16} aria-hidden="true" style={{ marginRight: '0.35rem' }} />
                {t('scanWithCamera')}
              </button>
            )}
          </form>

          {reconcileCameraOpen && (
            <div style={{ marginTop: '0.75rem', maxWidth: '420px' }}>
              <div id="reconcile-camera-reader" className="camera-reader" aria-label={t('cameraScanner')} />
              <p className="camera-helper text-muted">
                {reconcileCameraStarting ? t('startingCamera') : t('reconcileCameraHint')}
              </p>
              {scannedCount > 0 && (
                <p style={{ fontSize: '0.85rem' }}>
                  {t('reconcileScannedCount').replace('{count}', String(scannedCount))}
                </p>
              )}
              {reconcileCameraError && <p className="form-error">{reconcileCameraError}</p>}
            </div>
          )}
        </div>

        {labelMessage && (
          <p style={{ marginTop: '0.75rem', fontSize: '0.85rem' }}>{labelMessage}</p>
        )}
      </div>
      </details>
      <details className="inventory-details">
      <summary>{t('addNewTool')}</summary>
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>{t('addNewTool')}</h3>
        <form onSubmit={handleAddTool} className="inventory-add-form" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="new-tool-name" className="form-label">{t('toolName')}</label>
            <input 
              id="new-tool-name"
              type="text" 
              className="form-input" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('toolNamePlaceholder')}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label htmlFor="new-tool-image" className="form-label">{t('toolImageOptional')}</label>
            <input 
              id="new-tool-image"
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
      </details>

      <div className="card" id="inventory" style={{ scrollMarginTop: '100px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>{t('toolsInventory')}</h3>
            <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
              {t('unusedToolsSummary').replace('{count}', String(unusedTools.length))} · {t('selectedCount').replace('{count}', String(selectedTools.length))}
            </p>
          </div>
          <div className="inventory-bulk-actions" data-selected={selectedIds.size > 0}>
            <button
              onClick={selectUnusedTools}
              className="btn btn-outline"
              disabled={unusedFiltered.length === 0}
            >
              {t('selectUnused').replace('{count}', String(unusedFiltered.length))}
            </button>
            <button
              onClick={clearSelection}
              className="btn btn-outline selection-only"
              disabled={selectedIds.size === 0}
            >
              {t('clearSelection')}
            </button>
            <button
              onClick={handleBulkDeleteSelected}
              className="btn btn-outline selection-only"
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
              disabled={cleanupBusy || selectedTools.length === 0}
            >
              <Trash2 size={14} style={{ marginRight: '0.35rem' }} />
              {t('deleteSelected').replace('{count}', String(selectedTools.length))}
            </button>
          </div>
        </div>
        <div className="filter-tabs" aria-label={t('filterByStatus')}>
          {(['all', 'AVAILABLE', 'ASSIGNED', 'overdue'] as const).map((status) => <button type="button" key={status} className="filter-tab" aria-pressed={statusFilter === status} onClick={() => { setStatusFilter(status); if (status === 'overdue') setSort('oldest'); resetViewSelection(); }}>
            {t(status === 'all' ? 'allTools' : status === 'AVAILABLE' ? 'available' : status === 'ASSIGNED' ? 'assigned' : 'overdue')}
            <span>{loading || error ? '—' : tools.filter((tool) => status === 'all' || (status === 'overdue' ? tool.isOverdue : tool.status === status)).length}</span>
          </button>)}
        </div>
        <div className="inventory-toolbar">
          <div className="form-group search-field"><label htmlFor="inventory-search" className="form-label">{t('searchInventory')}</label><div className="search-input-wrap"><Search size={16} aria-hidden="true" /><input id="inventory-search" className="form-input" type="search" value={search} onChange={(e) => { setSearch(e.target.value); resetViewSelection(); }} placeholder={t('inventorySearchPlaceholder')} /></div></div>
          <div className="form-group"><label htmlFor="label-filter" className="form-label">{t('labelStatus')}</label><select id="label-filter" className="form-input" value={labelFilter} onChange={(e) => { setLabelFilter(e.target.value as LabelFilter); resetViewSelection(); }}><option value="all">{t('allLabels')}</option><option value="pending">{t('labelPending')}</option><option value="printed">{t('labelPrinted')}</option></select></div>
          <div className="form-group"><label htmlFor="inventory-sort" className="form-label">{t('sortBy')}</label><select id="inventory-sort" className="form-input" value={sort} onChange={(e) => { setSort(e.target.value as InventorySort); setPage(0); }}><option value="name">{t('sortName')}</option><option value="oldest">{t('sortOldest')}</option><option value="usage">{t('sortUsage')}</option></select></div>
          <button type="button" className="btn btn-outline" onClick={clearFilters} disabled={!search && statusFilter === 'all' && labelFilter === 'all' && sort === 'name'}>{t('resetFilters')}</button>
        </div>
        {inventoryMessage && (
          <p style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>{inventoryMessage}</p>
        )}
        {error && <div className="error-banner" role="alert"><span>{t('unableLoadTools')}</span><button className="btn btn-outline" onClick={() => void fetchTools()}>{t('retry')}</button></div>}
        {loading ? (
          <p>{t('loading')}</p>
        ) : error && tools.length === 0 ? (
          <div className="empty-state">{t('unableLoadTools')}</div>
        ) : (
          <div className="table-scroll" role="region" aria-label={t('toolsInventory')} tabIndex={0}><table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '32px' }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label={t('selectVisible')}
                  />
                </th>
                <th>{t('image')}</th>
                <th>{t('name')}</th>
                <th>{t('labelStatus')}</th>
                <th>{t('uses')}</th>
                <th>{t('status')}</th>
                <th>{t('assignedTo')}</th>
                <th>{t('action')}</th>
              </tr>
            </thead>
            <tbody>
              {visibleTools.map((tool) => (
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
                    <button type="button"
                      onClick={() => handleUpdateImageClick(tool.id)}
                      style={{ cursor: 'pointer', display: 'inline-block' }}
                      title={t('updateImage')}
                      aria-label={`${t('updateImage')}: ${tool.name}`}
                    >
                      {tool.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={tool.image} alt={tool.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '40px', height: '40px', backgroundColor: '#e2e8f0', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#64748b' }}>{t('noImage')}</div>
                      )}
                    </button>
                  </td>
                  
                  <td>
                    {editingToolId === tool.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '0.25rem 0.5rem', height: 'auto', width: '150px' }}
                          value={editingName}
                          aria-label={`${t('editToolName')}: ${tool.name}`}
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
                          {t('saveTool')}
                        </button>
                        <button 
                          onClick={() => setEditingToolId(null)} 
                          className="btn btn-outline" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div><strong>{tool.name}</strong><div className="text-muted" style={{ fontSize: '0.75rem' }}>{tool.qrCode}</div></div>
                        <button 
                          onClick={() => {
                            setEditingToolId(tool.id);
                            setEditingName(tool.name);
                          }}
                          className="btn btn-outline"
                          style={{ padding: '0.2rem', border: 'none', color: '#64748b', background: 'transparent' }}
                          title={t('editToolName')}
                          aria-label={`${t('editToolName')}: ${tool.name}`}
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
                        aria-label={tool.labelPrinted ? t('markLabelUnprinted') : t('markLabelPrinted')}
                      >
                        {tool.labelPrinted ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
                      </button>
                    </div>
                  </td>

                  <td>{tool.usageCount}</td>

                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge ${tool.status === 'AVAILABLE' ? 'badge-success' : 'badge-warning'}`}>
                        {t(tool.status === 'AVAILABLE' ? 'available' : 'assigned')}
                      </span>
                      {tool.isOverdue && (
                        <span
                          className="badge badge-danger"
                          title={tool.checkedOutAt ? `${t('checkedOut')}: ${formatCheckedOutAt(tool.checkedOutAt)}` : undefined}
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
                        disabled={tool.status === 'ASSIGNED' || cleanupBusy}
                        aria-label={`${t('deleteTool')}: ${tool.name}`}
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
              {visibleTools.length === 0 && (
                <tr>
                  <td colSpan={8}><div className="empty-state"><strong>{t(tools.length ? 'noMatchingTools' : 'noTools')}</strong><p>{t('tryDifferentFilters')}</p></div></td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
        <div className="table-footer">
          <p aria-live="polite">{loading ? t('loading') : t('resultsCount').replace('{from}', String(filteredTools.length ? currentPage * pageSize + 1 : 0)).replace('{to}', String(Math.min((currentPage + 1) * pageSize, filteredTools.length))).replace('{total}', String(filteredTools.length))}</p>
          <div className="pagination-actions"><label htmlFor="inventory-page-size">{t('rowsPerPage')}</label><select id="inventory-page-size" className="form-input" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><button type="button" className="btn btn-outline" aria-label={t('previousPage')} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={16} /></button><span>{currentPage + 1}/{pageCount}</span><button type="button" className="btn btn-outline" aria-label={t('nextPage')} disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={16} /></button></div>
        </div>
      </div>
      <details className="inventory-details" style={{ marginTop: '1rem' }}><summary>{t('paretoTitle')}</summary><ParetoCard tools={tools} loading={loading} /></details>
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

function ToolsWithQuery() {
  const params = useSearchParams();
  const rawStatus = params.get('status');
  const status: InventoryStatus = rawStatus === 'AVAILABLE' || rawStatus === 'ASSIGNED' || rawStatus === 'overdue' ? rawStatus : 'all';
  return <ToolsInventory key={params.toString()} initialSearch={params.get('search') ?? ''} initialStatus={status} />;
}

export default function ToolsPage() {
  const { t } = useTranslation();
  return <Suspense fallback={<div className="loading-placeholder">{t('loading')}</div>}><ToolsWithQuery /></Suspense>;
}
