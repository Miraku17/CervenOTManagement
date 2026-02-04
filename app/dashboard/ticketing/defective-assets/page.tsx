'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Filter, Monitor, Server, AlertTriangle, CheckCircle, Printer, Loader2, ChevronDown, FileSpreadsheet } from 'lucide-react';
import AssetInventoryModal from '@/components/ticketing/AssetInventoryModal';
import * as XLSX from 'xlsx';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Pagination } from '@/components/ui/pagination';

interface Asset {
  id: string;
  serial_number: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  under_warranty: boolean | null;
  warranty_date: string | null;
  categories: { id: string; name: string } | null;
  brands: { id: string; name: string } | null;
  models: { id: string; name: string } | null;
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
  deleted_by_user?: {
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

export default function DefectiveAssetsPage() {
  const { user } = useAuth();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const router = useRouter();
  
  // State definitions
  const [searchTerm, setSearchTerm] = useState('');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Filter state
  const [statusFilter, setStatusFilter] = useState('All');
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showAll, setShowAll] = useState(false);

  // Stats state (for defective assets only)
  const [stats, setStats] = useState({
    totalDefectiveAssets: 0,
    defectivePrinters: 0,
    uniqueCategories: 0,
  });
  
  // Toast notification state
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    message: string;
  }>({ show: false, type: 'success', message: '' });

  // Helper function to show toast
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ show: true, type, message });
    setTimeout(() => {
      setToast({ show: false, type, message: '' });
    }, 3000);
  };

  // TanStack Query setup
  const queryClient = useQueryClient();

  // Fetch defective assets using TanStack Query
  const { data: queryData, isLoading, error, refetch } = useQuery({
    queryKey: ['defectiveAssets', currentPage, pageSize, searchTerm, statusFilter, showAll],
    queryFn: async () => {
      const effectiveLimit = showAll ? 5000 : pageSize;
      const effectivePage = showAll ? 1 : currentPage;

      const searchParam = searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : '';
      const statusParam = statusFilter && statusFilter !== 'All' ? `&status=${encodeURIComponent(statusFilter)}` : '';

      const response = await fetch(`/api/assets/get?page=${effectivePage}&limit=${effectiveLimit}${searchParam}${statusParam}`);
      if (!response.ok) {
        throw new Error('Failed to fetch defective assets');
      }

      const data = await response.json();

      // Filter to show only Broken or Under Repair assets
      const defectiveAssets = statusFilter === 'All'
        ? (data.assets || []).filter((asset: Asset) => asset.status === 'Broken' || asset.status === 'Under Repair')
        : data.assets || [];

      // Calculate defective-specific stats
      const totalDefectiveAssets = defectiveAssets.length;
      const defectivePrinters = defectiveAssets.filter(
        (asset: Asset) => asset.categories?.name?.toLowerCase().includes('printer')
      ).length;
      const uniqueCategories = [...new Set(defectiveAssets.map((asset: Asset) => asset.categories?.name).filter(Boolean))].length;

      return {
        assets: defectiveAssets,
        stats: {
          totalDefectiveAssets,
          defectivePrinters,
          uniqueCategories,
        },
        pagination: {
          totalCount: statusFilter === 'All' ? defectiveAssets.length : data.pagination.totalCount,
          totalPages: statusFilter === 'All' ? Math.ceil(defectiveAssets.length / pageSize) : data.pagination.totalPages,
        },
      };
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  // Update local state when query data changes
  useEffect(() => {
    if (queryData) {
      setAssets(queryData.assets);
      setStats(queryData.stats);
      setTotalCount(queryData.pagination.totalCount);
      setTotalPages(queryData.pagination.totalPages);
    }
  }, [queryData]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      if (permissionsLoading) return;
      if (!user?.id) return;

      try {
        // Check if user has view access
        const { data: editAccess } = await supabase
          .from('assets_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        const canManageAssets = hasPermission('manage_assets');
        const hasViewAccess = canManageAssets || editAccess?.can_edit === true;

        if (!hasViewAccess) {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        // Allow access if edit access exists
        const { data: editAccess } = await supabase
          .from('assets_edit_access')
          .select('can_edit')
          .eq('profile_id', user.id)
          .single();

        if (!editAccess?.can_edit) {
          router.push('/dashboard/ticketing/tickets');
        }
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [user?.id, router, permissionsLoading, hasPermission]);

  // Reset to page 1 when search term or status filter changes
  useEffect(() => {
    setCurrentPage(1);
    setShowAll(false);
  }, [searchTerm, statusFilter]);

  if (checkingAccess || permissionsLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400">Verifying access...</p>
        </div>
      </div>
    );
  }

  const handleViewDetails = (asset: Asset) => {
    setSelectedAssetForDetail(asset);
    setIsDetailModalOpen(true);
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedAssetForDetail(null);
  };

  const handleExport = async () => {
    // Fetch ALL defective assets for the export
    let allDefectiveAssets: Asset[] = [];
    try {
      const response = await fetch('/api/assets/get-all');
      const data = await response.json();
      if (response.ok) {
        // Filter only Broken or Under Repair assets
        allDefectiveAssets = (data.assets || []).filter(
          (asset: Asset) => !asset.deleted_at && (asset.status === 'Broken' || asset.status === 'Under Repair')
        );
      }
    } catch (error) {
      console.error('Error fetching all defective assets:', error);
      // Fallback to current assets if fetch fails
      allDefectiveAssets = filteredAssets;
    }

    // Sort by category
    const sortedAssets = allDefectiveAssets.sort((a, b) => {
      const nameA = a.categories?.name || '';
      const nameB = b.categories?.name || '';
      return nameA.localeCompare(nameB);
    });

    // Prepare data for Excel
    const excelData = sortedAssets.map((asset) => ({
      'Category': asset.categories?.name || 'N/A',
      'Brand': asset.brands?.name || 'N/A',
      'Model': asset.models?.name || 'N/A',
      'Serial Number': asset.serial_number || 'N/A',
      'Store': asset.store_info ? `${asset.store_info.store_name} (${asset.store_info.store_code})` : 'Not assigned',
      'Ticket': asset.ticket_info?.rcc_reference_number || 'Not used',
      'Status': asset.status || 'N/A',
      'Under Warranty': asset.under_warranty ? 'Yes' : 'No',
      'Warranty Date': asset.warranty_date ? new Date(asset.warranty_date).toLocaleDateString() : 'N/A',
      'Created At': new Date(asset.created_at).toLocaleDateString(),
      'Updated At': new Date(asset.updated_at).toLocaleDateString(),
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Category
      { wch: 25 }, // Brand
      { wch: 30 }, // Model
      { wch: 30 }, // Serial Number
      { wch: 35 }, // Store
      { wch: 20 }, // Ticket
      { wch: 15 }, // Status
      { wch: 15 }, // Under Warranty
      { wch: 15 }, // Warranty Date
      { wch: 15 }, // Created At
      { wch: 15 }, // Updated At
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Defective Assets');

    // Add metadata sheet
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const metaData = [
      { Field: 'Report Title', Value: 'Defective Assets Report' },
      { Field: 'Generated Date', Value: today },
      { Field: 'Total Defective Assets', Value: sortedAssets.length },
      { Field: 'Broken Assets', Value: sortedAssets.filter(a => a.status === 'Broken').length },
      { Field: 'Under Repair Assets', Value: sortedAssets.filter(a => a.status === 'Under Repair').length },
    ];
    const metaSheet = XLSX.utils.json_to_sheet(metaData);
    XLSX.utils.book_append_sheet(workbook, metaSheet, 'Report Info');

    // Save file
    const filename = `Defective_Assets_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, filename);

    showToast('success', 'Defective assets exported successfully!');
  };

  // Assets are already filtered by the API based on search term
  const filteredAssets = assets;

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
            <AlertTriangle size={20} />
          )}
          <p className="font-medium">{toast.message}</p>
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Defective Assets</h1>
          <p className="text-slate-400">View defective assets (Broken or Under Repair).</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95 whitespace-nowrap"
        >
          <FileSpreadsheet size={20} />
          <span>Export Excel</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
            <input
            type="text"
            placeholder="Search asset tag, serial number, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 text-slate-200 pl-10 pr-4 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
            />
        </div>
        <div className="flex flex-wrap gap-3">
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                className={`flex items-center gap-2 px-4 py-2.5 bg-slate-950 border ${statusFilter !== 'All' ? 'border-blue-500 text-blue-400' : 'border-slate-800 text-slate-300'} rounded-xl hover:border-slate-600 transition-all active:scale-95 whitespace-nowrap`}
              >
                <Filter size={18} />
                <span>{statusFilter === 'All' ? 'Status' : statusFilter}</span>
                <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isStatusDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                  <div className="p-1 space-y-1">
                    {['All', 'Broken', 'Under Repair'].map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          setStatusFilter(status);
                          setIsStatusDropdownOpen(false);
                          setCurrentPage(1); // Reset to first page
                        }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                          statusFilter === status
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-300 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
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
                        <p className="text-slate-400 text-sm mb-1">Total Defective Assets</p>
                        <h3 className="text-2xl font-bold text-white">{isLoading ? '-' : stats.totalDefectiveAssets}</h3>
                    </div>
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                        <Server size={24} />
                    </div>
                </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-slate-400 text-sm mb-1">Defective Printers</p>
                        <h3 className="text-2xl font-bold text-white">
                          {isLoading ? '-' : stats.defectivePrinters}
                        </h3>
                    </div>
                    <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                        <Printer size={24} />
                    </div>
                </div>
            </div>
             <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-slate-400 text-sm mb-1">Categories</p>
                        <h3 className="text-2xl font-bold text-white">
                          {isLoading ? '-' : stats.uniqueCategories}
                        </h3>
                    </div>
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <Monitor size={24} />
                    </div>
                </div>
            </div>
        </div>

      {/* Inventory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Brand</TableHead>
                        <TableHead>Model</TableHead>
                        <TableHead>Serial Number</TableHead>
                        <TableHead>Store</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Loading assets...</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredAssets.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                          {searchTerm ? 'No defective assets found matching your search.' : 'No defective/under repair items.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAssets.map((asset) => (
                        <TableRow key={asset.id} onClick={() => handleViewDetails(asset)} className="cursor-pointer">
                            <TableCell className="font-medium">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted border text-xs whitespace-nowrap">
                                  {asset.categories?.name || 'N/A'}
                                </span>
                            </TableCell>
                            <TableCell>{asset.brands?.name || 'N/A'}</TableCell>
                            <TableCell>
                                {asset.models?.name || '-'}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{asset.serial_number || '-'}</TableCell>
                            <TableCell>
                                {asset.store_info ? (
                                  <div className="text-sm">
                                    <p className="font-medium text-white">{asset.store_info.store_name}</p>
                                    <p className="text-xs text-slate-400">{asset.store_info.store_code}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-sm">Not assigned</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {asset.ticket_info ? (
                                  <div className="space-y-1">
                                    <p className="font-medium text-blue-400 text-sm">{asset.ticket_info.rcc_reference_number}</p>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
                                      asset.ticket_info.status === 'open' || asset.ticket_info.status === 'Open'
                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                      asset.ticket_info.status === 'in_progress' || asset.ticket_info.status === 'In Progress'
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                      asset.ticket_info.status === 'pending' || asset.ticket_info.status === 'Pending'
                                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                      asset.ticket_info.status === 'resolved' || asset.ticket_info.status === 'Resolved'
                                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                                        'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                    }`}>
                                      {asset.ticket_info.status}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500 text-sm">Not used</span>
                                )}
                            </TableCell>
                            <TableCell>
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${
                                  asset.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  asset.status === 'In Use' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  asset.status === 'Under Repair' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  asset.status === 'Broken' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                  {asset.status || 'Available'}
                                </span>
                            </TableCell>
                        </TableRow>
                      ))
                    )}
                </TableBody>
            </Table>
        </div>

        {/* Pagination Controls */}
        {!isLoading && filteredAssets.length > 0 && (
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
        )}
      </div>

      <AssetInventoryModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        editItem={selectedAssetForDetail}
        isViewingDetail={true}
      />
    </div>
  );
}
