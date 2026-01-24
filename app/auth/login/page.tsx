'use client';

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useMFA } from "@/hooks/useMFA";
import Aurora from "@/components/react_bits/Aurora";

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedMessage, setDisplayedMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const { listFactors, getAssuranceLevel } = useMFA();

  // Handle messages from query parameters
  useEffect(() => {
    const message = searchParams?.get('message');
    if (message === "reset_link_expired") {
      setDisplayedMessage(
        "Reset password link is invalid or has expired. Please try again."
      );
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDisplayedMessage(null);

    try {
      await login({ email, password });

      // Give a moment for the session to sync to cookies
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check MFA status
      const factors = await listFactors();
      const verifiedFactor = factors.find(f => f.status === 'verified');

      if (verifiedFactor) {
        // User has MFA enrolled, check if they need to verify
        const aal = await getAssuranceLevel();

        if (aal?.currentLevel === 'aal1' && aal?.nextLevel === 'aal2') {
          // User needs to complete MFA verification
          window.location.href = `/auth/mfa/verify?factorId=${verifiedFactor.id}`;
          return;
        }
        // Already at aal2, proceed to dashboard
        window.location.href = '/dashboard';
      } else {
        // No MFA enrolled, redirect to setup
        window.location.href = '/auth/mfa/setup';
      }
    } catch (err: any) {
      console.error('[Login Page] Login error:', err);
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      {/* Background */}
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Aurora
          colorStops={["#3B82F6", "#1D4ED8", "#1E3A8A"]}
          blend={1}
          amplitude={1.0}
          speed={1}
        />
      </div>

      {/* Login Card */}
      <div className="w-full max-w-md p-6 sm:p-8 space-y-6 sm:space-y-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl relative z-10 text-slate-200">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Cerventech Inc.
          </h1>
          <p className="mt-2 text-sm text-slate-400">Employee Portal Login</p>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {displayedMessage && (
          <p className="text-yellow-500 text-center">{displayedMessage}</p>
        )}

        <form className="space-y-5 sm:space-y-6" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="email"
              className="text-sm font-bold text-slate-400 block mb-2"
            >
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
              className="w-full px-3 py-2.5 sm:py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="text-sm font-bold text-slate-400 block mb-2"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 sm:py-2 pr-10 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Forgot Password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 sm:py-2.5 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed text-base sm:text-sm"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}
