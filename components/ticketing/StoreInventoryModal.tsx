'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';

interface Store {
  id: string;
  store_name: string;
  store_code: string;
}

interface AutocompleteOption {
  id: string;
  name: string;
}

interface InventoryItem {
  id: string;
  serial_number: string | null;
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

interface StoreInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  editItem?: InventoryItem | null;
}

const StoreInventoryModal: React.FC<StoreInventoryModalProps> = ({ isOpen, onClose, onSuccess, editItem }) => {
  const isEditMode = !!editItem;
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [storeName, setStoreName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [showStoreDropdown, setShowStoreDropdown] = useState(false);

  // Autocomplete fields - now store full objects with IDs
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

  const [station, setStation] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stations, setStations] = useState<AutocompleteOption[]>([]);
  const [showStationDropdown, setShowStationDropdown] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const stationRef = useRef<HTMLDivElement>(null);

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Fetch stores and autocomplete data when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStores();
      fetchAutocompleteData();
    }
  }, [isOpen]);

  // Populate form fields when editing
  useEffect(() => {
    if (isOpen && editItem) {
      // Set store data
      if (editItem.stores) {
        const store = {
          id: editItem.stores.id,
          store_name: editItem.stores.store_name,
          store_code: editItem.stores.store_code,
        };
        setSelectedStore(store as Store);
        setStoreName(store.store_name);
        setStoreCode(store.store_code);
        setStoreSearchTerm(store.store_name);
      }

      // Set category
      if (editItem.categories) {
        setCategory(editItem.categories.name);
        setSelectedCategoryId(editItem.categories.id);
      }

      // Set brand
      if (editItem.brands) {
        setBrand(editItem.brands.name);
        setSelectedBrandId(editItem.brands.id);
      }

      // Set model
      if (editItem.models) {
        setModel(editItem.models.name);
        setSelectedModelId(editItem.models.id);
      }

      // Set serial number
      setSerialNumber(editItem.serial_number || '');

      // Set station
      if (editItem.stations) {
        setStation(editItem.stations.name);
        setSelectedStationId(editItem.stations.id);
      }
    } else if (isOpen && !editItem) {
      // Reset form when opening for new item
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setStation('');
      setSelectedStationId(null);
    }
  }, [isOpen, editItem]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStoreDropdown(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (brandRef.current && !brandRef.current.contains(event.target as Node)) {
        setShowBrandDropdown(false);
      }
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) {
        setShowModelDropdown(false);
      }
      if (stationRef.current && !stationRef.current.contains(event.target as Node)) {
        setShowStationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/stores/get');
      const data = await response.json();
      if (response.ok) {
        setStores(data.stores || []);
      } else {
        console.error('Failed to fetch stores:', data.error);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchAutocompleteData = async () => {
    try {
      const response = await fetch('/api/inventory/autocomplete');
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
        setBrands(data.brands || []);
        setModels(data.models || []);
        setStations(data.stations || []);
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

  const handleStoreSelect = (store: Store) => {
    setSelectedStore(store);
    setStoreName(store.store_name);
    setStoreCode(store.store_code);
    setStoreSearchTerm(store.store_name);
    setShowStoreDropdown(false);
  };

  const handleClearSelection = () => {
    setSelectedStore(null);
    setStoreName('');
    setStoreCode('');
    setStoreSearchTerm('');
    setShowStoreDropdown(false);
  };

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStore) {
      showToast('error', 'Please select a store');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create IDs for autocomplete values
      const categoryId = selectedCategoryId || await getOrCreateAutocompleteId('categories', category);
      const brandId = selectedBrandId || await getOrCreateAutocompleteId('brands', brand);
      const modelId = model ? (selectedModelId || await getOrCreateAutocompleteId('models', model)) : null;
      const stationId = station ? (selectedStationId || await getOrCreateAutocompleteId('stations', station)) : null;

      const payload = {
        store_id: selectedStore.id,
        category_id: categoryId,
        brand_id: brandId,
        model_id: modelId,
        serial_number: serialNumber || null,
        station_id: stationId,
      };

      const response = await fetch(
        isEditMode ? '/api/inventory/update' : '/api/inventory/create',
        {
          method: isEditMode ? 'PUT' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            isEditMode ? { id: editItem!.id, ...payload } : payload
          ),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditMode ? 'update' : 'create'} inventory item`);
      }

      // Reset form
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setStation('');
      setSelectedStationId(null);

      // Refresh autocomplete data to include newly added values
      await fetchAutocompleteData();

      showToast('success', `Inventory item ${isEditMode ? 'updated' : 'created'} successfully!`);

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }

      // Close modal after a brief delay to show the success toast
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} inventory item:`, error);
      showToast('error', error.message || `Failed to ${isEditMode ? 'update' : 'create'} inventory item`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
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

      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {isEditMode ? 'Edit Inventory Item' : 'Add New Store Inventory Item'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Store Selector with Dropdown */}
          <div ref={dropdownRef} className="relative">
            <label htmlFor="storeSearch" className="block text-sm font-medium text-slate-300 mb-1">
              Select Store {selectedStore && <span className="text-xs text-slate-500">(Selected: {selectedStore.store_name})</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                id="storeSearch"
                value={storeSearchTerm}
                onChange={(e) => {
                  setStoreSearchTerm(e.target.value);
                  setShowStoreDropdown(true);
                }}
                onFocus={() => setShowStoreDropdown(true)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Search for a store..."
                required
              />
              {selectedStore && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                  title="Clear selection"
                >
                  <X size={16} />
                </button>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
            </div>

            {/* Dropdown Menu */}
            {showStoreDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
                {filteredStores.length > 0 ? (
                  filteredStores.map((store) => (
                    <button
                      key={store.id}
                      type="button"
                      onClick={() => handleStoreSelect(store)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-white">{store.store_name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">Code: {store.store_code}</div>
                        </div>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">
                    No stores found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Display Selected Store Info (Read-only) */}
          {selectedStore && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Store Name</label>
                <input
                  type="text"
                  value={storeName}
                  readOnly
                  className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Store Code</label>
                <input
                  type="text"
                  value={storeCode}
                  readOnly
                  className="w-full bg-slate-900 border border-slate-700 rounded-md py-2 px-3 text-slate-400 cursor-not-allowed"
                />
              </div>
            </div>
          )}
          {/* Category Autocomplete */}
          <div ref={categoryRef} className="relative">
            <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <input
              type="text"
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                // Clear selected ID when user types, so new values can be created
                setSelectedCategoryId(null);
              }}
              onFocus={() => setShowCategoryDropdown(true)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type or select category..."
              required
            />
            {showCategoryDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
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
            <input
              type="text"
              id="brand"
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                // Clear selected ID when user types, so new values can be created
                setSelectedBrandId(null);
              }}
              onFocus={() => setShowBrandDropdown(true)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type or select brand..."
              required
            />
            {showBrandDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
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
            <input
              type="text"
              id="model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                // Clear selected ID when user types, so new values can be created
                setSelectedModelId(null);
              }}
              onFocus={() => setShowModelDropdown(true)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type or select model..."
            />
            {showModelDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
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
            <input
              type="text"
              id="serialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., SN123456789"
            />
          </div>
          {/* Station Autocomplete */}
          <div ref={stationRef} className="relative">
            <label htmlFor="station" className="block text-sm font-medium text-slate-300 mb-1">Station</label>
            <input
              type="text"
              id="station"
              value={station}
              onChange={(e) => {
                setStation(e.target.value);
                // Clear selected ID when user types, so new values can be created
                setSelectedStationId(null);
              }}
              onFocus={() => setShowStationDropdown(true)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type or select station..."
            />
            {showStationDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-40 overflow-y-auto">
                {stations
                  .filter(s => !station || s.name.toLowerCase().includes(station.toLowerCase()))
                  .map((stn) => (
                    <button
                      key={stn.id}
                      type="button"
                      onClick={() => {
                        setStation(stn.name);
                        setSelectedStationId(stn.id);
                        setShowStationDropdown(false);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-slate-700 transition-colors text-sm text-white"
                    >
                      {stn.name}
                    </button>
                  ))}
                {stations.filter(s => !station || s.name.toLowerCase().includes(station.toLowerCase())).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500">No stations found</div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isEditMode ? 'Updating...' : 'Adding...'}</span>
                </>
              ) : (
                <span>{isEditMode ? 'Update Item' : 'Add Item'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoreInventoryModal;
