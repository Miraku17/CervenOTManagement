'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import Silk from '@/components/react_bits/Silk';
import { supabase } from '@/services/supabase';
import Link from 'next/link';

const ResetPasswordPage: React.FC = () => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Parse URL hash for errors (e.g., from an expired/invalid reset link)
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // Remove '#'
    const errorParam = params.get('error');
    const errorCode = params.get('error_code');
    const errorDescription = params.get('error_description');

    if (errorParam === 'access_denied' && errorCode === 'otp_expired') {
      // Redirect to login with an error message
      router.replace('/auth/login?message=reset_link_expired');
      return; // Stop further execution on this page
    }
    // You might also want to clear the hash to clean the URL for the user
    // window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }, [router]);


  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) { // Supabase default minimum password length
        setError('Password must be at least 6 characters long.');
        setLoading(false);
        return;
    }

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage('Your password has been updated successfully! Redirecting to login...');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);

    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during password update.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center">

      {/* 🌈 Silk Full-Screen Background */}
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Silk
          speed={4}
          scale={1}
          color="#155efd"
          noiseIntensity={1.5}
          rotation={0}
        />
      </div>

      {/* ⭐ Centered Reset Password Card */}
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl relative z-10 text-slate-200">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Set New Password
          </h1>
          <p className="mt-2 text-sm text-slate-400">Please enter and confirm your new password.</p>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {message && <p className="text-green-500 text-center">{message}</p>}

        {!message && ( // Only show form if no success message is displayed
            <form className="space-y-6" onSubmit={handleResetPassword}>
            <div className="relative">
                <label htmlFor="newPassword" className="text-sm font-bold text-slate-400 block mb-2">
                New Password
                </label>
                <input
                id="newPassword"
                name="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute inset-y-0 right-0 top-6 flex items-center px-3 text-white"
                >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            <div className="relative">
                <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-400 block mb-2">
                Confirm New Password
                </label>
                <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 top-6 flex items-center px-3 text-white"
                >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
            </div>

            <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
                {loading ? 'Updating Password...' : 'Set New Password'}
            </button>
            </form>
        )}

        {message && ( // Show link to login after successful reset
            <div className="text-center mt-4">
                <Link href="/auth/login" className="text-sm text-blue-400 hover:text-blue-300">
                    Go to Login
                </Link>
            </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
