import React, { useState, useRef, useEffect } from 'react';
import { Film, Upload, Download, Trash2, X, Copy } from 'lucide-react';
import { Core } from '../utils/core';
import JSZip from 'jszip';
import LoadingOverlay from './LoadingOverlay';
import ConfirmModal from './ConfirmModal';

interface StillFrame {
  num: number;
  blob: Blob;
  url: string;
  checked: boolean;
}

interface VideoData {
  id: string;
  name: string;
  frames: StillFrame[];
  thumbnail?: string;
  status: string;
}

export default function VideoStills() {
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [queue, setQueue] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const valid = Array.from(files).filter((f) => f.type.startsWith('video/'));
    if (!valid.length) return;
    setQueue((prev) => [...prev, ...valid]);
  };

  const process = async () => {
    if (!queue.length) return;
    setIsProcessing(true);

    for (let i = 0; i < queue.length; i++) {
      const file = queue[i];
      try {
        const name = file.name.replace(/\.[^/.]+$/, '').replace(/\s+/g, '_');
        const vid = document.createElement('video');
        vid.src = Core.BlobRegistry.create(file);
        vid.muted = true;
        
        await new Promise((r) => { vid.onloadedmetadata = r; vid.onerror = r; });
        
        const id = `vid-${Date.now()}`;
        vid.currentTime = 0.5;
        await new Promise((r) => { vid.onseeked = r; });
        
        const cv = document.createElement('canvas');
        cv.width = 400;
        cv.height = 400 * (vid.videoHeight / vid.videoWidth);
        cv.getContext('2d')!.drawImage(vid, 0, 0, cv.width, cv.height);
        
        const thumbnail = cv.toDataURL();
        
        setVideos((prev) => [...prev, { id, name, frames: [], thumbnail, status: 'Processing...' }]);
        
        const frames = Math.floor(vid.duration) || 1;
        const interval = vid.duration / (frames + 1);
        const extractedFrames: StillFrame[] = [];
        
        for (let f = 1; f <= frames; f++) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          vid.currentTime = f * interval;
          await new Promise((r) => { vid.onseeked = r; });
          
          const c = document.createElement('canvas');
          c.width = vid.videoWidth;
          c.height = vid.videoHeight;
          c.getContext('2d')!.drawImage(vid, 0, 0);
          
          const blob = await new Promise<Blob>((r) => c.toBlob(r as BlobCallback, 'image/jpeg', 0.9));
          extractedFrames.push({ num: f, blob, url: Core.BlobRegistry.create(blob), checked: true });
        }
        
        setVideos((prev) => prev.map((v) => v.id === id ? { ...v, frames: extractedFrames, status: `${frames} Frames` } : v));
      } catch (e: any) {
        console.error(e);
        setAlertMessage(`Failed to process ${file.name}: ${e.message}`);
      }
    }
    
    setQueue([]);
    setIsProcessing(false);
  };

  const clearAll = () => {
    setShowConfirm(true);
  };

  const confirmClearAll = () => {
    setVideos([]);
    setQueue([]);
    Core.BlobRegistry.revokeAll();
    setShowConfirm(false);
  };

  const toggleAll = (val: boolean) => {
    if (!selectedVideo) return;
    setVideos((prev) => prev.map((v) => {
      if (v.id === selectedVideo) {
        return { ...v, frames: v.frames.map((f) => ({ ...f, checked: val })) };
      }
      return v;
    }));
  };

  const toggleFrame = (num: number, val: boolean) => {
    if (!selectedVideo) return;
    setVideos((prev) => prev.map((v) => {
      if (v.id === selectedVideo) {
        return { ...v, frames: v.frames.map((f) => f.num === num ? { ...f, checked: val } : f) };
      }
      return v;
    }));
  };

  const downloadSelected = async () => {
    if (!selectedVideo) return;
    const data = videos.find((v) => v.id === selectedVideo);
    if (!data) return;
    
    const sel = data.frames.filter((f) => f.checked);
    if (!sel.length) return;
    
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      sel.forEach((f) => zip.file(`${f.num}.jpg`, f.blob));
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
      a.download = 'frames.zip';
      a.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const downloadAll = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      videos.forEach((v) => {
        const f = zip.folder(v.name);
        if (f) v.frames.forEach((frame) => f.file(`${frame.num}.jpg`, frame.blob));
      });
      
      const a = document.createElement('a');
      a.href = URL.createObjectURL(await zip.generateAsync({ type: 'blob' }));
      a.download = 'all_stills.zip';
      a.click();
    } finally {
      setIsDownloading(false);
    }
  };

  const activeVideoData = videos.find((v) => v.id === selectedVideo);

  return (
    <div className="flex flex-col h-full relative">
      <ConfirmModal
        isOpen={showConfirm}
        title="Reset All"
        message="Are you sure you want to remove all videos and extracted frames? This action cannot be undone."
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
      <LoadingOverlay isVisible={isProcessing || isDownloading} message={isProcessing ? "Extracting frames..." : "Generating ZIP file..."} />
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <Film className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Video Stills</h2>
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
              <input accept="video/*" hidden multiple type="file" ref={fileInputRef} onChange={(e) => { if (e.target.files) handleFiles(e.target.files); }} />
              <Upload className="w-4 h-4" /> Add Videos
            </label>
          </div>
          
          <div className="mt-[20px]">
            <div className="flex flex-col gap-[10px]">
              <button className="liquid-btn w-full" disabled={!queue.length || isProcessing} onClick={process}>
                Process Videos
              </button>
              <button className="liquid-btn active-mode w-full" disabled={!videos.length || isDownloading} onClick={downloadAll}>
                Download All
              </button>
              <button className="liquid-btn danger-btn w-full" onClick={clearAll}>
                Reset
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-[24px] items-start">
          {!videos.length && !queue.length ? (
            <div className="empty-state-msg w-full">
              <Film className="w-[40px] h-[40px] opacity-30" />
              <p>No videos</p>
            </div>
          ) : (
            <>
              {queue.length > 0 && (
                <div className="empty-state-msg w-full">
                  <p>{queue.length} video(s) queued.</p>
                </div>
              )}
              {videos.map((vid) => (
                <div key={vid.id} className="w-[240px] relative cursor-pointer border border-[var(--color-border-color)] bg-[var(--color-bg-panel)] rounded-[var(--radius-app)] flex flex-col overflow-hidden transition duration-150 hover:-translate-y-[4px] hover:border-[#404040]" onClick={() => setSelectedVideo(vid.id)}>
                  {vid.thumbnail ? (
                    <img src={vid.thumbnail} className="w-full h-[220px] block object-contain bg-[#050505]" alt={vid.name} />
                  ) : (
                    <div className="w-full h-[220px] bg-[#050505] flex items-center justify-center text-[var(--color-text-muted)]">Processing...</div>
                  )}
                  <div className="bg-[var(--color-bg-panel)] p-[16px] text-[0.9rem] border-t border-[var(--color-border-color)] flex flex-col gap-[6px]">
                    <div className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis">{vid.name}</div>
                    <div className="text-[var(--color-text-muted)] text-[0.8rem]">{vid.status}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {selectedVideo && activeVideoData && (
        <div className="fixed inset-0 bg-[#050505] z-[1000] flex flex-col p-[40px] max-lg:p-[20px]">
          <div className="flex justify-between mb-[20px] border-b border-[var(--color-border-color)] pb-[15px] items-center flex-wrap gap-[15px]">
            <div>
              <h3 className="m-0 text-[1.5rem] font-semibold text-white tracking-tight">{activeVideoData.name}</h3>
              <span className="text-[var(--color-text-muted)] text-[0.9rem]">{activeVideoData.frames.length} Frames</span>
            </div>
            <div className="flex gap-[12px] items-center">
              <label className="flex items-center gap-[8px] cursor-pointer text-white text-[0.9rem]">
                <input className="toggle-switch small" type="checkbox" checked={activeVideoData.frames.every(f => f.checked)} onChange={(e) => toggleAll(e.target.checked)} /> Select All
              </label>
              <button className="liquid-btn active-mode" onClick={downloadSelected} disabled={isDownloading}>Download Selected</button>
              <button className="liquid-btn danger-btn px-[10px]" onClick={() => setSelectedVideo(null)}><X className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[24px] overflow-y-auto p-[10px] max-lg:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
            {activeVideoData.frames.map((frame, index) => (
              <div 
                key={frame.num} 
                className={`border border-[var(--color-border-color)] bg-[var(--color-bg-panel)] rounded-[var(--radius-app)] overflow-hidden flex flex-col transition duration-200 hover:border-[#404040]`}
              >
                <img src={frame.url} className="w-full block cursor-pointer aspect-[16/9] object-contain bg-[#050505] border-b border-[var(--color-border-color)] pointer-events-none" alt={`Frame ${frame.num}`} onClick={() => window.open(frame.url, '_blank')} />
                <div className="p-[12px] flex flex-col gap-[8px] bg-[var(--color-bg-panel)]">
                  <div className="flex justify-between items-center">
                    <span className="text-[0.8rem] text-[var(--color-text-muted)] font-mono">#{frame.num}</span>
                    <input type="checkbox" className="toggle-switch small" checked={frame.checked} onChange={(e) => toggleFrame(frame.num, e.target.checked)} />
                  </div>
                  <div className="flex gap-[8px]">
                    <button className="liquid-btn danger-btn px-[8px] py-[4px] flex-1 text-[0.75rem]" onClick={() => {
                      URL.revokeObjectURL(frame.url);
                      setVideos((prev) => prev.map((v) => v.id === activeVideoData.id ? { ...v, frames: v.frames.filter((f) => f.num !== frame.num) } : v));
                    }}><Trash2 className="w-3 h-3" /> Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
