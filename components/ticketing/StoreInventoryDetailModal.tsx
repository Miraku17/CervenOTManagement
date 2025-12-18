import React from 'react';
import { X, Package, Store, Tag, Box, MapPin, Calendar, CheckCircle, XCircle, Shield, User } from 'lucide-react';
import { format } from 'date-fns';

interface InventoryItem {
  id: string;
  created_at: string;
  updated_at: string;
  serial_number: string;
  under_warranty: boolean | null;
  warranty_date: string | null;
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

interface StoreInventoryDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}

const StoreInventoryDetailModal: React.FC<StoreInventoryDetailModalProps> = ({ isOpen, onClose, item }) => {
  if (!isOpen || !item) return null;

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch (e) {
      return dateString;
    }
  };

  const DetailSection = ({ title, icon: Icon, children }: { title: string, icon: any, children: React.ReactNode }) => (
    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-5 mb-4">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-800">
        <Icon size={18} className="text-blue-400" />
        <h3 className="font-semibold text-slate-200">{title}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6">
        {children}
      </div>
    </div>
  );

  const LabelValue = ({ label, value, fullWidth = false }: { label: string, value: React.ReactNode, fullWidth?: boolean }) => (
    <div className={`${fullWidth ? 'col-span-full' : ''}`}>
      <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">{label}</span>
      <div className="text-sm text-slate-300 font-medium break-words">{value || <span className="text-slate-600 italic">N/A</span>}</div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-800 bg-slate-900 sticky top-0 rounded-t-2xl z-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {item.under_warranty ? (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium border bg-green-500/10 text-green-400 border-green-500/20 uppercase flex items-center gap-1">
                  <Shield size={12} />
                  Under Warranty
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium border bg-slate-500/10 text-slate-400 border-slate-500/20 uppercase">
                  No Warranty
                </span>
              )}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-white flex items-center gap-3">
              {item.categories?.name} - {item.brands?.name}
              {item.models && <span className="text-slate-500 text-lg font-normal">{item.models.name}</span>}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar">

          <DetailSection title="Store Information" icon={Store}>
            <LabelValue label="Store Name" value={item.stores?.store_name} />
            <LabelValue label="Store Code" value={item.stores?.store_code} />
            <LabelValue label="Station" value={item.stations?.name} />
          </DetailSection>

          <DetailSection title="Product Information" icon={Package}>
            <LabelValue label="Category" value={item.categories?.name} />
            <LabelValue label="Brand" value={item.brands?.name} />
            <LabelValue label="Model" value={item.models?.name} />
            <LabelValue label="Serial Number" value={item.serial_number} fullWidth />
          </DetailSection>

          <DetailSection title="Warranty Information" icon={Shield}>
            <LabelValue
              label="Under Warranty"
              value={
                <span className={`flex items-center gap-1 ${item.under_warranty ? 'text-green-400' : 'text-slate-500'}`}>
                  {item.under_warranty ? (
                    <>
                      <CheckCircle size={16} />
                      Yes
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      No
                    </>
                  )}
                </span>
              }
            />
            <LabelValue label="Warranty Date" value={formatDate(item.warranty_date ?? null)} />
          </DetailSection>

          <DetailSection title="Record Information" icon={Calendar}>
            <LabelValue label="Created At" value={formatDate(item.created_at)} />
            <LabelValue label="Updated At" value={formatDate(item.updated_at)} />
          </DetailSection>

          <DetailSection title="Audit Information" icon={User}>
            {item.created_by_user ? (
              <>
                <div className="col-span-full">
                  <span className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Created By</span>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
                    <p className="text-sm font-semibold text-slate-200">
                      {item.created_by_user.first_name} {item.created_by_user.last_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{item.created_by_user.email}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {format(new Date(item.created_at), 'PPpp')}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-full">
                <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Created By</span>
                <span className="text-slate-600 italic text-sm">N/A</span>
              </div>
            )}

            {item.updated_by_user ? (
              <>
                <div className="col-span-full">
                  <span className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Last Updated By</span>
                  <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-3">
                    <p className="text-sm font-semibold text-slate-200">
                      {item.updated_by_user.first_name} {item.updated_by_user.last_name}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">{item.updated_by_user.email}</p>
                    <p className="text-xs text-slate-500 mt-2">
                      {format(new Date(item.updated_at), 'PPpp')}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-full">
                <span className="block text-xs font-medium text-slate-500 mb-1 uppercase tracking-wider">Last Updated By</span>
                <span className="text-slate-600 italic text-sm">N/A</span>
              </div>
            )}
          </DetailSection>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoreInventoryDetailModal;
