import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, AlertCircle, Loader2, Check } from 'lucide-react';
import { differenceInDays, parseISO, format } from 'date-fns';

interface FileLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

const FileLeaveModal: React.FC<FileLeaveModalProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const [formData, setFormData] = useState({
    type: 'Vacation',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [totalDays, setTotalDays] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (formData.startDate && formData.endDate) {
      try {
        const start = parseISO(formData.startDate);
        const end = parseISO(formData.endDate);
        const diff = differenceInDays(end, start) + 1;
        setTotalDays(diff > 0 ? diff : 0);
      } catch (e) {
        setTotalDays(0);
      }
    } else {
      setTotalDays(0);
    }
  }, [formData.startDate, formData.endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    if (totalDays <= 0) {
        setError('End date must be after start date.');
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch('/api/leave/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          ...formData,
          totalDays,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit leave request');
      }

      onSuccess();
      onClose();
      // Reset form
      setFormData({
        type: 'Vacation',
        startDate: '',
        endDate: '',
        reason: '',
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarIcon className="text-blue-400" size={24} />
            File Leave Request
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 text-sm">
              <AlertCircle size={20} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Leave Type</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
              >
                <option value="Vacation">Vacation Leave</option>
                <option value="Sick">Sick Leave</option>
                <option value="Personal">Personal Leave</option>
                <option value="Emergency">Emergency Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  required
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            {totalDays > 0 && (
               <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-2 text-blue-300 text-sm font-medium">
                 <CalendarIcon size={16} />
                 <span>Total Duration: {totalDays} day{totalDays !== 1 ? 's' : ''}</span>
               </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Reason</label>
              <textarea
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                placeholder="Please provide a reason for your leave..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none placeholder-slate-600"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Submit Request</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FileLeaveModal;
