import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Silk from '@/components/react_bits/Silk';

const ResetPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    // Placeholder for reset password logic
    console.log('Reset password attempt:', { email, newPassword, confirmPassword });
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      setLoading(false);
      return;
    }

    // In a real scenario, you'd call an API here to handle the password reset.
    // For now, just simulate success.
    setMessage('If your email is registered, a password reset link has been sent.');
    setLoading(false);
    // Optionally, redirect after a short delay
    // setTimeout(() => router.push('/login'), 3000);
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
            Cerventech<span className="text-blue-500">.HR</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">Reset Your Password</p>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {message && <p className="text-green-500 text-center">{message}</p>}


        <form className="space-y-6" onSubmit={handleResetPassword}>
          <div>
            <label htmlFor="email" className="text-sm font-bold text-slate-400 block mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="newPassword" className="text-sm font-bold text-slate-400 block mb-2">
              New Password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="text-sm font-bold text-slate-400 block mb-2">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;