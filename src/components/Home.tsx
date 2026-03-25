import React from 'react';
import { Image as ImageIcon, FileText, Scissors, Clapperboard, Film, Link2, ArrowRight, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { ToolId } from '../App';

interface HomeProps {
  onSelectTool: (tool: ToolId) => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 400, damping: 30 } }
};

export default function Home({ onSelectTool }: HomeProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-10">
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-white tracking-tight">
          Creative Toolkit
        </h1>
        <p className="text-base md:text-lg text-[var(--color-text-muted)] max-w-2xl mx-auto font-normal">
          Select a tool below to get started.
        </p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1100px] w-full px-4"
      >
        <HomeCard
          title="Logo Resizer"
          description="Resize & Overlay Text"
          icon={<ImageIcon className="w-6 h-6" />}
          onClick={() => onSelectTool('logo')}
        />
        <HomeCard
          title="PDF to Image"
          description="High-Res Extraction"
          icon={<FileText className="w-6 h-6" />}
          onClick={() => onSelectTool('pdf')}
        />
        <HomeCard
          title="Image Splitter"
          description="Grid & Sequence Split"
          icon={<Scissors className="w-6 h-6" />}
          onClick={() => onSelectTool('split')}
        />
        <HomeCard
          title="Storyboard"
          description="Board Creator"
          icon={<Clapperboard className="w-6 h-6" />}
          onClick={() => onSelectTool('story')}
        />
        <HomeCard
          title="Video Stills"
          description="Extract Frames"
          icon={<Film className="w-6 h-6" />}
          onClick={() => onSelectTool('stills')}
        />
        <HomeCard
          title="Ad Links"
          description="Generate Links"
          icon={<Link2 className="w-6 h-6" />}
          onClick={() => onSelectTool('adlinks')}
        />
        <HomeCard
          title="Ad Downloader"
          description="Download Ad Assets"
          icon={<Download className="w-6 h-6" />}
          onClick={() => onSelectTool('addownload')}
        />
      </motion.div>
    </div>
  );
}

function HomeCard({ title, description, icon, onClick }: { title: string, description: string, icon: React.ReactNode, onClick: () => void }) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative bg-[var(--color-bg-panel)] border border-[var(--color-border-color)] rounded-xl p-6 cursor-pointer overflow-hidden transition-colors duration-200 hover:border-[#404040]"
      onClick={onClick}
    >
      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-lg bg-[#262626] flex items-center justify-center text-white transition-colors duration-200 group-hover:bg-white group-hover:text-black">
            {icon}
          </div>
          <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] opacity-0 -translate-x-4 transition duration-200 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-white" />
        </div>
        
        <div>
          <h3 className="font-semibold text-lg mb-1 text-white tracking-tight">
            {title}
          </h3>
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
