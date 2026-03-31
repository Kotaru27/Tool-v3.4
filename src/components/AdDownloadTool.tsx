import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, Download, Copy, CheckCircle2, FileSpreadsheet, List, Code } from 'lucide-react';

interface AdItem {
  adNo: string;
  adType: string;
  link: string;
  displayText: string;
  finalName: string;
  ext: string;
  cleanName: string;
  downloaded: boolean;
}

export default function AdDownloadTool() {
  const [file, setFile] = useState<File | null>(null);
  const [ads, setAds] = useState<AdItem[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 3000);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const processExcel = () => {
    if (!file) {
      showToast("Please upload an Excel file first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:C1');

      const parsedAds: AdItem[] = [];

      for (let r = 1; r <= range.e.r; r++) {
        const adCell = sheet[XLSX.utils.encode_cell({ r, c: 0 })];
        const linkCell = sheet[XLSX.utils.encode_cell({ r, c: 1 })];
        const typeCell = sheet[XLSX.utils.encode_cell({ r, c: 2 })];

        if (!typeCell || !adCell) continue;

        const adNo = String(adCell.v);
        const adType = String(typeCell.v);
        
        let link = "";
        if (linkCell?.l) link = linkCell.l.Target;
        else if (linkCell?.v) link = String(linkCell.v);

        const linkString = link.trim();
        const displayText = (linkCell?.v || "").toString().trim();

        // Extension extraction logic
        let extRegex = /\.(mp4|mov|avi|mkv|webm|flv|wmv|mp3|wav|ogg|m4a|aac|flac|jpg|jpeg|png|gif|webp|svg|bmp)\b/i;
        let extMatch = displayText.match(extRegex) || linkString.match(extRegex);

        if (!extMatch) {
          extMatch = displayText.match(/\.([a-zA-Z0-9]{2,4})$/i);
          if (!extMatch) {
            try {
              let urlObj = new URL(linkString);
              extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]{2,4})$/i);
            } catch (err) {
              extMatch = linkString.match(/\.([a-zA-Z0-9]{2,4})$/i);
            }
          }
        }

        let ext = extMatch ? extMatch[0].toLowerCase() : "";
        const ignoredExts = ['.com', '.org', '.net', '.co', '.io', '.de', '.uk', '.us', '.info', '.biz', '.html', '.htm', '.php', '.asp', '.aspx', '.jsp'];
        if (ignoredExts.includes(ext)) {
          ext = "";
        }

        let clean = displayText
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/ß/g, "ss");

        if (ext) {
          if (clean.toLowerCase().endsWith(ext)) {
            clean = clean.substring(0, clean.length - ext.length);
          }
        } else {
          let typeLower = adType.toLowerCase();
          if (typeLower.includes('print') || typeLower.includes('ooh') || typeLower.includes('img') || typeLower.includes('pic')) {
            ext = '.jpg';
          } else if (typeLower.includes('radio') || typeLower.includes('audio') || typeLower.includes('podcast')) {
            ext = '.mp3';
          } else {
            ext = '.mp4';
          }
        }

        clean = clean
          .replace(/[^a-zA-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        let typeNumberMatch = adType.match(/\d+/);
        let typeNumber = typeNumberMatch ? typeNumberMatch[0] : "";
        let typeBase = adType.replace(/\d+/g, "").trim();
        let typeBaseClean = typeBase
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        if (typeNumber) {
          let regex = new RegExp(typeBaseClean, "i");
          clean = clean.replace(regex, typeBaseClean + typeNumber);
        }

        const finalName = `AD${adNo}_${clean}${ext}`;

        parsedAds.push({
          adNo,
          adType,
          link: linkString,
          displayText,
          finalName,
          cleanName: `AD${adNo}_${clean}`,
          ext,
          downloaded: false
        });
      }

      setAds(parsedAds);
      showToast("Dashboard built successfully!");
    };
    reader.readAsArrayBuffer(file);
  };

const copyToClipboard = async (text: string, successMessage?: string) => {
    // Use the custom message, or fallback to a truncated version of the text if it's too long
    const message = successMessage || `Copied: ${text.length > 50 ? text.substring(0, 50) + '...' : text}`;
    try {
      await navigator.clipboard.writeText(text);
      showToast(message);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast(message);
    }
  };

  const handleDownload = (ad: AdItem) => {
    let downloadUrl = ad.link;
    if (!downloadUrl.includes("download=")) {
      if (downloadUrl.includes("?")) {
        downloadUrl = downloadUrl.split("?")[0] + "?download=1";
      } else {
        downloadUrl += "?download=1";
      }
    }

    copyToClipboard(ad.finalName, `Copied: ${ad.finalName}`);
    window.open(downloadUrl, "downloadWindow", "width=900,height=700,left=200,top=100");

    setAds(prev => prev.map(item => item.adNo === ad.adNo ? { ...item, downloaded: true } : item));
  };
  const copyAllNames = () => {
    const names = ads.map(ad => ad.finalName).join('\n');
    copyToClipboard(names, `All ${ads.length} names copied to clipboard!`);
  };

const getBucketData = () => {
    if (!file) return Promise.resolve([]);
    
    return new Promise<any[]>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length < 2) {
          resolve([]);
          return;
        }
        
        const sheet = workbook.Sheets[workbook.SheetNames[1]];
        if (!sheet) {
          resolve([]);
          return;
        }
        
        const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
        let rows = [];
        
        const adTypeMap: Record<string, string> = {};
        ads.forEach(ad => {
          const normalizedType = ad.adType.toString().replace(/\s+/g, '').replace(/_/g, '').toUpperCase();
          adTypeMap[normalizedType] = ad.adNo;
        });

        for (let r = 1; r <= range.e.r; r++) {
          let bucketCell = sheet[XLSX.utils.encode_cell({ r: r, c: 0 })];
          if (!bucketCell) continue;

          let bucket = bucketCell.v.toString().trim();
          let bucketAds = [];

          for (let c = 1; c <= range.e.c; c++) {
            let adCell = sheet[XLSX.utils.encode_cell({ r: r, c: c })];
            if (!adCell || !adCell.v) continue;

            let name = adCell.v.toString().replace(/\s+/g, '').replace(/_/g, '').toUpperCase();
            let adNo = adTypeMap[name];

            if (adNo) bucketAds.push(adNo);
          }

          if (bucketAds.length > 0) {
            rows.push({ bucket: bucket, ads: bucketAds });
          }
        }
        resolve(rows);
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const copyBucketTable = async () => {
    const rows = await getBucketData();
    if (rows.length === 0) {
      showToast("No bucket data found on Sheet 2.");
      return;
    }

    let output = "Bucket\tAds\n";
    rows.forEach(r => {
      output += r.bucket + "\t" + r.ads.map((a: string) => "'" + a + "'").join(",") + "\n";
    });

        copyToClipboard(output, "Bucket table copied to clipboard!");
  };

  const copyScript = async () => {
    const rows = await getBucketData();
    if (rows.length === 0) {
      showToast("No bucket data found on Sheet 2.");
      return;
    }

    let script = "var s = set()\n\n";
    rows.forEach(r => {
      script += "// Bucket " + r.bucket + "\n";
      script += "if (f('cq42000').any('" + r.bucket + "')) {\n";
      script += "    s = s.union(set(" + r.ads.map((a: string) => "'" + a + "'").join(",") + "))\n";
      script += "}\n\n";
    });

     copyToClipboard(script, "Script copied to clipboard!");
  };

  const pendingAds = ads.filter(a => !a.downloaded);
  const downloadedAds = ads.filter(a => a.downloaded);

  return (
    <div className="flex flex-col relative">
      <div className="flex items-center gap-[10px] mb-[20px] pb-[15px] border-b border-[var(--color-border-color)]">
        <FileSpreadsheet className="w-5 h-5 text-white" />
        <h2 className="m-0 text-[1.1rem] font-semibold flex-1 leading-none text-white tracking-tight">Ad Download Dashboard</h2>
      </div>
      <p className="text-[var(--color-text-muted)] mt-[-10px] mb-[20px] text-sm">Upload your Excel tracking sheet to generate standardized filenames and download assets.</p>

      <div className="glass-panel flex flex-col gap-[16px] mb-[24px]">
        <div className="flex flex-wrap gap-4 items-center">
          <div 
            className="drop-zone flex-1 min-w-[250px] flex items-center justify-center gap-3"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('drag-over');
              handleDrop(e as unknown as React.DragEvent<HTMLDivElement>);
            }}
          >
            <Upload className="w-5 h-5" />
            <span>{file ? file.name : "Click or drag Excel file here (.xlsx)"}</span>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange} 
            />
          </div>
          <button 
            onClick={processExcel}
            className="liquid-btn active-mode h-[72px] px-6"
          >
            <CheckCircle2 className="w-5 h-5" />
            Build Dashboard
          </button>
        </div>
      </div>

      {ads.length > 0 && (
        <div className="glass-panel flex items-center justify-between gap-4 flex-wrap mb-[24px]">
          <div className="text-[var(--color-success)] px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2 bg-[rgba(16,185,129,0.1)]">
            <CheckCircle2 className="w-4 h-4" />
            {ads.length} Ads Detected
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={copyAllNames}
              className="liquid-btn"
            >
              <Copy className="w-4 h-4" /> Copy All Names
            </button>
            <button 
              onClick={copyBucketTable}
              className="liquid-btn"
            >
              <List className="w-4 h-4" /> Copy Bucket Table
            </button>
            <button 
              onClick={copyScript}
              className="liquid-btn border-[var(--color-success)] text-[var(--color-success)] hover:bg-[rgba(16,185,129,0.1)]"
            >
              <Code className="w-4 h-4" /> Copy Script
            </button>
          </div>
        </div>
      )}

      {ads.length > 0 && (
        <div className="glass-panel overflow-hidden p-0 mb-[24px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-[var(--color-bg-main)] border-b border-[var(--color-border-color)]">
                <tr>
                  <th className="p-4 text-[var(--color-text-muted)] font-medium text-sm">Ad No</th>
                  <th className="p-4 text-[var(--color-text-muted)] font-medium text-sm">Generated Name</th>
                  <th className="p-4 text-[var(--color-text-muted)] font-medium text-sm text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border-color)]">
                {pendingAds.map(ad => (
                  <tr key={ad.adNo} className="hover:bg-[var(--color-bg-main)] transition-colors">
                    <td className="p-4 font-medium text-sm">{ad.adNo}</td>
                    <td className="p-4 font-mono text-sm">
                      {ad.cleanName}<span className="text-[var(--color-text-muted)]">{ad.ext}</span>
                    </td>
                    <td className="p-4 flex justify-end gap-2">
                      <button 
                        onClick={() => copyToClipboard(ad.finalName, `Copied: ${ad.finalName}`)}
                        className="liquid-btn"
                      >
                        <Copy className="w-4 h-4" /> Copy
                      </button>
                      <button 
                        onClick={() => handleDownload(ad)}
                        className="liquid-btn active-mode"
                      >
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </td>
                  </tr>
                ))}
                
                {downloadedAds.length > 0 && (
                  <>
                    <tr className="bg-[var(--color-bg-main)]">
                      <td colSpan={3} className="p-4 text-[var(--color-success)] font-medium text-sm uppercase tracking-wider">
                        Downloaded Ads
                      </td>
                    </tr>
                    {downloadedAds.map(ad => (
                      <tr key={ad.adNo} className="bg-[var(--color-bg-main)] opacity-60 hover:opacity-100 transition-opacity">
                        <td className="p-4 font-medium text-sm">{ad.adNo}</td>
                        <td className="p-4 font-mono text-sm line-through decoration-[var(--color-text-muted)]">
                          {ad.cleanName}<span className="text-[var(--color-text-muted)]">{ad.ext}</span>
                        </td>
                        <td className="p-4 flex justify-end gap-2">
                          <button 
                            onClick={() => copyToClipboard(ad.finalName, `Copied: ${ad.finalName}`)}
                            className="liquid-btn"
                          >
                            <Copy className="w-4 h-4" /> Copy
                          </button>
                          <button 
                            onClick={() => handleDownload(ad)}
                            className="liquid-btn border-[var(--color-success)] text-[var(--color-success)] hover:bg-[rgba(16,185,129,0.1)]"
                          >
                            <Download className="w-4 h-4" /> Redownload
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 bg-[var(--color-success)] text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
}
