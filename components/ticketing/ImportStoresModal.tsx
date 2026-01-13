import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, AlertTriangle, FileCheck, ArrowRight } from 'lucide-react';

interface ImportStoresModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface ImportResult {
  imported: number;
  updated?: number;
  created?: number;
  skipped: number;
  total: number;
  errors?: string[];
  hasMoreErrors?: boolean;
}

interface ImportError {
  error: string;
  details?: string;
  code?: string;
  suggestion?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

interface ValidationResult {
  valid: boolean;
  totalRows: number;
  validRows: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  preview: any[];
  duplicateStoreCodes: string[];
}

const ImportStoresModal: React.FC<ImportStoresModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [stage, setStage] = useState<'upload' | 'validation' | 'import' | 'complete'>('upload');
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
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

  const handleValidate = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setValidationResult(null);
    setLoadingStage('Validating file...');

    try {
      // Read file as base64
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1];

          setLoadingStage('Checking data format...');

          const response = await fetch('/api/stores/validate-import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData }),
          });

          const data = await response.json();

          if (!response.ok) {
            setError({
              error: data.error || 'Validation failed',
              details: data.details
            });
            setIsLoading(false);
            setLoadingStage('');
            return;
          }

          setValidationResult(data);
          setStage('validation');

        } catch (err: any) {
          console.error('Validation error:', err);
          setError({
            error: 'Validation processing failed',
            details: err.message || 'An unexpected error occurred while validating your file. Please try again.'
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
      console.error('Validation error:', err);
      setError({
        error: 'Validation failed',
        details: err.message || 'An unexpected error occurred while validating the file. Please try again.'
      });
      setIsLoading(false);
      setLoadingStage('');
    }
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
          setStage('complete');

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
    setStage('upload');
    setValidationResult(null);
    setImportResult(null);
    setError(null);
    onClose();
  };

  const handleBackToUpload = () => {
    setStage('upload');
    setValidationResult(null);
    setError(null);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-xl sm:rounded-2xl w-full max-w-4xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 flex items-center justify-center flex-shrink-0">
              <Upload size={18} className="text-green-400 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base sm:text-xl font-bold text-white truncate">Import Stores from XLSX</h2>
              <p className="text-xs sm:text-sm text-slate-400 hidden sm:block">Upload an Excel file to import multiple stores</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5 sm:w-5 sm:h-5" />
              <div className="text-xs sm:text-sm text-blue-200 min-w-0 flex-1">
                <p className="font-medium mb-2">File Requirements:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-300/80">
                  <li>File format: .xlsx or .xls (max <span className="font-semibold">50MB</span>)</li>
                  <li>Must contain a sheet named <span className="font-semibold text-blue-200">"stores"</span></li>
                  <li>Required column: <span className="font-semibold text-blue-200">Store Code</span></li>
                  <li className="hidden sm:list-item">Optional columns: STORE NAME, STORE TYPE, Contact No., Mobile Number, STORE ADDRESS, City, Location, Group, Status, Managers</li>
                  <li className="sm:hidden">See template for optional columns</li>
                  <li className="text-blue-200 font-medium">✓ Supports 1000+ rows</li>
                </ul>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-lg sm:rounded-xl p-4 sm:p-8 transition-all ${
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
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center shrink-0">
                  <FileSpreadsheet size={20} className="text-green-400 sm:w-6 sm:h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white truncate text-sm sm:text-base">{selectedFile.name}</p>
                  <p className="text-xs sm:text-sm text-slate-400">{formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                >
                  <X size={16} className="sm:w-[18px] sm:h-[18px]" />
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <FileSpreadsheet size={24} className="text-slate-400 sm:w-8 sm:h-8" />
                </div>
                <p className="text-white font-medium mb-1 text-sm sm:text-base px-2">
                  {isDragging ? 'Drop your file here' : <><span className="hidden sm:inline">Drag and drop your Excel file here</span><span className="sm:hidden">Select your Excel file</span></>}
                </p>
                <p className="text-xs sm:text-sm text-slate-400 mb-3 sm:mb-4 hidden sm:block">or</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium text-sm sm:text-base w-full sm:w-auto"
                >
                  Browse Files
                </button>
                <p className="text-xs text-slate-500 mt-2 sm:mt-3">Supports .xlsx and .xls files (up to 50MB)</p>
              </div>
            )}
          </div>

          {/* Loading Progress Bar */}
          {isLoading && loadingStage && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg sm:rounded-xl p-3 sm:p-4">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Loader2 size={18} className="text-blue-400 animate-spin shrink-0 sm:w-5 sm:h-5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-blue-200 text-xs sm:text-sm truncate">{loadingStage}</p>
                    <p className="text-xs text-blue-300/60 mt-0.5 hidden sm:block">Please wait while we process your file...</p>
                  </div>
                </div>
                {/* Animated Progress Bar */}
                <div className="w-full bg-slate-800/50 rounded-full h-1.5 sm:h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full animate-pulse"
                       style={{
                         width: loadingStage.includes('Reading') || loadingStage.includes('Validating') ? '25%' :
                                loadingStage.includes('Uploading') || loadingStage.includes('Checking') ? '50%' :
                                loadingStage.includes('Processing') ? '75%' :
                                loadingStage.includes('Importing') ? '90%' : '100%',
                         transition: 'width 0.5s ease-in-out'
                       }}>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {validationResult && stage === 'validation' && (
            <div className="space-y-3 sm:space-y-4">
              {/* Summary */}
              <div className={`border rounded-lg sm:rounded-xl p-3 sm:p-4 ${
                validationResult.valid
                  ? 'bg-green-500/10 border-green-500/20'
                  : 'bg-amber-500/10 border-amber-500/20'
              }`}>
                <div className="flex items-start gap-2 sm:gap-3">
                  {validationResult.valid ? (
                    <FileCheck size={18} className="text-green-400 shrink-0 mt-0.5 sm:w-5 sm:h-5" />
                  ) : (
                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5 sm:w-5 sm:h-5" />
                  )}
                  <div className="text-sm flex-1 min-w-0">
                    <p className="font-bold text-sm sm:text-base mb-2">
                      {validationResult.valid ? 'Validation Passed!' : 'Validation Found Issues'}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                      <p className="text-slate-200">Total: <span className="font-semibold">{validationResult.totalRows}</span></p>
                      <p className="text-green-300">Valid: <span className="font-semibold">{validationResult.validRows}</span></p>
                      {validationResult.errors.length > 0 && (
                        <p className="text-red-300">Errors: <span className="font-semibold">{validationResult.errors.length}</span></p>
                      )}
                      {validationResult.warnings.length > 0 && (
                        <p className="text-amber-300">Warnings: <span className="font-semibold">{validationResult.warnings.length}</span></p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Errors */}
              {validationResult.errors.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg sm:rounded-xl overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-red-500/20 bg-red-500/5">
                    <p className="font-bold text-red-400 text-sm sm:text-base flex items-center gap-2">
                      <AlertCircle size={16} className="sm:w-5 sm:h-5" />
                      Errors ({validationResult.errors.length})
                    </p>
                    <p className="text-xs text-red-300/60 mt-1">Fix these errors before importing</p>
                  </div>
                  <div className="max-h-48 sm:max-h-64 overflow-y-auto p-3 sm:p-4">
                    <ul className="space-y-2">
                      {validationResult.errors.slice(0, 20).map((err, idx) => (
                        <li key={idx} className="text-xs sm:text-sm text-red-300 bg-red-500/5 p-2 sm:p-3 rounded-lg border border-red-500/10">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                            <span className="font-semibold text-red-400 shrink-0">
                              Row {err.row}:
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-red-300">{err.field}</span>
                              <span className="text-red-300/80"> - {err.message}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                      {validationResult.errors.length > 20 && (
                        <li className="text-xs sm:text-sm text-red-400 italic text-center py-2">
                          ... and {validationResult.errors.length - 20} more errors
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {validationResult.warnings.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg sm:rounded-xl overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-amber-500/20 bg-amber-500/5">
                    <p className="font-bold text-amber-400 text-sm sm:text-base flex items-center gap-2">
                      <AlertTriangle size={16} className="sm:w-5 sm:h-5" />
                      Warnings ({validationResult.warnings.length})
                    </p>
                    <p className="text-xs text-amber-300/60 mt-1">These won't prevent import but should be reviewed</p>
                  </div>
                  <div className="max-h-40 sm:max-h-48 overflow-y-auto p-3 sm:p-4">
                    <ul className="space-y-2">
                      {validationResult.warnings.slice(0, 10).map((warn, idx) => (
                        <li key={idx} className="text-xs sm:text-sm text-amber-300 bg-amber-500/5 p-2 sm:p-3 rounded-lg border border-amber-500/10">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2">
                            <span className="font-semibold text-amber-400 shrink-0">
                              Row {warn.row}:
                            </span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium text-amber-300">{warn.field}</span>
                              <span className="text-amber-300/80"> - {warn.message}</span>
                            </div>
                          </div>
                        </li>
                      ))}
                      {validationResult.warnings.length > 10 && (
                        <li className="text-xs sm:text-sm text-amber-400 italic text-center py-2">
                          ... and {validationResult.warnings.length - 10} more warnings
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {/* Preview */}
              {validationResult.preview.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-lg sm:rounded-xl overflow-hidden">
                  <div className="p-3 sm:p-4 border-b border-slate-700 bg-slate-800/80">
                    <p className="font-bold text-slate-200 text-sm sm:text-base">Data Preview (First 10 Rows)</p>
                    <p className="text-xs text-slate-400 mt-1">Review the data before importing</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-900 text-slate-400">
                        <tr>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap">Row</th>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap">Store Code</th>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap hidden sm:table-cell">Store Name</th>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap hidden md:table-cell">Type</th>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap hidden lg:table-cell">City</th>
                          <th className="p-2 sm:p-3 text-left font-semibold whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-300">
                        {validationResult.preview.map((row, idx) => (
                          <tr key={idx} className="border-t border-slate-700 hover:bg-slate-800/50 transition-colors">
                            <td className="p-2 sm:p-3 text-slate-400">{row.rowNumber}</td>
                            <td className="p-2 sm:p-3 font-mono text-blue-300 font-medium">{row.storeCode}</td>
                            <td className="p-2 sm:p-3 hidden sm:table-cell">
                              <div className="max-w-[200px] truncate" title={row.storeName}>
                                {row.storeName}
                              </div>
                            </td>
                            <td className="p-2 sm:p-3 hidden md:table-cell text-slate-400">{row.storeType}</td>
                            <td className="p-2 sm:p-3 hidden lg:table-cell text-slate-400">{row.city}</td>
                            <td className="p-2 sm:p-3">
                              <span className={`inline-block px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap ${
                                row.status === 'active' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-slate-600/50 text-slate-300 border border-slate-600'
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="p-2 sm:p-3 bg-slate-900/50 border-t border-slate-700 text-xs text-slate-400 text-center sm:hidden">
                    Scroll right to see more columns →
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Success Message */}
          {importResult && stage === 'complete' && (
            <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={20} className="text-green-400 shrink-0 mt-0.5" />
                <div className="text-sm text-green-200 flex-1">
                  <p className="font-medium mb-1">Import Completed!</p>
                  <div className="space-y-1 text-green-300/80">
                    <p>Successfully imported: <span className="font-semibold">{importResult.imported}</span> stores</p>
                    {importResult.created !== undefined && (
                      <p>New stores created: <span className="font-semibold">{importResult.created}</span></p>
                    )}
                    {importResult.updated !== undefined && (
                      <p>Existing stores updated: <span className="font-semibold">{importResult.updated}</span></p>
                    )}
                    <p>Skipped/Failed: <span className="font-semibold">{importResult.skipped}</span> rows</p>
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
                      {importResult.hasMoreErrors && (
                        <p className="text-xs text-yellow-400/60 mt-2 italic">... and more errors (showing first 100)</p>
                      )}
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
                    <div className="space-y-3">
                      <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                        <p className="text-red-300/90 leading-relaxed">{error.details}</p>
                      </div>
                      {error.suggestion && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <p className="text-xs font-semibold text-blue-300 mb-1">💡 Suggestion:</p>
                          <p className="text-blue-200 text-sm leading-relaxed">{error.suggestion}</p>
                        </div>
                      )}
                      {error.code && (
                        <p className="text-xs text-red-400/60 italic">
                          Error Code: {error.code}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-800 flex flex-col sm:flex-row justify-between gap-3 flex-shrink-0">
          <div className="order-2 sm:order-1">
            {stage === 'validation' && (
              <button
                onClick={handleBackToUpload}
                disabled={isLoading}
                className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
              >
                ← Back to Upload
              </button>
            )}
          </div>
          <div className="flex gap-2 sm:gap-3 order-1 sm:order-2">
            <button
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {importResult ? 'Close' : 'Cancel'}
            </button>

            {stage === 'upload' && (
              <button
                onClick={handleValidate}
                disabled={!selectedFile || isLoading}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Validating...</span>
                    <span className="sm:hidden">Validating</span>
                  </>
                ) : (
                  <>
                    <FileCheck size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Validate File</span>
                    <span className="sm:hidden">Validate</span>
                  </>
                )}
              </button>
            )}

            {stage === 'validation' && validationResult && (
              <button
                onClick={handleImport}
                disabled={isLoading || validationResult.errors.length > 0}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm sm:text-base"
                title={validationResult.errors.length > 0 ? 'Fix validation errors before importing' : 'Proceed with import'}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden sm:inline">Importing...</span>
                    <span className="sm:hidden">Importing</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} className="sm:w-[18px] sm:h-[18px]" />
                    <span className="hidden md:inline">Proceed to Import</span>
                    <span className="md:hidden">Import</span>
                    <ArrowRight size={14} className="hidden sm:inline sm:w-4 sm:h-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImportStoresModal;
