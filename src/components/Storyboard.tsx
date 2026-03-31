import React, { useState, useRef, useEffect } from 'react';
import { Clapperboard, Upload, Download, Trash2, ArrowUp, ArrowDown, X, Copy } from 'lucide-react';
import { Core } from '../utils/core';
import JSZip from 'jszip';
import LoadingOverlay from './LoadingOverlay';
import ConfirmModal from './ConfirmModal';

interface StoryImage {
  id: string;
  file: File;
  img: HTMLImageElement;
}

interface StoryProject {
  id: number;
  name: string;
  images: StoryImage[];
  settings: {
    gap: number;
    width: number;
    autoWidth: boolean;
    bgColor: string;
    columns: number | 'auto';
    fitMode: 'cover' | 'contain';
  };
}

export default function Storyboard() {
  const [projects, setProjects] = useState<StoryProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<number | null>(null);
  const [canvasDataUrl, setCanvasDataUrl] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [confirmDeleteProject, setConfirmDeleteProject] = useState<number | null>(null);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      addNewProject();
    }
  }, []);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  const addNewProject = () => {
    const id = Date.now() + Math.random();
    setProjects((prev) => {
      const newProject: StoryProject = {
        id,
        name: `Board_${prev.length + 1}`,
        images: [],
        settings: { gap: 0, width: 1920, autoWidth: true, bgColor: '#ffffff', columns: 'auto', fitMode: 'cover' },
      };
      return [...prev, newProject];
    });
    setActiveProjectId(id);
  };

  const deleteProject = (id: number) => {
    setConfirmDeleteProject(id);
  };

  const confirmDelete = () => {
    if (confirmDeleteProject === null) return;
    const id = confirmDeleteProject;
    setProjects((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      const newProjects = prev.filter((p) => p.id !== id);
      if (newProjects.length === 0) {
        setTimeout(addNewProject, 0);
      } else if (activeProjectId === id) {
        setActiveProjectId(newProjects[Math.max(0, idx - 1)].id);
      }
      return newProjects;
    });
    setConfirmDeleteProject(null);
  };

  const updateActiveProject = (updates: Partial<StoryProject>) => {
    if (!activeProjectId) return;
    setProjects((prev) => prev.map((p) => p.id === activeProjectId ? { ...p, ...updates } : p));
  };

  const updateSettings = (updates: Partial<StoryProject['settings']>) => {
    if (!activeProject) return;
    updateActiveProject({ settings: { ...activeProject.settings, ...updates } });
  };

  const handleFiles = async (files: FileList | File[]) => {
    if (!activeProject) return;
    const newImages: StoryImage[] = [];

    for (const file of Array.from(files)) {
      let img: HTMLImageElement;
      if (file.type.startsWith('video/')) {
        try {
          img = await getVideoFrame(file);
        } catch (e) {
          continue;
        }
      } else if (file.type.startsWith('image/')) {
        img = new Image();
        img.src = Core.BlobRegistry.create(file);
        await new Promise((res) => { 
          img.onload = res; 
          img.onerror = res;
        });
        if (!img.complete || img.naturalWidth === 0) continue;
      } else {
        continue;
      }
      newImages.push({ id: Math.random().toString(36).substr(2, 9), file, img });
    }

    updateActiveProject({ images: [...activeProject.images, ...newImages] });
  };

  const getVideoFrame = (file: File): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.src = URL.createObjectURL(file);
      video.muted = true;
      video.currentTime = 1.0;
      video.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = video.videoWidth;
        c.height = video.videoHeight;
        c.getContext('2d')!.drawImage(video, 0, 0);
        const img = new Image();
        img.src = c.toDataURL('image/jpeg');
        img.onload = () => resolve(img);
      };
      video.onerror = reject;
    });
  };

  const moveImage = (idx: number, dir: number) => {
    if (!activeProject) return;
    const t = idx + dir;
    if (t < 0 || t >= activeProject.images.length) return;
    const newImages = [...activeProject.images];
    [newImages[idx], newImages[t]] = [newImages[t], newImages[idx]];
    updateActiveProject({ images: newImages });
  };

  const removeImage = (idx: number) => {
    if (!activeProject) return;
    const newImages = [...activeProject.images];
    URL.revokeObjectURL(newImages[idx].img.src);
    newImages.splice(idx, 1);
    updateActiveProject({ images: newImages });
  };

  const clearBoard = () => {
    if (!activeProject) return;
    setShowConfirmClear(true);
  };

  const confirmClearBoard = () => {
    if (!activeProject) return;
    activeProject.images.forEach((i) => URL.revokeObjectURL(i.img.src));
    updateActiveProject({ images: [] });
    setShowConfirmClear(false);
  };

  useEffect(() => {
    draw();
  }, [activeProject?.images, activeProject?.settings]);

  const draw = async () => {
    if (!activeProject || !activeProject.images.length) {
      setCanvasDataUrl(null);
      setCanvasSize(null);
      return;
    }

    setIsProcessing(true);
    // Add a small delay to allow UI to update
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const imgs = activeProject.images;
      if (!imgs[0].img.complete) {
        setIsProcessing(false);
        return;
      }

      const s = activeProject.settings;
      const count = imgs.length;
      let cols, rows;
      if (s.columns !== 'auto') {
        cols = s.columns as number;
        rows = Math.ceil(count / cols);
      } else {
        if (count === 4) { cols = 2; rows = 2; }
        else if (count === 9) { cols = 3; rows = 3; }
        else if (count === 16) { cols = 4; rows = 4; }
        else { cols = Math.ceil(Math.sqrt(count)); rows = Math.ceil(count / cols); }
      }

      let fW = s.autoWidth ? (imgs[0].img.naturalWidth * cols) : s.width;
      if (fW > 8192) fW = 8192;
      const baseAspect = imgs[0].img.naturalWidth / imgs[0].img.naturalHeight;
      let fH = fW * (rows / cols) / baseAspect;

      const c = document.createElement('canvas');
      c.width = fW;
      c.height = fH;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = s.bgColor || '#ffffff';
      ctx.fillRect(0, 0, fW, fH);

      const cellW = (fW - (s.gap * (cols + 1))) / cols;
      const cellH = (fH - (s.gap * (rows + 1))) / rows;

      let idx = 0;
      for (let r = 0; r < rows; r++) {
        const rem = imgs.length - idx;
        const countInRow = Math.min(cols, rem);
        if (countInRow <= 0) break;
        const shiftX = ((cols - countInRow) * (cellW + s.gap)) / 2;

        for (let col = 0; col < countInRow; col++) {
          const item = imgs[idx];
          const x = s.gap + col * (cellW + s.gap) + shiftX;
          const y = s.gap + r * (cellH + s.gap);

          const iR = item.img.naturalWidth / item.img.naturalHeight;
          const cR = cellW / cellH;
          let sw, sh, sx, sy, dx, dy, dw, dh;
          
          if (s.fitMode === 'contain') {
            sx = 0; sy = 0; sw = item.img.naturalWidth; sh = item.img.naturalHeight;
            if (iR > cR) {
              dw = cellW;
              dh = dw / iR;
              dx = x;
              dy = y + (cellH - dh) / 2;
            } else {
              dh = cellH;
              dw = dh * iR;
              dy = y;
              dx = x + (cellW - dw) / 2;
            }
          } else {
            dx = x; dy = y; dw = cellW; dh = cellH;
            if (iR > cR) {
              sh = item.img.naturalHeight;
              sw = sh * cR;
              sy = 0;
              sx = (item.img.naturalWidth - sw) / 2;
            } else {
              sw = item.img.naturalWidth;
              sh = sw / cR;
              sx = 0;
              sy = (item.img.naturalHeight - sh) / 2;
            }
          }

          ctx.drawImage(item.img, sx, sy, sw, sh, dx, dy, dw, dh);
          idx++;
        }
      }

      canvasRef.current = c;
      setCanvasDataUrl(c.toDataURL('image/jpeg', 0.9));
      setCanvasSize({ w: Math.round(fW), h: Math.round(fH) });
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Failed to draw storyboard: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadStory = () => {
    if (canvasDataUrl && activeProject) {
      const a = document.createElement('a');
      a.href = canvasDataUrl;
      a.download = `${activeProject.name}.jpg`;
      a.click();
    }
  };

  const downloadAll = async () => {
    if (!projects.some((p) => p.images.length > 0)) return;
    setIsDownloading(true);
    
    try {
      const zip = new JSZip();

      for (const p of projects) {
        if (p.images.length === 0) continue;
        // We need to temporarily draw this project to a canvas
        const imgs = p.images;
        const s = p.settings;
        const count = imgs.length;
        let cols, rows;
        if (s.columns !== 'auto') {
          cols = s.columns as number;
          rows = Math.ceil(count / cols);
        } else {
          if (count === 4) { cols = 2; rows = 2; }
          else if (count === 9) { cols = 3; rows = 3; }
          else if (count === 16) { cols = 4; rows = 4; }
          else { cols = Math.ceil(Math.sqrt(count)); rows = Math.ceil(count / cols); }
        }

        let fW = s.autoWidth ? (imgs[0].img.naturalWidth * cols) : s.width;
        if (fW > 8192) fW = 8192;
        const baseAspect = imgs[0].img.naturalWidth / imgs[0].img.naturalHeight;
        let fH = fW * (rows / cols) / baseAspect;

        const c = document.createElement('canvas');
        c.width = fW;
        c.height = fH;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = s.bgColor || '#ffffff';
        ctx.fillRect(0, 0, fW, fH);

        const cellW = (fW - (s.gap * (cols + 1))) / cols;
        const cellH = (fH - (s.gap * (rows + 1))) / rows;

        let idx = 0;
        for (let r = 0; r < rows; r++) {
          const rem = imgs.length - idx;
          const countInRow = Math.min(cols, rem);
          if (countInRow <= 0) break;
          const shiftX = ((cols - countInRow) * (cellW + s.gap)) / 2;

          for (let col = 0; col < countInRow; col++) {
            const item = imgs[idx];
            const x = s.gap + col * (cellW + s.gap) + shiftX;
            const y = s.gap + r * (cellH + s.gap);

            const iR = item.img.naturalWidth / item.img.naturalHeight;
            const cR = cellW / cellH;
            let sw, sh, sx, sy, dx, dy, dw, dh;
            
            if (s.fitMode === 'contain') {
              sx = 0; sy = 0; sw = item.img.naturalWidth; sh = item.img.naturalHeight;
              if (iR > cR) {
                dw = cellW;
                dh = dw / iR;
                dx = x;
                dy = y + (cellH - dh) / 2;
              } else {
                dh = cellH;
                dw = dh * iR;
                dy = y;
                dx = x + (cellW - dw) / 2;
              }
            } else {
              dx = x; dy = y; dw = cellW; dh = cellH;
              if (iR > cR) {
                sh = item.img.naturalHeight;
                sw = sh * cR;
                sy = 0;
                sx = (item.img.naturalWidth - sw) / 2;
              } else {
                sw = item.img.naturalWidth;
                sh = sw / cR;
                sx = 0;
                sy = (item.img.naturalHeight - sh) / 2;
              }
            }

            ctx.drawImage(item.img, sx, sy, sw, sh, dx, dy, dw, dh);
            idx++;
          }
        }

        const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
        if (blob) {
          zip.file(`${p.name}.jpg`, blob);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = 'boards.zip';
      a.click();
    } catch (e: any) {
      console.error(e);
      setAlertMessage(`Failed to download storyboards: ${e.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <ConfirmModal
        isOpen={confirmDeleteProject !== null}
        title="Delete Board"
        message="Are you sure you want to delete this board? This action cannot be undone."
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteProject(null)}
        confirmText="Delete"
      />
      <ConfirmModal
        isOpen={showConfirmClear}
        title="Clear Board"
        message="Are you sure you want to remove all assets from this board? This action cannot be undone."
        onConfirm={confirmClearBoard}
        onCancel={() => setShowConfirmClear(false)}
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
      <LoadingOverlay isVisible={isProcessing || isDownloading} message={isProcessing ? "Rendering storyboard..." : "Generating ZIP file..."} />
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <Clapperboard className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Storyboard</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-[24px] items-start">
        <div className="flex flex-col gap-[20px] sticky top-0 overflow-y-auto max-h-[calc(100vh-100px)] pr-[5px]">
          <div className="glass-panel mb-[20px]">
            <div className="flex flex-col gap-[8px] mb-[16px]">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className={`px-[12px] py-[8px] rounded-[6px] text-[0.85rem] cursor-pointer flex justify-between items-center transition-colors duration-200 ${p.id === activeProjectId ? 'bg-white text-black font-medium' : 'bg-[#1A1A1A] text-white hover:bg-[#2A2A2A]'}`}
                  onClick={() => setActiveProjectId(p.id)}
                >
                  <span className="truncate flex-1">{p.name}</span>
                  <div className="flex items-center gap-[4px]">
                    <span className={`opacity-50 hover:opacity-100 p-[2px] ${p.id === activeProjectId ? 'text-black' : 'text-white'}`} title="Delete" onClick={(e) => { e.stopPropagation(); deleteProject(p.id); }}><X className="w-4 h-4" /></span>
                  </div>
                </div>
              ))}
            </div>
            <button className="liquid-btn w-full h-[36px] text-[0.85rem]" onClick={addNewProject}>+ New Board</button>
          </div>
          
          <div
            className="drop-zone"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
            onDrop={(e) => { e.preventDefault(); e.currentTarget.classList.remove('drag-over'); handleFiles(e.dataTransfer.files); }}
          >
            <label className="liquid-btn w-full cursor-pointer">
              <input accept="image/*,video/*" hidden multiple type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
              <Upload className="w-4 h-4" /> Add Assets
            </label>
          </div>
          
          <div className="mt-[20px]">
            <div className="glass-panel flex flex-col gap-[16px]">
              <div className="flex gap-[10px]">
                <div className="flex-1">
                  <span className="label-header">Columns</span>
                  <select className="liquid-input" value={activeProject?.settings.columns || 'auto'} onChange={(e) => updateSettings({ columns: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value) })}>
                    <option value="auto">Auto</option>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <span className="label-header">Fit Mode</span>
                  <select className="liquid-input" value={activeProject?.settings.fitMode || 'cover'} onChange={(e) => updateSettings({ fitMode: e.target.value as 'cover' | 'contain' })}>
                    <option value="cover">Cover</option>
                    <option value="contain">Contain</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-[10px]">
                <div className="flex-1">
                  <span className="label-header">Gap</span>
                  <input className="liquid-input" type="number" value={activeProject?.settings.gap || 0} onChange={(e) => updateSettings({ gap: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="flex-1">
                  <span className="label-header">Width</span>
                  <input className="liquid-input" disabled={activeProject?.settings.autoWidth} type="number" value={activeProject?.settings.width || 1920} onChange={(e) => updateSettings({ width: parseInt(e.target.value) || 1920 })} />
                </div>
              </div>
              <div className="flex items-center justify-between mt-[5px]">
                <label className="text-[0.9rem] flex gap-[10px] items-center cursor-pointer text-white">
                  <input className="toggle-switch small" type="checkbox" checked={activeProject?.settings.autoWidth || false} onChange={(e) => updateSettings({ autoWidth: e.target.checked })} /> Auto Width
                </label>
                <div className="flex items-center gap-[10px]">
                  <span className="label-header mb-0">BG</span>
                  <input className="bg-transparent border-none h-[30px] w-[40px] cursor-pointer" type="color" value={activeProject?.settings.bgColor || '#ffffff'} onChange={(e) => updateSettings({ bgColor: e.target.value })} />
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-[#050505] border border-[var(--color-border-color)] rounded-[var(--radius-app)] h-[calc(100vh-150px)] flex items-center justify-center overflow-hidden relative p-[24px] max-lg:h-[350px] max-lg:order-[-1]">
          <div className="w-full h-full flex items-center justify-center overflow-hidden relative">
            {canvasDataUrl ? (
              <>
                <img src={canvasDataUrl} className="max-w-full max-h-full w-auto h-auto object-contain shadow-[0_4px_20px_rgba(0,0,0,0.5)] rounded-[4px] cursor-pointer" alt="Preview" onClick={() => window.open(canvasDataUrl, '_blank')} />
                {canvasSize && (
                  <div className="absolute top-[20px] right-[20px] bg-[rgba(0,0,0,0.8)] backdrop-blur-[4px] text-white px-[10px] py-[6px] rounded-[6px] text-[0.75rem] font-mono font-semibold border border-[#333] pointer-events-none tracking-[1px] z-10">
                    <span className="opacity-70">SIZE:</span> {canvasSize.w} <span className="opacity-70">x</span> {canvasSize.h}
                  </div>
                )}
              </>
            ) : (
              <span className="text-[var(--color-text-muted)]">Preview</span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-[20px] sticky top-0 overflow-y-auto max-h-[calc(100vh-100px)] pr-[5px]">
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Board Actions</span>
            <input className="liquid-input" type="text" value={activeProject?.name || ''} placeholder="Board Name" onChange={(e) => updateActiveProject({ name: e.target.value.replace(/\s+/g, '_') })} />
            <div className="flex gap-[10px]">
              <button className="liquid-btn flex-1" onClick={draw} disabled={isProcessing}>Render</button>
              <button className="liquid-btn active-mode flex-1" onClick={downloadStory} disabled={!canvasDataUrl}>Save JPG</button>
            </div>
            <div className="flex flex-col gap-[10px] mt-[10px]">
              <button className="liquid-btn w-full" onClick={downloadAll} disabled={isDownloading}>Download All (Zip)</button>
              <button className="liquid-btn danger-btn w-full" onClick={clearBoard}>Clear Board</button>
            </div>
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px] flex-1 min-h-[250px]">
            <span className="label-header">Added Assets</span>
            <div className="flex-1 overflow-y-auto pr-[5px]">
              <div className="flex flex-col gap-[8px]">
                {activeProject?.images.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={`flex justify-between items-center p-[10px_12px] bg-[var(--color-bg-input)] border border-[var(--color-border-color)] text-[0.85rem] rounded-[6px] transition duration-200 text-white`}
                  >
                    <div className="flex items-center gap-[10px] pointer-events-none">
                      <img src={item.img.src} className="w-[30px] h-[30px] object-cover rounded-[4px]" alt={`Asset ${index + 1}`} />
                      <span>{index + 1}</span>
                    </div>
                    <div className="flex gap-[5px]">
                      <button className="liquid-btn px-[8px] h-[28px]" onClick={() => moveImage(index, -1)}><ArrowUp className="w-3 h-3" /></button>
                      <button className="liquid-btn px-[8px] h-[28px]" onClick={() => moveImage(index, 1)}><ArrowDown className="w-3 h-3" /></button>
                      <button className="liquid-btn danger-btn px-[8px] h-[28px]" onClick={() => removeImage(index)}><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
