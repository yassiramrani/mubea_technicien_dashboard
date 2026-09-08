'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { Html5Qrcode as Html5QrcodeInstance } from 'html5-qrcode';
import { Camera, Keyboard, X } from 'lucide-react';
import { useTranslation } from '@/lib/LanguageContext';

type Technician = { id: string; name: string };

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

  const inputRef = useRef<HTMLInputElement>(null);
  const cameraScannerRef = useRef<Html5QrcodeInstance | null>(null);
  const isProcessingCameraCodeRef = useRef(false);

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
  }, [selectedTech, t]);

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
          <label className="form-label" htmlFor="technician-select">{t('selectTechnician')}</label>
          {techniciansError && <p className="form-error">{t('unableLoadTechnicians')}</p>}
          <select id="technician-select" className="form-input" value={selectedTech} onChange={(event) => setSelectedTech(event.target.value)} disabled={cameraOpen}>
            <option value="">{t('selectTechnicianOption')}</option>
            {technicians.map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}
          </select>
        </div>
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
