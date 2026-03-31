import React, { useState, useRef, useEffect } from 'react';
import { FileText, Upload, X, Download, Copy, Trash2 } from 'lucide-react';
import { Core } from '../utils/core';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import LoadingOverlay from './LoadingOverlay';
import ConfirmModal from './ConfirmModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPage {
  num: number;
  blob: Blob;
  url: string;
  checked: boolean;
}

interface PdfData {
  id: string;
  name: string;
  total: number;
  pages: PdfPage[];
  format: string;
  thumbnail?: string;
  progress: number;
  status: string;
}

export default function PdfConvert() {
  const [pdfs, setPdfs] = useState<PdfData[]>([]);
  const [format, setFormat] = useState('image/png');
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalProgress, setGlobalProgress] = useState({ text: 'Initializing...', percent: 0 });
  const [selectedPdf, setSelectedPdf] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const abortCtrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortCtrlRef.current) {
        abortCtrlRef.current.abort();
      }
    };
  }, []);

  const handleFiles = async (files: FileList | File[]) => {
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf');
    if (pdfFiles.length === 0) {
      setAlertMessage('Please upload valid PDF files.');
      return;
    }

    setIsProcessing(true);
    abortCtrlRef.current = new AbortController();
    const signal = abortCtrlRef.current.signal;

    try {
      for (const file of pdfFiles) {
        if (signal.aborted) break;
        await processSinglePdf(file, format, signal);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') setAlertMessage(e.message);
    } finally {
      setIsProcessing(false);
      abortCtrlRef.current = null;
    }
  };

  const processSinglePdf = async (file: File, format: string, signal: AbortSignal) => {
    const pdfId = `pdf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGlobalProgress({ text: `Loading ${file.name}...`, percent: 0 });

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      
      const newPdf: PdfData = {
        id: pdfId,
        name: file.name,
        total: pdf.numPages,
        pages: [],
        format,
        progress: 0,
        status: 'Processing...',
      };
      
      setPdfs((prev) => [newPdf, ...prev]);

      for (let i = 1; i <= pdf.numPages; i++) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        
        setGlobalProgress({ text: `Rendering ${file.name} (Page ${i}/${pdf.numPages})`, percent: Math.round((i / pdf.numPages) * 100) });
        
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2.0 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport } as any).promise;
        
        const blob = await new Promise<Blob>((r) => canvas.toBlob(r as BlobCallback, format, 0.9));
        const url = Core.BlobRegistry.create(blob);
        
        setPdfs((prev) => prev.map((p) => {
          if (p.id === pdfId) {
            const updated = { ...p, progress: i };
            updated.pages.push({ num: i, blob, url, checked: true });
            if (i === 1) updated.thumbnail = canvas.toDataURL(format, 0.5);
            if (i === pdf.numPages) updated.status = `${pdf.numPages} Pages`;
            return updated;
          }
          return p;
        }));
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error(err);
        setAlertMessage(`Failed to process ${file.name}: ${err.message}`);
      }
    }
  };

  const clearAll = () => {
    setShowConfirm(true);
  };

  const confirmClearAll = () => {
    setPdfs([]);
    Core.BlobRegistry.revokeAll();
    setShowConfirm(false);
  };

  const cancelProcessing = () => {
    if (abortCtrlRef.current) abortCtrlRef.current.abort();
  };

  const toggleAll = (val: boolean) => {
    if (!selectedPdf) return;
    setPdfs((prev) => prev.map((p) => {
      if (p.id === selectedPdf) {
        return { ...p, pages: p.pages.map((page) => ({ ...page, checked: val })) };
      }
      return p;
    }));
  };

  const togglePage = (pageNum: number, val: boolean) => {
    if (!selectedPdf) return;
    setPdfs((prev) => prev.map((p) => {
      if (p.id === selectedPdf) {
        return { ...p, pages: p.pages.map((page) => page.num === pageNum ? { ...page, checked: val } : page) };
      }
      return p;
    }));
  };

  const downloadSingle = (url: string, name: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
  };

  const downloadSelected = async () => {
    if (!selectedPdf) return;
    const data = pdfs.find((p) => p.id === selectedPdf);
    if (!data) return;
    
    const selected = data.pages.filter((p) => p.checked);
    if (selected.length === 0) {
      setAlertMessage('No pages selected.');
      return;
    }
    
    const zip = new JSZip();
    const ext = data.format.split('/')[1] === 'jpeg' ? 'jpg' : 'png';
    selected.forEach((p) => zip.file(`${p.num}.${ext}`, p.blob));
    
    const content = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `${data.name}_images.zip`;
    a.click();
  };

  const activePdfData = pdfs.find((p) => p.id === selectedPdf);

  return (
    <div className="flex flex-col h-full relative">
      <ConfirmModal
        isOpen={showConfirm}
        title="Clear All PDFs"
        message="Are you sure you want to remove all PDFs? This action cannot be undone."
        onConfirm={confirmClearAll}
        onCancel={() => setShowConfirm(false)}
        confirmText="Clear"
      />
      <ConfirmModal
        isOpen={!!alertMessage}
        title="Notice"
        message={alertMessage || ''}
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
        isAlert={true}
      />
      <LoadingOverlay isVisible={isProcessing} message={globalProgress.text} progress={globalProgress.percent} />
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <FileText className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">PDF Convert</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[24px] items-start">
        <div className="flex flex-col gap-[20px] sticky top-0 overflow-y-auto max-h-[calc(100vh-100px)] pr-[5px]">
          <div
            className="drop-zone"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); }}
          >
            <label className="liquid-btn w-full cursor-pointer">
              <input accept="application/pdf" hidden multiple type="file" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
              <Upload className="w-4 h-4" /> Add PDF Files
            </label>
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Output Format</span>
            <select className="liquid-input" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPG</option>
            </select>
            <div className="flex flex-col gap-[10px] mt-[8px]">
              {isProcessing && (
                <button className="liquid-btn w-full" onClick={cancelProcessing}>Cancel Processing</button>
              )}
              <button className="liquid-btn danger-btn w-full" onClick={clearAll}>Clear All</button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-[24px] items-start">
          {!pdfs.length ? (
            <div className="empty-state-msg">
              <FileText className="w-[50px] h-[50px] opacity-50" />
              <p>No PDFs loaded</p>
            </div>
          ) : (
            pdfs.map((pdf) => (
              <div key={pdf.id} className="w-[240px] relative cursor-pointer border border-[var(--color-border-color)] bg-[var(--color-bg-panel)] rounded-[var(--radius-app)] flex flex-col overflow-hidden transition duration-150 hover:-translate-y-[4px] hover:border-[#404040]" onClick={() => setSelectedPdf(pdf.id)}>
                {pdf.thumbnail ? (
                  <img src={pdf.thumbnail} className="w-full h-[220px] block object-contain bg-[#050505]" alt={pdf.name} />
                ) : (
                  <div className="w-full h-[220px] bg-[#050505] flex items-center justify-center text-[#555]">Processing...</div>
                )}
                <div className="bg-[var(--color-bg-panel)] p-[16px] text-[0.9rem] border-t border-[var(--color-border-color)] flex flex-col gap-[6px]">
                  <div className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">{pdf.name}</div>
                  <div className="text-[var(--color-text-muted)] text-[0.8rem]">{pdf.status}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedPdf && activePdfData && (
        <div className="fixed inset-0 bg-[#0A0A0A]/95 backdrop-blur-sm z-[1000] flex flex-col p-[40px] max-lg:p-[20px]">
          <div className="flex justify-between mb-[20px] border-b border-[var(--color-border-color)] pb-[15px] items-center flex-wrap gap-[15px]">
            <div>
              <h3 className="m-0 text-[1.5rem] font-semibold text-white tracking-tight">{activePdfData.name}</h3>
              <span className="text-[var(--color-text-muted)]">{activePdfData.total} Pages</span>
            </div>
            <div className="flex gap-[12px] items-center">
              <label className="flex items-center gap-[8px] cursor-pointer text-white">
                <input className="toggle-switch small" type="checkbox" checked={activePdfData.pages.every(p => p.checked)} onChange={(e) => toggleAll(e.target.checked)} /> Select All
              </label>
              <button className="liquid-btn active-mode" onClick={downloadSelected}>Download Selected</button>
              <button className="liquid-btn danger-btn px-[10px]" onClick={() => setSelectedPdf(null)}><X className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[24px] overflow-y-auto p-[10px] max-lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {activePdfData.pages.map((page, index) => {
              const ext = activePdfData.format.split('/')[1] === 'jpeg' ? 'jpg' : 'png';
              return (
                <div 
                  key={page.num} 
                  className={`border border-[var(--color-border-color)] bg-[var(--color-bg-panel)] rounded-[var(--radius-app)] overflow-hidden flex flex-col transition duration-200 hover:border-[#404040]`}
                >
                  <img src={page.url} className="w-full block cursor-pointer aspect-[16/9] object-contain bg-[#050505] border-b border-[var(--color-border-color)] pointer-events-none" alt={`Page ${page.num}`} onClick={() => window.open(page.url, '_blank')} />
                  <div className="p-[12px] flex flex-col gap-[8px] bg-[var(--color-bg-panel)]">
                    <div className="flex justify-between items-center">
                      <span className="text-[0.8rem] text-[var(--color-text-muted)]">#{page.num}</span>
                      <div className="flex gap-[10px] items-center">
                        <button className="liquid-btn icon-only" title={`Download Page ${page.num}`} onClick={() => downloadSingle(page.url, `${page.num}.${ext}`)}>
                          <Download className="w-4 h-4" />
                        </button>
                        <input type="checkbox" className="toggle-switch small" checked={page.checked} onChange={(e) => togglePage(page.num, e.target.checked)} />
                      </div>
                    </div>
                    <div className="flex gap-[8px]">
                      <button className="liquid-btn danger-btn px-[8px] py-[4px] flex-1 text-[0.75rem]" onClick={() => {
                        URL.revokeObjectURL(page.url);
                        setPdfs((prev) => prev.map((p) => p.id === activePdfData.id ? { ...p, pages: p.pages.filter((pg) => pg.num !== page.num) } : p));
                      }}><Trash2 className="w-3 h-3" /> Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

