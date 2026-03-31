import React, { useState } from 'react';
import { Link2, Copy, Trash2, GripVertical } from 'lucide-react';

const SERVERS = {
  aldi: 'https://aldimediaeu.blob.core.windows.net/aldimediaeu/',
  s3: 'https://s3media-ml-eu.surveycenter.com/',
};

export default function AdLinkGen() {
  const [server, setServer] = useState<keyof typeof SERVERS>('aldi');
  const [folder, setFolder] = useState('');
  const [input, setInput] = useState('');
  const [outAds, setOutAds] = useState('');
  const [outStory, setOutStory] = useState('');
  const [copiedAds, setCopiedAds] = useState(false);
  const [copiedStory, setCopiedStory] = useState(false);

  const normFolder = (v: string) => {
    return v.trim().replace(/\s+/g, '/').replace(/\/+/g, '/').replace(/^\/|\/$/g, '') + '/';
  };

  const generate = () => {
    const f = normFolder(folder);
    const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
    const ads: string[] = [];
    const story: string[] = [];

    lines.forEach((name) => {
      const ext = name.split('.').pop()?.toLowerCase();
      const url = SERVERS[server] + f + name;

      if (ext === 'jpg' || ext === 'png') {
        ads.push(`<img src="${url}" class="zoomImage" style="max-width:80%">`);
        story.push(`<img src="${url}" class="zoomImage" style="max-height:280px">`);
      } else if (ext === 'mp4') {
        ads.push(url);
        story.push(`<img src="${SERVERS[server] + f + name.replace('.mp4', '.jpg')}" class="zoomImage" style="max-height:280px">`);
      } else if (ext === 'mp3') {
        ads.push(url);
        story.push(name);
      }
    });

    setOutAds(ads.join('\n'));
    setOutStory(story.join('\n'));
  };

  const copy = (text: string, type: 'ads' | 'story') => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'ads') {
        setCopiedAds(true);
        setTimeout(() => setCopiedAds(false), 2000);
      } else {
        setCopiedStory(true);
        setTimeout(() => setCopiedStory(false), 2000);
      }
    });
  };

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <Link2 className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Ad Link Gen</h2>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-[24px] items-start">
        <div className="flex flex-col gap-[20px] sticky top-0 overflow-y-auto max-h-[calc(100vh-100px)] pr-[5px]">
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Server</span>
            <select className="liquid-input" value={server} onChange={(e) => setServer(e.target.value as keyof typeof SERVERS)}>
              <option value="aldi">ALDI Blob</option>
              <option value="s3">S3 Media</option>
            </select>
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Path</span>
            <input className="liquid-input" placeholder="Folder/Path" value={folder} onChange={(e) => setFolder(e.target.value)} />
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <span className="label-header">Filenames</span>
            <textarea className="liquid-input terminal-input min-h-[200px]" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          
          <button className="liquid-btn active-mode w-full" onClick={generate}>Generate</button>
        </div>
        
        <div className="flex flex-col gap-[24px]">
          <div className="glass-panel flex flex-col gap-[16px]">
            <div className="flex justify-between items-center">
              <span className="label-header mb-0">Ad Exposure</span>
              <button className="liquid-btn h-[28px] text-[0.75rem] px-[12px]" onClick={() => copy(outAds, 'ads')}>{copiedAds ? 'Copied!' : 'Copy'}</button>
            </div>
            <textarea 
              className="liquid-input terminal-input min-h-[150px]" 
              readOnly 
              value={outAds} 
              rows={Math.max(5, outAds.split('\n').length)}
            />
          </div>
          
          <div className="glass-panel flex flex-col gap-[16px]">
            <div className="flex justify-between items-center">
              <span className="label-header mb-0">Storyboard Code</span>
              <button className="liquid-btn h-[28px] text-[0.75rem] px-[12px]" onClick={() => copy(outStory, 'story')}>{copiedStory ? 'Copied!' : 'Copy'}</button>
            </div>
            <textarea 
              className="liquid-input terminal-input min-h-[150px]" 
              readOnly 
              value={outStory} 
              rows={Math.max(5, outStory.split('\n').length)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
