'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Loader2, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface FileCashAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

interface CashAdvanceFormData {
  userId: string;
  type: 'personal' | 'support';
  amount: number;
  date: string;
  purpose: string;
}

const submitCashAdvance = async (data: CashAdvanceFormData) => {
  const response = await fetch('/api/cash-advance/file-request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Failed to submit cash advance request');
  }

  return result;
};

const FileCashAdvanceModal: React.FC<FileCashAdvanceModalProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    type: 'personal' as 'personal' | 'support',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
  });
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: submitCashAdvance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-advances'] });
      queryClient.invalidateQueries({ queryKey: ['my-cash-advances'] });
      onSuccess();
      handleClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'An unexpected error occurred.');
    },
  });

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData({
        type: 'personal',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        purpose: '',
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    mutation.mutate({
      userId,
      type: formData.type,
      amount: amount,
      date: formData.date,
      purpose: formData.purpose,
    });
  };

  const handleClose = () => {
    setError(null);
    setFormData({
      type: 'personal',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      purpose: '',
    });
    onClose();
  };

  const formatCurrency = (value: string) => {
    // Remove non-numeric characters except decimal point
    const numericValue = value.replace(/[^0-9.]/g, '');
    return numericValue;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-green-400 text-2xl font-bold">₱</span>
            File Cash Advance
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Cash Advance Type */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Type of Cash Advance</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'support' })}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1 ${
                    formData.type === 'support'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="font-semibold">Support</span>
                  <span className="text-xs opacity-70">Support Cash Advance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'personal' })}
                  className={`px-4 py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-1 ${
                    formData.type === 'personal'
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="font-semibold">Personal</span>
                  <span className="text-xs opacity-70">Personal Cash Advance</span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Amount (PHP)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">₱</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatCurrency(e.target.value) })}
                  placeholder="0.00"
                  required
                  className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-lg font-mono"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Date Requested</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none [color-scheme:dark]"
              />
            </div>

            {/* Purpose (Optional) */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">
                Purpose <span className="text-slate-500">(Optional)</span>
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Briefly describe the purpose of this cash advance..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none placeholder-slate-500"
              />
            </div>
          </div>

          {/* Info box */}
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
            <p className="text-slate-400 text-sm">
              Your cash advance request will be sent to <span className="text-white font-medium">HR / Accounting</span> for approval.
              You will be notified once your request has been reviewed.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full sm:flex-1 px-4 py-2.5 bg-green-600 text-white hover:bg-green-500 rounded-xl transition-colors shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default FileCashAdvanceModal;
