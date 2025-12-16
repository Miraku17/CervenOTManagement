import React, { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface UploadLeaveCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface UploadResult {
  type: 'success' | 'error' | 'partial';
  text: string;
  details?: string[];
}

export const UploadLeaveCreditsModal: React.FC<UploadLeaveCreditsModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadResult(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];

      if (validTypes.includes(selectedFile.type) || selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile);
      } else {
        setUploadResult({ type: 'error', text: 'Please upload a valid Excel file (.xlsx or .xls).' });
        setFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } else {
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    // Create template data
    const templateData = [
      {
        employee_id: 'EMP001',
        leave_credits: 15,
      },
      {
        employee_id: 'EMP002',
        leave_credits: 20,
      },
    ];

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // employee_id
      { wch: 15 }, // leave_credits
    ];

    // Create workbook and add worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leave Credits');

    // Generate and download file
    XLSX.writeFile(workbook, 'leave_credits_template.xlsx');
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadResult({ type: 'error', text: 'Please select a file to upload.' });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      // Read the Excel file
      const reader = new FileReader();

      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Get the first sheet
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Convert to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          // Validate data
          if (jsonData.length === 0) {
            setUploadResult({ type: 'error', text: 'The Excel file is empty.' });
            setUploading(false);
            return;
          }

          // Send to API
          const response = await fetch('/api/admin/upload-leave-credits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: jsonData }),
          });

          const result = await response.json();

          if (response.ok) {
            if (result.errors && result.errors.length > 0) {
              setUploadResult({
                type: 'partial',
                text: `${result.message} ${result.stats.successful} of ${result.stats.total} records processed successfully.`,
                details: result.errors,
              });
            } else {
              setUploadResult({
                type: 'success',
                text: result.message,
              });
              setFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }

              // Call onSuccess callback after a short delay
              if (onSuccess) {
                setTimeout(() => {
                  onSuccess();
                }, 1500);
              }
            }
          } else {
            setUploadResult({ type: 'error', text: result.error || 'Failed to upload leave credits.' });
          }
        } catch (parseError: any) {
          console.error('Parse error:', parseError);
          setUploadResult({ type: 'error', text: 'Failed to parse Excel file. Please check the format.' });
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        setUploadResult({ type: 'error', text: 'Failed to read file.' });
        setUploading(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadResult({ type: 'error', text: error.message || 'An unexpected error occurred during upload.' });
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      setUploadResult(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-3">
              <Upload className="text-blue-400" size={24} />
              Upload Leave Credits
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Upload an Excel file to update employee leave credits
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-400 mb-2 flex items-center gap-2">
              <AlertCircle size={16} />
              Instructions
            </h3>
            <ul className="text-sm text-blue-200/80 space-y-1 list-disc list-inside">
              <li>Download the template below to get started</li>
              <li>Fill in the <code className="bg-slate-950/50 px-1 rounded">employee_id</code> and <code className="bg-slate-950/50 px-1 rounded">leave_credits</code> columns</li>
              <li>You can add as many employees as needed (bulk update) or just one (individual update)</li>
              <li>The system will validate employee IDs and update only existing employees</li>
              <li>Leave credits will be set to the value you specify (not added to existing credits)</li>
            </ul>
          </div>

          {/* Download Template Button */}
          <button
            onClick={handleDownloadTemplate}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-white rounded-xl transition-colors"
          >
            <Download size={18} />
            Download Excel Template
          </button>

          {/* File Upload Area */}
          <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500/50 transition-colors bg-slate-950/50">
            <input
              type="file"
              id="leave-credits-file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
              disabled={uploading}
            />

            {!file ? (
              <label htmlFor="leave-credits-file" className={`cursor-pointer flex flex-col items-center gap-4 ${uploading ? 'pointer-events-none opacity-50' : ''}`}>
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="text-blue-400" size={32} />
                </div>
                <div>
                  <p className="text-slate-300 font-medium mb-1">Click to select Excel file</p>
                  <p className="text-slate-500 text-sm">or drag and drop</p>
                  <p className="text-slate-600 text-xs mt-2">.xlsx or .xls files only</p>
                </div>
              </label>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <FileSpreadsheet className="text-emerald-400" size={32} />
                </div>
                <div>
                  <p className="text-slate-200 font-medium">{file.name}</p>
                  <p className="text-slate-500 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                {!uploading && (
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Remove file
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Upload Result */}
          {uploadResult && (
            <div className={`p-4 rounded-xl border flex items-start gap-3 ${
              uploadResult.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : uploadResult.type === 'error'
                ? 'bg-red-500/10 border-red-500/20'
                : 'bg-amber-500/10 border-amber-500/20'
            }`}>
              <div className="flex-shrink-0 mt-0.5">
                {uploadResult.type === 'success' ? (
                  <CheckCircle className="text-emerald-400" size={20} />
                ) : uploadResult.type === 'error' ? (
                  <XCircle className="text-red-400" size={20} />
                ) : (
                  <AlertCircle className="text-amber-400" size={20} />
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  uploadResult.type === 'success'
                    ? 'text-emerald-400'
                    : uploadResult.type === 'error'
                    ? 'text-red-400'
                    : 'text-amber-400'
                }`}>
                  {uploadResult.text}
                </p>
                {uploadResult.details && uploadResult.details.length > 0 && (
                  <div className="mt-2 max-h-40 overflow-y-auto">
                    <p className="text-xs text-slate-400 mb-1">Details:</p>
                    <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
                      {uploadResult.details.map((detail, idx) => (
                        <li key={idx}>{detail}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 flex items-center justify-end gap-3 sticky bottom-0 bg-slate-900">
          <button
            onClick={handleClose}
            disabled={uploading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
