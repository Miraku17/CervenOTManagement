'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

interface AutocompleteOption {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  serial_number: string | null;
  status: string;
  under_warranty: boolean | null;
  warranty_date: string | null;
  categories: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
  models: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
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
  store_info?: {
    store_name: string;
    store_code: string;
    station_name: string | null;
  } | null;
  ticket_info?: {
    id: string;
    rcc_reference_number: string;
    status: string;
    request_type: string;
    severity: string;
  } | null;
}

interface AssetInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editItem?: Asset | null;
  isViewingDetail?: boolean;
}

const AssetInventoryModal: React.FC<AssetInventoryModalProps> = ({ isOpen, onClose, onSuccess, editItem, isViewingDetail = false }) => {
  // Autocomplete fields
  const [category, setCategory] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<AutocompleteOption[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [brand, setBrand] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [brands, setBrands] = useState<AutocompleteOption[]>([]);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const [model, setModel] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [models, setModels] = useState<AutocompleteOption[]>([]);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  const [serialNumber, setSerialNumber] = useState('');
  const [status, setStatus] = useState('Available');

  const [underWarranty, setUnderWarranty] = useState<boolean>(false);
  const [warrantyDate, setWarrantyDate] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const categoryRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Fetch autocomplete data when modal opens
  useEffect(() => {
    if (isOpen && !isViewingDetail) { // Only fetch if not in view mode
      fetchAutocompleteData();
    }
  }, [isOpen, isViewingDetail]);

  // Populate form when editing or viewing
  useEffect(() => {
    if (isOpen && editItem) {
      if (editItem.categories) {
        setCategory(editItem.categories.name);
        setSelectedCategoryId(editItem.categories.id);
      } else {
        setCategory('');
        setSelectedCategoryId(null);
      }
      if (editItem.brands) {
        setBrand(editItem.brands.name);
        setSelectedBrandId(editItem.brands.id);
      } else {
        setBrand('');
        setSelectedBrandId(null);
      }
      if (editItem.models) {
        setModel(editItem.models.name);
        setSelectedModelId(editItem.models.id);
      } else {
        setModel('');
        setSelectedModelId(null);
      }
      setSerialNumber(editItem.serial_number || '');

      // If status is "In Use" but asset is not in a store, default to "Available"
      const currentStatus = editItem.status || 'Available';
      if (currentStatus === 'In Use' && !editItem.store_info) {
        setStatus('Available');
      } else if (currentStatus === 'In Use') {
        // Keep "In Use" if it's actually in a store
        setStatus('In Use');
      } else {
        setStatus(currentStatus);
      }

      setUnderWarranty(editItem.under_warranty || false);
      setWarrantyDate(editItem.warranty_date || '');
    } else if (isOpen && !editItem && !isViewingDetail) {
      // Reset form when opening for new item
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setStatus('Available');
      setUnderWarranty(false);
      setWarrantyDate('');
    }
  }, [isOpen, editItem, isViewingDetail]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setShowBrandDropdown(false);
      }
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchAutocompleteData = async () => {
    try {
      const response = await fetch('/api/inventory/autocomplete');
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
        setBrands(data.brands || []);
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Error fetching autocomplete data:', error);
    }
  };

  // Helper function to get or create an autocomplete value
  const getOrCreateAutocompleteId = async (tableName: string, value: string): Promise<string> => {
    const response = await fetch('/api/inventory/get-or-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableName, value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    return data.id;
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!category || !brand) {
      showToast('error', 'Category and brand are required');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create IDs for autocomplete values
      const categoryId = selectedCategoryId || await getOrCreateAutocompleteId('categories', category);
      const brandId = selectedBrandId || await getOrCreateAutocompleteId('brands', brand);
      const modelId = model ? (selectedModelId || await getOrCreateAutocompleteId('models', model)) : null;

      const url = editItem ? '/api/assets/update' : '/api/assets/create';
      const method = editItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(editItem && { id: editItem.id }),
          category_id: categoryId,
          brand_id: brandId,
          model_id: modelId,
          serial_number: serialNumber || null,
          status,
          under_warranty: underWarranty,
          warranty_date: warrantyDate || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${editItem ? 'update' : 'create'} asset`);
      }

      // Reset form
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setStatus('Available');
      setUnderWarranty(false);
      setWarrantyDate('');

      // Refresh autocomplete data to include newly added values
      await fetchAutocompleteData();

      showToast('success', `Asset ${editItem ? 'updated' : 'created'} successfully!`);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a brief delay to show the success toast
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error(`Error ${editItem ? 'updating' : 'creating'} asset:`, error);
      showToast('error', error.message || `Failed to ${editItem ? 'update' : 'create'} asset`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right ${
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
              {isViewingDetail ? 'Asset Details' : (editItem ? 'Edit Asset' : 'Add New Asset')}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1">
              <X size={24} />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Category Autocomplete */}
          <div ref={categoryRef} className="relative">
            <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            {isViewingDetail ? (
              <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.categories?.name || 'N/A'}</p>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  id="category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setSelectedCategoryId(null);
                  }}
                  onFocus={() => setShowCategoryDropdown(true)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type or select category..."
                  required
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
            {showCategoryDropdown && !isViewingDetail && (
              <div className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                {categories
                  .filter(c => !category || c.name.toLowerCase().includes(category.toLowerCase()))
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setCategory(cat.name);
                        setSelectedCategoryId(cat.id);
                        setShowCategoryDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      {cat.name}
                    </button>
                  ))}
                {categories.filter(c => !category || c.name.toLowerCase().includes(category.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500">No categories found</div>
                )}
              </div>
            )}
          </div>

          {/* Brand Autocomplete */}
          <div ref={brandRef} className="relative">
            <label htmlFor="brand" className="block text-sm font-medium text-slate-300 mb-1">Brand</label>
            {isViewingDetail ? (
              <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.brands?.name || 'N/A'}</p>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  id="brand"
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setSelectedBrandId(null);
                  }}
                  onFocus={() => setShowBrandDropdown(true)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type or select brand..."
                  required
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
            {showBrandDropdown && !isViewingDetail && (
              <div className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                {brands
                  .filter(b => !brand || b.name.toLowerCase().includes(brand.toLowerCase()))
                  .map((brd) => (
                    <button
                      key={brd.id}
                      type="button"
                      onClick={() => {
                        setBrand(brd.name);
                        setSelectedBrandId(brd.id);
                        setShowBrandDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      {brd.name}
                    </button>
                  ))}
                {brands.filter(b => !brand || b.name.toLowerCase().includes(brand.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500">No brands found</div>
                )}
              </div>
            )}
          </div>

          {/* Model Autocomplete */}
          <div ref={modelRef} className="relative">
            <label htmlFor="model" className="block text-sm font-medium text-slate-300 mb-1">Model</label>
            {isViewingDetail ? (
              <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.models?.name || 'N/A'}</p>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  id="model"
                  value={model}
                  onChange={(e) => {
                    setModel(e.target.value);
                    setSelectedModelId(null);
                  }}
                  onFocus={() => setShowModelDropdown(true)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Type or select model..."
                />
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
            {showModelDropdown && !isViewingDetail && (
              <div className="absolute z-[9999] w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                {models
                  .filter(m => !model || m.name.toLowerCase().includes(model.toLowerCase()))
                  .map((mdl) => (
                    <button
                      key={mdl.id}
                      type="button"
                      onClick={() => {
                        setModel(mdl.name);
                        setSelectedModelId(mdl.id);
                        setShowModelDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      {mdl.name}
                    </button>
                  ))}
                {models.filter(m => !model || m.name.toLowerCase().includes(model.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500">No models found</div>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-slate-300 mb-1">Serial Number</label>
            {isViewingDetail ? (
              <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.serial_number || 'N/A'}</p>
            ) : (
              <input
                type="text"
                id="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., SN123456789"
              />
            )}
          </div>

          {/* Status */}
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-slate-300 mb-1">Status</label>
            {isViewingDetail ? (
              <>
                <div className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${
                  editItem?.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  editItem?.status === 'In Use' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                  editItem?.status === 'Under Repair' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                  editItem?.status === 'Broken' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                  'bg-slate-700 text-slate-400 border-slate-600'
                }`}>
                  {editItem?.status || 'Available'}
                </div>
                <p className="text-xs text-slate-500 mt-1">"In Use" status is automatically set when assigned to a store</p>
              </>
            ) : (
              <>
                <div className="relative">
                  <select
                    id="status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="Under Repair">Under Repair</option>
                    <option value="Broken">Broken</option>
                    <option value="Retired">Retired</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                <p className="text-xs text-slate-500 mt-1">"In Use" is automatically set when asset is assigned to a store</p>
              </>
            )}
          </div>

          {/* Under Warranty */}
          <div>
            <label htmlFor="underWarranty" className="block text-sm font-medium text-slate-300 mb-1">Under Warranty</label>
            {isViewingDetail ? (
              <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.under_warranty ? 'Yes' : 'No'}</p>
            ) : (
              <div className="relative">
                <select
                  id="underWarranty"
                  value={underWarranty ? 'yes' : 'no'}
                  onChange={(e) => {
                    const isWarranty = e.target.value === 'yes';
                    setUnderWarranty(isWarranty);
                    // Clear warranty date when switching to "No"
                    if (!isWarranty) {
                      setWarrantyDate('');
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>

          {/* Warranty Date - Only show if under warranty */}
          {(underWarranty || (isViewingDetail && editItem?.under_warranty)) && (
            <div>
              <label htmlFor="warrantyDate" className="block text-sm font-medium text-slate-300 mb-1">Warranty Date</label>
              {isViewingDetail ? (
                <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{editItem?.warranty_date ? format(new Date(editItem.warranty_date), 'PPP') : 'N/A'}</p>
              ) : (
                <input
                  type="date"
                  id="warrantyDate"
                  value={warrantyDate}
                  onChange={(e) => setWarrantyDate(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 [color-scheme:dark]"
                />
              )}
            </div>
          )}

          {/* Usage Information */}
          {isViewingDetail && (
            <div className="space-y-4 pt-4 border-t border-slate-700 mt-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Usage Information</h3>

              {/* Store Information */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Store Location</label>
                {editItem?.store_info ? (
                  <div className="text-white bg-slate-800 p-3 rounded-md border border-slate-700">
                    <p className="font-medium">{editItem.store_info.store_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Code: {editItem.store_info.store_code}</p>
                    {editItem.store_info.station_name && (
                      <p className="text-xs text-slate-400 mt-1">Station: {editItem.store_info.station_name}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 bg-slate-800 p-3 rounded-md border border-slate-700">Not assigned to any store</p>
                )}
              </div>

              {/* Ticket Information */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Active Ticket</label>
                {editItem?.ticket_info ? (
                  <div className="text-white bg-slate-800 p-3 rounded-md border border-blue-500/20">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-blue-400">{editItem.ticket_info.rcc_reference_number}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{editItem.ticket_info.request_type}</p>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${
                        editItem.ticket_info.status === 'Open' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        editItem.ticket_info.status === 'In Progress' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {editItem.ticket_info.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Severity: {editItem.ticket_info.severity}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-500 bg-slate-800 p-3 rounded-md border border-slate-700">
                    <span className="text-sm">Not used</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Audit Information */}
          {isViewingDetail && (
            <div className="space-y-4 pt-4 border-t border-slate-700 mt-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Audit Information</h3>

              {/* Created At */}
              {editItem?.created_at && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Created At</label>
                  <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{format(new Date(editItem.created_at), 'PPP p')}</p>
                </div>
              )}

              {/* Created By */}
              {editItem?.created_by_user && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Created By</label>
                  <div className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">
                    <p className="font-medium">{editItem.created_by_user.first_name} {editItem.created_by_user.last_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{editItem.created_by_user.email}</p>
                  </div>
                </div>
              )}

              {/* Updated At */}
              {editItem?.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Updated</label>
                  <p className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">{format(new Date(editItem.updated_at), 'PPP p')}</p>
                </div>
              )}

              {/* Updated By */}
              {editItem?.updated_by_user && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Last Updated By</label>
                  <div className="text-white bg-slate-800 p-2 rounded-md border border-slate-700">
                    <p className="font-medium">{editItem.updated_by_user.first_name} {editItem.updated_by_user.last_name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{editItem.updated_by_user.email}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {!isViewingDetail && (
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-700 mt-6 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>{editItem ? 'Updating...' : 'Adding...'}</span>
                  </>
                ) : (
                  <span>{editItem ? 'Update Asset' : 'Add Asset'}</span>
                )}
              </button>
            </div>
          )}
          {isViewingDetail && (
            <div className="flex justify-end pt-4 border-t border-slate-700 mt-6 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </form>
        </div>
      </div>
    </>
  );
};

export default AssetInventoryModal;