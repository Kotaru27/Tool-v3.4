import React, { useState, useEffect } from 'react';
import { Box, LayoutGrid, Image as ImageIcon, FileText, Scissors, Clapperboard, Film, Link2, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Core } from './utils/core';

import Home from './components/Home';
import LogoResizer from './components/LogoResizer';
import PdfConvert from './components/PdfConvert';
import ImageSplitter from './components/ImageSplitter';
import Storyboard from './components/Storyboard';
import VideoStills from './components/VideoStills';
import AdLinkGen from './components/AdLinkGen';
import AdDownloadTool from './components/AdDownloadTool';

export type ToolId = 'home' | 'logo' | 'pdf' | 'split' | 'story' | 'stills' | 'adlinks'| 'addownload';

const ToolColors: Record<ToolId, { hex: string, rgb: string }> = {
  home: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  logo: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  pdf: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  split: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  story: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  stills: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  adlinks: { hex: '#FFFFFF', rgb: '255, 255, 255' },
  addownload: { hex: '#FFFFFF', rgb: '255, 255, 255' },
};

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>('home');

  useEffect(() => {
    const savedTool = Core.AppState.load('activeTool') as ToolId;
    if (savedTool && Object.keys(ToolColors).includes(savedTool)) {
      setActiveTool(savedTool);
    }
  }, []);

  useEffect(() => {
    const color = ToolColors[activeTool];
    document.documentElement.style.setProperty('--accent', color.hex);
    document.documentElement.style.setProperty('--accent-hover', color.hex);
    document.documentElement.style.setProperty('--accent-rgb', color.rgb);
    Core.AppState.save('activeTool', activeTool);
    
    // Cleanup blobs when switching tools
    return () => {
      Core.BlobRegistry.revokeAll();
    };
  }, [activeTool]);

  const renderTool = () => {
    switch (activeTool) {
      case 'home': return <Home onSelectTool={setActiveTool} />;
      case 'logo': return <LogoResizer />;
      case 'pdf': return <PdfConvert />;
      case 'split': return <ImageSplitter />;
      case 'story': return <Storyboard />;
      case 'stills': return <VideoStills />;
      case 'adlinks': return <AdLinkGen />;
      case 'addownload': return <AdDownloadTool />;
      default: return <Home onSelectTool={setActiveTool} />;
    }
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${activeTool !== 'home' ? 'tool-active' : ''}`}>
      {activeTool !== 'home' && (
        <motion.header 
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="h-[60px] border-b border-[var(--color-border-color)] flex items-center justify-between px-[var(--spacing-app)] bg-[var(--color-bg-panel)] shrink-0 z-50"
        >
          <div className="font-semibold text-[1.1rem] tracking-tight flex items-center gap-[10px]">
            <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
              <Box className="text-black w-5 h-5" />
            </div>
            <span>Toolkit</span>
          </div>
        </motion.header>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <AnimatePresence>
          {activeTool !== 'home' && (
            <motion.nav 
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="w-[64px] bg-[var(--color-bg-panel)] border-r border-[var(--color-border-color)] flex flex-col items-center pt-[var(--spacing-app)] gap-[12px] z-40 max-lg:w-full max-lg:fixed max-lg:bottom-0 max-lg:h-[60px] max-lg:flex-row max-lg:justify-around max-lg:p-0 max-lg:border-t max-lg:border-r-0 max-lg:pt-0"
            >
              <NavItem id="home" icon={<LayoutGrid />} active={activeTool === 'home'} onClick={() => setActiveTool('home')} title="Home" />
              <div className="h-[1px] w-[24px] bg-[var(--color-border-color)] my-[4px] max-lg:hidden"></div>
              <NavItem id="logo" icon={<ImageIcon />} active={activeTool === 'logo'} onClick={() => setActiveTool('logo')} title="Logo Resizer" color={ToolColors.logo.hex} />
              <NavItem id="pdf" icon={<FileText />} active={activeTool === 'pdf'} onClick={() => setActiveTool('pdf')} title="PDF Tools" color={ToolColors.pdf.hex} />
              <NavItem id="split" icon={<Scissors />} active={activeTool === 'split'} onClick={() => setActiveTool('split')} title="Image Splitter" color={ToolColors.split.hex} />
              <NavItem id="story" icon={<Clapperboard />} active={activeTool === 'story'} onClick={() => setActiveTool('story')} title="Storyboard" color={ToolColors.story.hex} />
              <NavItem id="stills" icon={<Film />} active={activeTool === 'stills'} onClick={() => setActiveTool('stills')} title="Video Stills" color={ToolColors.stills.hex} />
              <NavItem id="adlinks" icon={<Link2 />} active={activeTool === 'adlinks'} onClick={() => setActiveTool('adlinks')} title="Ad Links" color={ToolColors.adlinks.hex} />
              <NavItem id="addownload" icon={<Download />} active={activeTool === 'addownload'} onClick={() => setActiveTool('addownload')} title="Ad Downloader" color={ToolColors.addownload.hex} />
            </motion.nav>
          )}
        </AnimatePresence>

        <div className="flex-1 relative overflow-hidden flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTool}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full h-full overflow-y-auto p-[var(--spacing-app)] max-lg:pb-[90px]"
            >
              {renderTool()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function NavItem({ id, icon, active, onClick, title, color = '#FFFFFF' }: { id: string, icon: React.ReactNode, active: boolean, onClick: () => void, title: string, color?: string }) {
  return (
    <button
      className={`w-[40px] h-[40px] bg-transparent border border-transparent text-[var(--color-text-muted)] cursor-pointer rounded-lg flex items-center justify-center transition duration-200 relative group max-lg:w-[40px] max-lg:h-[40px] ${active ? 'text-white bg-[#262626]' : 'hover:text-white hover:bg-[#1A1A1A]'}`}
      onClick={onClick}
      title={title}
    >
      <div className="relative z-10">
        {React.cloneElement(icon as React.ReactElement, { 
          strokeWidth: active ? 2 : 1.5,
          className: `w-5 h-5`
        })}
      </div>
    </button>
  );
}
