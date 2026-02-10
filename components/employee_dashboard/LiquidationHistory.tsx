'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Receipt, CheckCircle, XCircle, Clock, AlertCircle, Calendar, Loader2, Eye, X, MapPin, Ticket, Paperclip, FileImage, File, ExternalLink, Pencil } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import FileLiquidationModal from './FileLiquidationModal';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';

interface LiquidationItem {
  id: string;
  from_destination: string;
  to_destination: string;
  jeep: number;
  bus: number;
  fx_van: number;
  gas: number;
  toll: number;
  meals: number;
  lodging: number;
  others: number;
  total: number;
  remarks: string;
}

interface LiquidationAttachment {
  id: string;
  liquidation_item_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

interface Liquidation {
  id: string;
  cash_advance_id: string;
  store_id: string;
  ticket_id: number | null;
  liquidation_date: string;
  total_amount: number;
  return_to_company: number;
  reimbursement: number;
  remarks: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  cash_advances: {
    id: string;
    amount: number;
    date_requested: string;
  } | null;
  stores: {
    id: string;
    store_code: string;
    store_name: string;
  } | null;
  tickets: {
    id: number;
    rcc_reference_number: string;
  } | null;
  liquidation_items: LiquidationItem[];
  liquidation_attachments: LiquidationAttachment[];
}

interface LiquidationResponse {
  liquidations: Liquidation[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const fetchMyLiquidations = async (): Promise<LiquidationResponse> => {
  const response = await fetch('/api/liquidation/my-requests?limit=50');
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch liquidations');
  }
  return response.json();
};

const LiquidationHistory: React.FC = () => {
  const { user } = useAuth();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [selectedLiquidation, setSelectedLiquidation] = useState<Liquidation | null>(null);
  const [editingLiquidation, setEditingLiquidation] = useState<Liquidation | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [attachmentUrls, setAttachmentUrls] = useState<{ [key: string]: string }>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-liquidations'],
    queryFn: fetchMyLiquidations,
  });

  // Fetch signed URLs for attachments when viewing a liquidation
  const fetchAttachmentUrls = async (attachments: LiquidationAttachment[]) => {
    setLoadingAttachments(true);
    const urls: { [key: string]: string } = {};

    await Promise.all(
      attachments.map(async (attachment) => {
        try {
          const response = await fetch(`/api/liquidation/get-receipt-url?attachment_id=${attachment.id}`);
          if (response.ok) {
            const data = await response.json();
            urls[attachment.id] = data.url;
          } else {
            const errorData = await response.json().catch(() => ({}));
            console.error(`Failed to get signed URL for attachment ${attachment.id}:`, errorData);
          }
        } catch (error) {
          console.error('Error fetching attachment URL:', error);
        }
      })
    );

    setAttachmentUrls(urls);
    setLoadingAttachments(false);
  };

  const handleViewLiquidation = (liquidation: Liquidation) => {
    setSelectedLiquidation(liquidation);
    setAttachmentUrls({});
    if (liquidation.liquidation_attachments && liquidation.liquidation_attachments.length > 0) {
      fetchAttachmentUrls(liquidation.liquidation_attachments);
    }
  };

  const handleEditLiquidation = (liquidation: Liquidation) => {
    setEditingLiquidation(liquidation);
    setIsEditModalOpen(true);
    setSelectedLiquidation(null); // Close detail modal if open
  };

  const handleEditSuccess = () => {
    refetch();
  };

  const liquidations = data?.liquidations || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'rejected':
        return 'text-red-400 bg-red-500/10 border-red-500/20';
      default:
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy h:mm a');
    } catch {
      return new Date(dateString).toLocaleString();
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getFileIcon = (fileType: string) => {
    if (fileType?.startsWith('image/')) {
      return <FileImage size={16} className="text-blue-400" />;
    }
    return <File size={16} className="text-slate-400" />;
  };

  const isImageFile = (fileType: string) => {
    return fileType?.startsWith('image/');
  };

  const filteredLiquidations = liquidations.filter((liq) => {
    if (filter === 'all') return true;
    return liq.status === filter;
  });

  if (isLoading) {
    return (
      <div id="liquidation-history" className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-6 flex justify-center items-center min-h-[200px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <div id="liquidation-history" className="space-y-6 animate-fade-in scroll-mt-24">
      {/* Detail Modal */}
      {selectedLiquidation && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
          onClick={() => setSelectedLiquidation(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden transform transition-all max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900 shrink-0">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-500/10 rounded-lg">
                    <Receipt className="w-5 h-5 text-orange-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Liquidation Details</h3>
                    <p className="text-slate-400 text-sm mt-0.5">
                      ID: {selectedLiquidation.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLiquidation(null)}
                  className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 bg-slate-900/50">
              {/* Status */}
              <div className="flex items-center justify-between">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border ${getStatusColor(selectedLiquidation.status)}`}>
                  {getStatusIcon(selectedLiquidation.status)}
                  <span className="capitalize">{selectedLiquidation.status}</span>
                </div>
                <span className="text-slate-400 text-sm">
                  {formatDate(selectedLiquidation.liquidation_date)}
                </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Cash Advance</label>
                  <p className="text-white mt-1 font-mono text-sm">
                    {selectedLiquidation.cash_advances
                      ? formatCurrency(selectedLiquidation.cash_advances.amount)
                      : 'N/A'}
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Total Expenses</label>
                  <p className="text-orange-400 mt-1 font-mono text-sm font-semibold">
                    {formatCurrency(selectedLiquidation.total_amount)}
                  </p>
                </div>
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Store</label>
                  <p className="text-white mt-1 text-sm">
                    {selectedLiquidation.stores
                      ? `${selectedLiquidation.stores.store_code}`
                      : 'N/A'}
                  </p>
                </div>
              </div>

              {/* Return to Company / Reimbursement */}
              <div className="grid grid-cols-2 gap-4">
                {selectedLiquidation.return_to_company > 0 && (
                  <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <label className="text-xs text-emerald-400 uppercase font-semibold">Return to Company</label>
                    <p className="text-emerald-400 mt-1 font-mono text-lg font-bold">
                      {formatCurrency(selectedLiquidation.return_to_company)}
                    </p>
                  </div>
                )}
                {selectedLiquidation.reimbursement > 0 && (
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <label className="text-xs text-blue-400 uppercase font-semibold">Reimbursement</label>
                    <p className="text-blue-400 mt-1 font-mono text-lg font-bold">
                      {formatCurrency(selectedLiquidation.reimbursement)}
                    </p>
                    <p className="text-xs text-blue-400/70 mt-1">Company owes you</p>
                  </div>
                )}
                {selectedLiquidation.return_to_company === 0 && selectedLiquidation.reimbursement === 0 && (
                  <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                    <label className="text-xs text-slate-400 uppercase font-semibold">Balance</label>
                    <p className="text-slate-300 mt-1 font-mono text-lg font-bold">
                      {formatCurrency(0)}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Fully liquidated</p>
                  </div>
                )}
              </div>

              {/* Ticket Info */}
              {selectedLiquidation.tickets && (
                <div className="p-3 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Ticket size={12} />
                    Incident No.
                  </label>
                  <p className="text-white mt-1 text-sm">
                    {selectedLiquidation.tickets.rcc_reference_number}
                  </p>
                </div>
              )}

              {/* Expense Items Table */}
              {selectedLiquidation.liquidation_items && selectedLiquidation.liquidation_items.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Expense Items</label>
                  {selectedLiquidation.liquidation_items.map((item, index) => {
                    // Get attachments for this specific item
                    const itemAttachments = selectedLiquidation.liquidation_attachments?.filter(
                      att => att.liquidation_item_id === item.id
                    ) || [];

                    return (
                      <div key={item.id} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-800/30">
                        {/* Row Header */}
                        <div className="bg-slate-800/50 px-3 py-2 border-b border-slate-700">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-400">Row {index + 1}</span>
                              {(item.from_destination || item.to_destination) && (
                                <span className="text-xs text-white flex items-center gap-1">
                                  <MapPin size={12} className="text-slate-500" />
                                  {item.from_destination || '—'} → {item.to_destination || '—'}
                                </span>
                              )}
                            </div>
                            <span className="text-sm font-semibold text-orange-400">{formatCurrency(item.total)}</span>
                          </div>
                        </div>

                        {/* Expenses Grid */}
                        <div className="p-3">
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                            {item.jeep > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Jeep:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.jeep)}</span>
                              </div>
                            )}
                            {item.bus > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Bus:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.bus)}</span>
                              </div>
                            )}
                            {item.fx_van > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">FX/Van:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.fx_van)}</span>
                              </div>
                            )}
                            {item.gas > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Gas:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.gas)}</span>
                              </div>
                            )}
                            {item.toll > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Toll:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.toll)}</span>
                              </div>
                            )}
                            {item.meals > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Meals:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.meals)}</span>
                              </div>
                            )}
                            {item.lodging > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Lodging:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.lodging)}</span>
                              </div>
                            )}
                            {item.others > 0 && (
                              <div className="bg-slate-800 px-2 py-1.5 rounded">
                                <span className="text-slate-400">Others:</span>{' '}
                                <span className="text-white font-medium">{formatCurrency(item.others)}</span>
                              </div>
                            )}
                          </div>

                          {/* Row Remarks */}
                          {item.remarks && (
                            <div className="mt-2 text-xs text-slate-300 bg-slate-800 px-2 py-1.5 rounded">
                              <span className="text-slate-400">Note:</span> {item.remarks}
                            </div>
                          )}

                          {/* Row Attachments */}
                          {itemAttachments.length > 0 && (
                            <div className="mt-3 space-y-2">
                              <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Paperclip size={12} />
                                <span>Receipts ({itemAttachments.length})</span>
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {itemAttachments.map((attachment) => {
                                  const signedUrl = attachmentUrls[attachment.id];
                                  return (
                                    <a
                                      key={attachment.id}
                                      href={signedUrl || '#'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`group block p-2 bg-slate-800 rounded border border-slate-700 hover:border-orange-500/50 transition-all ${!signedUrl ? 'pointer-events-none opacity-60' : ''}`}
                                      onClick={(e) => !signedUrl && e.preventDefault()}
                                    >
                                      {isImageFile(attachment.file_type) ? (
                                        <div className="aspect-square mb-1.5 rounded overflow-hidden bg-slate-900">
                                          {signedUrl ? (
                                            <img
                                              src={signedUrl}
                                              alt={attachment.file_name}
                                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                              <Loader2 size={20} className="text-slate-500 animate-spin" />
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <div className="aspect-square mb-1.5 rounded bg-slate-900 flex items-center justify-center">
                                          <File size={24} className="text-slate-500" />
                                        </div>
                                      )}
                                      <div className="space-y-0.5">
                                        <p className="text-xs text-white truncate flex items-center gap-1">
                                          {getFileIcon(attachment.file_type)}
                                          <span className="truncate">{attachment.file_name}</span>
                                        </p>
                                        <div className="flex items-center justify-between">
                                          <p className="text-xs text-slate-500">
                                            {formatFileSize(attachment.file_size)}
                                          </p>
                                          <ExternalLink size={10} className="text-slate-500 group-hover:text-orange-400" />
                                        </div>
                                      </div>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Remarks */}
              {selectedLiquidation.remarks && (
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Remarks</label>
                  <p className="text-white mt-2 text-sm whitespace-pre-wrap">
                    {selectedLiquidation.remarks}
                  </p>
                </div>
              )}

              {/* General Attachments (not linked to specific rows) */}
              {(() => {
                const generalAttachments = selectedLiquidation.liquidation_attachments?.filter(
                  att => att.liquidation_item_id === null
                ) || [];
                return generalAttachments.length > 0 ? (
                  <div className="space-y-3">
                    <label className="text-xs text-slate-400 uppercase font-semibold flex items-center gap-2">
                      <Paperclip size={12} />
                      General Attachments ({generalAttachments.length})
                      {loadingAttachments && <Loader2 size={12} className="animate-spin" />}
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {generalAttachments.map((attachment) => {
                      const signedUrl = attachmentUrls[attachment.id];
                      return (
                        <a
                          key={attachment.id}
                          href={signedUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`group block p-3 bg-slate-800 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all ${!signedUrl ? 'pointer-events-none opacity-60' : ''}`}
                          onClick={(e) => !signedUrl && e.preventDefault()}
                        >
                          {isImageFile(attachment.file_type) ? (
                            <div className="aspect-square mb-2 rounded overflow-hidden bg-slate-900">
                              {signedUrl ? (
                                <img
                                  src={signedUrl}
                                  alt={attachment.file_name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Loader2 size={24} className="text-slate-500 animate-spin" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="aspect-square mb-2 rounded bg-slate-900 flex items-center justify-center">
                              <File size={32} className="text-slate-500" />
                            </div>
                          )}
                          <div className="space-y-1">
                            <p className="text-xs text-white truncate flex items-center gap-1">
                              {getFileIcon(attachment.file_type)}
                              <span className="truncate">{attachment.file_name}</span>
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-slate-500">
                                {formatFileSize(attachment.file_size)}
                              </p>
                              <ExternalLink size={10} className="text-slate-500 group-hover:text-orange-400" />
                            </div>
                          </div>
                        </a>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Review Info */}
              {selectedLiquidation.status !== 'pending' && selectedLiquidation.approved_at && (
                <div className="p-4 bg-slate-800 rounded-lg border border-slate-700">
                  <label className="text-xs text-slate-400 uppercase font-semibold">Review Information</label>
                  <div className="mt-2 space-y-2">
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-400">Reviewed on:</span>{' '}
                      {formatDateTime(selectedLiquidation.approved_at)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-end gap-3 shrink-0">
              {selectedLiquidation.status === 'pending' && (
                <button
                  onClick={() => handleEditLiquidation(selectedLiquidation)}
                  className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors text-sm flex items-center gap-2"
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}
              <button
                onClick={() => setSelectedLiquidation(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Receipt className="w-5 h-5 text-orange-400" />
          Liquidation History
        </h2>

        <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                filter === f
                  ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {error ? (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-2">
          <AlertCircle size={20} />
          {(error as Error).message || 'Failed to load liquidation history'}
        </div>
      ) : filteredLiquidations.length === 0 ? (
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-12 text-center">
          <div className="w-12 h-12 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt className="text-slate-500" size={24} />
          </div>
          <h3 className="text-sm font-medium text-white mb-1">
            No {filter !== 'all' ? filter : ''} liquidations
          </h3>
          <p className="text-slate-400 text-xs">
            {filter === 'all'
              ? "You haven't submitted any liquidations yet."
              : `You don't have any ${filter} liquidations.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLiquidations.map((liquidation) => (
            <div
              key={liquidation.id}
              className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl p-4 sm:p-5 hover:border-orange-500/50 transition-all cursor-pointer group shadow-sm hover:shadow-md"
              onClick={() => handleViewLiquidation(liquidation)}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Left: Amount and Store */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl font-bold text-orange-400 font-mono">
                      {formatCurrency(liquidation.total_amount)}
                    </span>
                    {liquidation.stores && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
                        <MapPin size={10} className="mr-1" />
                        {liquidation.stores.store_code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Calendar size={14} />
                    <span>{formatDate(liquidation.liquidation_date)}</span>
                    {liquidation.tickets && (
                      <>
                        <span className="text-slate-600">•</span>
                        <Ticket size={14} />
                        <span>{liquidation.tickets.rcc_reference_number}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Center: Return to Company / Reimbursement */}
                <div className="flex-1 hidden lg:block">
                  {liquidation.return_to_company > 0 && (
                    <p className="text-sm text-slate-400">
                      Return to Company:{' '}
                      <span className="font-mono font-semibold text-emerald-400">
                        {formatCurrency(liquidation.return_to_company)}
                      </span>
                    </p>
                  )}
                  {liquidation.reimbursement > 0 && (
                    <p className="text-sm text-slate-400">
                      Reimbursement:{' '}
                      <span className="font-mono font-semibold text-blue-400">
                        {formatCurrency(liquidation.reimbursement)}
                      </span>
                    </p>
                  )}
                  {liquidation.return_to_company === 0 && liquidation.reimbursement === 0 && (
                    <p className="text-sm text-slate-400">
                      Balance:{' '}
                      <span className="font-mono font-semibold text-slate-300">
                        {formatCurrency(0)}
                      </span>
                    </p>
                  )}
                </div>

                {/* Right: Status and View */}
                <div className="flex items-center gap-3">
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(liquidation.status)}`}>
                    {getStatusIcon(liquidation.status)}
                    <span className="capitalize">{liquidation.status}</span>
                  </div>
                  {liquidation.status === 'pending' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditLiquidation(liquidation);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg transition-colors text-xs font-medium"
                    >
                      <Pencil size={14} />
                      <span className="hidden sm:inline">Edit</span>
                    </button>
                  )}
                  <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-xs font-medium">
                    <Eye size={14} />
                    <span className="hidden sm:inline">Details</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Liquidation Modal */}
      <FileLiquidationModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLiquidation(null);
        }}
        onSuccess={handleEditSuccess}
        userId={user?.id || ''}
        editingLiquidation={editingLiquidation}
      />
    </div>
  );
};

export default LiquidationHistory;
