import React, { useState, useRef, useEffect } from 'react';
import { Scissors, Upload, Download, Trash2, Copy } from 'lucide-react';
import { Core } from '../utils/core';
import JSZip from 'jszip';
import LoadingOverlay from './LoadingOverlay';
import ConfirmModal from './ConfirmModal';

interface SplitItem {
  id: string;
  file: File;
  url: string;
  img: HTMLImageElement | null;
  checked: boolean;
  splitBlobs: { blob: Blob }[];
}

export default function ImageSplitter() {
  const [items, setItems] = useState<SplitItem[]>([]);
  const [mode, setMode] = useState('vert');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!valid.length) return;

    const newItems: SplitItem[] = valid.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: Core.BlobRegistry.create(file),
      img: null,
      checked: true,
      splitBlobs: [],
    }));

    setItems((prev) => [...newItems, ...prev]);
  };

  const clearAll = () => {
    setShowConfirm(true);
  };

  const confirmClearAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.url));
    setItems([]);
    setShowConfirm(false);
  };

  const process = async () => {
    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 100));

    try {
      const rInput = rows || 1;
      const cInput = cols || 1;
      let r = 1, c = 1;
      if (mode === 'grid') { r = rInput; c = cInput; }
      else if (mode === 'vert') { c = cInput; }
      else if (mode === 'horz') { r = rInput; }

      const updatedItems = [...items];
      for (const item of updatedItems) {
        if (!item.checked) continue;
        if (!item.img) {
          item.img = new Image();
          item.img.src = item.url;
          await new Promise((res) => { 
            item.img!.onload = res; 
            item.img!.onerror = res;
          });
        }
        if (!item.img.complete || item.img.naturalWidth === 0) continue;
        item.splitBlobs = [];
        const pW = item.img!.naturalWidth / c;
        const pH = item.img!.naturalHeight / r;

        for (let row = 0; row < r; row++) {
          for (let col = 0; col < c; col++) {
            const cvs = document.createElement('canvas');
            cvs.width = pW;
            cvs.height = pH;
            cvs.getContext('2d')!.drawImage(item.img!, col * pW, row * pH, pW, pH, 0, 0, pW, pH);
            const blob = await new Promise<Blob>((res) => cvs.toBlob(res as BlobCallback, item.file.type));
            item.splitBlobs.push({ blob });
          }
        }
      }

      setItems(updatedItems);
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Failed to process images: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const download = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      let count = 1;

      items.forEach((item) => {
        const ext = item.file.name.split('.').pop();
        if (item.checked && item.splitBlobs.length > 0) {
          item.splitBlobs.forEach((b) => {
            zip.file(`${count}.${ext}`, b.blob);
            count++;
          });
        } else {
          zip.file(`${count}.${ext}`, item.file);
          count++;
        }
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'split_images.zip';
      a.click();
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Failed to download images: ${e.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleCheck = (id: string, checked: boolean) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, checked } : i));
  };

  const getGridStyle = () => {
    const rInput = rows || 1;
    const cInput = cols || 1;
    let r = 1, c = 1;
    if (mode === 'grid') { r = rInput; c = cInput; }
    else if (mode === 'vert') { c = cInput; }
    else if (mode === 'horz') { r = rInput; }
    return { '--rows': r, '--cols': c } as React.CSSProperties;
  };

  return (
    <div className="flex flex-col relative">
      <ConfirmModal
        isOpen={showConfirm}
        title="Reset All"
        message="Are you sure you want to remove all images and reset settings? This action cannot be undone."
        onConfirm={confirmClearAll}
        onCancel={() => setShowConfirm(false)}
        confirmText="Reset"
      />
      <ConfirmModal
        isOpen={!!alertMessage}
        title="Notice"
        message={alertMessage || ''}
        onConfirm={() => setAlertMessage(null)}
        onCancel={() => setAlertMessage(null)}
        isAlert={true}
      />
      <LoadingOverlay isVisible={isProcessing || isDownloading} message={isProcessing ? "Processing images..." : "Generating ZIP file..."} />
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <Scissors className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Image Splitter</h2>
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
              <input accept="image/*" hidden multiple type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
              <Upload className="w-4 h-4" /> Add Images
            </label>
          </div>
          
          <div className="flex flex-col gap-[20px]">
            <div className="glass-panel flex flex-col gap-[16px]">
              <span className="label-header">Configuration</span>
              <select className="liquid-input" value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="vert">Columns Only</option>
                <option value="horz">Rows Only</option>
                <option value="grid">Grid (Rows & Cols)</option>
              </select>
              <div className="flex gap-[10px]">
                <div className="flex-1">
                  <span className="label-header">Rows</span>
                  <input className="liquid-input" min="1" type="number" value={rows} onChange={(e) => setRows(parseInt(e.target.value) || 1)} disabled={mode === 'vert'} />
                </div>
                <div className="flex-1">
                  <span className="label-header">Cols</span>
                  <input className="liquid-input" min="1" type="number" value={cols} onChange={(e) => setCols(parseInt(e.target.value) || 1)} disabled={mode === 'horz'} />
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-[10px]">
              <button className="liquid-btn w-full" disabled={!items.length || isProcessing} onClick={process}>
                Process
              </button>
              <button className="liquid-btn active-mode w-full" disabled={!items.length || isDownloading} onClick={download}>
                Download Zip
              </button>
              <button className="liquid-btn danger-btn w-full" onClick={clearAll}>Reset</button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[24px] content-start">
          {!items.length ? (
            <div className="empty-state-msg">
              <Scissors className="w-[40px] h-[40px] opacity-30" />
              <p>No images</p>
            </div>
          ) : (
            items.map((item, index) => (
              <div 
                key={item.id} 
                className={`bg-[var(--color-bg-panel)] border border-[var(--color-border-color)] flex flex-col rounded-[var(--radius-app)] overflow-hidden transition duration-200 hover:border-[#404040]`}
              >
                <div className="bg-[#050505] flex items-center justify-center aspect-square overflow-hidden p-[12px] relative pointer-events-none" style={{
                  backgroundImage: 'linear-gradient(45deg, #0A0A0A 25%, transparent 25%), linear-gradient(-45deg, #0A0A0A 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0A0A0A 75%), linear-gradient(-45deg, transparent 75%, #0A0A0A 75%)',
                  backgroundSize: '20px 20px'
                }}>
                  <img src={item.url} className="max-w-full max-h-full object-contain" alt={item.file.name} />
                  <div className="absolute inset-0 grid pointer-events-none z-10" style={{ ...getGridStyle(), gridTemplateColumns: `repeat(var(--cols, 1), 1fr)`, gridTemplateRows: `repeat(var(--rows, 1), 1fr)` }}>
                    {Array.from({ length: (getGridStyle() as any)['--rows'] * (getGridStyle() as any)['--cols'] }).map((_, i) => (
                      <div key={i} className="border border-[rgba(255,255,255,0.4)] shadow-[inset_0_0_1px_rgba(0,0,0,0.5)]"></div>
                    ))}
                  </div>
                </div>
                <div className="p-[16px] flex flex-col gap-[12px] border-t border-[var(--color-border-color)] bg-[var(--color-bg-panel)]">
                  <div className="flex justify-between items-center">
                    <span className="truncate flex-1 text-[0.85rem] font-medium text-white">{item.file.name}</span>
                    <label className="flex items-center cursor-pointer ml-[10px]">
                      <input type="checkbox" className="toggle-switch small" checked={item.checked} onChange={(e) => toggleCheck(item.id, e.target.checked)} />
                    </label>
                  </div>
                  <div className="text-[0.75rem] text-[var(--color-text-muted)]">
                    {item.splitBlobs.length > 0 ? `Done (${item.splitBlobs.length})` : 'Ready'}
                  </div>
                  <div className="flex gap-[10px] mt-[4px]">
                    <button className="liquid-btn danger-btn px-[12px] flex-1" onClick={() => {
                      URL.revokeObjectURL(item.url);
                      setItems((p) => p.filter((x) => x.id !== item.id));
                    }}><Trash2 className="w-4 h-4" /> Remove</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
