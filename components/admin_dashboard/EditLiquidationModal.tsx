'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Receipt, Loader2, Save, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface LiquidationItem {
  id: string;
  from_destination: string;
  to_destination: string;
  total: number;
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
  profiles: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    employee_id: string | null;
  } | null;
}

interface Store {
  id: string;
  store_code: string;
  store_name: string;
}

interface EditLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  liquidation: Liquidation | null;
  onEditSuccess: () => void;
}

export const EditLiquidationModal: React.FC<EditLiquidationModalProps> = ({
  isOpen,
  onClose,
  liquidation,
  onEditSuccess,
}) => {
  const [formData, setFormData] = useState({
    store_id: '',
    ticket_id: '',
    liquidation_date: '',
    remarks: '',
    status: 'pending' as 'pending' | 'approved' | 'rejected',
  });
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoadingStores, setIsLoadingStores] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch stores on mount
  useEffect(() => {
    const fetchStores = async () => {
      setIsLoadingStores(true);
      try {
        const response = await fetch('/api/stores/get');
        if (response.ok) {
          const data = await response.json();
          setStores(data.stores || []);
        }
      } catch (err) {
        console.error('Failed to fetch stores:', err);
      } finally {
        setIsLoadingStores(false);
      }
    };

    if (isOpen) {
      fetchStores();
    }
  }, [isOpen]);

  // Populate form when liquidation changes
  useEffect(() => {
    if (liquidation) {
      setFormData({
        store_id: liquidation.store_id || '',
        ticket_id: liquidation.ticket_id?.toString() || '',
        liquidation_date: format(parseISO(liquidation.liquidation_date), 'yyyy-MM-dd'),
        remarks: liquidation.remarks || '',
        status: liquidation.status,
      });
      setError(null);
    }
  }, [liquidation]);

  if (!isOpen || !liquidation) return null;

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

    try {
      const response = await fetch('/api/liquidation/edit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: liquidation.id,
          store_id: formData.store_id,
          ticket_id: formData.ticket_id ? parseInt(formData.ticket_id) : null,
          liquidation_date: formData.liquidation_date,
          remarks: formData.remarks.trim() || null,
          status: formData.status,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update liquidation');
      }

      onEditSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
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
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Receipt className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Edit Liquidation</h3>
                <p className="text-slate-400 text-sm">
                  {liquidation.profiles
                    ? `${liquidation.profiles.first_name} ${liquidation.profiles.last_name}`
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

        {/* Summary Info */}
        <div className="px-6 py-4 bg-slate-800/50 border-b border-slate-700">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-500 text-xs mb-1">Cash Advance</p>
              <p className="text-white font-mono font-semibold">
                {liquidation.cash_advances ? formatCurrency(liquidation.cash_advances.amount) : '-'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Total Expenses</p>
              <p className="text-orange-400 font-mono font-semibold">
                {formatCurrency(liquidation.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">
                {liquidation.return_to_company > 0 ? 'Return' : 'Reimburse'}
              </p>
              <p className={`font-mono font-semibold ${liquidation.return_to_company > 0 ? 'text-emerald-400' : 'text-blue-400'}`}>
                {liquidation.return_to_company > 0
                  ? formatCurrency(liquidation.return_to_company)
                  : formatCurrency(liquidation.reimbursement)}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 max-h-[400px] overflow-y-auto">
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
                  className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50 appearance-none"
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

            {/* Store */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Store
              </label>
              <select
                name="store_id"
                value={formData.store_id}
                onChange={handleInputChange}
                disabled={isSubmitting || isLoadingStores}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
              >
                <option value="">Select a store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.store_code} - {store.store_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Ticket ID */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Ticket/Incident No. (Optional)
              </label>
              <input
                type="text"
                name="ticket_id"
                value={formData.ticket_id}
                onChange={handleInputChange}
                placeholder="Enter ticket number"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Liquidation Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Liquidation Date
              </label>
              <input
                type="date"
                name="liquidation_date"
                value={formData.liquidation_date}
                onChange={handleInputChange}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent disabled:opacity-50"
              />
            </div>

            {/* Remarks */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
                placeholder="Enter remarks"
                rows={3}
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none disabled:opacity-50"
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
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
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
