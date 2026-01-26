'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Shield, 
  CheckCircle, 
  ArrowLeft, 
  Loader2, 
  RefreshCw, 
  AlertTriangle, 
  User, 
  LogOut,
  Mail,
  Briefcase,
  Key
} from 'lucide-react';
import { useMFA, MFAFactor } from '@/hooks/useMFA';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useUser';
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardContent 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Aurora from '@/components/Aurora';

export default function SettingsPage() {
  const router = useRouter();
  const { logout, isLoggingOut } = useAuth();
  const { user, loading: userLoading } = useUser();
  const { listFactors, unenrollFactor } = useMFA();

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
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0a0a0c] selection:bg-primary/30">
      {/* Professional Background Layer */}
      <div className="fixed inset-0 z-0 opacity-40">
        <Aurora
          colorStops={['#0f172a', '#1e293b', '#0f172a']}
          amplitude={1.2}
          speed={0.5}
        />
      </div>
      
      {/* Subtle overlay gradient to ensure readability */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#0a0a0c]/50 via-transparent to-[#0a0a0c]/80 pointer-events-none" />

      <div className="relative z-10 container max-w-4xl mx-auto py-12 px-4 space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <Button 
            variant="ghost" 
            className="w-fit -ml-4 text-slate-400 hover:text-white hover:bg-white/5 mb-2"
            onClick={() => router.back()}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-4xl font-extrabold tracking-tight text-white">Settings</h1>
          <p className="text-slate-400 text-lg">
            Manage your account settings, profile information, and security preferences.
          </p>
        </div>

        <div className="grid gap-8">
          {/* Profile Section */}
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <User className="w-5 h-5 text-blue-400" />
                Profile Information
              </CardTitle>
              <CardDescription className="text-slate-400">
                Your personal account details and identification.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center gap-6 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <span className="text-3xl font-bold text-white tracking-tighter">
                    {user?.first_name?.[0]}{user?.last_name?.[0]}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-bold text-white">
                    {user?.first_name} {user?.last_name}
                  </h3>
                  <p className="text-slate-400 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 capitalize tracking-wide">
                      {user?.role || 'Employee'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-400 ml-1">First Name</label>
                  <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-white font-medium">
                    {user?.first_name}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-400 ml-1">Last Name</label>
                  <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-white font-medium">
                    {user?.last_name}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-400 ml-1">Email Address</label>
                  <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-white font-medium flex items-center gap-3">
                    <Mail className="w-4 h-4 text-slate-500" />
                    {user?.email}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-400 ml-1">Current Role</label>
                  <div className="p-3 bg-white/[0.02] border border-white/10 rounded-xl text-white font-medium flex items-center gap-3 capitalize">
                    <Briefcase className="w-4 h-4 text-slate-500" />
                    {user?.role || 'Employee'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security Section */}
          <Card className="border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Shield className="w-5 h-5 text-emerald-400" />
                Security & Authentication
              </CardTitle>
              <CardDescription className="text-slate-400">
                Manage your password and security verification methods.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* MFA Status */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04]">
                <div className="flex items-start justify-between">
                  <div className="flex gap-5">
                    <div className={`p-3 rounded-2xl shadow-inner ${
                      verifiedFactor ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {verifiedFactor ? <CheckCircle className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Two-Factor Authentication (MFA)</h3>
                      <p className="text-sm text-slate-400 mt-1 max-w-md leading-relaxed">
                        {verifiedFactor 
                          ? 'Your account is currently secured with an authenticator app. This provides the highest level of protection.' 
                          : 'Your account is less secure. Add an extra layer of protection by enabling two-factor authentication.'}
                      </p>
                      {verifiedFactor && (
                        <p className="text-xs font-medium text-slate-500 mt-3 flex items-center gap-1.5">
                          <CheckCircle className="w-3 h-3" />
                          Enrolled on {new Date(verifiedFactor.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="hidden sm:block">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border tracking-wider uppercase ${
                      verifiedFactor
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {verifiedFactor ? 'Enabled' : 'Action Required'}
                    </span>
                  </div>
                </div>

                {verifiedFactor && (
                  <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                    {!showResetConfirm ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowResetConfirm(true)}
                        className="text-slate-400 border-white/10 hover:bg-white/5 hover:text-white rounded-lg px-4"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Reset MFA Device
                      </Button>
                    ) : (
                      <div className="flex flex-col sm:flex-row items-center gap-4 bg-red-500/10 p-4 rounded-xl border border-red-500/20 animate-in fade-in zoom-in-95">
                        <p className="text-sm text-red-400 font-semibold">
                          Resetting will disable your current MFA. Are you sure?
                        </p>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleResetMFA}
                            disabled={resettingMFA}
                            className="bg-red-600 hover:bg-red-500 text-white rounded-lg shadow-lg shadow-red-900/20 flex-1 sm:flex-none"
                          >
                            {resettingMFA ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Confirm Reset
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowResetConfirm(false)}
                            disabled={resettingMFA}
                            className="text-slate-400 hover:text-white hover:bg-white/5 rounded-lg flex-1 sm:flex-none"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Security Hint */}
              <div className="rounded-2xl bg-blue-600/10 p-5 border border-blue-500/20 flex gap-4">
                <div className="p-2 bg-blue-500/20 rounded-xl h-fit">
                  <Key className="w-5 h-5 text-blue-400" />
                </div>
                <div className="text-sm">
                  <p className="font-bold text-blue-300 mb-1">Security Best Practice</p>
                  <p className="text-blue-300/70 leading-relaxed">
                    We recommend using a hardware security key or a reputable authenticator app for the best protection of your corporate data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Session Section */}
          <Card className="border-red-500/10 bg-red-500/[0.02] backdrop-blur-xl shadow-2xl">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <LogOut className="w-5 h-5" />
                Session & Termination
              </CardTitle>
              <CardDescription className="text-red-400/60">
                Safely end your current session across all devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center justify-between p-6 rounded-2xl border border-red-500/10 bg-red-500/[0.02] gap-6">
                <div className="text-center sm:text-left">
                  <h3 className="font-bold text-white">Sign out of your account</h3>
                  <p className="text-sm text-slate-400 mt-1">
                    You are currently active as <span className="text-slate-200 font-medium">{user?.email}</span>
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={logout}
                  disabled={isLoggingOut}
                  className="bg-red-600/80 hover:bg-red-600 text-white rounded-xl px-8 h-12 shadow-lg shadow-red-900/40 w-full sm:w-auto"
                >
                  {isLoggingOut ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Signing out...
                    </>
                  ) : (
                    <>
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
