'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Package, Box, AlertCircle, Loader2, ChevronDown, X, Edit2, Trash2, CheckCircle, Printer, Upload, FileSpreadsheet, History } from 'lucide-react';
import StoreInventoryModal from '@/components/ticketing/StoreInventoryModal';
import StoreInventoryDetailModal from '@/components/ticketing/StoreInventoryDetailModal';
import ImportStoreInventoryLogsModal from '@/components/ticketing/ImportStoreInventoryLogsModal';
import ImportLoadingModal from '@/components/ticketing/ImportLoadingModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import { ShieldAlert } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';
import { useInventory, useInventoryStats, useFilterOptions } from '@/hooks/useInventoryQueries';
import { useQueryClient } from '@tanstack/react-query';

interface InventoryItem {
  id: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  serial_number: string;
  under_warranty: boolean | null;
  warranty_date: string | null;
  status?: 'temporary' | 'permanent';
  stores: {
    id: string;
    store_name: string;
    store_code: string;
  } | null;
  stations: {
    id: string;
    name: string;
  };
  categories: {
    id: string;
    name: string;
  } | null;
  brands: {
    id: string;
    name: string;
  } | null;
  models: {
    id: string;
    name: string;
  } | null;
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

export default function StoreInventoryPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const queryClient = useQueryClient();

  // State definitions
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditOnlyUser, setIsEditOnlyUser] = useState(false);
  const [userPosition, setUserPosition] = useState<string | null>(null);

  const isLoadingAccess = authLoading || permissionsLoading;

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAll, setShowAll] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // TanStack Query hooks
  const { data: inventoryData, isLoading: loading, error: inventoryError } = useInventory({
    page: currentPage,
    pageSize,
    searchTerm: debouncedSearchTerm,
    selectedCategory: selectedCategory || '',
    selectedStore: selectedStore || '',
    selectedBrand: selectedBrand || '',
    showAll,
  });

  const { data: statsData, isLoading: statsLoading } = useInventoryStats();
  const { data: filterOptionsData } = useFilterOptions();

  // Extract data from queries
  const inventoryItems = inventoryData?.items || [];
  const totalCount = inventoryData?.pagination.totalCount || 0;
  const totalPages = inventoryData?.pagination.totalPages || 0;
  const stats = statsData?.stats || { totalItems: 0, uniqueCategories: 0, uniqueStores: 0 };
  const filterOptions = filterOptionsData || { categories: [], stores: [], brands: [] };

  // Update edit-only user flag when data changes
  useEffect(() => {
    if (inventoryData?.isEditOnly) {
      setIsEditOnlyUser(true);
    }
  }, [inventoryData]);

  // Dropdown states
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  // Edit/Delete states
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Import History State
  const [isImportLogsModalOpen, setIsImportLogsModalOpen] = useState(false);
  
  // Actions Dropdown State
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  // Toast notification state
  const [toast, setToast] = useState({
    show: false,
    type: 'success' as 'success' | 'error',
    message: '',
  });

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [importingFileName, setImportingFileName] = useState<string>('');
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string; data?: any }>>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categoryRef = useRef<HTMLDivElement>(null);
  const storeDropdownRef = useRef<HTMLDivElement>(null);
  const brandDropdownRef = useRef<HTMLDivElement>(null);

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Reset to page 1 when search or filters change
  useEffect(() => {
    setCurrentPage(1);
    setShowAll(false);
  }, [debouncedSearchTerm, selectedCategory, selectedStore, selectedBrand]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(event.target as Node)) {
        setIsActionsDropdownOpen(false);
      }
      if (storeDropdownRef.current && !storeDropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
      if (brandDropdownRef.current && !brandDropdownRef.current.contains(event.target as Node)) {
        setShowBrandDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Check access permissions - MUST be before any early returns to comply with Rules of Hooks
  useEffect(() => {
    const checkAccess = async () => {
      if (isLoadingAccess || !user?.id) return;

      try {
        // Fetch user position
        const { data: profile } = await supabase
          .from('profiles')
          .select('positions(name)')
          .eq('id', user.id)
          .single();

        const position = (profile?.positions as any)?.name || null;
        setUserPosition(position);

        // Check if user has edit-only access from store_inventory_edit_access table
        const { data: editAccess } = await supabase
          .from('store_inventory_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .maybeSingle();

        const isEditOnly = editAccess?.can_edit === true;

        if (isEditOnly) {
          setIsEditOnlyUser(true);
        }

      } catch (error) {
        console.error('Error checking access:', error);
        // Check if user has edit-only access even if other checks fail
        const { data: editAccess } = await supabase
          .from('store_inventory_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .maybeSingle();

        const isEditOnly = editAccess?.can_edit === true;

        if (!isEditOnly && !hasPermission('manage_store_inventory')) {
          router.push('/dashboard/ticketing/tickets');
        } else if (isEditOnly) {
          setIsEditOnlyUser(true);
        }
      }
    };

    checkAccess();
  }, [user?.id, isLoadingAccess, hasPermission, router]);

  // Show loading state while checking permissions
  if (isLoadingAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Only check permission AFTER loading is complete
  const hasAccess = hasPermission('manage_store_inventory') || isEditOnlyUser;

  // Show access denied if no permission
  if (!isLoadingAccess && !hasAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <ShieldAlert className="w-10 h-10 text-red-400" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-white mb-2">Access Denied</h3>
            <p className="text-slate-400">You don't have permission to access store inventory.</p>
            <p className="text-slate-500 text-sm mt-2">
              If you believe you should have access, please contact your administrator.
            </p>
          </div>
          <button
            onClick={() => router.push('/dashboard/ticketing/tickets')}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            Go to Tickets
          </button>
        </div>
      </div>
    );
  }

  const handleSuccess = () => {
    // Invalidate queries to refetch data
    queryClient.invalidateQueries({ queryKey: ['inventory'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
    queryClient.invalidateQueries({ queryKey: ['inventory-filter-options'] });
    setEditItem(null); // Clear edit item
  };

  const handleEdit = (item: InventoryItem) => {
    setEditItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (item: InventoryItem) => {
    setDeleteItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;

    setIsDeleting(true);
    try {
      const response = await fetch('/api/inventory/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: deleteItem.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete item');
      }

      setDeleteItem(null);
      showToast('success', 'Inventory item deleted successfully!');
      // Invalidate and refetch queries to update data
      await queryClient.invalidateQueries({ queryKey: ['inventory'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['inventory-filter-options'] });
      await queryClient.refetchQueries({ queryKey: ['inventory'] });
      setIsDeleteModalOpen(false); 
    } catch (error: any) {
      console.error('Error deleting item:', error);
      showToast('error', error.message || 'Failed to delete item');
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditItem(null); // Clear edit item when modal closes
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/inventory/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'store_inventory_template.xlsx';
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

    setIsImporting(true);
    setImportingFileName(file.name);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1]; // Remove data:application/... prefix

          const response = await fetch('/api/inventory/import', {
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
          showToast('success', `✅ Import successful! ${result.success} items imported.`);

          // Log any unexpected errors (shouldn't happen after validation)
          if (result.errors && result.errors.length > 0) {
            console.error('Unexpected import errors:', result.errors);
          }

          // Invalidate queries to refetch data
          queryClient.invalidateQueries({ queryKey: ['inventory'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
          queryClient.invalidateQueries({ queryKey: ['inventory-filter-options'] });
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

  const handleExport = async () => {
    // Fetch ALL inventory items including deleted ones for the export
    let allItems: InventoryItem[] = [];
    try {
      const response = await fetch('/api/inventory/get-all');
      const data = await response.json();
      if (response.ok) {
        allItems = data.items || [];
      }
    } catch (error) {
      console.error('Error fetching all inventory:', error);
      // Fallback to current items if fetch fails
      allItems = inventoryItems;
    }

    // Sort and filter inventory (only non-deleted items)
    const sortedItems = allItems
      .filter(item => !item.deleted_at)
      .sort((a, b) => {
        const nameA = a.brands?.name || '';
        const nameB = b.brands?.name || '';
        return nameA.localeCompare(nameB);
      });

    // Prepare data for Excel
    const excelData = sortedItems.map((item) => ({
      'Device': item.categories?.name || 'N/A',
      'Brand': item.brands?.name || 'N/A',
      'Model': item.models?.name || 'N/A',
      'Serial Number': item.serial_number || 'N/A',
      'Status': item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'N/A',
      'Store Name': item.stores?.store_name || 'N/A',
      'Store Code': item.stores?.store_code || 'N/A',
      'Station': item.stations?.name || 'N/A',
      'Under Warranty': item.under_warranty ? 'Yes' : 'No',
      'Warranty Date': item.warranty_date ? new Date(item.warranty_date).toLocaleDateString() : 'N/A',
      'Created By': item.created_by_user ? `${item.created_by_user.first_name} ${item.created_by_user.last_name}` : 'N/A',
      'Created At': new Date(item.created_at).toLocaleDateString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, // Device
      { wch: 20 }, // Brand
      { wch: 25 }, // Model
      { wch: 25 }, // Serial Number
      { wch: 15 }, // Status
      { wch: 30 }, // Store Name
      { wch: 15 }, // Store Code
      { wch: 20 }, // Station
      { wch: 15 }, // Under Warranty
      { wch: 15 }, // Warranty Date
      { wch: 25 }, // Created By
      { wch: 15 }, // Created At
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Store Inventory');

    // Add metadata sheet
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const metaData = [
      { Field: 'Report Title', Value: 'Store Inventory Report' },
      { Field: 'Generated Date', Value: today },
      { Field: 'Total Items', Value: sortedItems.length },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Report Info');

    // Save file
    const filename = `Store_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedStore(null);
    setSelectedBrand(null);
  };

  // Check if any filters are active
  const hasActiveFilters = selectedCategory || selectedStore || selectedBrand;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-60 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right ${ toast.type === 'success'
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertCircle size={20} />
          )}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Store Inventory</h1>
          <p className="text-slate-400">Track and manage stock levels across all stores.</p>
        </div>
        <div className="flex flex-wrap gap-3">
            {/* Field Engineers cannot create items, only view and update */}
            {(hasPermission('manage_store_inventory') || (isEditOnlyUser && userPosition !== 'Field Engineer')) && (
              <button
                className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20 active:scale-95 whitespace-nowrap"
                onClick={() => setIsModalOpen(true)}
              >
                <Plus size={20} />
                <span>Add Item</span>
              </button>
            )}

            {(hasPermission('manage_store_inventory') && !isEditOnlyUser) && (
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
                    </div>
                  </div>
                )}
              </div>
            )}
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
      <div className="flex flex-col gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        {/* Search Bar - Full width on all screens */}
        <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
            type="text"
            placeholder="Search by serial number, device, brand, model, or store..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
        </div>

        {/* Filter Buttons - Stack on mobile, row on desktop, aligned right */}
        <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
            {/* Clear All Filters Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X size={16} />
                <span>Clear filters</span>
              </button>
            )}

            {/* Store Dropdown */}
            <div ref={storeDropdownRef} className="relative flex-1 sm:flex-none">
              <button
                onClick={() => {
                  setShowStoreDropdown(!showStoreDropdown);
                  setShowBrandDropdown(false);
                  setShowCategoryDropdown(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 bg-slate-950 border rounded-xl transition-colors ${ selectedStore ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                <Package size={18} />
                <span className="truncate max-w-[120px]">{selectedStore || 'Store'}</span>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${showStoreDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Store Dropdown Menu */}
              {showStoreDropdown && (
                <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-full sm:w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedStore(null);
                      setShowStoreDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${ !selectedStore
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    All Stores
                  </button>
                  {filterOptions.stores.map((store) => (
                    <button
                      key={store}
                      onClick={() => {
                        setSelectedStore(store);
                        setShowStoreDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-slate-800 ${ selectedStore === store
                          ? 'bg-blue-500/10 text-blue-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {store}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Brand Dropdown */}
            <div ref={brandDropdownRef} className="relative flex-1 sm:flex-none">
              <button
                onClick={() => {
                  setShowBrandDropdown(!showBrandDropdown);
                  setShowStoreDropdown(false);
                  setShowCategoryDropdown(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 bg-slate-950 border rounded-xl transition-colors ${ selectedBrand ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                <Box size={18} />
                <span className="truncate max-w-[120px]">{selectedBrand || 'Brand'}</span>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${showBrandDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Brand Dropdown Menu */}
              {showBrandDropdown && (
                <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-full sm:w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedBrand(null);
                      setShowBrandDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${ !selectedBrand
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    All Brands
                  </button>
                  {filterOptions.brands.map((brand) => (
                    <button
                      key={brand}
                      onClick={() => {
                        setSelectedBrand(brand);
                        setShowBrandDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-slate-800 ${ selectedBrand === brand
                          ? 'bg-blue-500/10 text-blue-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Device Dropdown */}
            <div ref={categoryRef} className="relative flex-1 sm:flex-none">
              <button
                onClick={() => {
                  setShowCategoryDropdown(!showCategoryDropdown);
                  setShowStoreDropdown(false);
                  setShowBrandDropdown(false);
                }}
                className={`w-full sm:w-auto flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 bg-slate-950 border rounded-xl transition-colors ${ selectedCategory ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300 hover:border-slate-600'}`}
              >
                <Filter size={18} />
                <span className="truncate max-w-[120px]">{selectedCategory || 'Device'}</span>
                <ChevronDown size={16} className={`transition-transform flex-shrink-0 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Device Dropdown Menu */}
              {showCategoryDropdown && (
                <div className="absolute top-full mt-2 left-0 sm:left-auto sm:right-0 w-full sm:w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${ !selectedCategory
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    All Devices
                  </button>
                  {filterOptions.categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-slate-800 ${ selectedCategory === category
                          ? 'bg-blue-500/10 text-blue-400 font-medium'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
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
                      <p className="text-slate-400 text-sm mb-1">Total Items</p>
                      <h3 className="text-2xl font-bold text-white">
                        {statsLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          stats.totalItems.toLocaleString()
                        )}
                      </h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Package size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Devices</p>
                      <h3 className="text-2xl font-bold text-white">
                        {statsLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          stats.uniqueCategories
                        )}
                      </h3>
                  </div>
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                      <Box size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Stores</p>
                      <h3 className="text-2xl font-bold text-white">
                        {statsLoading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          stats.uniqueStores
                        )}
                      </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Package size={24} />
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
                        <TableHead>Item Details</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Device</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Station</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-muted-foreground">Loading inventory...</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : inventoryItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Package size={48} className="text-muted-foreground" />
                            <div>
                              <h3 className="text-lg font-medium">No inventory items found</h3>
                              <p className="text-muted-foreground mt-1">
                                {searchTerm ? 'Try adjusting your search' : 'Get started by adding your first item'}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      inventoryItems.map((item) => (
                        <TableRow
                          key={item.id}
                          onClick={() => {
                            setDetailItem(item);
                            setIsDetailModalOpen(true);
                          }}
                          className="cursor-pointer"
                        >
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                                        <Package size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm">{item.brands?.name || 'N/A'}</div>
                                        <div className="text-xs text-muted-foreground">{item.categories?.name || 'Uncategorized'}</div>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.serial_number || <span className="text-muted-foreground italic">No S/N</span>}
                            </TableCell>
                            <TableCell>
                                <span className="px-2 py-1 rounded-md bg-muted border text-xs whitespace-nowrap">
                                  {item.categories?.name?.replace(/[\n\r]+/g, ' ').trim() || 'N/A'}
                                </span>
                            </TableCell>
                            <TableCell>{item.brands?.name || 'N/A'}</TableCell>
                            <TableCell>{item.models?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell>
                              <div>
                                <div className="text-sm">{item.stores?.store_name || 'N/A'}</div>
                                <div className="text-xs text-muted-foreground">{item.stores?.store_code || ''}</div>
                              </div>
                            </TableCell>
                            <TableCell>{item.stations?.name || <span className="text-muted-foreground">—</span>}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(item);
                                    }}
                                    className="p-2 hover:bg-blue-500/10 rounded-lg text-muted-foreground hover:text-blue-400 transition-colors"
                                    title="Edit item"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  {!isEditOnlyUser && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(item);
                                      }}
                                      className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-400 transition-colors"
                                      title="Delete item"
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
         {!loading && inventoryItems.length > 0 && (
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

      {/* Import History Modal */}
      <ImportStoreInventoryLogsModal
        isOpen={isImportLogsModalOpen}
        onClose={() => setIsImportLogsModalOpen(false)}
      />

      <ImportLoadingModal
        isOpen={isImporting}
        fileName={importingFileName}
        title="Importing Store Inventory"
      />

      {/* Store Inventory Modal */}
      <StoreInventoryModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        editItem={editItem}
      />

      {/* Store Inventory Detail Modal */}
      <StoreInventoryDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        item={detailItem}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Remove Item from Store"
        message={`Are you sure you want to remove this item${deleteItem?.serial_number ? ` (${deleteItem.serial_number})` : ''} from the store inventory?`}
        type="danger"
        confirmText={isDeleting ? "Removing..." : "Remove Item"}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setIsDeleteModalOpen(false)}
        isLoading={isDeleting}
      />

      {/* Import Errors Modal */}
      {showImportErrors && importErrors.length > 0 && (
        <div className="fixed top-0 left-0 right-0 bottom-0 w-screen h-screen z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" style={{ position: 'fixed', inset: 0 }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col relative z-[10000]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Import Errors ({importErrors.length})</h2>
                  <p className="text-sm text-slate-400">Review and fix these issues in your Excel file</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportErrors(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error List */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-3">
                {importErrors.map((error, index) => (
                  <div key={index} className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                        <span className="text-red-400 font-bold text-sm">{error.row}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-red-400 mb-2">Row {error.row}</p>
                        <p className="text-sm text-red-300/90 mb-3">{error.error}</p>
                        {error.data && (
                          <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 mt-2">
                            <p className="text-xs font-semibold text-slate-400 mb-2">Row Data:</p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {Object.entries(error.data).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-slate-500 font-medium">{key}:</span>
                                  <span className="text-slate-300 truncate">{value as string || '(empty)'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-800 bg-slate-900/50">
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle size={18} className="text-blue-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-200">
                    <p className="font-medium mb-1">Required Columns:</p>
                    <p className="text-blue-300/80">Store Name, Store Code, Station Name, Device, Brand, Model, Serial Number, Status (Permanent/Temporary)</p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowImportErrors(false)}
                className="w-full px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}