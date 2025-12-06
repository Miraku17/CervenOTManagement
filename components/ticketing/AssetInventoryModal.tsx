'use client';

import React from 'react';
import { X } from 'lucide-react';

interface AssetInventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AssetInventoryModal: React.FC<AssetInventoryModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white">Add New Asset</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        <form className="p-6 space-y-4">
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-slate-300 mb-1">Category</label>
            <input
              type="text"
              id="category"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type category..."
            />
          </div>

          <div>
            <label htmlFor="brand" className="block text-sm font-medium text-slate-300 mb-1">Brand</label>
            <input
              type="text"
              id="brand"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type brand..."
            />
          </div>

          <div>
            <label htmlFor="model" className="block text-sm font-medium text-slate-300 mb-1">Model</label>
            <input
              type="text"
              id="model"
              className="w-full bg-slate-800 border border-slate-700 rounded-md py-2 px-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type model..."
            />
          </div>
          
          <div>
            <label htmlFor="serialNumber" className="block text-sm font-medium text-slate-300 mb-1">Serial Number</label>
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
