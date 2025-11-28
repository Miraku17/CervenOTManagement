import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/services/supabase";
import { useUser } from "@/hooks/useUser";
import Aurora from "@/components/react_bits/Aurora";

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayedMessage, setDisplayedMessage] = useState<string | null>(null);
  const router = useRouter();
  const { user, loading: userLoading } = useUser();

  // Redirect authenticated users to their dashboard
  useEffect(() => {
    console.log('[Login Page] Check - userLoading:', userLoading, 'user:', user?.email || 'none');

    if (!userLoading && user) {
      const dashboardPath = user.role === "admin" ? "/admin/dashboard" : "/dashboard/employee";
      console.log('[Login Page] User already logged in, redirecting to:', dashboardPath);
      router.replace(dashboardPath);
    }
  }, [user, userLoading, router]);

  // Handle messages from query parameters (e.g., reset_link_expired)
  useEffect(() => {
    if (router.query.message === "reset_link_expired") {
      setDisplayedMessage(
        "Reset password link is invalid or has expired. Please try again."
      );
      // Clear the query parameter from the URL
      router.replace(router.pathname, undefined, { shallow: true });
    }
  }, [router.query.message, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[Login Page] Login form submitted');
    setLoading(true);
    setError(null);
    setDisplayedMessage(null);

    try {
      console.log('[Login Page] Calling signInWithPassword...');
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Login Page] Login error:', error);
        setError(error.message);
        setLoading(false);
        return;
      }

      console.log('[Login Page] Sign in successful, auth state listener will handle redirect');
      // Don't set loading to false here - let the useEffect handle redirect
      // The useUser hook will fetch the profile via auth state change listener
      // The useEffect above will handle the redirect once user state is updated
    } catch (err: any) {
      console.error('[Login Page] Unexpected error:', err);
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  // Show a loading indicator while checking user session
  if (userLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center">
      {/* 🌈 Silk Full-Screen Background */}
      <div className="fixed inset-0 -z-10 w-full h-full">
        <Aurora
          colorStops={["#3B82F6", "#1D4ED8", "#1E3A8A"]}
          blend={1}
          amplitude={1.0}
          speed={1}
        />
      </div>

      {/* ⭐ Centered Login Card */}
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl relative z-10 text-slate-200">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">
            Cerventech INC
          </h1>
          <p className="mt-2 text-sm text-slate-400">Employee Portal Login</p>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {displayedMessage && (
          <p className="text-yellow-500 text-center">{displayedMessage}</p>
        )}

        <form className="space-y-6" onSubmit={handleLogin}>
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
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="relative">
            <label
              htmlFor="password"
              className="text-sm font-bold text-slate-400 block mb-2"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 top-6 flex items-center px-3 text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
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
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
