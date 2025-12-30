import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Clock, AlertCircle, Loader2, Check, Trash2, Edit3 } from 'lucide-react';
import { format } from 'date-fns';

interface PendingRequest {
  id: string;
  overtime_date: string;
  start_time: string;
  end_time: string;
  total_hours: number;
  reason: string;
  status: string;
  level1_status: string | null;
}

interface FileOvertimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
}

const FileOvertimeModal: React.FC<FileOvertimeModalProps> = ({ isOpen, onClose, onSuccess, userId }) => {
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '',
    endTime: '',
    reason: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingDate, setIsCheckingDate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check for existing pending request when date changes
  useEffect(() => {
    if (isOpen && formData.date && userId) {
      checkExistingRequest(formData.date);
    }
  }, [formData.date, isOpen, userId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsEditMode(false);
      setShowDeleteConfirm(false);
    }
  }, [isOpen]);

  const checkExistingRequest = async (date: string) => {
    setIsCheckingDate(true);
    setError(null);

    try {
      const response = await fetch('/api/overtime/my-requests');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check existing requests');
      }

      // Find pending request for the selected date
      const existing = data.requests?.find((req: PendingRequest) =>
        req.overtime_date === date &&
        (!req.level1_status || req.level1_status === 'pending')
      );

      if (existing) {
        setPendingRequest(existing);
        // Pre-fill form with existing data
        setFormData({
          date: existing.overtime_date,
          startTime: existing.start_time.slice(0, 5), // Format HH:mm
          endTime: existing.end_time.slice(0, 5),
          reason: existing.reason,
        });
      } else {
        setPendingRequest(null);
        // Reset form fields except date
        if (!isEditMode) {
          setFormData(prev => ({
            ...prev,
            startTime: '',
            endTime: '',
            reason: '',
          }));
        }
      }
    } catch (err: any) {
      console.error('Error checking existing request:', err);
    } finally {
      setIsCheckingDate(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    // Validate times
    if (!formData.startTime || !formData.endTime) {
      setError('Please provide both start and end times for overtime.');
      setIsLoading(false);
      return;
    }

    // Allow overnight shifts (e.g., 10 PM to 2 AM next day)
    // No validation needed here - the database will calculate hours correctly

    if (!formData.reason.trim()) {
      setError('Please provide a reason for overtime.');
      setIsLoading(false);
      return;
    }

    try {
      // If editing existing request
      if (pendingRequest && isEditMode) {
        const response = await fetch('/api/overtime/update-request', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: pendingRequest.id,
            startTime: formData.startTime,
            endTime: formData.endTime,
            reason: formData.reason,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to update overtime request');
        }
      } else {
        // Create new request
        const response = await fetch('/api/overtime/file-request', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            date: formData.date,
            startTime: formData.startTime,
            endTime: formData.endTime,
            reason: formData.reason,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit overtime request');
        }
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingRequest) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/overtime/delete-request?id=${pendingRequest.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete overtime request');
      }

      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setPendingRequest(null);
    setIsEditMode(false);
    setShowDeleteConfirm(false);
    setFormData({
      date: format(new Date(), 'yyyy-MM-dd'),
      startTime: '',
      endTime: '',
      reason: '',
    });
    onClose();
  };

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Clock className="text-amber-400" size={24} />
            {pendingRequest && !isEditMode ? 'Pending Overtime Request' : isEditMode ? 'Edit Overtime Request' : 'File Overtime Request'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm ? (
          <div className="p-6 space-y-6">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
              <Trash2 className="w-12 h-12 text-red-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-white mb-2">Delete Overtime Request?</h3>
              <p className="text-slate-400 text-sm">
                Are you sure you want to delete this overtime request? This action cannot be undone.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isLoading}
                className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full sm:flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-500 rounded-xl transition-colors shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={18} />
                    <span>Delete Request</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : pendingRequest && !isEditMode ? (
          /* View Pending Request */
          <div className="p-6 space-y-6">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle size={20} className="text-amber-400" />
                <span className="text-amber-400 font-medium">Pending Level 1 Approval</span>
              </div>
              <p className="text-slate-400 text-sm">
                You already have a pending overtime request for this date. You can edit or delete it while it's still pending review.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Start Time</label>
                  <p className="text-white bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700">
                    {formatTimeDisplay(pendingRequest.start_time.slice(0, 5))}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">End Time</label>
                  <p className="text-white bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700">
                    {formatTimeDisplay(pendingRequest.end_time.slice(0, 5))}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Total Hours</label>
                <p className="text-white bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-700 font-mono font-semibold">
                  {pendingRequest.total_hours.toFixed(2)} hours
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Reason</label>
                <p className="text-white bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 text-sm">
                  {pendingRequest.reason}
                </p>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 text-sm">
                <AlertCircle size={20} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className="w-full sm:flex-1 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Trash2 size={18} />
                <span>Delete</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                disabled={isLoading}
                className="w-full sm:flex-1 px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-500 rounded-xl transition-colors shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Edit3 size={18} />
                <span>Edit Request</span>
              </button>
            </div>
          </div>
        ) : (
          /* Create/Edit Form */
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 flex items-center gap-3 text-sm">
                <AlertCircle size={20} className="shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Date of Overtime</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  disabled={isEditMode || isCheckingDate}
                  className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark] disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {isCheckingDate ? (
                <div className="p-8 flex flex-col items-center justify-center">
                  <Loader2 size={32} className="animate-spin text-amber-400 mb-3" />
                  <p className="text-slate-400 text-sm">Checking for existing requests...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">Start Time</label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1.5">End Time</label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        required
                        className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-2.5 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {/* Overnight shift indicator */}
                  {formData.startTime && formData.endTime && formData.startTime > formData.endTime && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                      <div className="flex items-start gap-2">
                        <Clock size={16} className="text-blue-400 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="text-blue-400 font-medium">Overnight Shift Detected</p>
                          <p className="text-blue-300/80 text-xs mt-0.5">
                            This overtime extends into the next day (e.g., {formatTimeDisplay(formData.startTime)} → {formatTimeDisplay(formData.endTime)} next day)
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1.5">Reason for Overtime</label>
                    <textarea
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      required
                      placeholder="Please provide a reason for your overtime work..."
                      rows={3}
                      className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none placeholder-slate-500"
                    />
                  </div>
                </>
              )}
            </div>

            {!isCheckingDate && (
              <div className="flex flex-col-reverse sm:flex-row items-stretch gap-3 pt-2">
                <button
                  type="button"
                  onClick={isEditMode ? () => setIsEditMode(false) : handleClose}
                  disabled={isLoading}
                  className="w-full sm:flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  {isEditMode ? 'Back' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:flex-1 px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-500 rounded-xl transition-colors shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>{isEditMode ? 'Updating...' : 'Submitting...'}</span>
                    </>
                  ) : (
                    <>
                      <Check size={18} />
                      <span>{isEditMode ? 'Update Request' : 'Submit Request'}</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

export default FileOvertimeModal;
