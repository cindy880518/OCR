
import React, { useState, useEffect, useRef } from 'react';
import { ImageFile } from './types';
import { performOCR, fileToBase64 } from './services/gemini';
import { 
  CloudArrowUpIcon, 
  TrashIcon, 
  PlayIcon, 
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
  TableCellsIcon,
  CloudIcon,
  ArrowPathRoundedSquareIcon,
  ClipboardDocumentCheckIcon,
  ListBulletIcon,
  Squares2X2Icon,
  DocumentDuplicateIcon,
  InformationCircleIcon,
  CodeBracketIcon
} from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [sheetUrl, setSheetUrl] = useState(() => localStorage.getItem('google_sheet_url') || '');
  const [autoSync, setAutoSync] = useState(() => localStorage.getItem('auto_sync') === 'true');
  const [urlError, setUrlError] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const GAS_CODE = `function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([data.timestamp, data.fileName, data.text]);
  return ContentService.createTextOutput("Success");
}`;

  useEffect(() => {
    localStorage.setItem('google_sheet_url', sheetUrl);
    if (sheetUrl.trim()) setUrlError(false);
  }, [sheetUrl]);

  useEffect(() => {
    localStorage.setItem('auto_sync', String(autoSync));
  }, [autoSync]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files) as File[];
      const newFiles = filesArray.map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: URL.createObjectURL(file),
        status: 'idle' as const,
        syncStatus: 'idle' as const,
      }));
      setImages((prev) => [...prev, ...newFiles]);
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((img) => img.id !== id);
    });
  };

  const syncToSheet = async (img: ImageFile) => {
    const targetUrl = sheetUrl.trim();
    if (!targetUrl) {
      setUrlError(true);
      setShowSettings(true);
      return;
    }
    
    setImages(prev => prev.map(item => 
      item.id === img.id ? { ...item, syncStatus: 'syncing' } : item
    ));

    try {
      // We use text/plain and no-cors to bypass CORS issues with Google Apps Script
      // This means we won't get a response back, but the data will be sent successfully.
      await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          fileName: img.file.name,
          text: img.extractedText,
          timestamp: new Date().toLocaleString()
        })
      });

      setImages(prev => prev.map(item => 
        item.id === img.id ? { ...item, syncStatus: 'synced' } : item
      ));
    } catch (err) {
      console.error("Sync failed:", err);
      setImages(prev => prev.map(item => 
        item.id === img.id ? { ...item, syncStatus: 'failed' } : item
      ));
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  };

  const copyAllForExcel = async () => {
    const completed = images.filter(img => img.status === 'completed');
    if (completed.length === 0) return;
    const header = "檔名\t擷取內容\t處理時間\n";
    const body = completed.map(img => 
      `${img.file.name}\t${(img.extractedText || "").replace(/\n/g, ' ')}\t${new Date().toLocaleString()}`
    ).join("\n");
    const success = await copyToClipboard(header + body);
    if (success) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const processImage = async (img: ImageFile) => {
    setImages(prev => prev.map(item => 
      item.id === img.id ? { ...item, status: 'processing', error: undefined } : item
    ));

    try {
      const base64 = await fileToBase64(img.file);
      const text = await performOCR(base64, img.file.type);
      
      const updatedImg: ImageFile = { 
        ...img, 
        status: 'completed', 
        extractedText: text,
        syncStatus: 'idle'
      };

      setImages(prev => prev.map(item => 
        item.id === img.id ? updatedImg : item
      ));

      // Trigger automatic sync if enabled
      if (autoSync && sheetUrl.trim()) {
        await syncToSheet(updatedImg);
      }
    } catch (err: any) {
      setImages(prev => prev.map(item => 
        item.id === img.id ? { ...item, status: 'error', error: err.message } : item
      ));
    }
  };

  const processAll = async () => {
    if (images.length === 0 || isProcessing) return;
    setIsProcessing(true);
    const pendingImages = images.filter(img => img.status !== 'completed');
    for (const img of pendingImages) {
      await processImage(img);
    }
    setIsProcessing(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-indigo-200 shadow-lg">
              <TableCellsIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none text-slate-900">OCR 試算表助手</h1>
              <span className="text-[10px] text-indigo-500 font-bold uppercase tracking-widest">Auto-Sync Enabled</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-all ${showSettings ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
              title="自動同步設定"
            >
              <Cog6ToothIcon className="h-6 w-6" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md transition-all active:scale-95"
            >
              上傳圖片
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} multiple accept="image/*" className="hidden" />
          </div>
        </div>
      </header>

      {showSettings && (
        <div className="bg-white border-b border-slate-200 animate-in slide-in-from-top duration-300">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div className="space-y-1">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <CloudIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Google Sheets 自動傳送設定
                </h2>
                <p className="text-sm text-slate-500">當辨識完成時，文字將自動寫入您的試算表。</p>
              </div>
              <label className="flex items-center cursor-pointer bg-slate-100 px-4 py-2 rounded-xl">
                <span className="mr-3 text-sm font-bold text-slate-700">啟用自動同步</span>
                <div className="relative">
                  <input type="checkbox" className="sr-only" checked={autoSync} onChange={() => setAutoSync(!autoSync)} />
                  <div className={`block w-10 h-6 rounded-full transition-colors ${autoSync ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                  <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${autoSync ? 'transform translate-x-4' : ''}`}></div>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center">
                  <InformationCircleIcon className="h-4 w-4 mr-1" />
                  步驟 1：部署腳本
                </h3>
                <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <li>開啟 Google 試算表。</li>
                  <li>點擊 <b>擴充功能 > Apps Script</b> (若無法連線請改用無痕視窗)。</li>
                  <li>貼入右方的程式碼並儲存。</li>
                  <li>點擊 <b>部署 > 新部署</b>。</li>
                  <li>類型選「網頁應用程式」，將「誰可以存取」設為「所有人」。</li>
                </ol>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-700">步驟 2：貼上網址</h3>
                  <input
                    type="text"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="貼上「網頁應用程式」網址..."
                    className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition-all ${urlError ? 'border-red-500 ring-1 ring-red-100' : 'border-slate-300'}`}
                  />
                  {urlError && <p className="text-[10px] text-red-500 font-bold">⚠️ 請先輸入網址後再試一次！</p>}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center">
                    <CodeBracketIcon className="h-4 w-4 mr-1" />
                    需貼上的腳本代碼
                  </h3>
                  <button 
                    onClick={() => copyToClipboard(GAS_CODE)}
                    className="text-[10px] bg-slate-200 hover:bg-slate-300 px-2 py-1 rounded font-bold transition-all"
                  >
                    點我複製
                  </button>
                </div>
                <pre className="text-[10px] bg-slate-900 text-indigo-300 p-4 rounded-xl overflow-x-auto h-48 scrollbar-hide font-mono leading-relaxed">
                  {GAS_CODE}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh]">
            <div onClick={() => fileInputRef.current?.click()} className="group border-4 border-dashed border-slate-200 bg-white rounded-[40px] p-20 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/20 transition-all">
              <div className="p-8 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform mb-8">
                <CloudArrowUpIcon className="h-20 w-20 text-indigo-600" />
              </div>
              <p className="text-3xl font-black text-slate-800">批次辨識圖片</p>
              <p className="text-slate-400 mt-4 text-center max-w-md text-lg">
                將您的照片拖進來，AI 會自動掃描文字，並依照設定自動傳送到 Google Sheets。
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl">
                  <button onClick={() => setViewMode('grid')} className={`p-2 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><Squares2X2Icon className="h-5 w-5"/></button>
                  <button onClick={() => setViewMode('table')} className={`p-2 rounded-xl transition-all ${viewMode === 'table' ? 'bg-white shadow text-indigo-600' : 'text-slate-400'}`}><ListBulletIcon className="h-5 w-5"/></button>
                </div>
                <span className="text-sm font-black text-slate-700">{images.length} 張待處理</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={processAll}
                  disabled={isProcessing || images.every(img => img.status === 'completed')}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-2xl text-sm font-bold shadow-xl shadow-indigo-100 flex items-center space-x-2 transition-all active:scale-95"
                >
                  {isProcessing ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PlayIcon className="h-5 w-5" />}
                  <span>{isProcessing ? '批次執行中...' : '開始掃描並自動傳送'}</span>
                </button>
                <button
                  onClick={copyAllForExcel}
                  className={`px-6 py-3 rounded-2xl text-sm font-bold border transition-all flex items-center space-x-2 ${copyFeedback ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                >
                  {copyFeedback ? <ClipboardDocumentCheckIcon className="h-5 w-5" /> : <DocumentDuplicateIcon className="h-5 w-5" />}
                  <span>{copyFeedback ? '已複製！' : '手動複製全部'}</span>
                </button>
                <button onClick={() => setImages([])} className="p-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"><TrashIcon className="h-6 w-6" /></button>
              </div>
            </div>

            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {images.map((img) => (
                  <div key={img.id} className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all group flex flex-col h-[460px] relative">
                    <div className="h-44 relative bg-slate-100 flex-shrink-0">
                      <img src={img.previewUrl} alt={img.file.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                      
                      <div className="absolute top-4 left-4 flex gap-2">
                        {img.status === 'completed' && (
                          <span className="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                            <CheckCircleIcon className="h-3 w-3" /> 已完成
                          </span>
                        )}
                        {img.syncStatus === 'synced' && (
                          <span className="bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                            <CloudIcon className="h-3 w-3" /> 已傳送
                          </span>
                        )}
                      </div>

                      {img.status === 'processing' && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center flex-col z-20">
                          <ArrowPathIcon className="h-10 w-10 text-indigo-600 animate-spin" />
                          <p className="text-[10px] font-black text-indigo-600 mt-2 uppercase tracking-widest">Scanning</p>
                        </div>
                      )}

                      <button onClick={() => removeImage(img.id)} className="absolute top-4 right-4 bg-white/90 p-2 rounded-full text-slate-400 hover:text-red-500 shadow transition-all opacity-0 group-hover:opacity-100">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xs font-black text-slate-400 truncate mb-3 uppercase tracking-widest">{img.file.name}</h3>
                      <div className="flex-1 overflow-y-auto bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed scrollbar-hide mb-4 italic font-medium">
                        {img.status === 'completed' ? img.extractedText : (
                          <div className="flex flex-col items-center justify-center h-full space-y-2 opacity-30">
                            <DocumentDuplicateIcon className="h-6 w-6" />
                            <span className="text-[10px] font-bold">等待辨識中</span>
                          </div>
                        )}
                      </div>
                      
                      {img.status === 'completed' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => syncToSheet(img)}
                            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center space-x-2 border ${img.syncStatus === 'synced' ? 'bg-blue-50 text-blue-600 border-blue-200' : img.syncStatus === 'failed' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-indigo-50 hover:text-indigo-600'}`}
                          >
                            <CloudIcon className="h-4 w-4" />
                            <span>{img.syncStatus === 'synced' ? '成功傳送' : img.syncStatus === 'syncing' ? '傳送中...' : '傳送至 Sheet'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Preview</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Filename</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Sync Status</th>
                      <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {images.map(img => (
                      <tr key={img.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-6"><img src={img.previewUrl} className="h-14 w-14 rounded-2xl object-cover shadow-sm" alt="p"/></td>
                        <td className="p-6"><p className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{img.file.name}</p></td>
                        <td className="p-6">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${img.syncStatus === 'synced' ? 'bg-blue-100 text-blue-600' : img.syncStatus === 'syncing' ? 'bg-yellow-100 text-yellow-600 animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
                            {img.syncStatus === 'synced' ? 'Synced' : img.syncStatus === 'syncing' ? 'Syncing...' : 'Idle'}
                          </span>
                        </td>
                        <td className="p-6 text-right space-x-2">
                          <button onClick={() => syncToSheet(img)} className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all" title="傳送"><CloudIcon className="h-6 w-6"/></button>
                          <button onClick={() => removeImage(img.id)} className="p-3 text-slate-300 hover:text-red-500 rounded-2xl transition-all"><TrashIcon className="h-6 w-6"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-10 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-300 text-[10px] font-black tracking-[0.3em] uppercase">
            Designed for Instant Excel Synchronization • 2024
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
