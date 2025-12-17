import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X, Loader2 } from 'lucide-react'; // Import Loader2

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'info' | 'warning' | 'danger';
  children?: React.ReactNode;
  isLoading?: boolean; // New prop for loading state
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'info',
  children,
  isLoading = false, // Default to false
}) => {
  if (!isOpen) return null;

  const colors = {
    info: {
      icon: 'text-blue-400',
      button: 'bg-blue-600 hover:bg-blue-500',
    },
    warning: {
      icon: 'text-amber-400',
      button: 'bg-amber-600 hover:bg-amber-500',
    },
    danger: {
      icon: 'text-rose-400',
      button: 'bg-rose-600 hover:bg-rose-500',
    },
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm transition-opacity"
      onClick={onCancel}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100 animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex justify-between items-start bg-slate-900">
          <div className="flex items-start gap-3">
            <AlertCircle className={`w-6 h-6 mt-0.5 ${colors[type].icon}`} />
            <div>
              <h3 className="text-lg font-bold text-white">{title}</h3>
              <p className="text-slate-400 text-sm mt-1">{message}</p>
              {children && <div className="mt-4">{children}</div>}
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
            disabled={isLoading} // Disable cancel button too while loading
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Footer */}
        <div className="p-5 bg-slate-800/50 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading} // Disable cancel button too while loading
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm} // Only call onConfirm
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${colors[type].button}`}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
