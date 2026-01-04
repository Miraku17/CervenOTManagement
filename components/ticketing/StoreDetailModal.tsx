import React, { useState, useEffect } from 'react';
import { X, Edit2, Save, Store as StoreIcon, MapPin, Phone, User, Calendar, Trash2, CheckCircle } from 'lucide-react';
import { Store } from '@/types';
import { ConfirmModal } from '@/components/ConfirmModal';
import { usePermissions } from '@/hooks/usePermissions';

interface StoreDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  store: Store | null;
  onUpdate: () => void;
}

const StoreDetailModal: React.FC<StoreDetailModalProps> = ({ isOpen, onClose, store, onUpdate }) => {
  const { hasPermission } = usePermissions();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    store_name: '',
    store_code: '',
    store_type: '',
    contact_no: '',
    city: '',
    location: '',
    group: '',
    managers: '',
    status: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Delete state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (store && isOpen) {
      setFormData({
        store_name: store.store_name,
        store_code: store.store_code,
        store_type: store.store_type || '',
        contact_no: store.contact_no || '',
        city: store.city || '',
        location: store.location || '',
        group: store.group || '',
        managers: Array.isArray(store.managers) ? store.managers.join(', ') : store.managers || '',
        status: store.status || '',
      });
      setIsEditing(false);
      setError(null);
    }
  }, [store?.id, isOpen]);

  if (!isOpen || !store) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const managersArray = formData.managers
        ? formData.managers.split(',').map((m) => m.trim()).filter((m) => m !== '')
        : [];

      const response = await fetch('/api/stores/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: store.id,
          ...formData,
          managers: managersArray,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update store');
      }

      onUpdate();
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!store) return;
    setIsDeleting(true);
    try {
      const response = await fetch('/api/stores/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: store.id }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete store');
      }

      setIsDeleteModalOpen(false);
      onUpdate(); // This refreshes the list
      onClose(); // Close the detail modal
    } catch (err: any) {
      setError(err.message);
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400">
                <StoreIcon size={24} />
             </div>
             <div>
                 <h2 className="text-xl font-bold text-white">
                    {isEditing ? 'Edit Store Details' : store.store_name}
                 </h2>
                 {!isEditing && (
                     <span className="text-sm text-slate-400 font-mono">{store.store_code}</span>
                 )}
             </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
                <>
                    {/* Only Operations Manager can delete stores */}
                    {hasPermission('delete_stores') && (
                      <button
                          onClick={() => setIsDeleteModalOpen(true)}
                          className="p-2 hover:bg-red-500/10 rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete Store"
                      >
                          <Trash2 size={20} />
                      </button>
                    )}
                    {/* Operations Manager, Tech Support Lead, Tech Support Engineer can edit stores */}
                    {hasPermission('manage_stores') && (
                      <button
                          onClick={() => setIsEditing(true)}
                          className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-400 transition-colors"
                          title="Edit Store"
                      >
                          <Edit2 size={20} />
                      </button>
                    )}
                </>
            )}
            <button 
                onClick={onClose} 
                className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
              {error}
            </div>
          )}

          {isEditing ? (
            // Edit Mode
            <form id="edit-store-form" onSubmit={handleSave} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Store Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        required
                        value={formData.store_name}
                        onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Store Code <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        required
                        value={formData.store_code}
                        onChange={(e) => setFormData({ ...formData, store_code: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                  </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Managers (comma separated)</label>
                <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                    <input
                        type="text"
                        value={formData.managers}
                        onChange={(e) => setFormData({ ...formData, managers: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="John Doe, Jane Smith"
                    />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Store Type</label>
                    <input
                        type="text"
                        value={formData.store_type}
                        onChange={(e) => setFormData({ ...formData, store_type: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Retail, Warehouse"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Status</label>
                    <input
                        type="text"
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Active, Inactive"
                    />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Contact Number</label>
                     <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                        <input
                            type="text"
                            value={formData.contact_no}
                            onChange={(e) => setFormData({ ...formData, contact_no: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 text-white pl-10 pr-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                            placeholder="e.g. 09123456789"
                        />
                     </div>
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">City</label>
                    <input
                        type="text"
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Cebu"
                    />
                  </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Location</label>
                    <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. Downtown"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Group</label>
                    <input
                        type="text"
                        value={formData.group}
                        onChange={(e) => setFormData({ ...formData, group: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        placeholder="e.g. East Region"
                    />
                  </div>
              </div>
            </form>
          ) : (
            // View Mode
            <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Store Details</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <StoreIcon className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Store Type</p>
                                        <p className="text-slate-300">{store.store_type || 'Not specified'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <CheckCircle className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Status</p>
                                        <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium ${
                                          store.status === 'Active' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                                          store.status === 'Inactive' ? 'bg-gray-500/10 text-gray-400 border border-gray-500/20' :
                                          store.status === 'Closed' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                          store.status === 'Under Renovation' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                                          'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                                        }`}>
                                          {store.status || 'Not specified'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="text-blue-500 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Contact Number</p>
                                        <p className="text-slate-300">{store.contact_no || 'No contact number'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Location Details</h3>
                            <div className="space-y-4">
                                <div className="flex items-start gap-3">
                                    <MapPin className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">City</p>
                                        <p className="text-slate-300">{store.city || 'Not specified'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Location</p>
                                        <p className="text-slate-300">{store.location || 'Not specified'}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-3">
                                    <MapPin className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 mb-1">Group</p>
                                        <p className="text-slate-300">{store.group || 'Not specified'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Management</h3>
                             <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4">
                                <div className="flex items-start gap-3">
                                    <User className="text-blue-500 mt-1 shrink-0" size={18} />
                                    <div>
                                        <div className="flex flex-wrap gap-2">
                                            {Array.isArray(store.managers) && store.managers.length > 0 ? (
                                                store.managers.map((manager, idx) => (
                                                    <span key={idx} className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-sm border border-blue-500/20">
                                                        {manager}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-slate-400 italic">No managers assigned</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                             </div>
                        </div>

                         <div>
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">System Info</h3>
                             <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <Calendar size={16} />
                                <span>Created on {new Date(store.created_at).toLocaleDateString()}</span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/50 flex justify-end gap-3">
          {isEditing ? (
            <>
                <button
                    type="button"
                    onClick={() => {
                        setIsEditing(false);
                        setError(null);
                    }}
                    disabled={loading}
                    className="px-5 py-2.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors font-medium"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    form="edit-store-form"
                    disabled={loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/30 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                    <Save size={18} />
                    )}
                    <span>Save Changes</span>
                </button>
            </>
          ) : (
             <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium border border-slate-700"
            >
                Close
            </button>
          )}
        </div>
      </div>
    </div>

    <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Store"
        message={`Are you sure you want to delete "${store.store_name}"? This action cannot be undone.`}
        type="danger"
        confirmText={isDeleting ? "Deleting..." : "Delete Store"}
        onConfirm={handleDelete}
        onCancel={() => !isDeleting && setIsDeleteModalOpen(false)}
    />
    </>
  );
};

export default StoreDetailModal;
