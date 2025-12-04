import React, { useState } from 'react';
import { FileUp, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const ImportScheduleView: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadMessage(null); // Clear previous messages
    if (e.target.files && e.target.files[0]) {
      // Basic validation for CSV type
      if (e.target.files[0].type === 'text/csv' || e.target.files[0].name.endsWith('.csv')) {
        setFile(e.target.files[0]);
      } else {
        setUploadMessage({ type: 'error', text: 'Please upload a valid CSV file.' });
        setFile(null);
      }
    } else {
      setFile(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
        setUploadMessage({ type: 'error', text: 'Please select a file to upload.' });
        return;
    }
    
    setImporting(true);
    setUploadMessage({ type: 'info', text: 'Uploading and processing file...' });

    try {
        const reader = new FileReader();
        reader.onload = async (event) => {
            const csvText = event.target?.result as string;
            
            const response = await fetch('/api/admin/upload-schedule', {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/csv',
                },
                body: csvText,
            });

            const result = await response.json();

            if (response.ok) {
                setUploadMessage({ type: 'success', text: result.message || 'Schedule imported successfully!' });
                setFile(null);
            } else {
                setUploadMessage({ type: 'error', text: result.error || 'Failed to import schedule.' });
            }
        };
        reader.onerror = () => {
            setUploadMessage({ type: 'error', text: 'Failed to read file.' });
            setImporting(false);
        };
        reader.readAsText(file);

    } catch (error: any) {
      console.error('Import error:', error);
      setUploadMessage({ type: 'error', text: error.message || 'An unexpected error occurred during import.' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileUp className="text-blue-400" size={28} />
            Import Schedule
          </h2>
          <p className="text-slate-400 mt-1">
            Upload a CSV file to import employee schedules.
          </p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
        <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-colors bg-slate-950/50">
          <input
            type="file"
            id="schedule-file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          
          {!file ? (
            <label htmlFor="schedule-file" className="cursor-pointer flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
                <Upload className="text-blue-400 w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">Click to upload or drag and drop</p>
                <p className="text-slate-400 text-sm mt-1">CSV files only</p>
              </div>
            </label>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-2 border border-emerald-500/20">
                <FileSpreadsheet className="text-emerald-400 w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">{file.name}</p>
                <p className="text-slate-400 text-sm mt-1">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
              <button 
                onClick={() => setFile(null)}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Remove file
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          {uploadMessage && (
            <div className={`p-4 rounded-xl flex items-center gap-3 text-sm mb-6 ${
                uploadMessage.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' :
                uploadMessage.type === 'error' ? 'bg-red-500/10 border border-red-500/20 text-red-400' :
                'bg-blue-500/10 border border-blue-500/20 text-blue-400'
            }`}>
                {uploadMessage.type === 'success' && <CheckCircle size={20} />}
                {uploadMessage.type === 'error' && <XCircle size={20} />}
                {uploadMessage.type === 'info' && <AlertCircle size={20} />}
                <p>{uploadMessage.text}</p>
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-blue-400 w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">CSV Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                <li>Required columns: employee_id, month, shift_start, shift_end, rest_days</li>
                <li>`month` format: YYYY-MM</li>
                <li>`shift_start` and `shift_end` format: HH:MM (24-hour)</li>
                <li>`rest_days` format: Comma-separated (e.g., Mon,Tue)</li>
              </ul>
            </div>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || !file}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-500 transition-colors font-medium shadow-lg shadow-blue-900/40 disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {importing ? (
              <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <FileUp size={20} />
            )}
            <span>{importing ? 'Importing...' : 'Import Schedule'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportScheduleView;