'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Package, Box, AlertCircle, Loader2, ChevronDown, X, Edit2, Trash2, CheckCircle, Printer, Upload, FileSpreadsheet } from 'lucide-react';
import StoreInventoryModal from '@/components/ticketing/StoreInventoryModal';
import StoreInventoryDetailModal from '@/components/ticketing/StoreInventoryDetailModal';
import { ConfirmModal } from '@/components/ConfirmModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

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
  const { user } = useAuth();
  const router = useRouter();
  
  // State definitions
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Filter states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [serialNumberFilter, setSerialNumberFilter] = useState<'all' | 'with' | 'without'>('all');

  // Dropdown states
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Edit/Delete states
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<InventoryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  // Import states
  const [isImporting, setIsImporting] = useState(false);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string; data?: any }>>([]);
  const [showImportErrors, setShowImportErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filterRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/inventory/get');
      const data = await response.json();
      if (response.ok) {
        setInventoryItems(data.items || []);
      } else {
        console.error('Failed to fetch inventory:', data.error);
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Access control check
  // Store Inventory: accessible by admin OR employee role (basically everyone)
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, positions(name)')
          .eq('id', user.id)
          .single();

        const userRole = profile?.role;
        const userPosition = (profile?.positions as any)?.name;
        
        // Check for read-only access (Field Engineer)
        if (userPosition === 'Field Engineer') {
          setIsReadOnly(true);
        }

        const hasAccess = userRole === 'admin' || userRole === 'employee';

        if (!hasAccess) {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/dashboard/ticketing/tickets');
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [user?.id, router]);

  useEffect(() => {
    fetchInventory();
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setShowFilterDropdown(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (checkingAccess) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  const handleSuccess = () => {
    fetchInventory(); // Only refresh when item is successfully added or updated
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

      // setIsDeleteModalOpen(false); // Removed: Modal closes only after fetchInventory and toast
      setDeleteItem(null);
      showToast('success', 'Inventory item deleted successfully!');
      await fetchInventory(); // Refreshes table, which should re-evaluate deleteItem and close modal
      setIsDeleteModalOpen(false); // Explicitly close modal on success
    } catch (error: any) {
      console.error('Error deleting item:', error);
      showToast('error', error.message || 'Failed to delete item');
      setIsDeleteModalOpen(false); // Ensure modal closes on error
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
            body: JSON.stringify({ fileData }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to import file');
          }

          // Show success message with details
          const { result } = data;
          let message = `Import completed! ${result.success} items imported successfully.`;
          if (result.failed > 0) {
            message += ` ${result.failed} items failed.`;
          }

          showToast(result.failed > 0 ? 'error' : 'success', message);

          // Store and display errors if any
          if (result.errors && result.errors.length > 0) {
            console.error('Import errors:', result.errors);
            setImportErrors(result.errors);
            setShowImportErrors(true);
          }

          // Refresh inventory
          await fetchInventory();
        } catch (error: any) {
          console.error('Error importing file:', error);
          showToast('error', error.message || 'Failed to import file');
        } finally {
          setIsImporting(false);
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
    }
  };

  const handlePrint = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Fetch ALL inventory items including deleted ones for the PDF
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
      allItems = filteredItems;
    }

    // Sort inventory alphabetically by brand name
    const sortedItems = [...allItems].sort((a, b) => {
      const nameA = a.brands?.name || '';
      const nameB = b.brands?.name || '';
      return nameA.localeCompare(nameB);
    });

    try {
      // Add logo
      const logoImg = new Image();
      logoImg.src = '/logo.png';
      await new Promise((resolve, reject) => {
        logoImg.onload = resolve;
        logoImg.onerror = reject;
      });
      const logoWidth = 80;
      const logoHeight = 20;
      const logoX = (pageWidth - logoWidth) / 2;
      doc.addImage(logoImg, 'PNG', logoX, 10, logoWidth, logoHeight);
    } catch (error) {
      console.error('Error loading logo:', error);
      // Continue without logo if it fails
    }

    // Add header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Store Inventory Report', pageWidth / 2, 38, { align: 'center' });

    // Add date and count
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const activeCount = sortedItems.filter(item => !item.deleted_at).length;
    const deletedCount = sortedItems.filter(item => item.deleted_at).length;
    doc.text(`Generated: ${today}`, 14, 46);
    doc.text(`Active: ${activeCount} | Deleted: ${deletedCount} | Total: ${sortedItems.length}`, pageWidth - 14, 46, { align: 'right' });

    // Prepare table data
    const tableColumn = [
      'Item Details',
      'Serial Number',
      'Status',
      'Category',
      'Brand',
      'Model',
      'Store',
      'Station',
      'Created By',
      'Created At',
      'Updated By',
      'Updated At',
      'Deleted By',
      'Deleted At',
    ];

    const tableRows = sortedItems.map((item) => [
      `${item.brands?.name || 'N/A'}\n${item.categories?.name || 'N/A'}`,
      item.serial_number || 'N/A',
      item.status ? item.status.charAt(0).toUpperCase() + item.status.slice(1) : 'N/A',
      item.categories?.name || 'N/A',
      item.brands?.name || 'N/A',
      item.models?.name || 'N/A',
      `${item.stores?.store_name || 'N/A'}\n${item.stores?.store_code || ''}`,
      item.stations?.name || 'N/A',
      item.created_by_user ? `${item.created_by_user.first_name} ${item.created_by_user.last_name}` : 'N/A',
      item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A',
      item.updated_by_user ? `${item.updated_by_user.first_name} ${item.updated_by_user.last_name}` : 'N/A',
      item.updated_at ? new Date(item.updated_at).toLocaleDateString() : 'N/A',
      item.deleted_by_user ? `${item.deleted_by_user.first_name} ${item.deleted_by_user.last_name}` : 'N/A',
      item.deleted_at ? new Date(item.deleted_at).toLocaleDateString() : 'N/A',
    ]);

    // Add table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 54,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Light gray
      },
      columnStyles: {
        0: { cellWidth: 22 },  // Item Details
        1: { cellWidth: 18 },  // Serial Number
        2: { cellWidth: 16 },  // Status
        3: { cellWidth: 18 },  // Category
        4: { cellWidth: 18 },  // Brand
        5: { cellWidth: 18 },  // Model
        6: { cellWidth: 20 },  // Store
        7: { cellWidth: 18 },  // Station
        8: { cellWidth: 22 },  // Created By
        9: { cellWidth: 18 },  // Created At
        10: { cellWidth: 22 }, // Updated By
        11: { cellWidth: 18 }, // Updated At
        12: { cellWidth: 22 }, // Deleted By
        13: { cellWidth: 18 }, // Deleted At
      },
      didParseCell: function(data) {
        // Highlight deleted rows in red (only body rows, not headers)
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          if (sortedItems[rowIndex]?.deleted_at) {
            data.cell.styles.fillColor = [255, 230, 230]; // Light red background
            data.cell.styles.textColor = [180, 0, 0]; // Dark red text
          }
        }
      },
    });

    // Add page numbers
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Open PDF in new tab (without print dialog)
    window.open(doc.output('bloburl'), '_blank');
  };

  // Get unique values for filters
  const uniqueCategories = Array.from(new Set(inventoryItems.map(item => item.categories?.name).filter(Boolean))) as string[];
  const uniqueStores = Array.from(new Set(inventoryItems.map(item => item.stores?.store_name).filter(Boolean))) as string[];
  const uniqueBrands = Array.from(new Set(inventoryItems.map(item => item.brands?.name).filter(Boolean))) as string[];

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedStore(null);
    setSelectedBrand(null);
    setSerialNumberFilter('all');
  };

  // Check if any filters are active
  const hasActiveFilters = selectedCategory || selectedStore || selectedBrand || serialNumberFilter !== 'all';

  // Filter items based on search and filters
  const filteredItems = inventoryItems.filter(item => {
    // Search filter
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = !searchTerm || (
      item.serial_number?.toLowerCase().includes(searchLower) ||
      item.categories?.name.toLowerCase().includes(searchLower) ||
      item.brands?.name.toLowerCase().includes(searchLower) ||
      item.models?.name.toLowerCase().includes(searchLower) ||
      item.stores?.store_name.toLowerCase().includes(searchLower) ||
      item.stores?.store_code.toLowerCase().includes(searchLower) ||
      item.stations?.name.toLowerCase().includes(searchLower)
    );

    // Category filter
    const matchesCategory = !selectedCategory || item.categories?.name === selectedCategory;

    // Store filter
    const matchesStore = !selectedStore || item.stores?.store_name === selectedStore;

    // Brand filter
    const matchesBrand = !selectedBrand || item.brands?.name === selectedBrand;

    // Serial number filter
    const matchesSerialNumber =
      serialNumberFilter === 'all' ||
      (serialNumberFilter === 'with' && item.serial_number) ||
      (serialNumberFilter === 'without' && !item.serial_number);

    return matchesSearch && matchesCategory && matchesStore && matchesBrand && matchesSerialNumber;
  });

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
        <div className="flex flex-col sm:flex-row gap-3">
            {!isReadOnly && (
              <>
                <button
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Plus size={20} />
                  <span>Add Item</span>
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
                >
                  <FileSpreadsheet size={20} />
                  <span>Download Template</span>
                </button>
                <button
                  onClick={handleImportClick}
                  disabled={isImporting}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-lg shadow-purple-900/20"
                >
                  {isImporting ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={20} />
                      <span>Import XLSX</span>
                    </>
                  )}
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
                >
                  <Printer size={20} />
                  <span>Print Report</span>
                </button>
              </>
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
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
            type="text"
            placeholder="Search by serial number, category, brand, model, or store..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
        </div>
        <div className="flex gap-3">
            {/* Filter Button with Dropdown */}
            <div ref={filterRef} className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-slate-950 border rounded-xl transition-colors ${
                  hasActiveFilters ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Filter size={18} />
                <span>Filter</span>
                {hasActiveFilters && (
                  <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                    {[selectedStore, selectedBrand, serialNumberFilter !== 'all' ? 'S/N' : null].filter(Boolean).length}
                  </span>
                )}
                <ChevronDown size={16} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Filter Dropdown */}
              {showFilterDropdown && (
                <div className="absolute top-full mt-2 right-0 w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">Filters</h3>
                      {hasActiveFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                        >
                          <X size={14} />
                          Clear all
                        </button>
                      )}
                    </div>

                    {/* Store Filter */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Store</label>
                      <div className="relative">
                        <select
                          value={selectedStore || ''}
                          onChange={(e) => setSelectedStore(e.target.value || null)}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                          <option value="">All Stores</option>
                          {uniqueStores.map((store) => (
                            <option key={store} value={store}>{store}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                      </div>
                    </div>

                    {/* Brand Filter */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Brand</label>
                      <div className="relative">
                        <select
                          value={selectedBrand || ''}
                          onChange={(e) => setSelectedBrand(e.target.value || null)}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                          <option value="">All Brands</option>
                          {uniqueBrands.map((brand) => (
                            <option key={brand} value={brand}>{brand}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                      </div>
                    </div>

                    {/* Serial Number Filter */}
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-2">Serial Number</label>
                      <div className="relative">
                        <select
                          value={serialNumberFilter}
                          onChange={(e) => setSerialNumberFilter(e.target.value as 'all' | 'with' | 'without')}
                          className="w-full bg-slate-950 border border-slate-700 text-slate-200 px-3 py-2 pr-10 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                        >
                          <option value="all">All Items</option>
                          <option value="with">With Serial Number</option>
                          <option value="without">Without Serial Number</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Category Button with Dropdown */}
            <div ref={categoryRef} className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-slate-950 border rounded-xl transition-colors ${
                  selectedCategory ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300 hover:border-slate-600'
                }`}
              >
                <Box size={18} />
                <span>{selectedCategory || 'Category'}</span>
                <ChevronDown size={16} className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
              </button>

              {/* Category Dropdown */}
              {showCategoryDropdown && (
                <div className="absolute top-full mt-2 right-0 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-80 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedCategory(null);
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      !selectedCategory
                        ? 'bg-blue-500/10 text-blue-400 font-medium'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    All Categories
                  </button>
                  {uniqueCategories.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-t border-slate-800 ${
                        selectedCategory === category
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
                        {loading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          inventoryItems.length.toLocaleString()
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
                      <p className="text-slate-400 text-sm mb-1">Categories</p>
                      <h3 className="text-2xl font-bold text-white">
                        {loading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          new Set(inventoryItems.map(i => i.categories?.id).filter(Boolean)).size
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
                        {loading ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          new Set(inventoryItems.map(i => i.stores?.id).filter(Boolean)).size
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
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Item Details</th>
                        <th className="p-4 font-semibold">Serial Number</th>
                        <th className="p-4 font-semibold">Category</th>
                        <th className="p-4 font-semibold">Brand</th>
                        <th className="p-4 font-semibold">Model</th>
                        <th className="p-4 font-semibold">Store</th>
                        <th className="p-4 font-semibold">Station</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                            <p className="text-slate-400">Loading inventory...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Package size={48} className="text-slate-600" />
                            <div>
                              <h3 className="text-lg font-medium text-slate-300">No inventory items found</h3>
                              <p className="text-slate-500 mt-1">
                                {searchTerm ? 'Try adjusting your search' : 'Get started by adding your first item'}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => {
                            setDetailItem(item);
                            setIsDetailModalOpen(true);
                          }}
                          className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                        >
                            <td className="p-4 text-slate-300 font-medium">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center text-slate-500">
                                        <Package size={20} />
                                    </div>
                                    <div>
                                        <div className="text-sm">{item.brands?.name || 'N/A'}</div>
                                        <div className="text-xs text-slate-500">{item.categories?.name || 'Uncategorized'}</div>
                                    </div>
                                </div>
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-sm">
                              {item.serial_number || <span className="text-slate-600 italic">No S/N</span>}
                            </td>
                            <td className="p-4 text-slate-400">
                                <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs">
                                  {item.categories?.name || 'N/A'}
                                </span>
                            </td>
                            <td className="p-4 text-slate-400">{item.brands?.name || 'N/A'}</td>
                            <td className="p-4 text-slate-400">{item.models?.name || <span className="text-slate-600">—</span>}</td>
                            <td className="p-4 text-slate-400">
                              <div>
                                <div className="text-sm">{item.stores?.store_name || 'N/A'}</div>
                                <div className="text-xs text-slate-600">{item.stores?.store_code || ''}</div>
                              </div>
                            </td>
                            <td className="p-4 text-slate-400">{item.stations?.name || <span className="text-slate-600">—</span>}</td>
                            <td className="p-4 text-right">
                              {!isReadOnly && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEdit(item);
                                    }}
                                    className="p-2 hover:bg-blue-500/10 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                    title="Edit item"
                                  >
                                    <Edit2 size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDelete(item);
                                    }}
                                    className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                    title="Delete item"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              )}
                            </td>
                        </tr>
                      ))
                    )}
                </tbody>
            </table>
        </div>
         {!loading && filteredItems.length > 0 && (
          <div className="p-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-slate-500 text-sm">
              Showing {filteredItems.length} of {inventoryItems.length} items
            </span>
          </div>
         )}
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[80vh] shadow-2xl flex flex-col">
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
                    <p className="text-blue-300/80">Store Name, Store Code, Station Name, Category, Brand, Model, Serial Number, Status (Permanent/Temporary)</p>
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
