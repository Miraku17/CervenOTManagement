'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Wallet, Loader2, Save, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface CashAdvance {
  id: string;
  type: 'personal' | 'support';
  amount: number;
  purpose: string | null;
  status: 'pending' | 'approved' | 'rejected';
  date_requested: string;
  date_approved: string | null;
  rejection_reason: string | null;
  created_at: string;
  requester: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
  } | null;
  approved_by_user: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface EditCashAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: CashAdvance | null;
  onEditSuccess: () => void;
}

export const EditCashAdvanceModal: React.FC<EditCashAdvanceModalProps> = ({
  isOpen,
  onClose,
  request,
  onEditSuccess,
}) => {
  const [formData, setFormData] = useState({
    type: 'personal' as 'personal' | 'support',
    amount: '',
    purpose: '',
    date_requested: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when request changes
  useEffect(() => {
    if (request) {
      setFormData({
        type: request.type,
        amount: request.amount.toString(),
        purpose: request.purpose || '',
        date_requested: format(parseISO(request.date_requested), 'yyyy-MM-dd'),
        status: request.status,
      });
      setError(null);
    }
  }, [request]);

  if (!isOpen || !request) return null;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    // Validate amount
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount greater than 0');
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/cash-advance/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: request.id,
          type: formData.type,
          amount: amount,
          purpose: formData.purpose.trim() || null,
          date_requested: formData.date_requested,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update request');
      }

      onEditSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Wallet className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Edit Cash Advance</h3>
                <p className="text-slate-400 text-sm">
                  {request.requester
                    ? `${request.requester.first_name} ${request.requester.last_name}`
                    : 'Unknown Employee'}
                </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Type
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="personal">Personal</option>
                <option value="support">Support</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status
              </label>
              <div className="relative">
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleInputChange}
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 appearance-none"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  {formData.status === 'pending' && <Clock size={18} className="text-amber-400" />}
                  {formData.status === 'approved' && <CheckCircle size={18} className="text-emerald-400" />}
                  {formData.status === 'rejected' && <XCircle size={18} className="text-red-400" />}
                </div>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Amount (PHP)
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="Enter amount"
                min="0"
                step="0.01"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Date Requested */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Date Requested
              </label>
              <input
                type="date"
                name="date_requested"
                value={formData.date_requested}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Purpose (Optional)
              </label>
              <textarea
                name="purpose"
                value={formData.purpose}
                onChange={handleInputChange}
                placeholder="Enter purpose of cash advance"
                rows={3}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none disabled:opacity-50"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
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
