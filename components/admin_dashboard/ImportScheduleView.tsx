import React, { useState, useRef } from 'react';
import { FileUp, Upload, FileSpreadsheet, AlertCircle, CheckCircle, XCircle, Copy } from 'lucide-react';
import { read, utils, writeFile } from 'xlsx';

const ImportScheduleView: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null); // Declare ref for file input
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [isDryRunMode, setIsDryRunMode] = useState(false); // New state for dry run
    const [uploadResult, setUploadResult] = useState<{
      type: 'success' | 'error' | 'partial';
      text: string;
      details?: string[];
      isDryRun?: boolean; // Add isDryRun to type for frontend display logic
    } | null>(null);
  
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setUploadResult(null);
      if (e.target.files && e.target.files[0]) {
        const selectedFile = e.target.files[0];
        if (
          selectedFile.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          selectedFile.name.endsWith('.xlsx')
        ) {
          setFile(selectedFile);
        } else {
          setUploadResult({ type: 'error', text: 'Please upload a valid Excel (.xlsx) file.' });
          setFile(null);
          if (fileInputRef.current) { // Reset input value on error
            fileInputRef.current.value = '';
          }
        }
      } else {
        setFile(null);
        if (fileInputRef.current) { // Reset input value if no file is selected
          fileInputRef.current.value = '';
        }
      }
    };
  
    const handleDownloadTemplate = () => {
      const headers = ["employee_id", "month", "shift_start", "shift_end", "rest_days"];
      
      const instructions = [
        ["Field", "Description", "Example", "Required"],
        ["employee_id", "The unique ID of the employee.", "EMP001", "Yes"],
        ["month", "The month for the schedule (YYYY-MM).", "2023-10", "Yes"],
        ["shift_start", "Shift start time in 24-hour format (HH:MM).", "09:00", "No (if rest day)"],
        ["shift_end", "Shift end time in 24-hour format (HH:MM).", "18:00", "No (if rest day)"],
        ["rest_days", "Comma-separated list of rest days. Must be capitalized (e.g., Mon, Tue).", "Sat, Sun", "No"]
      ];

      const workbook = utils.book_new();
      
      const worksheet = utils.aoa_to_sheet([headers]);
      utils.book_append_sheet(workbook, worksheet, "Template");

      const instructionsSheet = utils.aoa_to_sheet(instructions);
      // Set column widths for instructions
      instructionsSheet['!cols'] = [
        { wch: 15 }, // Field
        { wch: 40 }, // Description
        { wch: 15 }, // Example
        { wch: 10 }  // Required
      ];
      utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

      writeFile(workbook, "schedule_template.xlsx");
    };
  
    const handleCopyErrors = () => {
        if (uploadResult?.details) {
            navigator.clipboard.writeText(uploadResult.details.join('\n'));
        }
    };

    const handleImport = async () => {
      if (!file) {
          setUploadResult({ type: 'error', text: 'Please select a file to upload.' });
          return;
      }
      
      setImporting(true);
      setUploadResult({ type: 'partial', text: 'Reading and processing file...' }); // Use partial style for info
  
      try {
          const reader = new FileReader();
          reader.onload = async (event) => {
              try {
                const arrayBuffer = event.target?.result as ArrayBuffer;
                const workbook = read(arrayBuffer, { type: 'array' });
                
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = utils.sheet_to_json(worksheet, { defval: "" });

                if (jsonData.length === 0) {
                    throw new Error("The uploaded file is empty or contains no data.");
                }

                let apiUrl = '/api/admin/upload-schedule';
                if (isDryRunMode) {
                    apiUrl += '?dryRun=true';
                }
    
                const response = await fetch(apiUrl, { // Use apiUrl here
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ records: jsonData }),
                });
    
                const result = await response.json();
    
                let messageText = result.message || 'Schedule import operation completed.';
                if (result.isDryRun) {
                    messageText = `Dry Run: ${messageText} No changes were saved to the database.`;
                }
    
                if (response.ok) {
                    if (result.errors && result.errors.length > 0) {
                        setUploadResult({ 
                            type: 'partial', 
                            text: `${messageText} ${result.stats.processed_rows} of ${result.stats.total_rows} rows processed successfully.`,
                            details: result.errors,
                            isDryRun: result.isDryRun // Pass dryRun status to state
                        });
                    } else {
                        setUploadResult({ 
                            type: 'success', 
                            text: messageText,
                            isDryRun: result.isDryRun // Pass dryRun status to state
                        });
                        if (!result.isDryRun) { // Only clear file if it was a real import
                            setFile(null);
                            if (fileInputRef.current) { // Reset input value
                              fileInputRef.current.value = '';
                            }
                        }
                    }
                } else {
                    setUploadResult({ type: 'error', text: result.error || 'Failed to import schedule.' });
                }
              } catch (parseError: any) {
                 console.error('Parsing error:', parseError);
                 setUploadResult({ type: 'error', text: 'Failed to parse Excel file. Ensure it is a valid .xlsx file.' });
              }
          };
          reader.onerror = () => {
              setUploadResult({ type: 'error', text: 'Failed to read file.' });
              setImporting(false);
          };
          reader.readAsArrayBuffer(file);
  
      } catch (error: any) {
        console.error('Import error:', error);
        setUploadResult({ type: 'error', text: error.message || 'An unexpected error occurred during import.' });
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
            Upload an Excel file to import employee schedules.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 mt-2"
          >
            <FileSpreadsheet size={16} /> Download Excel Template
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl max-w-2xl mx-auto">
        <div className="border-2 border-dashed border-slate-700 rounded-2xl p-8 text-center hover:border-blue-500/50 transition-colors bg-slate-950/50">
          <input
            type="file"
            id="schedule-file"
            accept=".xlsx"
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef} // Attach ref here
          />
          
          {!file ? (
            <label htmlFor="schedule-file" className="cursor-pointer flex flex-col items-center gap-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-2">
                <Upload className="text-blue-400 w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium text-white">Click to upload or drag and drop</p>
                <p className="text-slate-400 text-sm mt-1">Excel files (.xlsx) only</p>
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
                onClick={() => {
                    setFile(null);
                    if (fileInputRef.current) { // Reset input value when removing file
                        fileInputRef.current.value = '';
                    }
                }}
                className="text-sm text-red-400 hover:text-red-300 transition-colors"
              >
                Remove file
              </button>
            </div>
          )}
        </div>

        <div className="mt-6">
          {uploadResult && (
            <div className={`p-4 rounded-xl mb-6 border transition-all duration-300 ${
                uploadResult.type === 'success' ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' :
                uploadResult.type === 'error' ? 'bg-red-950/30 border-red-500/30 text-red-400' :
                'bg-amber-950/30 border-amber-500/30 text-amber-400'
            }`}>
                <div className="flex items-start gap-3 mb-2">
                    <div className="mt-1 shrink-0">
                        {uploadResult.type === 'success' && <CheckCircle size={20} className="text-emerald-500" />}
                        {uploadResult.type === 'error' && <XCircle size={20} className="text-red-500" />}
                        {uploadResult.type === 'partial' && <AlertCircle size={20} className="text-amber-500" />}
                    </div>
                    <div className="flex-1">
                        <p className="font-medium text-base">{uploadResult.text}</p>
                    </div>
                </div>
                
                {uploadResult.details && uploadResult.details.length > 0 && (
                    <div className="mt-4 bg-slate-950/50 rounded-lg border border-slate-800 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                <AlertCircle size={14} className="text-amber-500" />
                                Issues Found ({uploadResult.details.length})
                            </p>
                            <button 
                                onClick={handleCopyErrors}
                                className="text-xs flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors px-2 py-1 rounded hover:bg-blue-500/10"
                                title="Copy all errors to clipboard"
                            >
                                <Copy size={12} />
                                Copy Errors
                            </button>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-400 max-h-60 overflow-y-auto pr-2 custom-scrollbar font-mono">
                            {uploadResult.details.map((err, idx) => (
                                <li key={idx} className="flex items-start gap-2 bg-slate-900/50 p-2 rounded border border-slate-800/50">
                                    <span className="text-red-500/70 select-none mt-0.5">•</span>
                                    <span className="break-all">{err}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
          )}

          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="text-blue-400 w-5 h-5 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-200">
              <p className="font-medium mb-1">Excel Format Requirements:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-200/80">
                <li>Required columns: employee_id, month, shift_start, shift_end, rest_days</li>
                <li>`month` format: YYYY-MM</li>
                <li>`shift_start` and `shift_end` format: HH:MM (24-hour)</li>
                <li>`rest_days` format: Comma-separated (e.g., Mon,Tue)</li>
                <li>See "Instructions" sheet in template for more details.</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <input
              type="checkbox"
              id="dryRunCheckbox"
              checked={isDryRunMode}
              onChange={(e) => setIsDryRunMode(e.target.checked)}
              className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out bg-slate-700 border-slate-600 rounded"
            />
            <label htmlFor="dryRunCheckbox" className="text-sm text-slate-300">Run as Dry Run (validate only, no database changes)</label>
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
            <span>{importing ? 'Processing...' : (isDryRunMode ? 'Run Dry Run' : 'Import Schedule')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImportScheduleView;