'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Upload, FileSpreadsheet, Trash2, Edit, Loader2 } from 'lucide-react';
import ImportHolidaysModal from './ImportHolidaysModal';

interface Holiday {
  id: string;
  date: string;
  name: string;
  holiday_type: string;
  is_recurring: boolean;
  created_at: string;
}

export default function HolidaysView() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    date: '',
    name: '',
    holiday_type: 'regular',
    is_recurring: false,
  });

  // Fetch holidays
  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/holidays/get?year=${selectedYear}`);
      const data = await response.json();
      if (response.ok) {
        setHolidays(data.holidays || []);
      }
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, [selectedYear]);

  // Handle download template
  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/admin/holidays/download-template');
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'holidays_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Failed to download template. Please try again.');
    }
  };

  // Handle create holiday
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/holidays/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setIsAddModalOpen(false);
        setFormData({ date: '', name: '', holiday_type: 'regular', is_recurring: false });
        fetchHolidays();
        alert('Holiday created successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to create holiday');
      }
    } catch (error) {
      console.error('Error creating holiday:', error);
      alert('Failed to create holiday');
    }
  };

  // Handle update holiday
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHoliday) return;

    try {
      const response = await fetch('/api/admin/holidays/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingHoliday.id, ...formData }),
      });

      if (response.ok) {
        setIsEditModalOpen(false);
        setEditingHoliday(null);
        setFormData({ date: '', name: '', holiday_type: 'regular', is_recurring: false });
        fetchHolidays();
        alert('Holiday updated successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update holiday');
      }
    } catch (error) {
      console.error('Error updating holiday:', error);
      alert('Failed to update holiday');
    }
  };

  // Handle delete holiday
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const response = await fetch('/api/admin/holidays/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        fetchHolidays();
        alert('Holiday deleted successfully');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete holiday');
      }
    } catch (error) {
      console.error('Error deleting holiday:', error);
      alert('Failed to delete holiday');
    }
  };

  // Open edit modal
  const openEditModal = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setFormData({
      date: holiday.date,
      name: holiday.name,
      holiday_type: holiday.holiday_type,
      is_recurring: holiday.is_recurring,
    });
    setIsEditModalOpen(true);
  };

  // Generate year options (current year ± 5 years)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const getHolidayTypeLabel = (type: string) => {
    switch (type) {
      case 'regular': return 'Regular';
      case 'special_non_working': return 'Special Non-Working';
      case 'special_working': return 'Special Working';
      default: return type;
    }
  };

  const getHolidayTypeColor = (type: string) => {
    switch (type) {
      case 'regular': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'special_non_working': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'special_working': return 'bg-green-500/10 text-green-400 border-green-500/20';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Holiday Management</h1>
          <p className="text-slate-400">Manage company holidays and import holiday calendars.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            <span>Add Holiday</span>
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
            <span>Import Holidays</span>
          </button>
        </div>
      </div>

      {/* Year Filter */}
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
        <div className="flex items-center gap-3">
          <Calendar size={20} className="text-slate-400" />
          <label className="text-sm font-medium text-slate-300">Filter by Year:</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {yearOptions.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Holidays List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="text-blue-500 animate-spin" />
        </div>
      ) : holidays.length > 0 ? (
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Holiday Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-300">Recurring</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {holidays.map((holiday) => (
                  <tr key={holiday.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-white font-medium">
                      {new Date(holiday.date + 'T00:00:00').toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">{holiday.name}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium border ${getHolidayTypeColor(holiday.holiday_type)}`}>
                        {getHolidayTypeLabel(holiday.holiday_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {holiday.is_recurring ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(holiday)}
                          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                          title="Edit holiday"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(holiday.id, holiday.name)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete holiday"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-900/50 rounded-xl border border-slate-800">
          <Calendar size={48} className="mx-auto text-slate-600 mb-4" />
          <h3 className="text-lg font-medium text-slate-300">No holidays found for {selectedYear}</h3>
          <p className="text-slate-500 mt-1">Add holidays manually or import from a file.</p>
        </div>
      )}

      {/* Add/Edit Holiday Modal */}
      {(isAddModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-slate-800">
              <h2 className="text-xl font-bold text-white">
                {isEditModalOpen ? 'Edit Holiday' : 'Add Holiday'}
              </h2>
            </div>
            <form onSubmit={isEditModalOpen ? handleUpdate : handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Holiday Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="e.g., New Year's Day"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Type</label>
                <select
                  value={formData.holiday_type}
                  onChange={(e) => setFormData({ ...formData, holiday_type: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="regular">Regular</option>
                  <option value="special_non_working">Special Non-Working</option>
                  <option value="special_working">Special Working</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                <label htmlFor="is_recurring" className="text-sm text-slate-300">
                  Recurring (repeats yearly)
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    isEditModalOpen ? setIsEditModalOpen(false) : setIsAddModalOpen(false);
                    setFormData({ date: '', name: '', holiday_type: 'regular', is_recurring: false });
                    setEditingHoliday(null);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  {isEditModalOpen ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <ImportHolidaysModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={fetchHolidays}
      />
    </div>
  );
}
