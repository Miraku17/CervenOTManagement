"use client"
import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Truck,
  Calendar,
  Loader2,
  Trash2,
  Pencil,
  FileImage,
  Download,
  ShieldAlert,
  AlertCircle,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx-js-style';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/usePermissions';
import { Pagination } from '@/components/ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToastContainer, ToastProps } from '@/components/Toast';
import CourierTransactionModal, { CourierTransaction } from '@/components/ticketing/CourierTransactionModal';

interface CourierTransactionsResponse {
  transactions: CourierTransaction[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const fetchTransactions = async (
  page: number,
  limit: number,
  search: string,
  startDate: string,
  endDate: string
): Promise<CourierTransactionsResponse> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.append('search', search);
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const response = await fetch(`/api/courier-transactions/get?${params.toString()}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Failed to fetch courier transactions');
  }
  return response.json();
};

const formatPeso = (value: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0);

export default function CourierTransactionsPage() {
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit, setPageLimit] = useState(20);
  const [showAll, setShowAll] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<CourierTransaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CourierTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const hasAccess = hasPermission('manage_courier_transactions');

  const { data, isLoading, error } = useQuery({
    queryKey: ['courier-transactions', currentPage, showAll ? 5000 : pageLimit, searchTerm, startDate, endDate],
    queryFn: () =>
      fetchTransactions(currentPage, showAll ? 5000 : pageLimit, searchTerm, startDate, endDate),
    enabled: !permissionsLoading && hasAccess,
    staleTime: 30000,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate]);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', message: string, description?: string) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message, description, onClose: removeToast }]);
  };

  const refreshList = () => {
    queryClient.invalidateQueries({ queryKey: ['courier-transactions'] });
  };

  const handleModalSuccess = (message: string, warning?: string) => {
    refreshList();
    showToast('success', message);
    if (warning) {
      showToast('warning', 'Invoice upload issue', warning);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/courier-transactions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete courier transaction');
      }
      showToast('success', 'Courier transaction deleted');
      setDeleteTarget(null);
      refreshList();
    } catch (err) {
      showToast('error', 'Delete failed', err instanceof Error ? err.message : undefined);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleViewInvoice = async (transaction: CourierTransaction) => {
    setViewingInvoiceId(transaction.id);
    try {
      const response = await fetch(`/api/courier-transactions/get-invoice-url?transaction_id=${transaction.id}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load invoice');
      }
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast('error', 'Could not open invoice', err instanceof Error ? err.message : undefined);
    } finally {
      setViewingInvoiceId(null);
    }
  };

  // Excel report (O2) — styled like the other exports in the app
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/courier-transactions/export?${params.toString()}`);
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch export data');
      }

      const transactions: any[] = result.transactions || [];
      if (transactions.length === 0) {
        showToast('warning', 'No transactions to export');
        return;
      }

      const rows: any[][] = [];
      rows.push(['Courier Transactions Report']);
      rows.push([]);
      rows.push([
        'Date',
        'Ticket Number',
        'Pick Up From',
        'Deliver To',
        'Part Name',
        'Courier',
        'Ref #',
        'Amount',
        'Store Name',
        'Store Code',
        'Invoice',
        'Encoded By',
        'Created At',
      ]);

      let totalAmount = 0;
      for (const tx of transactions) {
        totalAmount += Number(tx.amount) || 0;
        rows.push([
          tx.transaction_date || '',
          tx.ticket_number || '',
          tx.pick_up_from || '',
          tx.deliver_to || '',
          tx.part_name || '',
          tx.courier || '',
          tx.reference_number || '',
          Number(tx.amount) || 0,
          tx.stores?.store_name || '',
          tx.stores?.store_code || '',
          tx.invoice_file_name ? 'Yes' : 'No',
          tx.created_by_user
            ? `${tx.created_by_user.first_name} ${tx.created_by_user.last_name}`
            : '',
          tx.created_at ? format(new Date(tx.created_at), 'yyyy-MM-dd HH:mm') : '',
        ]);
      }
      rows.push(['TOTAL', '', '', '', '', '', '', totalAmount, '', '', '', '', '']);

      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(rows);

      worksheet['!cols'] = [
        { wch: 12 }, // Date
        { wch: 18 }, // Ticket Number
        { wch: 22 }, // Pick Up From
        { wch: 22 }, // Deliver To
        { wch: 22 }, // Part Name
        { wch: 14 }, // Courier
        { wch: 16 }, // Ref #
        { wch: 12 }, // Amount
        { wch: 22 }, // Store Name
        { wch: 12 }, // Store Code
        { wch: 10 }, // Invoice
        { wch: 20 }, // Encoded By
        { wch: 18 }, // Created At
      ];

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          const cell = worksheet[cellAddress];
          if (!cell.s) cell.s = {};

          if (R === 0) {
            cell.s = {
              fill: { fgColor: { rgb: '1e40af' } },
              font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R === 2) {
            cell.s = {
              fill: { fgColor: { rgb: '3b82f6' } },
              font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
              alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } },
              },
            };
          } else if (R === range.e.r) {
            // Totals row
            cell.s = {
              fill: { fgColor: { rgb: 'dbeafe' } },
              font: { bold: true },
              border: {
                top: { style: 'thin', color: { rgb: '000000' } },
              },
            };
          } else if (R > 2) {
            const isEvenRow = (R - 3) % 2 === 0;
            cell.s = {
              fill: { fgColor: { rgb: isEvenRow ? 'dbeafe' : 'FFFFFF' } },
              alignment: { horizontal: 'left', vertical: 'top', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'cbd5e1' } },
                bottom: { style: 'thin', color: { rgb: 'cbd5e1' } },
                left: { style: 'thin', color: { rgb: 'cbd5e1' } },
                right: { style: 'thin', color: { rgb: 'cbd5e1' } },
              },
            };
          }
        }
      }

      worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 12 } }];
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Courier Transactions');

      const dateStamp = format(new Date(), 'yyyy-MM-dd');
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array', cellStyles: true });
      const blob = new Blob([excelBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `courier_transactions_${dateStamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast('success', `Exported ${transactions.length} transactions`);
    } catch (err) {
      showToast('error', 'Export failed', err instanceof Error ? err.message : undefined);
    } finally {
      setIsExporting(false);
    }
  };

  if (permissionsLoading || (hasAccess && isLoading)) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading courier transactions...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to access courier transactions.</p>
          </div>
          <button
            onClick={() => router.push('/dashboard/ticketing')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400" />
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Error Loading Transactions</h3>
            <p className="text-slate-400">{error instanceof Error ? error.message : 'An unknown error occurred'}</p>
          </div>
        </div>
      </div>
    );
  }

  const transactions = data?.transactions || [];
  const totalPages = data?.pagination.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Courier Transactions</h1>
          <p className="text-slate-400">Track courier deliveries, parts movement, and transaction invoices.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              setEditItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            <span>Add Transaction</span>
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all shadow-lg shadow-slate-900/20 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>{isExporting ? 'Exporting...' : 'Export Report'}</span>
          </button>
        </div>
      </div>

      {/* Search & Date Filter */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-4">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search by ticket #, ref #, part, courier, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex items-center gap-2 text-slate-400">
            <Calendar size={18} className="flex-shrink-0 text-white" />
            <span className="text-sm font-medium whitespace-nowrap">Date Range:</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 text-white px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm [color-scheme:dark]"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
              >
                Clear Dates
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <Truck size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No courier transactions found</h3>
            <p className="text-slate-500 mt-1">Try adjusting your filters or add a new transaction.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400 font-semibold">Date</TableHead>
                <TableHead className="text-slate-400 font-semibold">Ticket #</TableHead>
                <TableHead className="text-slate-400 font-semibold">Pick Up From</TableHead>
                <TableHead className="text-slate-400 font-semibold">Deliver To</TableHead>
                <TableHead className="text-slate-400 font-semibold">Part Name</TableHead>
                <TableHead className="text-slate-400 font-semibold">Courier</TableHead>
                <TableHead className="text-slate-400 font-semibold">Ref #</TableHead>
                <TableHead className="text-slate-400 font-semibold">Amount</TableHead>
                <TableHead className="text-slate-400 font-semibold">Store Code</TableHead>
                <TableHead className="text-slate-400 font-semibold">Invoice</TableHead>
                <TableHead className="text-slate-400 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="border-slate-800 hover:bg-slate-800/50 transition-colors">
                  <TableCell className="text-slate-300 whitespace-nowrap">
                    {format(new Date(tx.transaction_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {tx.ticket_number ? `#${tx.ticket_number}` : <span className="text-slate-500">—</span>}
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <span className="truncate max-w-[140px] block">{tx.pick_up_from}</span>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <span className="truncate max-w-[140px] block">{tx.deliver_to}</span>
                  </TableCell>
                  <TableCell className="text-slate-300">
                    <span className="truncate max-w-[140px] block">{tx.part_name || '—'}</span>
                  </TableCell>
                  <TableCell className="text-slate-300">{tx.courier || '—'}</TableCell>
                  <TableCell className="font-mono text-slate-400">{tx.reference_number || '—'}</TableCell>
                  <TableCell className="text-right font-mono text-orange-400 whitespace-nowrap">
                    {formatPeso(Number(tx.amount))}
                  </TableCell>
                  <TableCell className="font-mono text-slate-300">
                    {tx.stores?.store_code || <span className="text-slate-500">—</span>}
                  </TableCell>
                  <TableCell>
                    {tx.invoice_path ? (
                      <button
                        onClick={() => handleViewInvoice(tx)}
                        disabled={viewingInvoiceId === tx.id}
                        className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors text-sm disabled:opacity-50"
                      >
                        {viewingInvoiceId === tx.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <FileImage size={14} />
                        )}
                        View
                      </button>
                    ) : (
                      <span className="text-slate-500 text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditItem(tx);
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(tx)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Pagination */}
      {data && data.pagination.total > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageLimit}
          totalCount={data.pagination.total}
          showAll={showAll}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            if (size === 'all') {
              setShowAll(true);
              setCurrentPage(1);
            } else {
              setShowAll(false);
              setPageLimit(size);
              setCurrentPage(1);
            }
          }}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      )}

      {/* Add/Edit Modal */}
      <CourierTransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditItem(null);
        }}
        onSuccess={handleModalSuccess}
        editItem={editItem}
      />

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9998] p-4"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-700 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-white">Delete Courier Transaction</h2>
              <button
                onClick={() => !isDeleting && setDeleteTarget(null)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-slate-400 text-sm">
              Are you sure you want to delete this transaction
              {deleteTarget.ticket_number ? ` for ticket #${deleteTarget.ticket_number}` : ''} dated{' '}
              {format(new Date(deleteTarget.transaction_date), 'MMM d, yyyy')}? This will also remove the
              uploaded invoice photo. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isDeleting && <Loader2 size={16} className="animate-spin" />}
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
