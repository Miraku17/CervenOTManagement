import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, AlertCircle, CheckCircle, FileText, Calendar, User, Clock } from 'lucide-react';

interface ImportError {
  id: string;
  row_number: number;
  error_message: string;
  row_data: any;
  created_at: string;
}

interface ImportLog {
  id: string;
  import_type: string;
  file_name: string;
  imported_by: string;
  total_rows: number;
  success_count: number;
  failed_count: number;
  status: string;
  started_at: string;
  completed_at: string;
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  errors: ImportError[];
}

interface ImportLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportLogsModal({ isOpen, onClose }: ImportLogsModalProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchImportLogs();
    }
  }, [isOpen]);

  const fetchImportLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/assets/import-logs');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch import logs');
      }

      setLogs(data.logs || []);
    } catch (error: any) {
      console.error('Error fetching import logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (logId: string) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400 bg-green-900/30';
      case 'partial':
        return 'text-yellow-400 bg-yellow-900/30';
      case 'failed':
        return 'text-red-400 bg-red-900/30';
      default:
        return 'text-slate-400 bg-slate-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (start: string, end: string) => {
    const duration = new Date(end).getTime() - new Date(start).getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl sm:text-2xl font-bold text-white">Asset Import History</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors p-2 hover:bg-slate-800 rounded-lg"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg">No import history found</p>
              <p className="text-slate-500 text-sm mt-2">Import logs will appear here after you upload files</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden"
                >
                  {/* Log Summary */}
                  <div
                    className="p-4 cursor-pointer hover:bg-slate-800/70 transition-colors"
                    onClick={() => toggleExpand(log.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button className="mt-1 text-slate-400">
                          {expandedLogId === log.id ? (
                            <ChevronDown size={20} />
                          ) : (
                            <ChevronRight size={20} />
                          )}
                        </button>
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <h3 className="text-white font-semibold break-all">{log.file_name}</h3>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(log.status)}`}>
                              {log.status.toUpperCase()}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                              <Calendar size={14} className="shrink-0" />
                              <span>{formatDate(log.created_at)}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <User size={14} className="shrink-0" />
                              <span className="truncate">
                                {log.profiles
                                  ? `${log.profiles.first_name} ${log.profiles.last_name}`
                                  : 'Unknown'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                              <Clock size={14} className="shrink-0" />
                              <span>
                                {log.completed_at
                                  ? formatDuration(log.started_at, log.completed_at)
                                  : 'In Progress'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <CheckCircle size={14} className="text-green-400 shrink-0" />
                              <span className="text-green-400 font-medium">
                                {log.success_count} / {log.total_rows}
                              </span>
                              {log.failed_count > 0 && (
                                <>
                                  <AlertCircle size={14} className="text-red-400 ml-2 shrink-0" />
                                  <span className="text-red-400 font-medium">{log.failed_count} failed</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Errors */}
                  {expandedLogId === log.id && log.errors.length > 0 && (
                    <div className="border-t border-slate-700 bg-slate-900/50 p-4">
                      <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                        <AlertCircle className="text-red-400" size={18} />
                        Import Errors ({log.errors.length})
                      </h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {log.errors.map((error) => (
                          <div
                            key={error.id}
                            className="bg-slate-800/70 rounded-lg p-3 border border-slate-700"
                          >
                            <div className="flex items-start gap-3">
                              <span className="text-red-400 font-mono text-sm bg-red-900/30 px-2 py-1 rounded">
                                Row {error.row_number}
                              </span>
                              <div className="flex-1">
                                <p className="text-red-400 text-sm mb-2">{error.error_message}</p>
                                {error.row_data && (
                                  <div className="bg-slate-900 rounded p-2 text-xs font-mono">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400">
                                      {Object.entries(error.row_data).map(([key, value]) => (
                                        <div key={key}>
                                          <span className="text-slate-500">{key}:</span>{' '}
                                          <span className="text-slate-300">{String(value) || 'N/A'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {expandedLogId === log.id && log.errors.length === 0 && (
                    <div className="border-t border-slate-700 bg-slate-900/50 p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">No errors - all rows imported successfully!</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
