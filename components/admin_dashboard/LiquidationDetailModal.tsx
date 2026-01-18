'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, User, CheckCircle, XCircle, Clock, Loader2, AlertCircle, MapPin, Ticket, Paperclip, FileImage, File, ExternalLink } from 'lucide-react';
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
  reviewer_comment: string | null;
  cash_advances: {
    id: string;
    amount: number;
    date_requested: string;
    type: string;
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
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
  } | null;
}

interface LiquidationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidation: Liquidation | null;
  adminId: string;
  onActionSuccess: () => void;
}

export const LiquidationDetailModal: React.FC<LiquidationDetailModalProps> = ({
  isOpen,
  onClose,
  liquidation,
  adminId,
  onActionSuccess,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<{ [key: string]: string }>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);

  // Fetch signed URLs for attachments when viewing a liquidation
  useEffect(() => {
    if (isOpen && liquidation?.liquidation_attachments?.length) {
      fetchAttachmentUrls(liquidation.liquidation_attachments);
    }
    return () => {
      setAttachmentUrls({});
    };
  }, [isOpen, liquidation?.id]);

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
          }
        } catch (error) {
          console.error('Error fetching attachment URL:', error);
        }
      })
    );

    setAttachmentUrls(urls);
    setLoadingAttachments(false);
  };

  if (!isOpen || !liquidation) return null;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved':
        return {
          color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          icon: <CheckCircle size={20} />,
          label: 'Approved',
        };
      case 'rejected':
        return {
          color: 'text-red-400 bg-red-500/10 border-red-500/20',
          icon: <XCircle size={20} />,
          label: 'Rejected',
        };
      default:
        return {
          color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          icon: <Clock size={20} />,
          label: 'Pending',
        };
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
      return format(parseISO(dateString), 'MMMM dd, yyyy');
    } catch {
      return new Date(dateString).toLocaleDateString();
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMMM dd, yyyy h:mm a');
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

  const handleAction = async (action: 'approve' | 'reject') => {
    setIsProcessing(true);
    setActionType(action);
    setError(null);

    try {
      const response = await fetch('/api/liquidation/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: liquidation.id,
          action,
          adminId,
          reviewerComment: reviewerComment.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} liquidation`);
      }

      onActionSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
      setActionType(null);
    }
  };

  const statusConfig = getStatusConfig(liquidation.status);

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-900 shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Receipt className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Liquidation Details</h3>
                <p className="text-slate-400 text-sm">ID: {liquidation.id.slice(0, 8)}...</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 bg-slate-900/50">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border ${statusConfig.color}`}>
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Submitted</p>
              <p className="text-sm text-slate-300">{formatDateTime(liquidation.created_at)}</p>
            </div>
          </div>

          {/* Employee Info */}
          {liquidation.profiles && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Employee Information</h4>
              </div>
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-sm">
                    {liquidation.profiles.first_name[0]}{liquidation.profiles.last_name[0]}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {liquidation.profiles.first_name} {liquidation.profiles.last_name}
                    </p>
                    <p className="text-slate-400 text-sm">{liquidation.profiles.email}</p>
                    {liquidation.profiles.employee_id && (
                      <p className="text-slate-500 text-xs">ID: {liquidation.profiles.employee_id}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Liquidation Details */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Receipt className="text-orange-400" size={18} />
              <h4 className="font-semibold text-white">Liquidation Details</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ml-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">Cash Advance</p>
                <p className="text-white font-bold text-lg font-mono">
                  {liquidation.cash_advances ? formatCurrency(liquidation.cash_advances.amount) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Expenses</p>
                <p className="text-orange-400 font-bold text-lg font-mono">
                  {formatCurrency(liquidation.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Liquidation Date</p>
                <p className="text-white font-medium">{formatDate(liquidation.liquidation_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Store</p>
                <div className="flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400" />
                  <p className="text-white font-medium">
                    {liquidation.stores ? liquidation.stores.store_code : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Return to Company / Reimbursement */}
            <div className="grid grid-cols-2 gap-4 mt-4 ml-6">
              {liquidation.return_to_company > 0 && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 uppercase font-semibold">Return to Company</p>
                  <p className="text-emerald-400 mt-1 font-mono text-lg font-bold">
                    {formatCurrency(liquidation.return_to_company)}
                  </p>
                </div>
              )}
              {liquidation.reimbursement > 0 && (
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs text-blue-400 uppercase font-semibold">Reimbursement</p>
                  <p className="text-blue-400 mt-1 font-mono text-lg font-bold">
                    {formatCurrency(liquidation.reimbursement)}
                  </p>
                  <p className="text-xs text-blue-400/70 mt-1">Employee owes</p>
                </div>
              )}
            </div>

            {/* Ticket */}
            {liquidation.tickets && (
              <div className="mt-4 ml-6 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Ticket size={14} className="text-slate-400" />
                  <p className="text-xs text-slate-400 uppercase font-semibold">Incident No.</p>
                </div>
                <p className="text-white mt-1">{liquidation.tickets.rcc_reference_number}</p>
              </div>
            )}
          </div>

          {/* Expense Items Table */}
          {liquidation.liquidation_items && liquidation.liquidation_items.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <h4 className="font-semibold text-white mb-3">Expense Items</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-900/50 text-slate-400">
                      <th className="px-2 py-2 text-left">From</th>
                      <th className="px-2 py-2 text-left">To</th>
                      <th className="px-2 py-2 text-right">Jeep</th>
                      <th className="px-2 py-2 text-right">Bus</th>
                      <th className="px-2 py-2 text-right">FX/Van</th>
                      <th className="px-2 py-2 text-right">Gas</th>
                      <th className="px-2 py-2 text-right">Toll</th>
                      <th className="px-2 py-2 text-right">Meals</th>
                      <th className="px-2 py-2 text-right">Lodging</th>
                      <th className="px-2 py-2 text-right">Others</th>
                      <th className="px-2 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidation.liquidation_items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-700">
                        <td className="px-2 py-2 text-white">{item.from_destination || '-'}</td>
                        <td className="px-2 py-2 text-white">{item.to_destination || '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.jeep > 0 ? formatCurrency(item.jeep) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.bus > 0 ? formatCurrency(item.bus) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.fx_van > 0 ? formatCurrency(item.fx_van) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.gas > 0 ? formatCurrency(item.gas) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.toll > 0 ? formatCurrency(item.toll) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.meals > 0 ? formatCurrency(item.meals) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.lodging > 0 ? formatCurrency(item.lodging) : '-'}</td>
                        <td className="px-2 py-2 text-right text-slate-300">{item.others > 0 ? formatCurrency(item.others) : '-'}</td>
                        <td className="px-2 py-2 text-right text-orange-400 font-semibold">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Remarks */}
          {liquidation.remarks && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <h4 className="font-semibold text-white mb-2">Remarks</h4>
              <p className="text-slate-300 text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700 italic">
                &quot;{liquidation.remarks}&quot;
              </p>
            </div>
          )}

          {/* Attachments */}
          {liquidation.liquidation_attachments && liquidation.liquidation_attachments.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                <Paperclip size={16} />
                Receipt Attachments ({liquidation.liquidation_attachments.length})
                {loadingAttachments && <Loader2 size={14} className="animate-spin" />}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {liquidation.liquidation_attachments.map((attachment) => {
                  const signedUrl = attachmentUrls[attachment.id];
                  return (
                    <a
                      key={attachment.id}
                      href={signedUrl || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`group block p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all ${!signedUrl ? 'pointer-events-none opacity-60' : ''}`}
                      onClick={(e) => !signedUrl && e.preventDefault()}
                    >
                      {isImageFile(attachment.file_type) ? (
                        <div className="aspect-square mb-2 rounded overflow-hidden bg-slate-800">
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
                        <div className="aspect-square mb-2 rounded bg-slate-800 flex items-center justify-center">
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
          )}

          {/* Review Information (for non-pending) */}
          {liquidation.status !== 'pending' && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Review Information</h4>
              </div>
              <div className="space-y-3 ml-6">
                {liquidation.approved_at && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Reviewed On</p>
                    <p className="text-white font-medium">{formatDateTime(liquidation.approved_at)}</p>
                  </div>
                )}
                {liquidation.reviewer_comment && (
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Comment</p>
                    <p className="text-slate-300 bg-slate-900/50 p-3 rounded-lg italic border border-slate-700">
                      &quot;{liquidation.reviewer_comment}&quot;
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Section (for pending requests) */}
          {liquidation.status === 'pending' && (
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={18} />
                <h4 className="font-semibold text-white">Review Action</h4>
              </div>
              <div className="ml-6 space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Comment (optional)
                  </label>
                  <textarea
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    placeholder="Add a comment for this decision..."
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={isProcessing}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end gap-3 shrink-0">
          {liquidation.status === 'pending' ? (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing && actionType === 'reject' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>
              <button
                onClick={() => handleAction('approve')}
                disabled={isProcessing}
                className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing && actionType === 'approve' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
