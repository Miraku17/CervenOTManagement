import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface ImportStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: string[];
}

interface ImportError {
  error: string;
  details?: string;
}

const ImportStoresModal: React.FC<ImportStoresModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<ImportError | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setSelectedFile(file);
    } else {
      alert('Please select a valid Excel file (.xlsx or .xls)');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleImport = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setImportResult(null);
    setLoadingStage('Reading file...');

    try {
      // Read file as base64
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          setLoadingStage('Uploading file...');
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1]; // Remove data:application/...;base64, prefix

          setLoadingStage('Processing data...');

          // Send to API
          const response = await fetch('/api/stores/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData }),
          });

          setLoadingStage('Importing stores...');
          const data = await response.json();

          if (!response.ok) {
            // Store both error and details for better error display
            setError({
              error: data.error || 'Failed to import stores',
              details: data.details
            });
            setIsLoading(false);
            setLoadingStage('');
            return;
          }

          setLoadingStage('Finalizing...');
          setImportResult(data);

          // If successful, refresh the stores list after a short delay
          setTimeout(() => {
            onSuccess();
          }, 1500);

        } catch (err: any) {
          console.error('Import error:', err);
          setError({
            error: 'Import processing failed',
            details: err.message || 'An unexpected error occurred while processing your import. Please try again.'
          });
        } finally {
          setIsLoading(false);
          setLoadingStage('');
        }
      };

      reader.onerror = () => {
        setError({
          error: 'Failed to read file',
          details: 'The file could not be read from your device. Please try selecting the file again.'
        });
        setIsLoading(false);
        setLoadingStage('');
      };

      reader.readAsDataURL(selectedFile);

    } catch (err: any) {
      console.error('Import error:', err);
      setError({
        error: 'Upload failed',
        details: err.message || 'An unexpected error occurred while uploading the file. Please try again.'
      });
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setIsDragging(false);
    setIsLoading(false);
    setLoadingStage('');
    setImportResult(null);
    setError(null);
    onClose();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 flex items-center justify-center">
              <Upload size={20} className="text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Import Stores from XLSX</h2>
              <p className="text-sm text-slate-400">Upload an Excel file to import multiple stores</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-blue-400 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-200">
                <p className="font-medium mb-2">File Requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                  <li>File format: .xlsx or .xls (max 10MB)</li>
                  <li>Must contain a sheet named <span className="font-semibold text-blue-200">"stores"</span></li>
                  <li>Required column: <span className="font-semibold text-blue-200">Store Code</span></li>
                  <li>Optional columns: STORE NAME, STORE TYPE, Contact No., Mobile Number, STORE ADDRESS, City, Location, Group, Status, Managers (comma-separated)</li>
                </ul>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-xl p-8 transition-all ${
              isDragging
                ? 'border-green-500 bg-green-500/5'
                : selectedFile
                ? 'border-green-500/50 bg-green-500/5'
                : 'border-slate-700 bg-slate-950/50 hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />

            {selectedFile ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={24} className="text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate">{selectedFile.name}</p>
                  <p className="text-sm text-slate-400">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet size={32} className="text-slate-400" />
                </div>
                <p className="text-white font-medium mb-1">
                  {isDragging ? 'Drop your file here' : 'Drag and drop your Excel file here'}
                </p>
                <p className="text-sm text-slate-400 mb-4">or</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
                >
                  Browse Files
                </button>
                <p className="text-xs text-slate-500 mt-3">Supports .xlsx and .xls files</p>
              </div>
            )}
          </div>

          {/* Loading Progress Bar */}
          {isLoading && loadingStage && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Loader2 size={20} className="text-blue-400 animate-spin shrink-0" />
                  <div className="flex-1">
                    <p className="font-medium text-blue-200 text-sm">{loadingStage}</p>
                    <p className="text-xs text-blue-300/60 mt-0.5">Please wait while we process your file...</p>
                  </div>
                </div>
                {/* Animated Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse"
                       style={{
                         width: loadingStage.includes('Reading') ? '25%' :
                                loadingStage.includes('Uploading') ? '50%' :
                                loadingStage.includes('Processing') ? '75%' :
                                loadingStage.includes('Importing') ? '90%' : '100%',
                         transition: 'width 0.5s ease-in-out'
                       }}>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Success Message */}
          {importResult && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-0.5" />
                <div className="text-sm text-green-200 flex-1">
                  <p className="font-medium mb-1">Import Completed!</p>
                  <div className="space-y-1 text-green-300/80">
                    <p>Successfully imported: <span className="font-semibold">{importResult.imported}</span> stores</p>
                    <p>Skipped (no store code): <span className="font-semibold">{importResult.skipped}</span> rows</p>
                    <p>Total rows processed: <span className="font-semibold">{importResult.total}</span></p>
                  </div>
                  {importResult.errors && importResult.errors.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-green-500/20">
                      <p className="font-medium text-yellow-400 mb-1">Warnings:</p>
                      <ul className="list-disc list-inside space-y-0.5 text-xs text-yellow-300/80 max-h-32 overflow-y-auto">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={20} className="text-red-400 shrink-0 mt-0.5" />
                <div className="text-sm text-red-200 flex-1">
                  <p className="font-bold text-red-400 mb-2 text-base">{error.error}</p>
                  {error.details && (
                    <div className="space-y-2">
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                        <p className="text-red-300/90 leading-relaxed">{error.details}</p>
                      </div>
                      <p className="text-xs text-red-400/60 italic">
                        If the problem persists, please check your Excel file format and try again.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importResult ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || isLoading}
            className="px-6 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload size={18} />
                Import Stores
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportStoresModal;
