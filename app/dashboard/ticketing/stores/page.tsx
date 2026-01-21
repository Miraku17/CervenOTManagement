'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Store as StoreIcon, MapPin, Phone, User, ArrowRight, FileDown, Upload, Building2, CheckCircle, XCircle, FileSpreadsheet } from 'lucide-react';
import { Store } from '@/types';
import StoreModal from '@/components/ticketing/StoreModal';
import StoreDetailModal from '@/components/ticketing/StoreDetailModal';
import ImportStoresModal from '@/components/ticketing/ImportStoresModal';
import { Pagination } from '@/components/ui/pagination';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';

interface StoresResponse {
  stores: Store[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export default function StoresPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [showAll, setShowAll] = useState(false);

  // Access control check
  // Stores: accessible by users with view_stores permission (all except HR and Accounting)
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;

      // Wait for permissions to load before checking
      if (permissionsLoading) return;

      // Check if user has view_stores permission
      if (!hasPermission('view_stores')) {
        router.push('/dashboard/employee');
      }
    };

    checkAccess();
  }, [user?.id, hasPermission, permissionsLoading, router]);

  // Detail Modal State
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  const fetchStores = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: showAll ? '5000' : pageSize.toString(),
      });

      if (debouncedSearchTerm) {
        params.append('search', debouncedSearchTerm);
      }

      const response = await fetch(`/api/stores/get?${params.toString()}`);
      const data: StoresResponse = await response.json();
      if (response.ok) {
        setStores(data.stores);
        setTotalCount(data.pagination.total);
        setTotalPages(data.pagination.totalPages);
      } else {
        console.error('Failed to fetch stores:', data);
      }
    } catch (error) {
      console.error('Error fetching stores:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/stores/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'store_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  const handleExportAllStoresExcel = async () => {
    // Fetch ALL stores for export (not just current page)
    let allStores: Store[] = [];
    try {
      const response = await fetch('/api/stores/get?limit=5000');
      const data: StoresResponse = await response.json();
      if (response.ok) {
        allStores = data.stores;
      } else {
        // Fallback to current stores if fetch fails
        allStores = stores;
      }
    } catch (error) {
      console.error('Error fetching all stores for export:', error);
      allStores = stores;
    }

    // Prepare data for Excel
    const excelData = allStores.map((store) => ({
      'Store Name': store.store_name,
      'Store Code': store.store_code,
      'Store Type': store.store_type || 'N/A',
      'Contact No': store.contact_no || 'N/A',
      'City': store.city || 'N/A',
      'Location': store.location || 'N/A',
      'Group': store.group || 'N/A',
      'Managers': Array.isArray(store.managers) && store.managers.length > 0
        ? store.managers.join(', ')
        : 'N/A',
      'Created At': new Date(store.created_at).toLocaleDateString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 30 }, // Store Name
      { wch: 15 }, // Store Code
      { wch: 15 }, // Store Type
      { wch: 15 }, // Contact No
      { wch: 20 }, // City
      { wch: 40 }, // Location
      { wch: 15 }, // Group
      { wch: 40 }, // Managers
      { wch: 15 }, // Created At
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stores');

    // Add metadata sheet
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const metaData = [
      { Field: 'Report Title', Value: 'All Stores Data' },
      { Field: 'Generated Date', Value: today },
      { Field: 'Total Stores', Value: allStores.length },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Report Info');

    // Save file
    const filename = `All_Stores_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);
  };

  useEffect(() => {
    fetchStores();
  }, [currentPage, pageSize, showAll, debouncedSearchTerm]);

  const handleStoreClick = (store: Store) => {
    setSelectedStore(store);
    setIsDetailModalOpen(true);
  };

  // Search is now done server-side, so we just use stores directly
  const filteredStores = stores;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stores Management</h1>
          <p className="text-slate-400">Manage your store locations and details.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            {/* Only Operations Manager, Tech Support Lead, and Tech Support Engineer can create/import */}
            {hasPermission('manage_stores') && (
              <>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
                >
                  <Plus size={20} />
                  <span>Add Store</span>
                </button>
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors shadow-lg shadow-purple-900/20"
                >
                  <FileSpreadsheet size={20} />
                  <span>Download Template</span>
                </button>
                <button
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-colors shadow-lg shadow-green-900/20"
                >
                  <Upload size={20} />
                  <span>Import XLSX</span>
                </button>
              </>
            )}
            <button
                onClick={handleExportAllStoresExcel}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
              >
                <FileDown size={20} />
                <span>Export All Stores</span>
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

      {/* Pagination */}
      {!loading && totalCount > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalCount={totalCount}
            showAll={showAll}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              if (size === 'all') {
                setShowAll(true);
                setCurrentPage(1);
              } else {
                setShowAll(false);
                setPageSize(size);
                setCurrentPage(1);
              }
            }}
            pageSizeOptions={[10, 20, 50, 100]}
          />
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
