'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X, Loader2 } from 'lucide-react';

interface CashAdvance {
  id: string;
  type: 'personal' | 'support';
  amount: number;
  purpose: string | null;
  requester: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface DeleteCashAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CashAdvance | null;
  onDeleteSuccess: () => void;
}

export const DeleteCashAdvanceModal: React.FC<DeleteCashAdvanceModalProps> = ({
  isOpen,
  onClose,
  request,
  onDeleteSuccess,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !request) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch('/api/cash-advance/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: request.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete request');
      }

      onDeleteSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 mb-4">
          <div className="p-3 bg-red-500/10 rounded-full">
            <AlertTriangle className="text-red-500" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-2">
              Delete Cash Advance Request
            </h3>
            <p className="text-slate-400 text-sm">
              Are you sure you want to delete this cash advance request from{' '}
              <span className="font-semibold text-white">
                {request.requester
                  ? `${request.requester.first_name} ${request.requester.last_name}`
                  : 'Unknown'}
              </span>
              ?
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Request Details */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Type</p>
              <p className="text-white capitalize">{request.type}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Amount</p>
              <p className="text-white font-mono font-semibold">
                {formatCurrency(request.amount)}
              </p>
            </div>
            {request.purpose && (
              <div className="col-span-2">
                <p className="text-slate-500 text-xs mb-1">Purpose</p>
                <p className="text-slate-300 text-sm">{request.purpose}</p>
              </div>
            )}
          </div>
        </div>

        <p className="text-red-400/80 text-xs mb-4">
          This action cannot be undone. The request will be permanently removed from the system.
        </p>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 size={16} />
                <span>Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};
