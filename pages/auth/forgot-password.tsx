import React, { useState } from "react";
import Silk from "@/components/react_bits/Silk";
import { supabase } from "@/services/supabase";
import Link from "next/link";
import { withGuest } from "@/hoc/withGuest";

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://erp.cerventech.com/auth/reset-password",
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setMessage("Reset password has been sent to your email.");
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

      {/* ⭐ Centered Forgot Password Card */}
      <div className="w-full max-w-md p-8 space-y-8 bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-xl relative z-10 text-slate-200">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">Forgot Password</h1>
          <p className="mt-2 text-sm text-slate-400">
            Enter your email to receive a password reset link.
          </p>
        </div>

        {error && <p className="text-red-500 text-center">{error}</p>}
        {message && <p className="text-green-500 text-center">{message}</p>}

        {!message && (
          <form className="space-y-6" onSubmit={handlePasswordReset}>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold transition-colors disabled:bg-slate-700 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/auth/login"
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default withGuest(ForgotPasswordPage);
