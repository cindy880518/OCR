
export interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'idle' | 'processing' | 'completed' | 'error';
  syncStatus: 'idle' | 'syncing' | 'synced' | 'failed';
  extractedText?: string;
  error?: string;
}

export interface OCRResult {
  fileName: string;
  text: string;
  timestamp: string;
}
