import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/services/supabase';
import { Eye, EyeOff, Save } from 'lucide-react';
import Silk from '@/components/react_bits/Silk';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase password recovery link contains the access token and refresh token in the hash
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1)); // remove '#'
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken && refreshToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated successfully! You can now log in.");
      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    }

    setLoading(false);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Silk speed={2} scale={1.2} color="#fd155e" noiseIntensity={1} rotation={0.1} />
      </div>
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl z-10 text-slate-200">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Cerventech<span className="text-blue-500">.HR</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Set a new password for your account.
          </p>
        </div>

        {error && <p className="text-red-500 text-center p-3 bg-red-500/10 rounded-lg">{error}</p>}
        {success && <p className="text-emerald-500 text-center p-3 bg-emerald-500/10 rounded-lg">{success}</p>}

        <form className="space-y-6" onSubmit={handleResetPassword}>
          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-400 block mb-2">Confirm New Password</label>
             <div className="relative">
                <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white pr-10"
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
             </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:bg-slate-700"
          >
            {loading ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : <Save size={18} />}
            {loading ? 'Saving...' : 'Set Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
