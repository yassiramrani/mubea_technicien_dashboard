'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode';
import { Camera, ImagePlus, Keyboard, Save, X } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';
import { compressImageFile } from '@/lib/imageUtils';
import { isLabeler } from '@/lib/technicianRoles';

type Technician = { id: string; name: string; role: string };

type ScannedTool = {
  name: string;
  status: string;
  image?: string | null;
};

type ScanResponse = {
  message?: string;
  error?: string;
  tool?: ScannedTool;
};

// Tool card returned by /api/tools/lookup for the identification profile.
type IdentifiableTool = {
  id: string;
  qrCode: string;
  name: string;
  image: string | null;
  status: string;
  technicianName: string | null;
  hasPlaceholderName: boolean;
};

type LookupResponse = {
  error?: string;
  tool?: IdentifiableTool;
  stats?: { total: number; withoutPhoto: number };
};

function decodeAzerty(input: string): string {
  const azertyToQwertyMap: Record<string, string> = {
    ',': 'm', ')': '-', '&': '1', 'é': '2', '"': '3', "'": '4', '(': '5',
    '-': '6', 'è': '7', '_': '8', 'ç': '9', 'à': '0',
  };

  return input.split('').map((char) => azertyToQwertyMap[char] ?? char).join('');
}

export default function ScannerPage() {
  const { t } = useTranslation();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [selectedTech, setSelectedTech] = useState('');
  const [scanResult, setScanResult] = useState<{ text: string; type: 'success' | 'error'; tool?: ScannedTool } | null>(null);
  const [techniciansError, setTechniciansError] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Identification profile state.
  const [identifyTool, setIdentifyTool] = useState<IdentifiableTool | null>(null);
  const [identifyName, setIdentifyName] = useState('');
  const [identifyImage, setIdentifyImage] = useState<string | null>(null);
  const [identifyBusy, setIdentifyBusy] = useState(false);
  const [identifyError, setIdentifyError] = useState<string | null>(null);
  const [identifyCount, setIdentifyCount] = useState(0);
  const [photoProgress, setPhotoProgress] = useState<{ total: number; withoutPhoto: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraScannerRef = useRef<Html5QrcodeInstance | null>(null);
  const isProcessingCameraCodeRef = useRef(false);

  // The selected technician decides what a scan does: a standard technician takes
  // or returns the tool, an identification profile renames it and adds its photo.
  const selectedTechnician = technicians.find((technician) => technician.id === selectedTech);
  const identifyMode = isLabeler(selectedTechnician?.role);

  const fetchTechnicians = useCallback(async () => {
    try {
      const res = await fetch('/api/technicians');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data)) throw new Error('Unable to load technicians');
      setTechnicians(data);
      setTechniciansError(false);
    } catch (error) {
      setTechniciansError(true);
      console.error(error);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchTechnicians(), 0);
    if (window.matchMedia('(min-width: 721px)').matches) inputRef.current?.focus();
    return () => window.clearTimeout(timer);
  }, [fetchTechnicians]);

  const stopCamera = useCallback(async () => {
    setCameraOpen(false);
    const scanner = cameraScannerRef.current;
    cameraScannerRef.current = null;
    if (!scanner) return;

    try {
      if (scanner.isScanning) await scanner.stop();
      scanner.clear();
    } catch (error) {
      console.error('Unable to release camera scanner:', error);
    }
  }, []);

  const processScannedCode = useCallback(async (rawScannedCode: string, focusHardwareInput: boolean) => {
    if (!selectedTech) {
      setScanResult({ text: t('pleaseSelectTechnician'), type: 'error' });
      return;
    }

    const decodedCode = decodeAzerty(rawScannedCode.trim());
    if (!decodedCode) return;

    try {
      // Identification profile: read-only lookup that opens the tool card instead
      // of assigning or returning the tool.
      if (identifyMode) {
        const res = await fetch(`/api/tools/lookup?qrCode=${encodeURIComponent(decodedCode)}`);
        const data = await res.json() as LookupResponse;

        if (res.ok && data.tool) {
          setIdentifyTool(data.tool);
          // Placeholder names (component-001…) are cleared so the real name can be
          // typed straight away; existing names are kept for a small correction.
          setIdentifyName(data.tool.hasPlaceholderName ? '' : data.tool.name);
          setIdentifyImage(data.tool.image ?? null);
          setIdentifyError(null);
          if (data.stats) setPhotoProgress(data.stats);
          setScanResult({ text: t('toolFound').replace('{code}', decodedCode), type: 'success' });
        } else {
          setIdentifyTool(null);
          setIdentifyError(null);
          setScanResult({ text: `${data.error ?? t('failedProcessScan')} (Scanned: "${decodedCode}")`, type: 'error' });
        }
        return;
      }

      const res = await fetch('/api/tools/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: decodedCode, technicianId: selectedTech }),
      });
      const data = await res.json() as ScanResponse;

      if (res.ok) {
        setScanResult({ text: data.message ?? t('scanProcessed'), type: 'success', tool: data.tool });
      } else {
        setScanResult({ text: `${data.error ?? t('failedProcessScan')} (Scanned: "${decodedCode}")`, type: 'error' });
      }
    } catch {
      setScanResult({ text: t('failedProcessScan'), type: 'error' });
    } finally {
      if (focusHardwareInput && inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.focus();
      }
    }
  }, [selectedTech, identifyMode, t]);

  const closeIdentifyCard = useCallback(() => {
    setIdentifyTool(null);
    setIdentifyName('');
    setIdentifyImage(null);
    setIdentifyError(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }, []);

  const handleIdentifyPhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIdentifyError(null);
    try {
      setIdentifyImage(await compressImageFile(file));
    } catch (error) {
      console.error(error);
      setIdentifyError(t('photoReadFailed'));
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  const handleIdentifySave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!identifyTool) return;

    const trimmedName = identifyName.trim();
    if (!trimmedName) {
      setIdentifyError(t('toolNameRequired'));
      return;
    }

    setIdentifyBusy(true);
    setIdentifyError(null);

    try {
      const res = await fetch('/api/tools', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: identifyTool.id, name: trimmedName, image: identifyImage }),
      });

      if (!res.ok) throw new Error('Unable to save the tool');

      setIdentifyCount((count) => count + 1);
      closeIdentifyCard();
      setPhotoProgress(null);
      setScanResult({ text: `${t('toolUpdated').replace('{name}', trimmedName)} ${t('scanNextLabel')}`, type: 'success' });
      inputRef.current?.focus();
    } catch (error) {
      console.error(error);
      setIdentifyError(t('toolUpdateFailed'));
    } finally {
      setIdentifyBusy(false);
    }
  };

  const handleHardwareSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void processScannedCode(inputRef.current?.value ?? '', true);
  };

  const handleCameraSuccess = useCallback((decodedText: string) => {
    if (isProcessingCameraCodeRef.current) return;
    isProcessingCameraCodeRef.current = true;

    void (async () => {
      await stopCamera();
      await processScannedCode(decodedText, false);
      isProcessingCameraCodeRef.current = false;
    })();
  }, [processScannedCode, stopCamera]);

  useEffect(() => {
    if (!cameraOpen) return;

    let cancelled = false;
    const startCamera = async () => {
      setCameraStarting(true);
      setCameraError(null);

      try {
        const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode('camera-reader', {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        cameraScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
          handleCameraSuccess,
          () => undefined,
        );

        if (!cancelled) setCameraStarting(false);
      } catch (error) {
        if (cancelled) return;
        console.error('Unable to start camera scanner:', error);
        setCameraError(t('cameraUnavailable'));
        setCameraStarting(false);
        setCameraOpen(false);
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      const scanner = cameraScannerRef.current;
      cameraScannerRef.current = null;
      if (!scanner) return;
      void (async () => {
        try {
          if (scanner.isScanning) await scanner.stop();
          scanner.clear();
        } catch (error) {
          console.error('Unable to release camera scanner:', error);
        }
      })();
    };
  }, [cameraOpen, handleCameraSuccess, t]);

  useEffect(() => () => {
    void stopCamera();
  }, [stopCamera]);

  const openCamera = () => {
    if (!selectedTech) {
      setScanResult({ text: t('pleaseSelectTechnician'), type: 'error' });
      return;
    }
    isProcessingCameraCodeRef.current = false;
    setCameraOpen(true);
  };

  return (
    <div className="scanner-page">
      <div className="scanner-header">
        <h1 className="page-title">{t('toolScanner')}</h1>
        <p className="text-muted">{t('scannerMobileIntro')}</p>
      </div>

      <section className="card scanner-technician-card">
        <h3>{t('activeTechnician')}</h3>
        <div className="form-group scanner-technician-field">
          <label className="form-label" htmlFor="technician-select">{identifyMode ? t('selectTechnicianIdentify') : t('selectTechnician')}</label>
          {techniciansError && <p className="form-error">{t('unableLoadTechnicians')}</p>}
          <select
            id="technician-select"
            className="form-input"
            value={selectedTech}
            onChange={(event) => {
              setSelectedTech(event.target.value);
              closeIdentifyCard();
              setScanResult(null);
            }}
            disabled={cameraOpen}
          >
            <option value="">{t('selectTechnicianOption')}</option>
            {technicians.map((technician) => (
              <option key={technician.id} value={technician.id}>
                {technician.name}{isLabeler(technician.role) ? ` — ${t('roleLabelerShort')}` : ''}
              </option>
            ))}
          </select>
        </div>
        {identifyMode && (
          <div className="identify-mode-banner">
            <p><strong>{t('labelerModeTitle')}</strong></p>
            <p>{t('labelerModeHint')}</p>
          </div>
        )}
      </section>

      {scanResult && (
        <section className={`scan-result scan-result-${scanResult.type}`} aria-live="polite">
          <p className="scan-result-message">{scanResult.text}</p>
          {scanResult.tool && (
            <div className="scan-result-tool">
              {scanResult.tool.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- Tool photos may be local data URLs.
                <img src={scanResult.tool.image} alt={scanResult.tool.name} className="scan-result-image" />
              ) : <div className="scan-result-image scan-result-no-image">{t('noImage')}</div>}
              <div><p><strong>{t('tool')}:</strong> {scanResult.tool.name}</p><p><strong>{t('newStatus')}:</strong> {scanResult.tool.status}</p></div>
            </div>
          )}
        </section>
      )}

      {identifyMode && identifyTool && (
        <section className="card identify-card">
          <div className="scanner-panel-heading">
            <div className="scanner-panel-title"><ImagePlus size={20} aria-hidden="true" /><h3>{t('identifyTool')}</h3></div>
            <button type="button" onClick={closeIdentifyCard} className="btn btn-outline scanner-close-camera">
              <X size={16} aria-hidden="true" /> {t('cancel')}
            </button>
          </div>

          <div className="identify-body">
            <div className="identify-photo">
              {identifyImage ? (
                // eslint-disable-next-line @next/next/no-img-element -- Tool photos may be local data URLs.
                <img src={identifyImage} alt={identifyTool.name} className="identify-photo-image" />
              ) : (
                <div className="identify-photo-image identify-photo-empty">{t('noPhotoYet')}</div>
              )}
              <label className="btn btn-outline identify-photo-button">
                <Camera size={16} aria-hidden="true" /> {identifyImage ? t('changePhoto') : t('addPhoto')}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="identify-photo-input"
                  onChange={(event) => void handleIdentifyPhotoChange(event)}
                />
              </label>
              <p className="text-muted identify-help">{t('photoHelp')}</p>
            </div>

            <form className="identify-form" onSubmit={handleIdentifySave}>
              <div className="form-group">
                <label className="form-label" htmlFor="identify-name">{t('toolName')}</label>
                <input
                  id="identify-name"
                  type="text"
                  className="form-input"
                  value={identifyName}
                  onChange={(event) => setIdentifyName(event.target.value)}
                  placeholder={t('toolNamePlaceholder')}
                  autoComplete="off"
                  required
                />
                {identifyTool.hasPlaceholderName && <p className="text-muted identify-help">{t('placeholderNameHint')}</p>}
              </div>

              <dl className="identify-meta">
                <div><dt>{t('labelId')}</dt><dd>{identifyTool.qrCode}</dd></div>
                <div><dt>{t('status')}</dt><dd>{identifyTool.status}</dd></div>
                <div><dt>{t('assignedTo')}</dt><dd>{identifyTool.technicianName ?? '—'}</dd></div>
              </dl>

              {identifyError && <p className="form-error">{identifyError}</p>}

              <button type="submit" className="btn btn-primary" disabled={identifyBusy}>
                <Save size={16} aria-hidden="true" /> {identifyBusy ? t('saving') : t('saveTool')}
              </button>
            </form>
          </div>

          {photoProgress && (
            <p className="text-muted identify-help">
              {t('photoProgress')
                .replace('{done}', String(photoProgress.total - photoProgress.withoutPhoto))
                .replace('{total}', String(photoProgress.total))}
              {identifyCount > 0 && ` ${t('sessionUpdatedCount').replace('{count}', String(identifyCount))}`}
            </p>
          )}
        </section>
      )}

      <div className="scanner-layout">
        <section className="card scanner-panel scanner-camera-card">
          <div className="scanner-panel-heading">
            <div className="scanner-panel-title"><Camera size={20} aria-hidden="true" /><h3>{t('cameraScanner')}</h3></div>
            {cameraOpen && <button type="button" onClick={() => void stopCamera()} className="btn btn-outline scanner-close-camera"><X size={16} aria-hidden="true" /> {t('closeCamera')}</button>}
          </div>
          {cameraOpen ? (
            <div><div id="camera-reader" className="camera-reader" aria-label={t('cameraScanner')} /><p className="camera-helper text-muted">{cameraStarting ? t('startingCamera') : t('pointCameraAtQr')}</p></div>
          ) : (
            <div className="camera-empty-state">
              <Camera size={32} aria-hidden="true" />
              <p>{t('cameraReadyDescription')}</p>
              <button type="button" onClick={openCamera} className="btn btn-primary"><Camera size={18} aria-hidden="true" /> {t('openCamera')}</button>
              {cameraError && <p className="form-error">{cameraError}</p>}
            </div>
          )}
        </section>

        <section className="card scanner-panel scanner-hardware-card">
          <div className="scanner-panel-heading"><div className="scanner-panel-title"><Keyboard size={20} aria-hidden="true" /><h3>{t('scanQrHardware')}</h3></div></div>
          <p className="text-muted scanner-panel-description">{t('scanInstructions')}</p>
          <form onSubmit={handleHardwareSubmit} className="hardware-scan-form">
            <div className="form-group"><label className="form-label" htmlFor="hardware-scan-input">{t('scannerInput')}</label><input id="hardware-scan-input" ref={inputRef} type="text" className="form-input" placeholder={t('scanBarcode')} enterKeyHint="done" /></div>
            <button type="submit" className="btn btn-primary">{t('processScan')}</button>
          </form>
        </section>
      </div>
    </div>
  );
}
