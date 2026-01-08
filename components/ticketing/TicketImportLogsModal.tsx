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
  imported_by_user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  errors?: ImportError[];
}

interface TicketImportLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TicketImportLogsModal({ isOpen, onClose }: TicketImportLogsModalProps) {
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [loadingErrors, setLoadingErrors] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchImportLogs();
    }
  }, [isOpen]);

  const fetchImportLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/tickets/import-logs');
      const data = await response.json();

      if (response.ok) {
        setLogs(data.logs || []);
      } else {
        console.error('Failed to fetch import logs:', data.error);
      }
    } catch (error) {
      console.error('Error fetching import logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogErrors = async (logId: string) => {
    setLoadingErrors(logId);
    try {
      const response = await fetch(`/api/tickets/import-logs?logId=${logId}`);
      const data = await response.json();

      if (response.ok) {
        setLogs(prevLogs =>
          prevLogs.map(log =>
            log.id === logId ? { ...log, errors: data.errors || [] } : log
          )
        );
      }
    } catch (error) {
      console.error('Error fetching log errors:', error);
    } finally {
      setLoadingErrors(null);
    }
  };

  const toggleLog = (logId: string) => {
    if (expandedLogId === logId) {
      setExpandedLogId(null);
    } else {
      setExpandedLogId(logId);
      const log = logs.find(l => l.id === logId);
      if (log && !log.errors && log.failed_count > 0) {
        fetchLogErrors(logId);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs">
            <CheckCircle size={14} />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 text-xs">
            <AlertCircle size={14} />
            Failed
          </span>
        );
      case 'partial':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
            <AlertCircle size={14} />
            Partial
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 rounded-md bg-slate-700 text-slate-400 text-xs">
            {status}
          </span>
        );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <FileText className="text-blue-400" size={24} />
            <h2 className="text-2xl font-bold text-white">Ticket Import History</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-400">Loading import history...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <p className="text-slate-400">No import history found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const isExpanded = expandedLogId === log.id;
                const userName = log.imported_by_user
                  ? `${log.imported_by_user.first_name} ${log.imported_by_user.last_name}`
                  : 'Unknown User';

                return (
                  <div
                    key={log.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden"
                  >
                    {/* Log Summary */}
                    <div
                      onClick={() => toggleLog(log.id)}
                      className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            {isExpanded ? (
                              <ChevronDown size={20} className="text-slate-400" />
                            ) : (
                              <ChevronRight size={20} className="text-slate-400" />
                            )}
                          </div>

                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h3 className="text-white font-medium">{log.file_name}</h3>
                              {getStatusBadge(log.status)}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div className="flex items-center gap-2 text-slate-400">
                                <Calendar size={14} />
                                <span>{formatDate(log.started_at)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                <User size={14} />
                                <span>{userName}</span>
                              </div>
                              <div className="flex items-center gap-2 text-slate-400">
                                <Clock size={14} />
                                <span>
                                  {log.total_rows} total • {log.success_count} success • {log.failed_count} failed
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Errors */}
                    {isExpanded && (
                      <div className="border-t border-slate-800 p-4 bg-slate-900/50">
                        {loadingErrors === log.id ? (
                          <div className="flex items-center justify-center py-8">
                            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          </div>
                        ) : log.failed_count === 0 ? (
                          <div className="text-center py-8 text-emerald-400">
                            <CheckCircle size={48} className="mx-auto mb-2" />
                            <p>All tickets imported successfully!</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <h4 className="text-white font-medium flex items-center gap-2">
                              <AlertCircle size={16} className="text-red-400" />
                              Import Errors ({log.failed_count})
                            </h4>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                              {log.errors?.map((error) => (
                                <div
                                  key={error.id}
                                  className="bg-red-500/5 border border-red-500/20 rounded-lg p-3"
                                >
                                  <div className="flex items-start gap-3">
                                    <div className="flex-shrink-0">
                                      <span className="inline-block px-2 py-1 rounded bg-red-500/20 text-red-400 text-xs font-mono">
                                        Row {error.row_number}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-red-400 text-sm mb-2">{error.error_message}</p>
                                      {error.row_data && (
                                        <details className="text-xs text-slate-400">
                                          <summary className="cursor-pointer hover:text-slate-300">
                                            View row data
                                          </summary>
                                          <pre className="mt-2 p-2 bg-slate-950 rounded overflow-x-auto">
                                            {JSON.stringify(error.row_data, null, 2)}
                                          </pre>
                                        </details>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
