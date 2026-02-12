'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, User, CheckCircle, XCircle, Clock, Loader2, AlertCircle, MapPin, Ticket, Paperclip, FileImage, File, Eye } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LiquidationItem {
  id: string;
  expense_date?: string;
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
  liquidation_item_attachments?: LiquidationAttachment[];
}

interface LiquidationAttachment {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
  liquidation_item_id?: string | null;
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
  status: 'pending' | 'level1_approved' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
  reviewer_comment: string | null;
  level1_approved_by: string | null;
  level1_approved_at: string | null;
  level1_reviewer_comment: string | null;
  level2_approved_by: string | null;
  level2_approved_at: string | null;
  level2_reviewer_comment: string | null;
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
  approver: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
    position_id: string | null;
    positions: {
      name: string;
    } | null;
  } | null;
  level1_approver: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
    position_id: string | null;
    positions: {
      name: string;
    } | null;
  } | null;
  level2_approver: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
    position_id: string | null;
    positions: {
      name: string;
    } | null;
  } | null;
}

interface LiquidationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidation: Liquidation | null;
  adminId: string;
  onActionSuccess: () => void;
  canApproveLiquidation?: boolean;
  canApproveLevel1?: boolean;
  canApproveLevel2?: boolean;
}

export const LiquidationDetailModal: React.FC<LiquidationDetailModalProps> = ({
  isOpen,
  onClose,
  liquidation,
  adminId,
  onActionSuccess,
  canApproveLiquidation = false,
  canApproveLevel1 = false,
  canApproveLevel2 = false,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [currentLevel, setCurrentLevel] = useState<1 | 2 | null>(null);
  const [reviewerComment, setReviewerComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attachmentUrls, setAttachmentUrls] = useState<{ [key: string]: string }>({});
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Fetch signed URLs for attachments when viewing a liquidation
  useEffect(() => {
    if (isOpen && liquidation) {
      // Collect all attachments (liquidation-level and item-level)
      const allAttachments: LiquidationAttachment[] = [
        ...(liquidation.liquidation_attachments || []),
      ];

      // Add item-level attachments
      liquidation.liquidation_items?.forEach((item) => {
        if (item.liquidation_item_attachments) {
          allAttachments.push(...item.liquidation_item_attachments);
        }
      });

      if (allAttachments.length > 0) {
        fetchAttachmentUrls(allAttachments);
      }
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
      case 'level1_approved':
        return {
          color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          icon: <CheckCircle size={20} />,
          label: 'Level 1 Approved',
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

  const handleAction = async (action: 'approve' | 'reject', level: 1 | 2) => {
    setIsProcessing(true);
    setActionType(action);
    setCurrentLevel(level);
    setError(null);

    try {
      const response = await fetch('/api/liquidation/update-status-level', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: liquidation.id,
          action,
          level,
          adminId,
          reviewerComment: reviewerComment.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} liquidation at Level ${level}`);
      }

      onActionSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
      setActionType(null);
      setCurrentLevel(null);
    }
  };

  const statusConfig = getStatusConfig(liquidation.status);

  const modalContent = (
    <div
      className="fixed inset-0 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity z-[9999]"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-7xl rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-in zoom-in-95 duration-200 max-h-[95vh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-700 bg-slate-900 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="p-1.5 sm:p-2 bg-orange-500/10 rounded-lg shrink-0">
                <Receipt className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg sm:text-2xl font-bold text-white truncate">Liquidation Details</h3>
                <p className="text-slate-400 text-xs sm:text-sm truncate">ID: {liquidation.id.slice(0, 8)}...</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors shrink-0"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1 bg-slate-900/50">
          {/* Status Badge */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium border ${statusConfig.color}`}>
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-slate-500">Submitted</p>
              <p className="text-xs sm:text-sm text-slate-300">{formatDateTime(liquidation.created_at)}</p>
            </div>
          </div>

          {/* Employee Info */}
          {liquidation.profiles && (
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <User className="text-blue-400" size={16} />
                <h4 className="font-semibold text-white text-sm sm:text-base">Employee Information</h4>
              </div>
              <div className="space-y-2 sm:ml-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0">
                    {liquidation.profiles.first_name[0]}{liquidation.profiles.last_name[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-medium text-sm sm:text-base truncate">
                      {liquidation.profiles.first_name} {liquidation.profiles.last_name}
                    </p>
                    <p className="text-slate-400 text-xs sm:text-sm truncate">{liquidation.profiles.email}</p>
                    {liquidation.profiles.employee_id && (
                      <p className="text-slate-500 text-xs">ID: {liquidation.profiles.employee_id}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Liquidation Details */}
          <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Receipt className="text-orange-400" size={16} />
              <h4 className="font-semibold text-white text-sm sm:text-base">Liquidation Details</h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 sm:ml-6">
              <div>
                <p className="text-xs text-slate-400 mb-1">Cash Advance</p>
                <p className="text-white font-bold text-base sm:text-lg font-mono break-all">
                  {liquidation.cash_advances ? formatCurrency(liquidation.cash_advances.amount) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Expenses</p>
                <p className="text-orange-400 font-bold text-base sm:text-lg font-mono break-all">
                  {formatCurrency(liquidation.total_amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Liquidation Date</p>
                <p className="text-white font-medium text-sm sm:text-base">{formatDate(liquidation.liquidation_date)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Store</p>
                <div className="flex items-center gap-1">
                  <MapPin size={14} className="text-slate-400 shrink-0" />
                  <p className="text-white font-medium text-sm sm:text-base truncate">
                    {liquidation.stores ? liquidation.stores.store_code : 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Return to Company / Reimbursement */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3 sm:mt-4 sm:ml-6">
              {liquidation.return_to_company > 0 && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-xs text-emerald-400 uppercase font-semibold">Return to Company</p>
                  <p className="text-emerald-400 mt-1 font-mono text-base sm:text-lg font-bold break-all">
                    {formatCurrency(liquidation.return_to_company)}
                  </p>
                </div>
              )}
              {liquidation.reimbursement > 0 && (
                <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-xs text-blue-400 uppercase font-semibold">Reimbursement</p>
                  <p className="text-blue-400 mt-1 font-mono text-base sm:text-lg font-bold break-all">
                    {formatCurrency(liquidation.reimbursement)}
                  </p>
                  <p className="text-xs text-blue-400/70 mt-1">Employee owes</p>
                </div>
              )}
            </div>

            {/* Ticket */}
            {liquidation.tickets && (
              <div className="mt-3 sm:mt-4 sm:ml-6 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <div className="flex items-center gap-2">
                  <Ticket size={14} className="text-slate-400" />
                  <p className="text-xs text-slate-400 uppercase font-semibold">Incident No.</p>
                </div>
                <p className="text-white mt-1 text-sm sm:text-base break-all">{liquidation.tickets.rcc_reference_number}</p>
              </div>
            )}
          </div>

          {/* Expense Items Table */}
          {liquidation.liquidation_items && liquidation.liquidation_items.length > 0 && (
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
              <h4 className="font-semibold text-white mb-3 text-sm sm:text-base">Expense Items</h4>
              <div className="space-y-3 sm:space-y-4">
                {liquidation.liquidation_items.map((item, index) => (
                  <div key={item.id} className="bg-slate-900/50 p-3 sm:p-4 rounded-lg border border-slate-700">
                    {/* Row Header */}
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs sm:text-sm font-semibold text-orange-400">
                        Row #{index + 1}
                      </h5>
                      <span className="text-xs sm:text-sm font-mono font-bold text-orange-400 break-all">
                        {formatCurrency(item.total)}
                      </span>
                    </div>

                    {/* Expense Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Date</p>
                        <p className="text-white text-xs sm:text-sm font-semibold">
                          {item.expense_date ? format(parseISO(item.expense_date), 'MMM dd, yyyy') : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">From</p>
                        <p className="text-white text-xs sm:text-sm truncate">{item.from_destination || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 mb-1">To</p>
                        <p className="text-white text-xs sm:text-sm truncate">{item.to_destination || '-'}</p>
                      </div>
                      {item.jeep > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Jeep</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.jeep)}</p>
                        </div>
                      )}
                      {item.bus > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Bus</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.bus)}</p>
                        </div>
                      )}
                      {item.fx_van > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">FX/Van</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.fx_van)}</p>
                        </div>
                      )}
                      {item.gas > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Gas</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.gas)}</p>
                        </div>
                      )}
                      {item.toll > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Toll</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.toll)}</p>
                        </div>
                      )}
                      {item.meals > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Meals</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.meals)}</p>
                        </div>
                      )}
                      {item.lodging > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Lodging</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.lodging)}</p>
                        </div>
                      )}
                      {item.others > 0 && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Others</p>
                          <p className="text-slate-300 text-xs sm:text-sm font-mono break-all">{formatCurrency(item.others)}</p>
                        </div>
                      )}
                    </div>

                    {/* Remarks */}
                    {item.remarks && (
                      <div className="mb-3">
                        <p className="text-xs text-slate-400 mb-1">Remarks</p>
                        <p className="text-slate-300 text-xs sm:text-sm italic break-words">{item.remarks}</p>
                      </div>
                    )}

                    {/* Row Attachments */}
                    {item.liquidation_item_attachments && item.liquidation_item_attachments.length > 0 && (
                      <div className="border-t border-slate-700 pt-3">
                        <p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
                          <Paperclip size={12} />
                          Receipts ({item.liquidation_item_attachments.length})
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {item.liquidation_item_attachments.map((attachment) => {
                            const signedUrl = attachmentUrls[attachment.id];
                            return (
                              <button
                                key={attachment.id}
                                type="button"
                                onClick={() => {
                                  if (signedUrl) {
                                    setPreviewImage({ url: signedUrl, name: attachment.file_name });
                                  }
                                }}
                                className={`group block p-2 bg-slate-800 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all text-left ${!signedUrl ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
                              >
                                {isImageFile(attachment.file_type) ? (
                                  <div className="aspect-square mb-1 rounded overflow-hidden bg-slate-900">
                                    {signedUrl ? (
                                      <img
                                        src={signedUrl}
                                        alt={attachment.file_name}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <Loader2 size={16} className="text-slate-500 animate-spin" />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="aspect-square mb-1 rounded bg-slate-900 flex items-center justify-center">
                                    <File size={20} className="text-slate-500" />
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
                                    <Eye size={8} className="text-slate-500 group-hover:text-orange-400" />
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Remarks */}
          {liquidation.remarks && (
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
              <h4 className="font-semibold text-white mb-2 text-sm sm:text-base">Remarks</h4>
              <p className="text-slate-300 text-xs sm:text-sm bg-slate-900/50 p-3 rounded-lg border border-slate-700 italic whitespace-pre-wrap break-words">
                &quot;{liquidation.remarks}&quot;
              </p>
            </div>
          )}

          {/* Attachments (only show general/non-item-specific ones) */}
          {(() => {
            const generalAttachments = (liquidation.liquidation_attachments || []).filter(
              (att) => !att.liquidation_item_id
            );
            if (generalAttachments.length === 0) return null;
            return (
              <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2 text-sm sm:text-base">
                  <Paperclip size={14} className="sm:size-4" />
                  General Attachments ({generalAttachments.length})
                  {loadingAttachments && <Loader2 size={14} className="animate-spin" />}
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {generalAttachments.map((attachment) => {
                    const signedUrl = attachmentUrls[attachment.id];
                    return (
                      <button
                        key={attachment.id}
                        type="button"
                        onClick={() => {
                          if (signedUrl) {
                            setPreviewImage({ url: signedUrl, name: attachment.file_name });
                          }
                        }}
                        className={`group block p-3 bg-slate-900 rounded-lg border border-slate-700 hover:border-orange-500/50 transition-all text-left ${!signedUrl ? 'pointer-events-none opacity-60' : 'cursor-pointer'}`}
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
                            <Eye size={10} className="text-slate-500 group-hover:text-orange-400" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Review Information */}
          {(liquidation.status !== 'pending' || liquidation.level1_approved_by) && (
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={16} />
                <h4 className="font-semibold text-white text-sm sm:text-base">Review Information</h4>
              </div>
              <div className="space-y-4 sm:ml-6">
                {/* Level 1 Approval Info */}
                {liquidation.level1_approver && (
                  <div className="border-l-2 border-blue-500/30 pl-3">
                    <p className="text-xs font-semibold text-blue-400 mb-2">Level 1 Approval</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Approved By</p>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                          <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {liquidation.level1_approver.first_name[0]}{liquidation.level1_approver.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium text-xs truncate">
                              {liquidation.level1_approver.first_name} {liquidation.level1_approver.last_name}
                            </p>
                            <p className="text-slate-400 text-xs truncate">{liquidation.level1_approver.email}</p>
                            {liquidation.level1_approver.positions?.name && (
                              <p className="text-slate-500 text-xs truncate">{liquidation.level1_approver.positions.name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {liquidation.level1_approved_at && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Approved On</p>
                          <p className="text-white font-medium text-xs">{formatDateTime(liquidation.level1_approved_at)}</p>
                        </div>
                      )}
                      {liquidation.level1_reviewer_comment && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Comment</p>
                          <p className="text-slate-300 bg-slate-900/50 p-2 rounded-lg italic border border-slate-700 whitespace-pre-wrap text-xs break-words">
                            &quot;{liquidation.level1_reviewer_comment}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Level 2 Approval Info */}
                {liquidation.level2_approver && (
                  <div className="border-l-2 border-emerald-500/30 pl-3">
                    <p className="text-xs font-semibold text-emerald-400 mb-2">Level 2 Approval (Final)</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Approved By</p>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                          <div className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {liquidation.level2_approver.first_name[0]}{liquidation.level2_approver.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium text-xs truncate">
                              {liquidation.level2_approver.first_name} {liquidation.level2_approver.last_name}
                            </p>
                            <p className="text-slate-400 text-xs truncate">{liquidation.level2_approver.email}</p>
                            {liquidation.level2_approver.positions?.name && (
                              <p className="text-slate-500 text-xs truncate">{liquidation.level2_approver.positions.name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {liquidation.level2_approved_at && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Approved On</p>
                          <p className="text-white font-medium text-xs">{formatDateTime(liquidation.level2_approved_at)}</p>
                        </div>
                      )}
                      {liquidation.level2_reviewer_comment && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Comment</p>
                          <p className="text-slate-300 bg-slate-900/50 p-2 rounded-lg italic border border-slate-700 whitespace-pre-wrap text-xs break-words">
                            &quot;{liquidation.level2_reviewer_comment}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Rejection Info (if rejected and no level approvals shown) */}
                {liquidation.status === 'rejected' && !liquidation.level1_approver && !liquidation.level2_approver && liquidation.approver && (
                  <div className="border-l-2 border-red-500/30 pl-3">
                    <p className="text-xs font-semibold text-red-400 mb-2">Rejected</p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs text-slate-400 mb-1">Rejected By</p>
                        <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700">
                          <div className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs shrink-0">
                            {liquidation.approver.first_name[0]}{liquidation.approver.last_name[0]}
                          </div>
                          <div className="min-w-0">
                            <p className="text-white font-medium text-xs truncate">
                              {liquidation.approver.first_name} {liquidation.approver.last_name}
                            </p>
                            <p className="text-slate-400 text-xs truncate">{liquidation.approver.email}</p>
                            {liquidation.approver.positions?.name && (
                              <p className="text-slate-500 text-xs truncate">{liquidation.approver.positions.name}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {liquidation.approved_at && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Rejected On</p>
                          <p className="text-white font-medium text-xs">{formatDateTime(liquidation.approved_at)}</p>
                        </div>
                      )}
                      {liquidation.reviewer_comment && (
                        <div>
                          <p className="text-xs text-slate-400 mb-1">Comment</p>
                          <p className="text-slate-300 bg-slate-900/50 p-2 rounded-lg italic border border-slate-700 whitespace-pre-wrap text-xs break-words">
                            &quot;{liquidation.reviewer_comment}&quot;
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Section */}
          {((liquidation.status === 'pending' && canApproveLevel1) ||
            (liquidation.status === 'level1_approved' && canApproveLevel2)) && (
            <div className="bg-slate-800 p-3 sm:p-4 rounded-xl border border-slate-700 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="text-blue-400" size={16} />
                <h4 className="font-semibold text-white text-sm sm:text-base">
                  Review Action - Level {liquidation.status === 'pending' ? '1' : '2'}
                  {liquidation.status === 'level1_approved' && ' (Final Approval)'}
                </h4>
              </div>
              <div className="sm:ml-6 space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-2">
                    Comment (optional)
                  </label>
                  <textarea
                    value={reviewerComment}
                    onChange={(e) => setReviewerComment(e.target.value)}
                    placeholder="Add a comment for this decision..."
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-slate-900 border border-slate-600 rounded-lg text-white text-xs sm:text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={isProcessing}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs sm:text-sm break-words">
                    {error}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-6 bg-slate-800 border-t border-slate-700 flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 shrink-0">
          {liquidation.status === 'pending' && canApproveLevel1 ? (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50 order-3 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject', 1)}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-2 sm:order-2"
              >
                {isProcessing && actionType === 'reject' && currentLevel === 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>
              <button
                onClick={() => handleAction('approve', 1)}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-3"
              >
                {isProcessing && actionType === 'approve' && currentLevel === 1 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve Level 1
              </button>
            </>
          ) : liquidation.status === 'level1_approved' && canApproveLevel2 ? (
            <>
              <button
                onClick={onClose}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50 order-3 sm:order-1"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject', 2)}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-2 sm:order-2"
              >
                {isProcessing && actionType === 'reject' && currentLevel === 2 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                Reject
              </button>
              <button
                onClick={() => handleAction('approve', 2)}
                disabled={isProcessing}
                className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 order-1 sm:order-3"
              >
                {isProcessing && actionType === 'approve' && currentLevel === 2 ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Approve Level 2 (Final)
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] bg-slate-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-700 bg-slate-800/50">
              <h3 className="text-white font-medium truncate flex items-center gap-2 text-sm sm:text-base min-w-0 flex-1">
                <FileImage size={16} className="text-orange-400 shrink-0 sm:size-5" />
                <span className="truncate">{previewImage.name}</span>
              </h3>
              <button
                onClick={() => setPreviewImage(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors shrink-0"
              >
                <X size={18} className="sm:size-5" />
              </button>
            </div>
            <div className="p-2 sm:p-4 flex items-center justify-center bg-slate-950">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-w-full max-h-[calc(95vh-6rem)] sm:max-h-[calc(90vh-8rem)] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
