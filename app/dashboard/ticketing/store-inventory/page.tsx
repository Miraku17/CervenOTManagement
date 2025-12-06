'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Download, Package, Box, AlertCircle, Loader2, ChevronDown, X, Edit2, Trash2, CheckCircle } from 'lucide-react';
import StoreInventoryModal from '@/components/ticketing/StoreInventoryModal';
import { ConfirmModal } from '@/components/ConfirmModal';

interface InventoryItem {
  id: string;
  serial_number: string | null;
  created_at: string;
  updated_at: string;
  stores: {
    id: string;
    store_name: string;
    store_code: string;
  } | null;
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
  stations: {
    id: string;
    name: string;
  } | null;
}

export default function StoreInventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const filterRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

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

      setIsDeleteModalOpen(false);
      setDeleteItem(null);
      showToast('success', 'Inventory item deleted successfully!');
      await fetchInventory();
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
            <button
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
              onClick={() => setIsModalOpen(true)} // Open the modal on click
            >
              <Plus size={20} />
              <span>Add Item</span>
            </button>
            <button
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
              >
                <Download size={20} />
                <span>Export</span>
              </button>
        </div>
      </div>

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
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors group">
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
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => handleEdit(item)}
                                  className="p-2 hover:bg-blue-500/10 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                                  title="Edit item"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                  title="Delete item"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
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

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Inventory Item"
        message={`Are you sure you want to delete this item${deleteItem?.serial_number ? ` (${deleteItem.serial_number})` : ''}? This action cannot be undone.`}
        type="danger"
        confirmText={isDeleting ? "Deleting..." : "Delete Item"}
        onConfirm={handleConfirmDelete}
        onCancel={() => !isDeleting && setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
