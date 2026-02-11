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
  type: 'personal' | 'support' | 'reimbursement';
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
    type: 'personal' as 'personal' | 'support' | 'reimbursement',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    purpose: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [hasPendingCashAdvance, setHasPendingCashAdvance] = useState(false);
  const [checkingPending, setCheckingPending] = useState(false);

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

  // Reset state when modal opens and check for pending cash advances
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setFormData({
        type: 'personal',
        amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        purpose: '',
      });

      // Check for pending cash advances
      const checkPendingCashAdvances = async () => {
        setCheckingPending(true);
        try {
          const response = await fetch('/api/cash-advance/my-requests?limit=100');
          if (response.ok) {
            const data = await response.json();
            const hasPending = data.cashAdvances?.some(
              (ca: any) => ca.status === 'pending' && !ca.deleted_at
            );
            setHasPendingCashAdvance(hasPending);
            if (hasPending) {
              setError('You cannot file a new cash advance while you have a pending cash advance request.');
            }
          }
        } catch (err) {
          console.error('Error checking for pending cash advances:', err);
        } finally {
          setCheckingPending(false);
        }
      };

      checkPendingCashAdvances();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate amount - optional for reimbursement
    const amount = parseFloat(formData.amount);
    if (formData.type !== 'reimbursement' && (isNaN(amount) || amount <= 0)) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    mutation.mutate({
      userId,
      type: formData.type,
      amount: formData.type === 'reimbursement' && !formData.amount ? 0 : amount,
      date: formData.date,
      purpose: formData.purpose,
    });
  };

  const handleClose = () => {
    setError(null);
    setHasPendingCashAdvance(false);
    setCheckingPending(false);
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
    <div className="fixed inset-0 z-[9999] flex items-start sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 my-4 sm:my-0 max-h-[calc(100vh-2rem)] flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-700 shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-green-400 text-xl sm:text-2xl font-bold">₱</span>
            File Cash Advance
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 sm:p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-start gap-3 text-xs sm:text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4">
            {/* Cash Advance Type */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-400 mb-2">Type of Cash Advance</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'support' })}
                  className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-0.5 sm:gap-1 ${
                    formData.type === 'support'
                      ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="font-semibold text-sm sm:text-base">Support</span>
                  <span className="text-[10px] sm:text-xs opacity-70">Support Cash Advance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'personal' })}
                  className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-0.5 sm:gap-1 ${
                    formData.type === 'personal'
                      ? 'border-green-500 bg-green-500/10 text-green-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="font-semibold text-sm sm:text-base">Personal</span>
                  <span className="text-[10px] sm:text-xs opacity-70">Personal Cash Advance</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: 'reimbursement' })}
                  className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-0.5 sm:gap-1 ${
                    formData.type === 'reimbursement'
                      ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                      : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  <span className="font-semibold text-sm sm:text-base">Reimbursement</span>
                  <span className="text-[10px] sm:text-xs opacity-70">Reimbursement</span>
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-400 mb-1.5">
                Amount (PHP) {formData.type === 'reimbursement' && <span className="text-slate-500">(Optional)</span>}
              </label>
              <div className="relative">
                <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm sm:text-base">₱</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: formatCurrency(e.target.value) })}
                  placeholder="0.00"
                  required={formData.type !== 'reimbursement'}
                  className="w-full bg-slate-950 border border-slate-700 text-white pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none text-base sm:text-lg font-mono"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-400 mb-1.5">Date Requested</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl focus:ring-2 focus:ring-green-500 outline-none [color-scheme:dark] text-sm sm:text-base"
              />
            </div>

            {/* Purpose (Optional) */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-slate-400 mb-1.5">
                Purpose <span className="text-slate-500">(Optional)</span>
              </label>
              <textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                placeholder="Briefly describe the purpose of this cash advance..."
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 sm:px-4 py-2 sm:py-3 rounded-xl focus:ring-2 focus:ring-green-500 outline-none resize-none placeholder-slate-500 text-sm sm:text-base"
              />
            </div>
          </div>

          {/* Info box */}
          <div className="p-3 sm:p-4 bg-slate-800/50 border border-slate-700 rounded-xl">
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Your cash advance request will be sent to <span className="text-white font-medium">HR / Accounting</span> for approval.
              You will be notified once your request has been reviewed.
            </p>
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-stretch gap-2 sm:gap-3 pt-2 shrink-0">
            <button
              type="button"
              onClick={handleClose}
              disabled={mutation.isPending}
              className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50 text-sm sm:text-base"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending || hasPendingCashAdvance || checkingPending}
              className="w-full sm:flex-1 px-4 py-2.5 bg-green-600 text-white hover:bg-green-500 rounded-xl transition-colors shadow-lg shadow-green-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : checkingPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
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
