"use client"
import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, Loader2, Upload, Trash2, FileImage } from 'lucide-react';
import { compressImage } from '@/lib/imageCompression';

interface TicketOption {
  id: number;
  rcc_reference_number: string;
  stores?: {
    store_name: string;
    store_code: string;
  } | null;
}

interface StoreOption {
  id: string;
  store_name: string;
  store_code: string;
}

export interface CourierTransaction {
  id: string;
  transaction_date: string;
  ticket_id: number | null;
  ticket_number: string | null;
  pick_up_from: string;
  deliver_to: string;
  part_name: string | null;
  courier: string | null;
  reference_number: string | null;
  amount: number;
  store_id: string | null;
  invoice_path: string | null;
  invoice_file_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  stores?: StoreOption | null;
  created_by_user?: { first_name: string; last_name: string } | null;
}

interface CourierTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string, warning?: string) => void;
  editItem?: CourierTransaction | null;
}

// Convert a File to a base64 string (without the data: prefix)
const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export default function CourierTransactionModal({
  isOpen,
  onClose,
  onSuccess,
  editItem,
}: CourierTransactionModalProps) {
  const [transactionDate, setTransactionDate] = useState('');
  const [ticketNumber, setTicketNumber] = useState('');
  const [ticketId, setTicketId] = useState<number | null>(null);
  const [pickUpFrom, setPickUpFrom] = useState('');
  const [deliverTo, setDeliverTo] = useState('');
  const [partName, setPartName] = useState('');
  const [courier, setCourier] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [storeSearch, setStoreSearch] = useState('');
  const [storeId, setStoreId] = useState<string | null>(null);

  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [invoicePreview, setInvoicePreview] = useState<string | null>(null);
  const [removeInvoice, setRemoveInvoice] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);

  const [ticketResults, setTicketResults] = useState<TicketOption[]>([]);
  const [storeResults, setStoreResults] = useState<StoreOption[]>([]);
  const [showTicketDropdown, setShowTicketDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobUrlRef = useRef<string | null>(null);

  const isEditMode = !!editItem;

  // Populate/reset the form when the modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (editItem) {
      setTransactionDate(editItem.transaction_date?.split('T')[0] || '');
      setTicketNumber(editItem.ticket_number || '');
      setTicketId(editItem.ticket_id);
      setPickUpFrom(editItem.pick_up_from || '');
      setDeliverTo(editItem.deliver_to || '');
      setPartName(editItem.part_name || '');
      setCourier(editItem.courier || '');
      setReferenceNumber(editItem.reference_number || '');
      setAmount(editItem.amount > 0 ? String(editItem.amount) : '');
      setStoreId(editItem.store_id);
      setStoreSearch(
        editItem.stores
          ? `${editItem.stores.store_name} (${editItem.stores.store_code})`
          : ''
      );
    } else {
      setTransactionDate(new Date().toISOString().split('T')[0]);
      setTicketNumber('');
      setTicketId(null);
      setPickUpFrom('');
      setDeliverTo('');
      setPartName('');
      setCourier('');
      setReferenceNumber('');
      setAmount('');
      setStoreId(null);
      setStoreSearch('');
    }
    setInvoiceFile(null);
    setInvoicePreview(null);
    setRemoveInvoice(false);
    setError(null);
  }, [isOpen, editItem]);

  // Ticket autocomplete (debounced)
  useEffect(() => {
    if (!showTicketDropdown) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tickets/search?q=${encodeURIComponent(ticketNumber)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setTicketResults(data.tickets || []);
        }
      } catch {
        // Autocomplete failures are non-fatal; manual entry still works
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [ticketNumber, showTicketDropdown]);

  // Store autocomplete (debounced)
  useEffect(() => {
    if (!showStoreDropdown) return;
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stores/search?q=${encodeURIComponent(storeSearch)}&limit=20`);
        if (res.ok) {
          const data = await res.json();
          setStoreResults(data.stores || []);
        }
      } catch {
        // non-fatal
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [storeSearch, showStoreDropdown]);

  // Cleanup preview blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed for the invoice photo.');
      e.target.value = '';
      return;
    }

    setIsCompressing(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      const previewUrl = URL.createObjectURL(compressed);
      blobUrlRef.current = previewUrl;
      setInvoiceFile(compressed);
      setInvoicePreview(previewUrl);
      setRemoveInvoice(false);
    } catch (err) {
      console.error('Image compression failed:', err);
      setError('Failed to process the invoice image. Please try another file.');
    } finally {
      setIsCompressing(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!transactionDate) {
      setError('Date is required.');
      return;
    }
    if (!pickUpFrom.trim()) {
      setError('Pick up from is required.');
      return;
    }
    if (!deliverTo.trim()) {
      setError('Deliver to is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      let invoicePayload = null;
      if (invoiceFile) {
        invoicePayload = {
          fileName: invoiceFile.name,
          fileType: invoiceFile.type,
          fileData: await fileToBase64(invoiceFile),
        };
      }

      const payload: Record<string, unknown> = {
        transaction_date: transactionDate,
        ticket_id: ticketId,
        ticket_number: ticketNumber,
        pick_up_from: pickUpFrom,
        deliver_to: deliverTo,
        part_name: partName,
        courier,
        reference_number: referenceNumber,
        amount,
        store_id: storeId,
        invoice: invoicePayload,
      };

      let response: Response;
      if (isEditMode && editItem) {
        response = await fetch('/api/courier-transactions/update', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, id: editItem.id, remove_invoice: removeInvoice }),
        });
      } else {
        response = await fetch('/api/courier-transactions/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save courier transaction');
      }

      onSuccess(
        `Courier transaction ${isEditMode ? 'updated' : 'created'} successfully!`,
        result.warning
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save courier transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9998] p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl border border-slate-700 my-8 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-slate-700 flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-white">
            {isEditMode ? 'Edit Courier Transaction' : 'Add Courier Transaction'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-400 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
                required
              />
            </div>

            {/* Ticket Number (autocomplete + free text) */}
            <div className="relative">
              <label className="block text-sm font-medium text-slate-300 mb-1">Ticket Number</label>
              <div className="relative">
                <input
                  type="text"
                  value={ticketNumber}
                  onChange={(e) => {
                    setTicketNumber(e.target.value);
                    setTicketId(null);
                  }}
                  onFocus={() => setShowTicketDropdown(true)}
                  onBlur={() => setTimeout(() => setShowTicketDropdown(false), 200)}
                  className={`${inputClass} pr-10`}
                  placeholder="Search ticket or type manually..."
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {showTicketDropdown && ticketResults.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                  {ticketResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setTicketNumber(t.rcc_reference_number);
                        setTicketId(t.id);
                        setShowTicketDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      #{t.rcc_reference_number}
                      {t.stores && (
                        <span className="text-slate-400"> — {t.stores.store_name}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {ticketId && (
                <p className="text-xs text-emerald-400 mt-1">Linked to ticket #{ticketNumber}</p>
              )}
            </div>

            {/* Pick Up From */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Pick Up From <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={pickUpFrom}
                onChange={(e) => setPickUpFrom(e.target.value)}
                className={inputClass}
                placeholder="Origin location"
                required
              />
            </div>

            {/* Deliver To */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Deliver To <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={deliverTo}
                onChange={(e) => setDeliverTo(e.target.value)}
                className={inputClass}
                placeholder="Destination"
                required
              />
            </div>

            {/* Part Name */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Part Name</label>
              <input
                type="text"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Power supply"
              />
            </div>

            {/* Courier */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Courier</label>
              <input
                type="text"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                className={inputClass}
                placeholder="e.g. LBC, Lalamove"
              />
            </div>

            {/* Ref # */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Ref #</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className={inputClass}
                placeholder="Courier reference number"
              />
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className={`${inputClass} text-right`}
                placeholder="0.00"
              />
            </div>

            {/* Store (autocomplete) */}
            <div className="relative sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-1">Store</label>
              <div className="relative">
                <input
                  type="text"
                  value={storeSearch}
                  onChange={(e) => {
                    setStoreSearch(e.target.value);
                    setStoreId(null);
                  }}
                  onFocus={() => setShowStoreDropdown(true)}
                  onBlur={() => setTimeout(() => setShowStoreDropdown(false), 200)}
                  className={`${inputClass} pr-10`}
                  placeholder="Search store by name or code..."
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
              {showStoreDropdown && storeResults.length > 0 && (
                <div className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                  {storeResults.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setStoreSearch(`${s.store_name} (${s.store_code})`);
                        setStoreId(s.id);
                        setShowStoreDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      {s.store_name}
                      <span className="text-slate-400 font-mono"> ({s.store_code})</span>
                    </button>
                  ))}
                </div>
              )}
              {storeId && (
                <p className="text-xs text-emerald-400 mt-1">Store selected</p>
              )}
            </div>
          </div>

          {/* Invoice Photo */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Transaction Invoice (photo)</label>

            {/* Existing invoice in edit mode */}
            {isEditMode && editItem?.invoice_file_name && !invoiceFile && !removeInvoice && (
              <div className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-md px-3 py-2 mb-2">
                <span className="flex items-center gap-2 text-sm text-slate-300 truncate">
                  <FileImage size={16} className="text-blue-400 flex-shrink-0" />
                  {editItem.invoice_file_name}
                </span>
                <button
                  type="button"
                  onClick={() => setRemoveInvoice(true)}
                  className="text-red-400 hover:text-red-300 transition-colors p-1"
                  title="Remove invoice"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
            {removeInvoice && !invoiceFile && (
              <p className="text-xs text-amber-400 mb-2">
                Invoice will be removed when you save.{' '}
                <button type="button" onClick={() => setRemoveInvoice(false)} className="underline">
                  Undo
                </button>
              </p>
            )}

            {invoicePreview ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={invoicePreview}
                  alt="Invoice preview"
                  className="h-32 rounded-md border border-slate-700 object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceFile(null);
                    setInvoicePreview(null);
                  }}
                  className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 border-dashed rounded-md text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-50"
              >
                {isCompressing ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Upload size={16} />
                )}
                {isCompressing ? 'Processing...' : 'Upload invoice photo'}
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
