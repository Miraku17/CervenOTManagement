'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, Loader2, CheckCircle, Copy, Check, AlertCircle } from 'lucide-react';
import { useMFA } from '@/hooks/useMFA';
import { supabase } from '@/services/supabase';
import Aurora from '@/components/react_bits/Aurora';

export default function MFASetupPage() {
  const router = useRouter();
  const { enrollTOTP, verifyEnrollment, listFactors, loading, error, setError } = useMFA();

  const [step, setStep] = useState<'loading' | 'qrcode' | 'verify' | 'success'>('loading');
  const [enrollmentData, setEnrollmentData] = useState<{
    id: string;
    qr_code: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if user already has MFA enrolled
  useEffect(() => {
    const checkExistingMFA = async () => {
      const factors = await listFactors();
      const verifiedFactor = factors.find(f => f.status === 'verified');

      if (verifiedFactor) {
        // Already enrolled, redirect to dashboard
        router.push('/dashboard');
        return;
      }

      // Check for unverified factor (enrollment in progress)
      const unverifiedFactor = factors.find(f => f.status === 'unverified');
      if (unverifiedFactor) {
        // Re-enroll to get fresh QR code
        await startEnrollment();
      } else {
        await startEnrollment();
      }
    };

    checkExistingMFA();
  }, []);

  const startEnrollment = async () => {
    const result = await enrollTOTP();
    if (result) {
      setEnrollmentData({
        id: result.id,
        qr_code: result.totp.qr_code,
        secret: result.totp.secret,
        uri: result.totp.uri,
      });
      setStep('qrcode');
    }
  };

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
    if (!enrollmentData) return;

    setError(null);
    const success = await verifyEnrollment(enrollmentData.id, code);

    if (success) {
      setStep('success');
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } else {
      // Clear code on error
      setVerificationCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const copySecret = () => {
    if (enrollmentData?.secret) {
      navigator.clipboard.writeText(enrollmentData.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
          <p className="mt-4 text-slate-400">Setting up two-factor authentication...</p>
        </div>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="fixed inset-0 -z-10 w-full h-full">
          <Aurora
            colorStops={['#22C55E', '#16A34A', '#15803D']}
            blend={1}
            amplitude={1.0}
            speed={1}
          />
        </div>
        <div className="w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MFA Enabled Successfully!</h1>
          <p className="text-slate-400 mb-4">
            Your account is now protected with two-factor authentication.
          </p>
          <p className="text-sm text-slate-500">Redirecting to dashboard...</p>
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
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold text-white">Set Up Two-Factor Authentication</h1>
          <p className="mt-2 text-sm text-slate-400">
            Scan the QR code with your authenticator app
          </p>
        </div>

        {step === 'qrcode' && enrollmentData && (
          <>
            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-6">
              <QRCodeSVG
                value={enrollmentData.uri}
                size={180}
                level="M"
                includeMargin={false}
              />
            </div>

            {/* Manual Entry Option */}
            <div className="mb-6">
              <p className="text-xs text-slate-500 text-center mb-2">
                Can't scan? Enter this code manually:
              </p>
              <div className="flex items-center justify-center gap-2 bg-slate-900/50 rounded-lg px-4 py-2">
                <code className="text-sm text-slate-300 font-mono break-all">
                  {enrollmentData.secret}
                </code>
                <button
                  onClick={copySecret}
                  className="flex-shrink-0 p-1.5 text-slate-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Verification Code Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-400 mb-3 text-center">
                Enter the 6-digit code from your app
              </label>
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
                    className="w-11 h-14 text-center text-xl font-bold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm mb-4 justify-center">
                <AlertCircle className="w-4 h-4" />
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

            {/* Instructions */}
            <div className="bg-slate-900/50 rounded-lg p-4 text-sm text-slate-400">
              <p className="font-medium text-slate-300 mb-2">Recommended apps:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Google Authenticator</li>
                <li>Microsoft Authenticator</li>
                <li>Authy</li>
              </ul>
            </div>

            {/* Logout option */}
            <div className="mt-6 text-center">
              <button
                onClick={handleLogout}
                className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
              >
                Sign out and try later
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
