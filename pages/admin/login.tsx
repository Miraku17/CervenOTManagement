import React, { useState } from 'react';
import { useRouter } from 'next/router';
import Silk from '@/components/react_bits/Silk';
const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // For now, we'll just log the credentials and redirect to a placeholder admin page.
    console.log('Admin logging in with:', { email, password });
    router.push('/admin/dashboard'); // Redirect to a future admin dashboard
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-950 text-slate-200 flex items-center justify-center">
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800 rounded-2xl shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Cerventech<span className="text-red-500">.HR</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">Admin Portal Login</p>
        </div>
        <form className="space-y-6" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="email"
              className="text-sm font-bold text-slate-400 block mb-2"
            >
              Admin Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="text-sm font-bold text-slate-400 block mb-2"
            >
              Admin Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <button
              type="submit"
              className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 rounded-lg text-white font-bold transition-colors"
            >
              Sign In as Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLoginPage;