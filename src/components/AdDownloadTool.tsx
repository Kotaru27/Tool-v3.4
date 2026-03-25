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

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`Copied: ${text}`);
    } catch (err) {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      showToast(`Copied: ${text}`);
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

    copyToClipboard(ad.finalName);
    window.open(downloadUrl, "downloadWindow", "width=900,height=700,left=200,top=100");

    setAds(prev => prev.map(item => item.adNo === ad.adNo ? { ...item, downloaded: true } : item));
  };
  const copyAllNames = () => {
    const names = ads.map(ad => ad.finalName).join('\n');
    copyToClipboard(names);
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

    copyToClipboard(output);
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

    copyToClipboard(script);
  };

  const pendingAds = ads.filter(a => !a.downloaded);
  const downloadedAds = ads.filter(a => a.downloaded);

  return (
    <div className="w-full bg-zinc-950 text-zinc-100 p-8 font-sans rounded-xl border border-zinc-800">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-bold text-red-500 flex items-center gap-3">
            <FileSpreadsheet className="w-8 h-8" />
            Ad Download Dashboard
          </h1>
          <p className="text-zinc-400 mt-2">Upload your Excel tracking sheet to generate standardized filenames and download assets.</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
          <div className="flex flex-wrap gap-4 items-center">
            <div 
              className="flex-1 min-w-[250px] border-2 border-dashed border-zinc-700 hover:border-red-500 hover:bg-red-500/5 rounded-lg p-6 text-center cursor-pointer transition-colors flex items-center justify-center gap-3 text-zinc-400"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
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
              className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 transition-colors h-[72px]"
            >
              <CheckCircle2 className="w-5 h-5" />
              Build Dashboard
            </button>
          </div>
        </div>

      {ads.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="bg-emerald-500/10 text-emerald-500 px-4 py-2 rounded-full font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {ads.length} Ads Detected
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={copyAllNames}
                className="px-4 py-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" /> Copy All Names
              </button>
              <button 
                onClick={copyBucketTable}
                className="px-4 py-2 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <List className="w-4 h-4" /> Copy Bucket Table
              </button>
              <button 
                onClick={copyScript}
                className="px-4 py-2 border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Code className="w-4 h-4" /> Copy Script
              </button>
            </div>
          </div>
        )}

        {ads.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-lg">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-zinc-950 border-b border-zinc-800">
                  <tr>
                    <th className="p-4 text-zinc-400 font-medium">Ad No</th>
                    <th className="p-4 text-zinc-400 font-medium">Generated Name</th>
                    <th className="p-4 text-zinc-400 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {pendingAds.map(ad => (
                    <tr key={ad.adNo} className="hover:bg-zinc-800/50 transition-colors">
                      <td className="p-4 font-medium">{ad.adNo}</td>
                      <td className="p-4 font-mono text-sm">
                        {ad.cleanName}<span className="text-zinc-500">{ad.ext}</span>
                      </td>
                      <td className="p-4 flex justify-end gap-2">
                        <button 
                          onClick={() => copyToClipboard(ad.finalName)}
                          className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" /> Copy
                        </button>
                        <button 
                          onClick={() => handleDownload(ad)}
                          className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <Download className="w-4 h-4" /> Download
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {downloadedAds.length > 0 && (
                    <>
                      <tr className="bg-zinc-950/50">
                        <td colSpan={3} className="p-4 text-emerald-500 font-medium text-sm uppercase tracking-wider">
                          Downloaded Ads
                        </td>
                      </tr>
                      {downloadedAds.map(ad => (
                        <tr key={ad.adNo} className="bg-zinc-900/50 opacity-60 hover:opacity-100 transition-opacity">
                          <td className="p-4 font-medium">{ad.adNo}</td>
                          <td className="p-4 font-mono text-sm line-through decoration-zinc-600">
                            {ad.cleanName}<span className="text-zinc-500">{ad.ext}</span>
                          </td>
                          <td className="p-4 flex justify-end gap-2">
                            <button 
                              onClick={() => copyToClipboard(ad.finalName)}
                              className="px-4 py-2 border border-zinc-700 hover:bg-zinc-800 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Copy className="w-4 h-4" /> Copy
                            </button>
                            <button 
                              onClick={() => handleDownload(ad)}
                              className="px-4 py-2 bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors cursor-pointer"
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
          <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span className="font-medium">{toast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
}
