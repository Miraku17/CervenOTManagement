'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Monitor, Laptop, Server, AlertTriangle, Tag, Edit2, Trash2, CheckCircle, Printer, Upload, FileSpreadsheet, Loader2, History, ChevronDown } from 'lucide-react';
import AssetInventoryModal from '@/components/ticketing/AssetInventoryModal';
import ImportLogsModal from '@/components/ticketing/ImportLogsModal';
import ImportLoadingModal from '@/components/ticketing/ImportLoadingModal';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';

interface Asset {
  id: string;
  serial_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  under_warranty: boolean | null;
  warranty_date: string | null;
  categories: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
  models: { id: string; name: string } | null;
  created_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  updated_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  deleted_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
}

export default function AssetInventoryPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  
  // State definitions
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isImportLogsModalOpen, setIsImportLogsModalOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Asset | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isReadOnly, setIsReadOnly] = useState(false); // Can be used for other read-only cases if needed
  const [isEditOnlyUser, setIsEditOnlyUser] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Stats state (for all assets, not just current page)
  const [stats, setStats] = useState({
    totalAssets: 0,
    availablePrinters: 0,
    uniqueCategories: 0,
  });
  
  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      if (permissionsLoading) return;
      if (!user?.id) return;

      try {
        // Check if user has edit-only access from assets_edit_access table
        const { data: editAccess } = await supabase
          .from('assets_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        const isEditOnly = editAccess?.can_edit === true;

        if (isEditOnly) {
          setIsEditOnlyUser(true);
        }

        const canManageAssets = hasPermission('manage_assets');
        const hasAccess = canManageAssets || isEditOnly;

        if (!hasAccess) {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        // Check if user has edit-only access even if other checks fail
        const { data: editAccess } = await supabase
          .from('assets_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        const isEditOnly = editAccess?.can_edit === true;

        if (!isEditOnly) {
          router.push('/dashboard/ticketing/tickets');
        } else {
          setIsEditOnlyUser(true);
        }
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [user?.id, router, permissionsLoading, hasPermission]);

  useEffect(() => {
    fetchAssets();
  }, [currentPage, pageSize, searchTerm, statusFilter, showAll]);

  // Reset to page 1 when search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
    setShowAll(false);
  }, [searchTerm, statusFilter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      // Use a reasonable limit for "All" option
      const effectiveLimit = showAll ? 5000 : pageSize;
      const effectivePage = showAll ? 1 : currentPage;

      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      const statusParam = statusFilter && statusFilter !== 'All' ? `&status=${encodeURIComponent(statusFilter)}` : '';
      const response = await fetch(`/api/assets/get?page=${effectivePage}&limit=${effectiveLimit}${searchParam}${statusParam}`);
      const data = await response.json();

      if (response.ok) {
        setAssets(data.assets || []);
        setStats(data.stats || { totalAssets: 0, availablePrinters: 0, uniqueCategories: 0 });
        setTotalCount(data.pagination.totalCount);
        setTotalPages(data.pagination.totalPages);
      } else {
        showToast('error', 'Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      showToast('error', 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAccess || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  const handleEdit = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the detail modal
    setEditItem(asset);
    setIsModalOpen(true);
  };

  const handleViewDetails = (asset: Asset) => {
    setSelectedAssetForDetail(asset);
    setIsDetailModalOpen(true);
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedAssetForDetail(null);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/assets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', 'Asset deleted successfully');
        fetchAssets();
        setDeleteId(null);
      } else {
        showToast('error', data.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      showToast('error', 'Failed to delete asset');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditItem(null);
  };

  const handleExport = async () => {
    // Fetch ALL assets including deleted ones for the export
    let allAssets: Asset[] = [];
    try {
      const response = await fetch('/api/assets/get-all');
      const data = await response.json();
      if (response.ok) {
        allAssets = data.assets || [];
      }
    } catch (error) {
      console.error('Error fetching all assets:', error);
      // Fallback to current assets if fetch fails
      allAssets = filteredAssets;
    }

    // Sort and filter assets (only non-deleted items)
    const sortedAssets = allAssets
      .filter(asset => !asset.deleted_at)
      .sort((a, b) => {
        const nameA = a.categories?.name || '';
        const nameB = b.categories?.name || '';
        return nameA.localeCompare(nameB);
      });

    // Prepare data for Excel
    const excelData = sortedAssets.map((asset) => ({
      'Category': asset.categories?.name || 'N/A',
      'Brand': asset.brands?.name || 'N/A',
      'Model': asset.models?.name || 'N/A',
      'Serial Number': asset.serial_number || 'N/A',
      'Status': asset.status || 'Available',
      'Under Warranty': asset.under_warranty ? 'Yes' : 'No',
      'Warranty Date': asset.warranty_date ? new Date(asset.warranty_date).toLocaleDateString() : 'N/A',
      'Created At': new Date(asset.created_at).toLocaleDateString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Category
      { wch: 25 }, // Brand
      { wch: 30 }, // Model
      { wch: 30 }, // Serial Number
      { wch: 15 }, // Status
      { wch: 15 }, // Under Warranty
      { wch: 15 }, // Warranty Date
      { wch: 15 }, // Created At
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Asset Inventory');

    // Add metadata sheet
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const metaData = [
      { Field: 'Report Title', Value: 'Asset Inventory Report' },
      { Field: 'Generated Date', Value: today },
      { Field: 'Total Assets', Value: sortedAssets.length },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Report Info');

    // Save file
    const filename = `Asset_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/assets/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asset_inventory_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('success', 'Template downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      showToast('error', error.message || 'Failed to download template');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    // Validate file size (rough estimate: 1MB should be plenty for 1000 rows)
    const maxFileSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxFileSize) {
      showToast('error', 'File is too large. Maximum file size is 5MB (approximately 1000 rows).');
      return;
    }

    setIsImporting(true);
    setImportingFileName(file.name);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1]; // Remove data:application/... prefix

          const response = await fetch('/api/assets/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileData,
              fileName: file.name
            }),
          });

          const data = await response.json();

          // Handle validation errors (400 status)
          if (response.status === 400 && data.result?.errors) {
            console.error('Validation errors:', data.result.errors);

            showToast('error', `❌ Import failed! ${data.result.failed} error(s) found. Nothing was imported.`);

            // Open import logs modal to show detailed errors
            setIsImportLogsModalOpen(true);

            setIsImporting(false);
            setImportingFileName('');
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }

          if (!response.ok) {
            throw new Error(data.error || 'Failed to import file');
          }

          // Show success message - all items imported
          const { result } = data;
          let successMessage = `✅ Import successful! ${result.success} items processed: ${result.created} created, ${result.updated} updated.`;

          // Add info about auto-generated serial numbers
          if (result.autoGeneratedSerials > 0) {
            successMessage += ` (${result.autoGeneratedSerials} serial number(s) auto-generated)`;
          }

          showToast('success', successMessage);

          // Log any unexpected errors (shouldn't happen after validation)
          if (result.errors && result.errors.length > 0) {
            console.error('Unexpected import errors:', result.errors);
          }

          // Refresh assets
          await fetchAssets();
        } catch (error: any) {
          console.error('Error importing file:', error);
          showToast('error', error.message || 'Failed to import file');
        } finally {
          setIsImporting(false);
          setImportingFileName('');
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading file:', error);
      showToast('error', error.message || 'Failed to read file');
      setIsImporting(false);
      setImportingFileName('');
    }
  };

  // Assets are already filtered by the API based on search term
  const filteredAssets = assets;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-60 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right ${
          toast.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (() => {
        const assetToDelete = assets.find(a => a.id === deleteId);
        const isInUse = assetToDelete?.status === 'In Use';
        
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className={`bg-slate-900 rounded-lg shadow-xl w-full max-w-md border ${isInUse ? 'border-amber-500/50' : 'border-slate-700'}`}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {isInUse ? <AlertTriangle className="text-amber-500" size={24} /> : <AlertTriangle className="text-red-500" size={24} />}
                  <h3 className="text-xl font-bold text-white">Delete Asset</h3>
                </div>
                
                {isInUse ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                    <p className="text-amber-200 font-medium mb-1">Warning: Asset currently In Use</p>
                    <p className="text-amber-200/70 text-sm">
                      This asset is currently assigned to a store. Deleting it will <strong>permanently remove</strong> it from both the Asset Inventory and the Store Inventory.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 mb-6">
                    Are you sure you want to delete this asset? This action cannot be undone.
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteId)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>{isInUse ? 'Force Delete' : 'Delete'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Inventory</h1>
          <p className="text-slate-400">Manage company assets, equipment, and hardware.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            {!isReadOnly && !isEditOnlyUser && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
              >
                <Plus size={20} />
                <span>Add Asset</span>
              </button>
            )}
            
            <div className="relative" ref={actionsDropdownRef}>
              <button
                onClick={() => setIsActionsDropdownOpen(!isActionsDropdownOpen)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-all shadow-lg shadow-slate-900/20 active:scale-95 whitespace-nowrap border border-slate-700"
              >
                <span>Actions</span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isActionsDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isActionsDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 space-y-1">
                    {!isReadOnly && !isEditOnlyUser && (
                      <>
                        <button
                          onClick={() => {
                            handleDownloadTemplate();
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <FileSpreadsheet size={16} />
                          <span>Download Template</span>
                        </button>
                        <button
                          onClick={() => {
                            handleImportClick();
                            setIsActionsDropdownOpen(false);
                          }}
                          disabled={isImporting}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isImporting ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <Upload size={16} />
                          )}
                          <span>{isImporting ? 'Importing...' : 'Import XLSX'}</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsImportLogsModalOpen(true);
                            setIsActionsDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <History size={16} />
                          <span>Import History</span>
                        </button>
                      </>
                    )}
                    {!isReadOnly && (
                      <button
                        onClick={() => {
                          handleExport();
                          setIsActionsDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <FileSpreadsheet size={16} />
                        <span>Export Excel</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
            type="text"
            placeholder="Search asset tag, serial number, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
        </div>
        <div className="flex flex-wrap gap-3">
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-slate-950 border ${statusFilter !== 'All' ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300'} rounded-xl hover:border-slate-600 transition-all active:scale-95 whitespace-nowrap`}
              >
                <Filter size={18} />
                <span>{statusFilter === 'All' ? 'Status' : statusFilter}</span>
                <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isStatusDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 space-y-1">
                    {['All', 'Available', 'In Use', 'Under Repair', 'Broken'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setIsStatusDropdownOpen(false);
                          setCurrentPage(1); // Reset to first page
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                          statusFilter === status
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-slate-400 text-sm mb-1">Total Assets</p>
                        <h3 className="text-2xl font-bold text-white">{loading ? '-' : stats.totalAssets}</h3>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Server size={24} />
                    </div>
                </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-slate-400 text-sm mb-1">Available Printers</p>
                        <h3 className="text-2xl font-bold text-white">
                          {loading ? '-' : stats.availablePrinters}
                        </h3>
                    </div>
                    <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                        <Printer size={24} />
                    </div>
                </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-slate-400 text-sm mb-1">Categories</p>
                        <h3 className="text-2xl font-bold text-white">
                          {loading ? '-' : stats.uniqueCategories}
                        </h3>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Monitor size={24} />
                    </div>
                </div>
            </div>
        </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading assets...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                          {searchTerm ? 'No assets found matching your search.' : 'No assets yet. Click "Add Asset" to create one.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <TableRow key={asset.id} onClick={() => handleViewDetails(asset)} className="cursor-pointer">
                            <TableCell className="font-medium">
                                <span className="px-2 py-1 rounded-md bg-muted border text-xs">
                                  {asset.categories?.name || 'N/A'}
                                </span>
                            </TableCell>
                            <TableCell>{asset.brands?.name || 'N/A'}</TableCell>
                            <TableCell>
                                {asset.models?.name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
                            <TableCell>
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
                                  asset.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  asset.status === 'In Use' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  asset.status === 'Under Repair' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  asset.status === 'Broken' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                  {asset.status || 'Available'}
                                </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isReadOnly && (
                                  <button
                                    onClick={(e) => handleEdit(asset, e)}
                                    className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all active:scale-95"
                                    title="Edit asset"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                )}
                                {/* Assets manager and operations manager can delete, but not edit-only user */}
                                {!isEditOnlyUser && hasPermission('manage_assets') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteId(asset.id);
                                    }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all active:scale-95"
                                    title="Delete asset"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </TableCell>
                        </TableRow>
                      ))
                    )}
                </TableBody>
            </Table>
        </div>

        {/* Pagination Controls */}
        {!loading && filteredAssets.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            showAll={showAll}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              if (size === 'all') {
                setShowAll(true);
                setCurrentPage(1);
              } else {
                setShowAll(false);
                setPageSize(size);
                setCurrentPage(1);
              }
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
        )}
      </div>

      <AssetInventoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={fetchAssets}
        editItem={editItem}
      />

      <AssetInventoryModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        editItem={selectedAssetForDetail}
        isViewingDetail={true}
      />

      <ImportLogsModal
        isOpen={isImportLogsModalOpen}
        onClose={() => setIsImportLogsModalOpen(false)}
      />

      <ImportLoadingModal
        isOpen={isImporting}
        fileName={importingFileName}
        title="Importing Assets"
      />
    </div>
  );
}
