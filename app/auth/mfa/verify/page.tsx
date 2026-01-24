'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { supabase } from '@/services/supabase';
import Aurora from '@/components/react_bits/Aurora';

function MFAVerifyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { challengeAndVerify, listFactors, loading, error, setError } = useMFA();

  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get factor ID from URL or fetch from user's factors
  useEffect(() => {
    const initializeMFA = async () => {
      // Check if factor ID is in URL
      const urlFactorId = searchParams?.get('factorId');
      if (urlFactorId) {
        setFactorId(urlFactorId);
        setIsLoading(false);
        inputRefs.current[0]?.focus();
        return;
      }

      // Otherwise, fetch the user's verified TOTP factor
      const factors = await listFactors();
      const verifiedFactor = factors.find(f => f.status === 'verified');

      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
      } else {
        // No verified factor, redirect to setup
        router.push('/auth/mfa/setup');
        return;
      }

      setIsLoading(false);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    };

    initializeMFA();
  }, [searchParams, router]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCode.every(digit => digit !== '') && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setVerificationCode(newCode);
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code: string) => {
    if (!factorId) {
      setError('No MFA factor found. Please set up MFA first.');
      return;
    }

    setError(null);
    const success = await challengeAndVerify(factorId, code);

    if (success) {
      // Successfully verified, redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      // Clear code on error
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Aurora
          colorStops={['#3B82F6', '#1D4ED8', '#1E3A8A']}
          blend={1}
          amplitude={1.0}
          speed={1}
        />
      </div>

      <div className="w-full max-w-md p-6 sm:p-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        {/* Verification Code Input */}
        <div className="mb-6">
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {verificationCode.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                className="w-11 h-14 text-center text-xl font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                disabled={loading}
                autoComplete="one-time-code"
              />
            ))}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm mb-4 justify-center bg-red-500/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center gap-2 text-blue-400 mb-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Verifying...</span>
          </div>
        )}

        {/* Help Text */}
        <p className="text-center text-sm text-slate-500 mb-6">
          Open your authenticator app to view your verification code
        </p>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-slate-800 text-slate-500">or</span>
          </div>
        </div>

        {/* Logout option */}
        <div className="text-center">
          <button
            onClick={handleLogout}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign in with a different account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MFAVerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-slate-400">Loading...</p>
        </div>
      </div>
    }>
      <MFAVerifyContent />
    </Suspense>
  );
}
