"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, ChevronDown, CheckCircle, AlertCircle } from "lucide-react";

interface AssetInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AutocompleteOption {
  id: string;
  name: string;
}

const AssetInventoryModal: React.FC<AssetInventoryModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  // Fetch stores and autocomplete data when modal opens
  useEffect(() => {
    if (isOpen) {
      // fetchStores();
      fetchAutocompleteData();
    }
  }, [isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // if (
      //   dropdownRef.current &&
      //   !dropdownRef.current.contains(event.target as Node)
      // ) {
      //   setShowStoreDropdown(false);
      // }
      if (
        categoryRef.current &&
        !categoryRef.current.contains(event.target as Node)
      ) {
        setShowCategoryDropdown(false);
      }
      // if (
      //   brandRef.current &&
      //   !brandRef.current.contains(event.target as Node)
      // ) {
      //   setShowBrandDropdown(false);
      // }
      // if (
      //   modelRef.current &&
      //   !modelRef.current.contains(event.target as Node)
      // ) {
      //   setShowModelDropdown(false);
      // }
      // if (
      //   stationRef.current &&
      //   !stationRef.current.contains(event.target as Node)
      // ) {
      //   setShowStationDropdown(false);
      // }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const categoryRef = useRef<HTMLDivElement>(null);

  // Autocomplete fields - now store full objects with IDs
  const [category, setCategory] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null
  );
  const [categories, setCategories] = useState<AutocompleteOption[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const fetchAutocompleteData = async () => {
    try {
      const response = await fetch("/api/inventory/autocomplete");
      const data = await response.json();
      if (response.ok) {
        setCategories(data.categories || []);
        // setBrands(data.brands || []);
        // setModels(data.models || []);
      }
    } catch (error) {
      console.error("Error fetching autocomplete data:", error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Add New Asset</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        <form className="p-6 space-y-4">
          {/* Category Autocomplete */}
          <div ref={categoryRef} className="relative">
            <label
              htmlFor="category"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Category
            </label>
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
                  .filter(
                    (c) =>
                      !category ||
                      c.name.toLowerCase().includes(category.toLowerCase())
                  )
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
                {categories.filter(
                  (c) =>
                    !category ||
                    c.name.toLowerCase().includes(category.toLowerCase())
                ).length === 0 && (
                  <div className="px-4 py-2 text-sm text-slate-500">
                    No categories found
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label
              htmlFor="brand"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Brand
            </label>
            <input
              type="text"
              id="brand"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type brand..."
            />
          </div>

          <div>
            <label
              htmlFor="model"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Model
            </label>
            <input
              type="text"
              id="model"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type model..."
            />
          </div>

          <div>
            <label
              htmlFor="serialNumber"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Serial Number
            </label>
            <input
              type="text"
              id="serialNumber"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., SN123456789"
            />
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md transition-colors flex items-center gap-2"
            >
              <span>Add Asset</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AssetInventoryModal;
