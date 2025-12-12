'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface Store {
  id: string;
  store_name: string;
  store_code: string;
}

interface Station {
  id: string;
  name: string;
}

interface Asset {
  id: string;
  serial_number: string | null;
  status: string | null;
  under_warranty: boolean | null;
  warranty_date: string | null;
  categories: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
  models: { id: string; name: string } | null;
}

// Updated InventoryItem interface to reflect the new database schema
interface InventoryItem {
  id: string;
  stores: {
    id: string;
    store_name: string;
    store_code: string;
  } | null;
  stations: {
    id: string;
    name: string;
  } | null;
  assets: Asset | null; // Now links to the Asset
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

  // New state for assets
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const [station, setStation] = useState('');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [showStationDropdown, setShowStationDropdown] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  const dropdownRef = useRef<HTMLDivElement>(null); // For store dropdown
  const stationRef = useRef<HTMLDivElement>(null); // For station dropdown

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // Fetch stores, stations and assets when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStores();
      fetchStations();
      fetchAssets();
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

      // Set asset
      if (editItem.assets) {
        setSelectedAssetId(editItem.assets.id);
      }
    } else if (isOpen && !editItem) {
      // Reset form when opening for new item
      setSelectedStore(null);
      setStoreName('');
      setStoreCode('');
      setStoreSearchTerm('');
      setSelectedAssetId(null);
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

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/assets/get'); // Use the new API endpoint
      const data = await response.json();
      if (response.ok) {
        setAssets(data.assets || []);
      } else {
        console.error('Failed to fetch assets:', data.error);
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
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

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );

  const filteredStations = stations.filter(s =>
    !station || s.name.toLowerCase().includes(station.toLowerCase())
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
    if (!selectedAssetId) {
      showToast('error', 'Please select an asset');
      return;
    }

    setIsSubmitting(true);

    try {
      // Get or create station ID if a station name is entered
      let finalStationId = selectedStationId;
      if (station && !finalStationId) {
        finalStationId = await getOrCreateAutocompleteId('stations', station);
      } else if (!station) {
        finalStationId = null; // Ensure it's null if the text is empty
      }

      const payload = {
        store_id: selectedStore.id,
        station_id: finalStationId,
        asset_id: selectedAssetId,
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
      setSelectedAssetId(null);
      setStation('');
      setSelectedStationId(null);
      
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

      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
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
              Select Station {selectedStationId && <span className="text-xs text-slate-500">(Selected: {stations.find(s => s.id === selectedStationId)?.name})</span>}
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
                placeholder="Search for a station..."
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

          {/* Asset Selection Dropdown */}
          <div>
            <label htmlFor="assetSelect" className="block text-sm font-medium text-slate-300 mb-1">
              Select Asset <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                id="assetSelect"
                value={selectedAssetId || ''}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
                required
              >
                <option value="">Select an Asset</option>
                {assets
                  .filter(asset => asset.status === 'Available' || (isEditMode && asset.id === editItem?.assets?.id))
                  .map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {[
                        asset.categories?.name,
                        asset.brands?.name,
                        asset.models?.name,
                        asset.serial_number ? `(SN: ${asset.serial_number})` : ''
                      ].filter(Boolean).join(' ')}
                    </option>
                  ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 pointer-events-none" />
            </div>
            {(() => {
              const availableAssetsForSelection = assets.filter(asset => asset.status === 'Available' || (isEditMode && asset.id === editItem?.assets?.id));
              if (assets.length === 0) {
                return (
                  <p className="text-xs text-red-400 mt-1">No assets found in Asset Inventory. Please add some first.</p>
                );
              } else if (availableAssetsForSelection.length === 0 && !isEditMode) {
                return (
                  <p className="text-xs text-red-400 mt-1">No available assets to assign. All assets are currently in use or have another status.</p>
                );
              } else if (availableAssetsForSelection.length === 0 && isEditMode && !editItem?.assets?.id) {
                return (
                  <p className="text-xs text-red-400 mt-1">No available assets to assign. The current asset is not found or is unavailable.</p>
                );
              }
              return null;
            })()}

            {/* Selected Asset Details (Read-only) */}
            {selectedAssetId && (() => {
              const selectedAsset = assets.find(a => a.id === selectedAssetId);
              if (!selectedAsset) return null;
              return (
                <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                    <div className="text-sm text-slate-200">{selectedAsset.categories?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Brand</label>
                    <div className="text-sm text-slate-200">{selectedAsset.brands?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Model</label>
                    <div className="text-sm text-slate-200">{selectedAsset.models?.name || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Serial Number</label>
                    <div className="text-sm text-slate-200 font-mono">{selectedAsset.serial_number || 'N/A'}</div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Warranty Status</label>
                     <div className={`text-sm inline-flex px-2 py-0.5 rounded ${
                        selectedAsset.under_warranty 
                          ? 'bg-emerald-500/10 text-emerald-400' 
                          : 'bg-slate-700 text-slate-400'
                      }`}>
                      {selectedAsset.under_warranty ? 'Under Warranty' : 'Expired / None'}
                    </div>
                  </div>
                  {selectedAsset.warranty_date && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Warranty Date</label>
                      <div className="text-sm text-slate-200">{format(new Date(selectedAsset.warranty_date), 'PPP')}</div>
                    </div>
                  )}
                </div>
              );
            })()}
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