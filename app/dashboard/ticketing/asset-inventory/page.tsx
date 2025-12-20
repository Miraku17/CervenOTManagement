'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, Filter, Monitor, Laptop, Server, AlertTriangle, Tag, Edit2, Trash2, CheckCircle, Printer, Upload, FileSpreadsheet, Loader2 } from 'lucide-react';
import AssetInventoryModal from '@/components/ticketing/AssetInventoryModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { supabase } from '@/services/supabase';

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
    first_name: string;
    last_name: string;
  } | null;
  updated_by_user?: {
    first_name: string;
    last_name: string;
  } | null;
  deleted_by_user?: {
    first_name: string;
    last_name: string;
  } | null;
}

export default function AssetInventoryPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [editItem, setEditItem] = useState<Asset | null>(null);
  const [selectedAssetForDetail, setSelectedAssetForDetail] = useState<Asset | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Access control check
  // Asset Inventory: accessible only by positions "asset" and "operations manager"
  const [userPosition, setUserPosition] = useState<string | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('positions(name)')
          .eq('id', user.id)
          .single();

        const position = (profile?.positions as any)?.name?.toLowerCase();
        setUserPosition(position || null);
        const hasAccess = position === 'asset' || position === 'assets' || position === 'operations manager';

        if (!hasAccess) {
          router.push('/dashboard/ticketing/tickets');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        router.push('/dashboard/ticketing/tickets');
      }
    };

    checkAccess();
  }, [user?.id, router]);

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

  // Fetch assets on component mount
  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/assets/get');
      const data = await response.json();

      if (response.ok) {
        setAssets(data.assets || []);
      } else {
        showToast('error', 'Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
      showToast('error', 'Failed to fetch assets');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the detail modal
    setEditItem(asset);
    setIsModalOpen(true);
  };

  const handleViewDetails = (asset: Asset) => {
    setSelectedAssetForDetail(asset);
    setIsDetailModalOpen(true);
  }

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedAssetForDetail(null);
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch('/api/assets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', 'Asset deleted successfully');
        fetchAssets();
        setDeleteId(null);
      } else {
        showToast('error', data.error || 'Failed to delete asset');
      }
    } catch (error) {
      console.error('Error deleting asset:', error);
      showToast('error', 'Failed to delete asset');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditItem(null);
  };

  const handlePrint = async () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Fetch ALL assets including deleted ones for the PDF
    let allAssets: Asset[] = [];
    try {
      const response = await fetch('/api/assets/get-all');
      const data = await response.json();
      if (response.ok) {
        allAssets = data.assets || [];
      }
    } catch (error) {
      console.error('Error fetching all assets:', error);
      // Fallback to current assets if fetch fails
      allAssets = filteredAssets;
    }

    // Sort assets alphabetically by category name
    const sortedAssets = [...allAssets].sort((a, b) => {
      const nameA = a.categories?.name || '';
      const nameB = b.categories?.name || '';
      return nameA.localeCompare(nameB);
    });

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
    doc.text('Asset Inventory Report', pageWidth / 2, 38, { align: 'center' });

    // Add date and count
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const activeCount = sortedAssets.filter(asset => !asset.deleted_at).length;
    const deletedCount = sortedAssets.filter(asset => asset.deleted_at).length;
    doc.text(`Generated: ${today}`, 14, 46);
    doc.text(`Active: ${activeCount} | Deleted: ${deletedCount} | Total: ${sortedAssets.length}`, pageWidth - 14, 46, { align: 'right' });

    // Prepare table data
    const tableColumn = [
      'Category',
      'Brand',
      'Model',
      'Serial Number',
      'Status',
      'Created By',
      'Created At',
      'Updated By',
      'Updated At',
      'Deleted By',
      'Deleted At',
    ];

    const tableRows = sortedAssets.map((asset) => [
      asset.categories?.name || 'N/A',
      asset.brands?.name || 'N/A',
      asset.models?.name || 'N/A',
      asset.serial_number || 'N/A',
      asset.status || 'Available',
      asset.created_by_user ? `${asset.created_by_user.first_name} ${asset.created_by_user.last_name}` : 'N/A',
      asset.created_at ? new Date(asset.created_at).toLocaleDateString() : 'N/A',
      asset.updated_by_user ? `${asset.updated_by_user.first_name} ${asset.updated_by_user.last_name}` : 'N/A',
      asset.updated_at ? new Date(asset.updated_at).toLocaleDateString() : 'N/A',
      asset.deleted_by_user ? `${asset.deleted_by_user.first_name} ${asset.deleted_by_user.last_name}` : 'N/A',
      asset.deleted_at ? new Date(asset.deleted_at).toLocaleDateString() : 'N/A',
    ]);

    // Add table
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 54,
      styles: {
        fontSize: 7,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [15, 23, 42], // Slate 900
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252], // Light gray
      },
      columnStyles: {
        0: { cellWidth: 26 },  // Category
        1: { cellWidth: 26 },  // Brand
        2: { cellWidth: 26 },  // Model
        3: { cellWidth: 26 },  // Serial Number
        4: { cellWidth: 22 },  // Status
        5: { cellWidth: 26 },  // Created By
        6: { cellWidth: 22 },  // Created At
        7: { cellWidth: 26 },  // Updated By
        8: { cellWidth: 22 },  // Updated At
        9: { cellWidth: 26 },  // Deleted By
        10: { cellWidth: 22 }, // Deleted At
      },
      didParseCell: function(data) {
        // Highlight deleted rows in red (only body rows, not headers)
        if (data.section === 'body') {
          const rowIndex = data.row.index;
          if (sortedAssets[rowIndex]?.deleted_at) {
            data.cell.styles.fillColor = [255, 230, 230]; // Light red background
            data.cell.styles.textColor = [180, 0, 0]; // Dark red text
          }
        }
      },
    });

    // Add page numbers
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    // Open PDF in new tab (without print dialog)
    window.open(doc.output('bloburl'), '_blank');
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/assets/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'asset_inventory_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('success', 'Template downloaded successfully!');
    } catch (error: any) {
      console.error('Error downloading template:', error);
      showToast('error', error.message || 'Failed to download template');
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      showToast('error', 'Please upload an Excel file (.xlsx or .xls)');
      return;
    }

    setIsImporting(true);
    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          const fileData = base64.split(',')[1]; // Remove data:application/... prefix

          const response = await fetch('/api/assets/import', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fileData }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || 'Failed to import file');
          }

          // Show success message with details
          const { result } = data;
          let message = `Import completed! ${result.success} items imported successfully.`;
          if (result.failed > 0) {
            message += ` ${result.failed} items failed.`;
          }

          showToast(result.failed > 0 ? 'error' : 'success', message);

          // Log errors for debugging
          if (result.errors && result.errors.length > 0) {
            console.error('Import errors:', result.errors);
          }

          // Refresh assets
          await fetchAssets();
        } catch (error: any) {
          console.error('Error importing file:', error);
          showToast('error', error.message || 'Failed to import file');
        } finally {
          setIsImporting(false);
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error reading file:', error);
      showToast('error', error.message || 'Failed to read file');
      setIsImporting(false);
    }
  };

  // Filter assets based on search term
  const filteredAssets = assets.filter((asset) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      asset.categories?.name.toLowerCase().includes(searchLower) ||
      asset.brands?.name.toLowerCase().includes(searchLower) ||
      asset.models?.name.toLowerCase().includes(searchLower) ||
      asset.serial_number?.toLowerCase().includes(searchLower)
    );
  });

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

      {/* Delete Confirmation Modal */}
      {deleteId && (() => {
        const assetToDelete = assets.find(a => a.id === deleteId);
        const isInUse = assetToDelete?.status === 'In Use';
        
        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className={`bg-slate-900 rounded-lg shadow-xl w-full max-w-md border ${isInUse ? 'border-amber-500/50' : 'border-slate-700'}`}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  {isInUse ? <AlertTriangle className="text-amber-500" size={24} /> : <AlertTriangle className="text-red-500" size={24} />}
                  <h3 className="text-xl font-bold text-white">Delete Asset</h3>
                </div>
                
                {isInUse ? (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
                    <p className="text-amber-200 font-medium mb-1">Warning: Asset currently In Use</p>
                    <p className="text-amber-200/70 text-sm">
                      This asset is currently assigned to a store. Deleting it will <strong>permanently remove</strong> it from both the Asset Inventory and the Store Inventory.
                    </p>
                  </div>
                ) : (
                  <p className="text-slate-400 mb-6">
                    Are you sure you want to delete this asset? This action cannot be undone.
                  </p>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(deleteId)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <span>{isInUse ? 'Force Delete' : 'Delete'}</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Asset Inventory</h1>
          <p className="text-slate-400">Manage company assets, equipment, and hardware.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
            >
              <Plus size={20} />
              <span>Add Asset</span>
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors shadow-lg shadow-emerald-900/20"
            >
              <FileSpreadsheet size={20} />
              <span>Download Template</span>
            </button>
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-xl transition-colors shadow-lg shadow-purple-900/20"
            >
              {isImporting ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  <span>Importing...</span>
                </>
              ) : (
                <>
                  <Upload size={20} />
                  <span>Import XLSX</span>
                </>
              )}
            </button>
            <button
                onClick={handlePrint}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors shadow-lg shadow-slate-900/20"
              >
                <Printer size={20} />
                <span>Print Report</span>
              </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

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
        <div className="flex gap-3">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl hover:border-slate-600 transition-colors">
                <Filter size={18} />
                <span>Status</span>
            </button>
             <button className="flex items-center gap-2 px-4 py-2.5 bg-slate-950 border border-slate-800 text-slate-300 rounded-xl hover:border-slate-600 transition-colors">
                <Monitor size={18} />
                <span>Type</span>
            </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Total Assets</p>
                      <h3 className="text-2xl font-bold text-white">{loading ? '-' : assets.length}</h3>
                  </div>
                  <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                      <Server size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">With Serial Number</p>
                      <h3 className="text-2xl font-bold text-white">
                        {loading ? '-' : assets.filter(a => a.serial_number).length}
                      </h3>
                  </div>
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                      <Tag size={24} />
                  </div>
              </div>
          </div>
           <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex items-start justify-between">
                  <div>
                      <p className="text-slate-400 text-sm mb-1">Categories</p>
                      <h3 className="text-2xl font-bold text-white">
                        {loading ? '-' : new Set(assets.map(a => a.categories?.id).filter(Boolean)).size}
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
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider">
                        <th className="p-4 font-semibold">Category</th>
                        <th className="p-4 font-semibold">Brand</th>
                        <th className="p-4 font-semibold">Model</th>
                        <th className="p-4 font-semibold">Serial Number</th>
                        <th className="p-4 font-semibold">Status</th>
                        <th className="p-4 font-semibold text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                            <span>Loading assets...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-400">
                          {searchTerm ? 'No assets found matching your search.' : 'No assets yet. Click "Add Asset" to create one.'}
                        </td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr key={asset.id} onClick={() => handleViewDetails(asset)} className="hover:bg-slate-800/50 transition-colors group">
                            <td className="p-4 text-slate-300 font-medium">
                                <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs">
                                  {asset.categories?.name || 'N/A'}
                                </span>
                            </td>
                            <td className="p-4 text-slate-400">{asset.brands?.name || 'N/A'}</td>
                            <td className="p-4 text-slate-400">
                                {asset.models?.name || '-'}
                            </td>
                            <td className="p-4 text-slate-400 font-mono text-sm">{asset.serial_number || '-'}</td>
                            <td className="p-4">
                                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium border ${
                                  asset.status === 'Available' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  asset.status === 'In Use' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                  asset.status === 'Under Repair' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                  asset.status === 'Broken' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                  'bg-slate-700 text-slate-400 border-slate-600'
                                }`}>
                                  {asset.status || 'Available'}
                                </span>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={(e) => handleEdit(asset, e)}
                                  className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                  title="Edit asset"
                                >
                                  <Edit2 size={16} />
                                </button>
                                {/* Only operations manager can delete */}
                                {userPosition === 'operations manager' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteId(asset.id);
                                    }}
                                    className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete asset"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                        </tr>
                      ))
                    )}
                </tbody>
            </table>
        </div>
      </div>

      <AssetInventoryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={fetchAssets}
        editItem={editItem}
      />

      <AssetInventoryModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        editItem={selectedAssetForDetail}
        isViewingDetail={true}
      />
    </div>
  );
}
