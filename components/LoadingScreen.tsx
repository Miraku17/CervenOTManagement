import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/50">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-8 h-8 text-white animate-pulse"
          >
            <path d="M2.5 18L12 2.5L21.5 18H2.5Z" />
            <path d="M12 2.5V18" />
            <path d="M7 18L12 10" />
            <path d="M17 18L12 10" />
          </svg>
        </div>
        <p className="text-white text-xl font-medium">{message}</p>
      </div>
    </div>
  );
};
