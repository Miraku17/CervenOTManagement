'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Loader2, CheckCircle, Copy, Check, AlertCircle } from 'lucide-react';
import { supabase } from '@/services/supabase';
import Aurora from '@/components/react_bits/Aurora';

export default function MFASetupPage() {
  const router = useRouter();

  const [factorId, setFactorId] = useState('');
  const [qr, setQR] = useState(''); // holds the QR code SVG from Supabase
  const [secret, setSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'loading' | 'qrcode' | 'success' | 'error'>('loading');
  const [copied, setCopied] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Enroll MFA on component mount
  useEffect(() => {
    const enrollMFA = async () => {
      try {
        console.log('=== MFA Setup: Starting ===');

        // First check if user is authenticated
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        console.log('Current user:', user?.id, userError);

        if (!user) {
          console.log('No user found, redirecting to login');
          router.push('/auth/login');
          return;
        }

        // Check if user already has a verified factor
        console.log('Checking existing factors...');
        const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
        console.log('Factors data:', factorsData, 'Error:', factorsError);

        if (factorsError) {
          console.error('Error listing factors:', factorsError);
          setError(`Failed to check MFA status: ${factorsError.message}`);
          setStep('error');
          return;
        }

        const verifiedFactor = factorsData?.totp?.find(f => f.status === 'verified');
        const unverifiedFactor = factorsData?.totp?.find(f => (f.status as string) === 'unverified');

        console.log('Verified factor:', verifiedFactor);
        console.log('Unverified factor:', unverifiedFactor);

        if (verifiedFactor) {
          // Already enrolled, redirect to dashboard
          console.log('User already has MFA enrolled, redirecting...');
          router.push('/dashboard');
          return;
        }

        // If there's an unverified factor, we can use that (user started but didn't finish)
        if (unverifiedFactor) {
          console.log('Found unverified factor, using existing enrollment');
          // We need to re-enroll because we can't get the QR code again
          // First unenroll the unverified factor
          const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: unverifiedFactor.id });
          if (unenrollError) {
            console.warn('Could not unenroll unverified factor:', unenrollError);
          }
        }

        // Enroll new TOTP factor
        console.log('Enrolling new TOTP factor...');
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
        });

        console.log('Enroll response - data:', data, 'error:', enrollError);

        if (enrollError) {
          console.error('MFA enrollment error:', enrollError);
          setError(enrollError.message);
          setStep('error');
          return;
        }

        if (!data) {
          setError('No enrollment data returned from Supabase');
          setStep('error');
          return;
        }

        console.log('MFA enrollment successful!');
        console.log('Factor ID:', data.id);
        console.log('QR Code length:', data.totp.qr_code?.length);
        console.log('Secret:', data.totp.secret);

        setFactorId(data.id);
        // Supabase returns an SVG QR code that can be used directly as img src
        setQR(data.totp.qr_code);
        setSecret(data.totp.secret);
        setStep('qrcode');
      } catch (err: any) {
        console.error('MFA setup error:', err);
        setError(err.message || 'An unexpected error occurred');
        setStep('error');
      }
    };

    enrollMFA();
  }, [router]);

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
    if (!factorId) return;

    setError(null);
    setLoading(true);

    try {
      // Create a challenge
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        setError(challenge.error.message);
        setLoading(false);
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      const challengeId = challenge.data.id;

      // Verify the code
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verify.error) {
        setError(verify.error.message);
        setLoading(false);
        setVerificationCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        return;
      }

      // Success!
      setStep('success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err: any) {
      console.error('Verification error:', err);
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

  if (step === 'error') {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="fixed inset-0 -z-10 w-full h-full">
          <Aurora
            colorStops={['#EF4444', '#DC2626', '#B91C1C']}
            blend={1}
            amplitude={1.0}
            speed={1}
          />
        </div>
        <div className="w-full max-w-md p-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">MFA Setup Failed</h1>
          <p className="text-slate-400 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
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

        {/* QR Code - Using SVG from Supabase directly */}
        <div className="bg-white p-4 rounded-xl mx-auto w-fit mb-6">
          <img src={qr} alt="QR Code for MFA setup" className="w-[180px] h-[180px]" />
        </div>

        {/* Manual Entry Option */}
        <div className="mb-6">
          <p className="text-xs text-slate-500 text-center mb-2">
            Can't scan? Enter this code manually:
          </p>
          <div className="flex items-center justify-center gap-2 bg-slate-900/50 rounded-lg px-4 py-2">
            <code className="text-sm text-slate-300 font-mono break-all">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="shrink-0 p-1.5 text-slate-400 hover:text-white transition-colors"
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
      </div>
    </div>
  );
}
