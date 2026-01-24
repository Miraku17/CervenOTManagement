'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, CheckCircle, ArrowLeft, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useMFA, MFAFactor } from '@/hooks/useMFA';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, isLoggingOut } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { listFactors, unenrollFactor, loading: mfaLoading, error: mfaError } = useMFA();

  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [isLoadingFactors, setIsLoadingFactors] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resettingMFA, setResettingMFA] = useState(false);

  useEffect(() => {
    loadFactors();
  }, []);

  const loadFactors = async () => {
    setIsLoadingFactors(true);
    const factorList = await listFactors();
    setFactors(factorList);
    setIsLoadingFactors(false);
  };

  const handleResetMFA = async () => {
    if (factors.length === 0) return;

    setResettingMFA(true);
    try {
      // Unenroll all factors
      for (const factor of factors) {
        await unenrollFactor(factor.id);
      }
      // Redirect to MFA setup
      router.push('/auth/mfa/setup');
    } catch (err) {
      console.error('Error resetting MFA:', err);
      setResettingMFA(false);
    }
  };

  const verifiedFactor = factors.find(f => f.status === 'verified');

  if (userLoading || isLoadingFactors) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-slate-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account settings and security</p>
      </div>

      {/* Profile Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-slate-400">Name</label>
            <p className="text-white">
              {user?.first_name} {user?.last_name}
            </p>
          </div>
          <div>
            <label className="text-sm text-slate-400">Email</label>
            <p className="text-white">{user?.email}</p>
          </div>
          <div>
            <label className="text-sm text-slate-400">Role</label>
            <p className="text-white capitalize">{user?.role || 'Employee'}</p>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-500" />
          Security
        </h2>

        {/* MFA Status */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                verifiedFactor ? 'bg-green-500/20' : 'bg-yellow-500/20'
              }`}>
                {verifiedFactor ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" />
                )}
              </div>
              <div>
                <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                <p className="text-sm text-slate-400">
                  {verifiedFactor ? 'Enabled via Authenticator App' : 'Not configured'}
                </p>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              verifiedFactor
                ? 'bg-green-500/20 text-green-400'
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              {verifiedFactor ? 'Active' : 'Required'}
            </span>
          </div>

          {verifiedFactor && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-3">
                Enrolled on: {new Date(verifiedFactor.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset to new device
                </button>
              ) : (
                <div className="bg-red-500/10 rounded-lg p-4 border border-red-500/20">
                  <p className="text-sm text-red-400 mb-3">
                    Are you sure? You'll need to set up MFA again with your authenticator app.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleResetMFA}
                      disabled={resettingMFA}
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {resettingMFA ? 'Resetting...' : 'Yes, Reset MFA'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      disabled={resettingMFA}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* MFA Info */}
        <div className="bg-blue-500/10 rounded-lg p-4 border border-blue-500/20">
          <p className="text-sm text-blue-300">
            Two-factor authentication is required for all users to protect your account.
            Your account is secured with a time-based one-time password (TOTP) from your authenticator app.
          </p>
        </div>
      </div>

      {/* Session Section */}
      <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Session</h2>
        <button
          onClick={logout}
          disabled={isLoggingOut}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors disabled:opacity-50"
        >
          {isLoggingOut ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Signing out...</span>
            </>
          ) : (
            <span>Sign out of all devices</span>
          )}
        </button>
      </div>
    </div>
  );
}
