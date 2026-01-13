'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';

interface Store {
  id: string;
  store_name: string;
  store_code: string;
}

interface Station {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Model {
  id: string;
  name: string;
}

// Updated InventoryItem interface to reflect the new database schema
interface InventoryItem {
  id: string;
  serial_number: string;
  under_warranty: boolean | null;
  warranty_date: string | null;
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

  const [station, setStation] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [showStationDropdown, setShowStationDropdown] = useState(false);

  // New states for category, brand, model
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [brand, setBrand] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  const [models, setModels] = useState<Model[]>([]);
  const [model, setModel] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null);
  const [showModelDropdown, setShowModelDropdown] = useState(false);

  // New states for product details
  const [serialNumber, setSerialNumber] = useState('');
  const [underWarranty, setUnderWarranty] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState('');
  const [status, setStatus] = useState<'temporary' | 'permanent'>('permanent');

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const dropdownRef = useRef<HTMLDivElement>(null); // For store dropdown
  const stationRef = useRef<HTMLDivElement>(null); // For station dropdown
  const categoryRef = useRef<HTMLDivElement>(null); // For category dropdown
  const brandRef = useRef<HTMLDivElement>(null); // For brand dropdown
  const modelRef = useRef<HTMLDivElement>(null); // For model dropdown

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Fetch stores, stations, categories, brands, and models when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStores();
      fetchStations();
      fetchCategories();
      fetchBrands();
      fetchModels();
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

      // Set station
      if (editItem.stations) {
        setStation(editItem.stations.name);
        setSelectedStationId(editItem.stations.id);
      }

      // Set category, brand, model
      if (editItem.categories) {
        setCategory(editItem.categories.name);
        setSelectedCategoryId(editItem.categories.id);
      }
      if (editItem.brands) {
        setBrand(editItem.brands.name);
        setSelectedBrandId(editItem.brands.id);
      }
      if (editItem.models) {
        setModel(editItem.models.name);
        setSelectedModelId(editItem.models.id);
      }

      // Set product details
      setSerialNumber(editItem.serial_number || '');
      setUnderWarranty(editItem.under_warranty || false);
      setWarrantyDate(editItem.warranty_date || '');
      setStatus((editItem as any).status || 'permanent');
    } else if (isOpen && !editItem) {
      // Reset form when opening for new item
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setStation('');
      setSelectedStationId(null);
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setUnderWarranty(false);
      setWarrantyDate('');
      setStatus('permanent');
    }
  }, [isOpen, editItem]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setShowStoreDropdown(false);
      }
      if (stationRef.current && !stationRef.current.contains(target)) {
        setShowStationDropdown(false);
      }
      if (categoryRef.current && !categoryRef.current.contains(target)) {
        setShowCategoryDropdown(false);
      }
      if (brandRef.current && !brandRef.current.contains(target)) {
        setShowBrandDropdown(false);
      }
      if (modelRef.current && !modelRef.current.contains(target)) {
        setShowModelDropdown(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

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

  const fetchStations = async () => {
    try {
      const response = await fetch('/api/stations/get');
      const data = await response.json();
      if (response.ok) {
        setStations(data.stations || []);
      }
    } catch (error) {
      console.error('Error fetching stations:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories/get');
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch('/api/brands/get');
      const data = await response.json();
      if (response.ok) {
        setBrands(data.brands || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('/api/models/get');
      const data = await response.json();
      if (response.ok) {
        setModels(data.models || []);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
    }
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

  const handleStationSelect = (selected: Station) => {
    setStation(selected.name);
    setSelectedStationId(selected.id);
    setShowStationDropdown(false);
  };

  const handleCategorySelect = (selected: Category) => {
    setCategory(selected.name);
    setSelectedCategoryId(selected.id);
    setShowCategoryDropdown(false);
  };

  const handleBrandSelect = (selected: Brand) => {
    setBrand(selected.name);
    setSelectedBrandId(selected.id);
    setShowBrandDropdown(false);
  };

  const handleModelSelect = (selected: Model) => {
    setModel(selected.name);
    setSelectedModelId(selected.id);
    setShowModelDropdown(false);
  };

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );

  const filteredStations = stations.filter(s =>
    !station || s.name.toLowerCase().includes(station.toLowerCase())
  );

  const filteredCategories = categories.filter(c =>
    !category || c.name.toLowerCase().includes(category.toLowerCase())
  );

  const filteredBrands = brands.filter(b =>
    !brand || b.name.toLowerCase().includes(brand.toLowerCase())
  );

  const filteredModels = models.filter(m =>
    !model || m.name.toLowerCase().includes(model.toLowerCase())
  );

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

    if (!selectedStore) {
      showToast('error', 'Please select a store');
      return;
    }
    if (!station && !selectedStationId) {
      showToast('error', 'Please select or enter a station');
      return;
    }
    if (!serialNumber) {
      showToast('error', 'Please enter a serial number');
      return;
    }
    if (!category) {
      showToast('error', 'Please enter or select a device');
      return;
    }
    if (!brand) {
      showToast('error', 'Please enter or select a brand');
      return;
    }
    if (!model) {
      showToast('error', 'Please enter or select a model');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create station ID if a station name is entered
      let finalStationId = selectedStationId;
      if (station && !finalStationId) {
        finalStationId = await getOrCreateAutocompleteId('stations', station);
      }

      // Get or create category ID
      let finalCategoryId = selectedCategoryId;
      if (category && !finalCategoryId) {
        finalCategoryId = await getOrCreateAutocompleteId('categories', category);
      }

      // Get or create brand ID
      let finalBrandId = selectedBrandId;
      if (brand && !finalBrandId) {
        finalBrandId = await getOrCreateAutocompleteId('brands', brand);
      }

      // Get or create model ID
      let finalModelId = selectedModelId;
      if (model && !finalModelId) {
        finalModelId = await getOrCreateAutocompleteId('models', model);
      }

      const payload = {
        store_id: selectedStore.id,
        station_id: finalStationId,
        category_id: finalCategoryId,
        brand_id: finalBrandId,
        model_id: finalModelId,
        serial_number: serialNumber,
        under_warranty: underWarranty,
        warranty_date: warrantyDate || null,
        status: status,
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
      setStation('');
      setSelectedStationId(null);
      setCategory('');
      setSelectedCategoryId(null);
      setBrand('');
      setSelectedBrandId(null);
      setModel('');
      setSelectedModelId(null);
      setSerialNumber('');
      setUnderWarranty(false);
      setWarrantyDate('');
      setStatus('permanent');

      showToast('success', `Inventory item ${isEditMode ? 'updated' : 'created'} successfully!`);

      if (onSuccess) {
        onSuccess();
      }

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
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in-right ${
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

      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl border border-slate-700 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 z-[55] flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">
            {isEditMode ? 'Edit Store Inventory Item' : 'Add New Store Inventory Item'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Store Selector with Dropdown */}
          <div ref={dropdownRef} className="relative">
            <label htmlFor="storeSearch" className="block text-sm font-medium text-slate-300 mb-1">
              Select Store <span className="text-red-500">*</span> {selectedStore && <span className="text-xs text-slate-500">(Selected: {selectedStore.store_name})</span>}
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
              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
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

          {/* Station Selector with Dropdown */}
          <div ref={stationRef} className="relative">
            <label htmlFor="stationSearch" className="block text-sm font-medium text-slate-300 mb-1">
              Select Station <span className="text-red-500">*</span> {selectedStationId && <span className="text-xs text-slate-500">(Selected: {stations.find(s => s.id === selectedStationId)?.name})</span>}
            </label>
            <div className="relative">
              <input
                type="text"
                id="stationSearch"
                value={station}
                onChange={(e) => {
                  setStation(e.target.value);
                  setShowStationDropdown(true);
                }}
                onFocus={() => setShowStationDropdown(true)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter or search for a station..."
                required
              />
              {selectedStationId && (
                <button
                  type="button"
                  onClick={() => { setStation(''); setSelectedStationId(null); setShowStationDropdown(false); }}
                  className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                  title="Clear selection"
                >
                  <X size={16} />
                </button>
              )}
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
            </div>

            {/* Dropdown Menu */}
            {showStationDropdown && (
              <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
                {filteredStations.length > 0 ? (
                  filteredStations.map((stn) => (
                    <button
                      key={stn.id}
                      type="button"
                      onClick={() => handleStationSelect(stn)}
                      className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                    >
                      <div className="text-sm font-medium text-white">{stn.name}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">
                    No stations found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Product Details Section */}
          <div className="border-t border-slate-700 pt-4 mt-4">
            <h3 className="text-lg font-semibold text-white mb-4">Product Details</h3>

            {/* Device, Brand, Model Row */}
            <div className="grid grid-cols-3 gap-4">
              {/* Device Input with Dropdown */}
              <div ref={categoryRef} className="relative">
                <label htmlFor="categorySearch" className="block text-sm font-medium text-slate-300 mb-1">
                  Device <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="categorySearch"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      setShowCategoryDropdown(true);
                      setSelectedCategoryId(null);
                    }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowCategoryDropdown(false), 200);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or search device..."
                    required
                  />
                  {selectedCategoryId && (
                    <button
                      type="button"
                      onClick={() => { setCategory(''); setSelectedCategoryId(null); setShowCategoryDropdown(false); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Clear selection"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
                </div>

                {/* Device Dropdown */}
                {showCategoryDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {filteredCategories.length > 0 ? (
                      filteredCategories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleCategorySelect(cat)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                        >
                          <div className="text-sm font-medium text-white">{cat.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No categories found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Brand Input with Dropdown */}
              <div ref={brandRef} className="relative">
                <label htmlFor="brandSearch" className="block text-sm font-medium text-slate-300 mb-1">
                  Brand <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="brandSearch"
                    value={brand}
                    onChange={(e) => {
                      setBrand(e.target.value);
                      setShowBrandDropdown(true);
                      setSelectedBrandId(null);
                    }}
                    onFocus={() => setShowBrandDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowBrandDropdown(false), 200);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or search brand..."
                    required
                  />
                  {selectedBrandId && (
                    <button
                      type="button"
                      onClick={() => { setBrand(''); setSelectedBrandId(null); setShowBrandDropdown(false); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Clear selection"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
                </div>

                {/* Brand Dropdown */}
                {showBrandDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {filteredBrands.length > 0 ? (
                      filteredBrands.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleBrandSelect(b)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                        >
                          <div className="text-sm font-medium text-white">{b.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No brands found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Model Input with Dropdown */}
              <div ref={modelRef} className="relative">
                <label htmlFor="modelSearch" className="block text-sm font-medium text-slate-300 mb-1">
                  Model <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="modelSearch"
                    value={model}
                    onChange={(e) => {
                      setModel(e.target.value);
                      setShowModelDropdown(true);
                      setSelectedModelId(null);
                    }}
                    onFocus={() => setShowModelDropdown(true)}
                    onBlur={() => {
                      setTimeout(() => setShowModelDropdown(false), 200);
                    }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-20 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter or search model..."
                    required
                  />
                  {selectedModelId && (
                    <button
                      type="button"
                      onClick={() => { setModel(''); setSelectedModelId(null); setShowModelDropdown(false); }}
                      className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-red-400 transition-colors p-1"
                      title="Clear selection"
                    >
                      <X size={16} />
                    </button>
                  )}
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
                </div>

                {/* Model Dropdown */}
                {showModelDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl max-h-60 overflow-y-auto">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleModelSelect(m)}
                          className="w-full text-left px-4 py-3 hover:bg-slate-700 transition-colors border-b border-slate-700 last:border-0"
                        >
                          <div className="text-sm font-medium text-white">{m.name}</div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-sm text-slate-500 text-center">
                        No models found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Serial Number Row */}
            <div className="mt-4">
              <label htmlFor="serialNumber" className="block text-sm font-medium text-slate-300 mb-1">
                Serial Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="serialNumber"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter serial number..."
                required
              />
            </div>

            {/* Status Row */}
            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="permanent"
                    checked={status === 'permanent'}
                    onChange={(e) => setStatus(e.target.value as 'permanent' | 'temporary')}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                  />
                  <span className="text-slate-300">Permanent</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="temporary"
                    checked={status === 'temporary'}
                    onChange={(e) => setStatus(e.target.value as 'permanent' | 'temporary')}
                    className="w-4 h-4 text-blue-600 bg-slate-800 border-slate-700 focus:ring-blue-500"
                  />
                  <span className="text-slate-300">Temporary</span>
                </label>
              </div>
            </div>

            {/* Warranty Row */}
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-300 mb-1">
                  <input
                    type="checkbox"
                    checked={underWarranty}
                    onChange={(e) => setUnderWarranty(e.target.checked)}
                    className="w-4 h-4 bg-slate-800 border border-slate-700 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  Under Warranty
                </label>
              </div>

              {underWarranty && (
                <div>
                  <label htmlFor="warrantyDate" className="block text-sm font-medium text-slate-300 mb-1">
                    Warranty Expiry Date
                  </label>
                  <input
                    type="date"
                    id="warrantyDate"
                    value={warrantyDate}
                    onChange={(e) => setWarrantyDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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
