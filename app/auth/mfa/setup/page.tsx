'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, CheckCircle, Copy, Check, AlertCircle, Smartphone, KeyRound, LogOut } from 'lucide-react';
import { supabase } from '@/services/supabase';

export default function MFASetupPage() {
  const router = useRouter();

  const [factorId, setFactorId] = useState('');
  const [qr, setQR] = useState('');
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'loading' | 'qrcode' | 'success' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const enrollMFA = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth/login');
          return;
        }

        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();

        if (factorsError) {
          setError(`Failed to check MFA status: ${factorsError.message}`);
          setStep('error');
          return;
        }

        const verifiedFactor = factorsData?.totp?.find(f => f.status === 'verified');

        if (verifiedFactor) {
          router.push('/dashboard');
          return;
        }

        const unverifiedFactors = factorsData?.totp?.filter(f => (f.status as string) === 'unverified') || [];

        if (unverifiedFactors.length > 0) {
          for (const factor of unverifiedFactors) {
            await supabase.auth.mfa.unenroll({ factorId: factor.id });
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: `Authenticator-${Date.now()}`,
        });

        if (enrollError) {
          setError(enrollError.message);
          setStep('error');
          return;
        }

        if (!data) {
          setError('No enrollment data returned from Supabase');
          setStep('error');
          return;
        }

        setFactorId(data.id);
        setQR(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('qrcode');
      } catch (err: any) {
        setError(err.message || 'An unexpected error occurred');
        setStep('error');
      }
    };

    enrollMFA();
  }, [router]);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...verificationCode];
    newCode[index] = value;
    setVerificationCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

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
    if (!factorId) return;

    setError(null);
    setLoading(true);

    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        setLoading(false);
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code,
      });

      if (verify.error) {
        setError(verify.error.message);
        setLoading(false);
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      setStep('success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setLoading(false);
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const handleRetry = () => {
    setError(null);
    setStep('loading');
    window.location.reload();
  };

  // Loading state
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
            <div className="absolute inset-0 w-16 h-16 rounded-full border-2 border-blue-500/20 animate-ping mx-auto" />
          </div>
          <p className="mt-6 text-slate-400 font-medium">Setting up two-factor authentication...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-red-500 to-rose-500" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Setup Failed</h1>
              <p className="text-slate-400 mb-6">{error}</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={handleRetry}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-blue-500/20"
                >
                  Try Again
                </button>
                <button
                  onClick={handleLogout}
                  className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg transition-colors border border-slate-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="w-full max-w-md">
          <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                <div className="absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">MFA Enabled</h1>
              <p className="text-slate-400 mb-4">
                Your account is now protected with two-factor authentication.
              </p>
              <div className="flex items-center justify-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Redirecting to dashboard...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main setup view - Horizontal layout
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background pattern */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiMyMDI5M2EiIGZpbGwtb3BhY2l0eT0iMC4zIj48cGF0aCBkPSJNMzYgMzRoLTJ2LTJoMnYyem0wLTRoLTJ2LTJoMnYyem0tNC00aC0ydi0yaDJ2MnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50 pointer-events-none" />

      <div className="w-full max-w-4xl relative">
        {/* Main Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
          {/* Accent bar */}
          <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />

          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Two-Factor Authentication</h1>
                <p className="text-xs text-slate-400">Add an extra layer of security</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>

          {/* Horizontal Content */}
          <div className="p-6 flex flex-col lg:flex-row gap-6">
            {/* Left Side - QR Code */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 1: Scan QR Code</h3>
                  <p className="text-xs text-slate-400">Use your authenticator app</p>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center bg-slate-800/30 rounded-xl p-4 border border-slate-700/30">
                <div className="bg-white p-3 rounded-xl shadow-lg">
                  <img src={qr} alt="QR Code" className="w-36 h-36" />
                </div>
              </div>

              {/* Manual Entry */}
              <div className="mt-4 bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs text-slate-400">Manual entry code</span>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/80 rounded-md px-3 py-2 border border-slate-700/50">
                  <code className="text-xs text-slate-300 font-mono flex-1 break-all">
                    {secret}
                  </code>
                  <button
                    onClick={copySecret}
                    className="shrink-0 p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                    title="Copy"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:flex flex-col items-center justify-center">
              <div className="w-px h-full bg-slate-700" />
            </div>
            <div className="lg:hidden h-px w-full bg-slate-700" />

            {/* Right Side - Verification */}
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-400">2</span>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Step 2: Enter Code</h3>
                  <p className="text-xs text-slate-400">From your authenticator app</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col justify-center">
                {/* Verification Code Input */}
                <div className="mb-4">
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
                        className="w-11 h-14 text-center text-xl font-bold bg-slate-800 border-2 border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 disabled:opacity-50"
                        disabled={loading}
                      />
                    ))}
                  </div>
                  <p className="text-center text-xs text-slate-500 mt-3">
                    Enter the 6-digit code from your app
                  </p>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center gap-2 text-red-400 text-sm justify-center bg-red-500/10 rounded-lg px-4 py-2.5 border border-red-500/20 mb-4">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Loading State */}
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-blue-400 bg-blue-500/10 rounded-lg px-4 py-2.5 border border-blue-500/20 mb-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Verifying...</span>
                  </div>
                )}

                {/* Supported Apps */}
                <div className="bg-slate-800/30 rounded-lg p-3 border border-slate-700/30">
                  <p className="text-xs text-slate-400 mb-2">Supported apps:</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">Google Authenticator</span>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">Microsoft Authenticator</span>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-1 rounded">Authy</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
