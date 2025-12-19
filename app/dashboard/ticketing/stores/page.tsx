'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Store as StoreIcon, MapPin, Phone, User, ArrowRight, FileDown, Upload, Building2, CheckCircle, XCircle } from 'lucide-react';
import { Store } from '@/types';
import StoreModal from '@/components/ticketing/StoreModal';
import StoreDetailModal from '@/components/ticketing/StoreDetailModal';
import ImportStoresModal from '@/components/ticketing/ImportStoresModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

export default function StoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Access control check
  // Stores: accessible by admin role only (no position requirement)
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        const isAdmin = profile?.role === 'admin';

        if (!isAdmin) {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/dashboard/ticketing/tickets');
      }
    };

    checkAccess();
  }, [user?.id, router]);

  // Detail Modal State
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/stores/get');
      const data = await response.json();
      if (response.ok) {
        setStores(data.stores);
      } else {
        console.error('Failed to fetch stores:', data.error);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAllStoresPDF = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

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
    doc.text('All Stores Data', pageWidth / 2, 38, { align: 'center' });

    // Add date and count
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    doc.text(`Generated: ${today}`, 14, 46);
    doc.text(`Total Stores: ${stores.length}`, pageWidth - 14, 46, { align: 'right' });

    const tableColumn = [
      "Store Name",
      "Store Code",
      "Store Type",
      "Contact No",
      "City",
      "Location",
      "Group",
      "Managers",
      "Created At",
    ];

    const tableRows = stores.map((store) => [
      store.store_name,
      store.store_code,
      store.store_type || 'N/A',
      store.contact_no || 'N/A',
      store.city || 'N/A',
      store.location || 'N/A',
      store.group || 'N/A',
      Array.isArray(store.managers) && store.managers.length > 0
        ? store.managers.join(', ')
        : 'N/A',
      new Date(store.created_at).toLocaleDateString(),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 54,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [15, 23, 42] }, // Slate 900
    });

    doc.save("all_stores_data.pdf");
  };

  useEffect(() => {
    fetchStores();
  }, []);

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);
    setIsDetailModalOpen(true);
  };

  const filteredStores = stores.filter(store =>
    store.store_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.store_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    store.group?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stores Management</h1>
          <p className="text-slate-400">Manage your store locations and details.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} />
              <span>Add Store</span>
            </button>
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors shadow-lg shadow-green-900/20"
            >
              <Upload size={20} />
              <span>Import XLSX</span>
            </button>
            <button
                onClick={handlePrintAllStoresPDF}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
              >
                <FileDown size={20} />
                <span>Print All Stores</span>
              </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
        <input
          type="text"
          placeholder="Search stores by name, code, city, location, or group..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-800 text-slate-200 pl-10 pr-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
        />
      </div>

      {/* Stores Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredStores.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredStores.map((store) => (
            <div
              key={store.id}
              onClick={() => handleStoreClick(store)}
              className="group relative bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-blue-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-900/10 overflow-hidden flex flex-col h-full cursor-pointer"
            >
               {/* Top Accent Gradient */}
               <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center group-hover:border-blue-500/30 group-hover:from-blue-500/10 group-hover:to-blue-600/5 transition-all">
                    <StoreIcon size={22} className="text-slate-400 group-hover:text-blue-400 transition-colors" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-white leading-tight group-hover:text-blue-100 transition-colors">
                        {store.store_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-colors">
                            {store.store_code}
                        </span>
                        {store.status && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            store.status.toLowerCase() === 'active'
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {store.status.toLowerCase() === 'active' ? (
                              <CheckCircle size={12} />
                            ) : (
                              <XCircle size={12} />
                            )}
                            {store.status}
                          </span>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-start gap-2">
                    <StoreIcon size={14} className="text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Type</span>
                      <span className="text-sm text-slate-300">{store.store_type || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone size={14} className="text-slate-500 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">Contact</span>
                      <span className="text-sm text-slate-300">{store.contact_no || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-800/50 group-hover:border-slate-800 transition-colors">
                  <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">City:</span>
                      <span className="text-sm text-slate-300">{store.city || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Location:</span>
                      <span className="text-sm text-slate-300">{store.location || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-slate-500 shrink-0" />
                      <span className="text-xs text-slate-500 uppercase font-bold tracking-wider">Group:</span>
                      <span className="text-sm text-slate-300">{store.group || 'N/A'}</span>
                    </div>
                    {store.store_address && (
                      <div className="flex items-start gap-2 pt-1 border-t border-slate-800/50">
                        <Building2 size={14} className="text-slate-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-slate-500 uppercase font-bold tracking-wider block mb-0.5">Address:</span>
                          <span className="text-sm text-slate-300 break-words">{store.store_address}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3 px-1">
                    <User size={16} className="text-slate-500 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-0.5">Managed By</span>
                        <span className="text-sm text-slate-300">
                            {Array.isArray(store.managers) && store.managers.length > 0
                            ? store.managers.join(', ')
                            : 'Not Assigned'}
                        </span>
                    </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-xs text-slate-500">
                      Added {new Date(store.created_at).toLocaleDateString()}
                  </span>
                  <button className="text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      View Details <ArrowRight size={12} />
                  </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800 border-dashed">
            <StoreIcon size={48} className="mx-auto text-slate-600 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">No stores found</h3>
            <p className="text-slate-500 mt-1">Get started by creating your first store.</p>
        </div>
      )}

      <StoreModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchStores}
      />

      <ImportStoresModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchStores}
      />

      <StoreDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        store={selectedStore}
        onUpdate={() => {
           fetchStores();
           setIsDetailModalOpen(false);
        }}
      />
    </div>
  );
}
