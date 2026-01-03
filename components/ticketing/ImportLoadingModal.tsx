import React from 'react';
import Image from 'next/image';

interface ImportLoadingModalProps {
  isOpen: boolean;
  fileName?: string;
  title?: string;
}

export default function ImportLoadingModal({ isOpen, fileName, title = "Importing Data" }: ImportLoadingModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8 border border-slate-700 flex flex-col items-center">
        {/* Logo Spinner */}
        <div className="relative mb-8">
          {/* Glowing background effect */}
          <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full animate-pulse"></div>
          
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
            {/* Outer rotating ring */}
            <div className="absolute inset-0 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            
            {/* Inner rotating ring (counter-clockwise) */}
            <div className="absolute inset-2 border-4 border-purple-500/30 border-b-purple-500 rounded-full animate-reverse-spin"></div>
            
            {/* Logo */}
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 animate-pulse-slow rounded-full overflow-hidden bg-slate-800 border-2 border-slate-700/50 shadow-inner">
              <Image 
                src="/cerventech.png" 
                alt="Loading..." 
                fill
                className="object-cover scale-90"
                priority
              />
            </div>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
          {title}
        </h3>

        {/* File name */}
        {fileName && (
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg mb-6 border border-slate-700/50 max-w-full">
            <p className="text-slate-300 text-sm truncate font-mono">
              {fileName}
            </p>
          </div>
        )}

        {/* Progress bar */}
        <div className="w-full mb-6">
          <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden border border-slate-700/50">
            <div className="h-full bg-gradient-to-r from-blue-600 via-purple-500 to-blue-600 animate-progress relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Status text */}
        <div className="space-y-2 text-center w-full">
          <p className="text-slate-300 font-medium animate-pulse">
            Processing your import...
          </p>
          <p className="text-slate-500 text-xs sm:text-sm">
            Please do not close this window.
          </p>
        </div>
      </div>

      <style jsx global>{`
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
        
        @keyframes reverse-spin {
          from {
            transform: rotate(360deg);
          }
          to {
            transform: rotate(0deg);
          }
        }

        .animate-progress {
          animation: progress 2s ease-in-out infinite;
        }

        .animate-shimmer {
          animation: shimmer 2.5s ease-in-out infinite;
        }
        
        .animate-reverse-spin {
          animation: reverse-spin 3s linear infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>
    </div>
  );
}