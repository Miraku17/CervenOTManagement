import React from 'react';
import { Upload, Loader2 } from 'lucide-react';

interface ImportLoadingModalProps {
  isOpen: boolean;
  fileName?: string;
}

export default function ImportLoadingModal({ isOpen, fileName }: ImportLoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-8 border border-slate-700">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 bg-purple-600/20 rounded-full flex items-center justify-center">
              <Upload className="w-10 h-10 text-purple-400" />
            </div>
            <div className="absolute -top-1 -right-1">
              <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-2xl font-bold text-white text-center mb-2">
          Importing Assets
        </h3>

        {/* File name */}
        {fileName && (
          <p className="text-slate-400 text-center mb-6 text-sm">
            {fileName}
          </p>
        )}

        {/* Progress bar */}
        <div className="mb-6">
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 animate-progress relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="space-y-2 text-center">
          <p className="text-slate-300 font-medium">
            Processing your import...
          </p>
          <p className="text-slate-500 text-sm">
            This may take a few moments depending on file size
          </p>
        </div>

        {/* Animated dots */}
        <div className="flex justify-center gap-2 mt-6">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        .animate-progress {
          animation: progress 1.5s ease-in-out infinite;
        }

        .animate-shimmer {
          animation: shimmer 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
