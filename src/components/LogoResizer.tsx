import React, { useState, useRef, useEffect } from 'react';
import { Image as ImageIcon, Upload, Download, Trash2, Copy } from 'lucide-react';
import { Core } from '../utils/core';
import JSZip from 'jszip';
import LoadingOverlay from './LoadingOverlay';
import ConfirmModal from './ConfirmModal';

interface CardData {
  id: string;
  file: File;
  url: string;
  text: string;
  fname: string;
  fontSize: number;
  hasLocalFont: boolean;
  txtSlider: number;
  imgSlider: number;
  padding: number | null;
  img: HTMLImageElement;
}

export default function LogoResizer() {
  const [cards, setCards] = useState<CardData[]>([]);
  const [globalFontSize, setGlobalFontSize] = useState<number>(28);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [fontColor, setFontColor] = useState<string>('#000000');
  const [globalImgPos, setGlobalImgPos] = useState<number>(0);
  const [globalPadding, setGlobalPadding] = useState<number>(0);
  const [exportWidth, setExportWidth] = useState<number>(200);
  const [exportHeight, setExportHeight] = useState<number>(200);
  const [isExporting, setIsExporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const newCards: CardData[] = [];
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const url = Core.BlobRegistry.create(file);
        const img = new Image();
        img.src = url;
        const id = Math.random().toString(36).substr(2, 9);
        const card: CardData = {
          id,
          file,
          url,
          text: '',
          fname: '',
          fontSize: globalFontSize,
          hasLocalFont: false,
          txtSlider: 90,
          imgSlider: globalImgPos,
          padding: null,
          img,
        };
        img.onload = () => {
          setCards((prev) => prev.map(c => c.id === id ? { ...c, img } : c));
        };
        newCards.push(card);
      }
    });
    setCards((prev) => [...newCards, ...prev]);
  };

  const updateCard = (id: string, updates: Partial<CardData>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const removeCard = (id: string) => {
    setCards((prev) => {
      const card = prev.find((c) => c.id === id);
      if (card) URL.revokeObjectURL(card.url);
      return prev.filter((c) => c.id !== id);
    });
  };

  const clearAll = () => {
    setShowConfirm(true);
  };

  const confirmClearAll = () => {
    cards.forEach((c) => URL.revokeObjectURL(c.url));
    setCards([]);
    setShowConfirm(false);
  };

  const exportAll = async () => {
    if (!cards.length) return;
    setIsExporting(true);
    try {
      const zip = new JSZip();
      
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i];
        const canvas = document.createElement('canvas');
        drawCard(c, canvas, globalPadding);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        if (blob) {
          const name = Core.Utils.sanitize(c.fname.trim() || `card_${i + 1}`);
          zip.file(`${name}.png`, blob);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'cards.zip';
      a.click();
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Failed to export images: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const drawCard = React.useCallback((c: CardData, canvas: HTMLCanvasElement, padding: number) => {
    if (!c.img.complete) return;
    const tW = exportWidth || 300;
    const tH = exportHeight || 400;
    canvas.width = tW;
    canvas.height = tH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, tW, tH);
    
    const pad = c.padding !== null ? c.padding : padding;
    const aW = tW - pad * 2;
    const aH = tH - pad * 2;
    const scale = Math.min(aW / c.img.naturalWidth, aH / c.img.naturalHeight);
    const rW = c.img.naturalWidth * scale;
    const rH = c.img.naturalHeight * scale;
    const x = (tW - rW) / 2;
    const y = (tH - rH) / 2 + (c.imgSlider / 100) * tH;
    
    ctx.drawImage(c.img, x, y, rW, rH);
    
    if (c.text) {
      ctx.fillStyle = fontColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const fontVal = c.hasLocalFont ? c.fontSize : globalFontSize;
      ctx.font = `${isBold ? '700' : '400'} ${fontVal}px Inter`;
      const lines = c.text.split('\n');
      const lh = fontVal * 1.25;
      const yS = (tH * c.txtSlider) / 100 - (lh * lines.length) / 2 + lh / 2;
      lines.forEach((l, i) => ctx.fillText(l, tW / 2, yS + i * lh));
    }
  }, [exportWidth, exportHeight, fontColor, globalFontSize, isBold]);

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
      <LoadingOverlay isVisible={isExporting} message="Generating ZIP file..." />
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <ImageIcon className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Logo Resizer</h2>
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
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Text Settings</span>
            <input className="liquid-input" placeholder="Font Size (px)" type="number" value={globalFontSize} onChange={(e) => setGlobalFontSize(parseInt(e.target.value) || 28)} />
            <div className="flex items-center justify-between">
              <label className="flex gap-[10px] text-[0.875rem] items-center cursor-pointer">
                <input className="toggle-switch small" type="checkbox" checked={isBold} onChange={(e) => setIsBold(e.target.checked)} /> Bold
              </label>
              <input className="bg-transparent border-none h-[32px] w-[50px] cursor-pointer" type="color" value={fontColor} onChange={(e) => setFontColor(e.target.value)} />
            </div>
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <div className="flex justify-between items-center">
              <span className="label-header mb-0">Image Padding</span>
              <span className="text-xs text-[var(--color-text-muted)]">{globalPadding}px</span>
            </div>
            <input className="range-slider" max="150" min="0" type="range" value={globalPadding} onChange={(e) => setGlobalPadding(parseInt(e.target.value))} />
            
            <span className="label-header mt-[8px]">Vertical Adjust</span>
            <input className="range-slider" max="50" min="-50" type="range" value={globalImgPos} onChange={(e) => {
              const val = parseInt(e.target.value);
              setGlobalImgPos(val);
              setCards(prev => prev.map(c => ({ ...c, imgSlider: val })));
            }} />
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Output Size</span>
            <div className="flex gap-[10px]">
              <input className="liquid-input flex-1" placeholder="W" type="number" value={exportWidth} onChange={(e) => setExportWidth(parseInt(e.target.value) || 300)} />
              <input className="liquid-input flex-1" placeholder="H" type="number" value={exportHeight} onChange={(e) => setExportHeight(parseInt(e.target.value) || 400)} />
            </div>
            <div className="flex flex-col gap-[10px] mt-[8px]">
              <button className="liquid-btn active-mode w-full" disabled={!cards.length || isExporting} onClick={exportAll}>
                Download Zip
              </button>
              <button className="liquid-btn danger-btn w-full" onClick={clearAll}>Reset</button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-[24px] content-start">
          {!cards.length ? (
            <div className="empty-state-msg">
              <ImageIcon className="w-[40px] h-[40px] opacity-30" />
              <p>No images selected</p>
            </div>
          ) : (
            cards.map((card, index) => (
              <LogoCard 
                key={card.id} 
                card={card} 
                index={index}
                updateCard={updateCard} 
                removeCard={removeCard} 
                drawCard={drawCard} 
                exportWidth={exportWidth} 
                exportHeight={exportHeight} 
                globalFontSize={globalFontSize} 
                isBold={isBold} 
                fontColor={fontColor} 
                globalPadding={globalPadding} 
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const LogoCard = React.memo(function LogoCard({ card, index, updateCard, removeCard, drawCard, exportWidth, exportHeight, globalFontSize, isBold, fontColor, globalPadding }: any) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      drawCard(card, canvasRef.current, globalPadding);
    }
  }, [card, exportWidth, exportHeight, globalFontSize, isBold, fontColor, globalPadding]);

  const downloadSingle = async () => {
    if (!canvasRef.current) return;
    const blob = await new Promise<Blob | null>((r) => canvasRef.current!.toBlob(r, 'image/png'));
    if (blob) {
      const name = Core.Utils.sanitize(card.fname.trim() || 'card');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.png`;
      a.click();
    }
  };

  return (
    <div 
      className={`bg-[var(--color-bg-panel)] border border-[var(--color-border-color)] flex flex-col rounded-[var(--radius-app)] overflow-hidden transition duration-200 hover:border-[#404040]`}
    >
      <div className="bg-[#050505] flex items-center justify-center aspect-square overflow-hidden p-[12px] relative pointer-events-none" style={{
        backgroundImage: 'linear-gradient(45deg, #0A0A0A 25%, transparent 25%), linear-gradient(-45deg, #0A0A0A 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #0A0A0A 75%), linear-gradient(-45deg, transparent 75%, #0A0A0A 75%)',
        backgroundSize: '20px 20px'
      }}>
        <canvas ref={canvasRef} className="max-w-full max-h-full object-contain" style={{ aspectRatio: `${exportWidth}/${exportHeight}` }} />
      </div>
      <div className="p-[16px] flex flex-col gap-[12px] border-t border-[var(--color-border-color)] bg-[var(--color-bg-panel)]">
        <textarea className="liquid-input" rows={2} placeholder="Label" value={card.text} onChange={(e) => updateCard(card.id, { text: e.target.value, fname: Core.Utils.sanitize(e.target.value) })} />
        <div className="flex gap-[10px]">
          <input className="liquid-input flex-[2]" placeholder="Filename" value={card.fname} onChange={(e) => updateCard(card.id, { fname: Core.Utils.sanitize(e.target.value) })} />
          <input type="number" className="liquid-input flex-1" placeholder="Size" value={card.hasLocalFont ? card.fontSize : ''} onChange={(e) => {
            const val = parseInt(e.target.value);
            if (!isNaN(val)) {
              updateCard(card.id, { hasLocalFont: true, fontSize: Math.max(8, Math.min(val, 200)) });
            } else {
              updateCard(card.id, { hasLocalFont: false });
            }
          }} />
        </div>
        <div className="flex gap-[10px]">
          <div className="flex-1">
            <span className="label-header">Text Y</span>
            <input type="range" className="range-slider" min="0" max="100" value={card.txtSlider} onChange={(e) => updateCard(card.id, { txtSlider: parseInt(e.target.value) })} />
          </div>
          <div className="flex-1">
            <span className="label-header">Image Y</span>
            <input type="range" className="range-slider" min="-50" max="50" value={card.imgSlider} onChange={(e) => updateCard(card.id, { imgSlider: parseInt(e.target.value) })} />
          </div>
        </div>
        <div className="flex gap-[10px]">
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="label-header mb-0">Padding</span>
              <span className="text-xs text-[var(--color-text-muted)]">{card.padding !== null ? card.padding : globalPadding}px</span>
            </div>
            <input type="range" className="range-slider" min="0" max="150" value={card.padding !== null ? card.padding : globalPadding} onChange={(e) => updateCard(card.id, { padding: parseInt(e.target.value) })} />
          </div>
        </div>
        <div className="flex gap-[10px] mt-[4px]">
          <button className="liquid-btn flex-1" onClick={downloadSingle}><Download className="w-4 h-4" /> Download</button>
          <button className="liquid-btn danger-btn px-[12px]" onClick={() => removeCard(card.id)}><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
    </div>
  );
});
