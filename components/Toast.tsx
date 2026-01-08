import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X, ChevronDown, ChevronUp } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  description?: string;
  details?: string[];
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  message,
  description,
  details,
  duration = 5000,
  onClose
}) => {
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Don't auto-dismiss if there are details
    if (details && details.length > 0) {
      return;
    }

    const timer = setTimeout(() => {
      onClose(id);
    }, duration);

    return () => clearTimeout(timer);
  }, [id, duration, onClose, details]);

  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    info: <Info className="w-5 h-5" />,
  };

  const colors = {
    success: 'bg-emerald-500/90 border-emerald-400',
    error: 'bg-rose-500/90 border-rose-400',
    warning: 'bg-amber-500/90 border-amber-400',
    info: 'bg-blue-500/90 border-blue-400',
  };

  return (
    <div
      className={`${colors[type]} backdrop-blur-sm border text-white rounded-xl shadow-2xl p-4 mb-3 min-w-[320px] max-w-lg animate-slide-in-right`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {icons[type]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{message}</p>
          {description && (
            <p className="text-xs text-white/80 mt-1">{description}</p>
          )}
          {details && details.length > 0 && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-1 text-xs font-medium text-white/90 hover:text-white transition-colors"
              >
                {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {showDetails ? 'Hide' : 'Show'} Details ({details.length})
              </button>
              {showDetails && (
                <div className="mt-2 p-2 bg-black/20 rounded-lg max-h-40 overflow-y-auto">
                  <ul className="space-y-1">
                    {details.map((detail, index) => (
                      <li key={index} className="text-xs text-white/90">
                        • {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onClose(id)}
          className="flex-shrink-0 text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastProps[];
  onClose: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose }) => {
  return (
    <div className="fixed top-4 right-4 flex flex-col items-end" style={{ zIndex: 9999 }}>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onClose} />
      ))}
    </div>
  );
};
