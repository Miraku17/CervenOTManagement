'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Clock, Shield, Banknote, Ticket } from 'lucide-react';

export default function LandingPage() {
  // Auth and routing is handled by middleware.ts - no need for client-side checks

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img
              src="/cerventech.png"
              alt="Cerventech Logo"
              className="w-10 h-10 rounded-full object-cover shadow-lg shadow-blue-900/20"
            />
            <span className="text-2xl font-bold tracking-tight">Cerventech Inc.</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/auth/login"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full transition-all shadow-lg shadow-blue-900/20 hover:shadow-blue-900/40 flex items-center gap-2"
            >
              Login
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-48 md:pb-32 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full z-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px]"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800 mb-8 animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-sm font-medium text-slate-300">Internal Employee Portal</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-8 text-white">
            Cerventech Inc.<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
              Workforce System
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            Secure access to time tracking, payroll, and internal support services for all Cerventech employees.
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6">
            <Link
              href="/auth/login"
              className="w-full md:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xl shadow-blue-900/20 hover:shadow-blue-900/40 transition-all flex items-center justify-center gap-2"
            >
              Employee Login
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="modules" className="py-20 bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Enterprise Modules</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">Tools and services to support your daily operations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Clock className="w-8 h-8 text-blue-500" />}
              title="Time Management"
              description="Log work hours, request overtime, and manage leave applications effortlessly."
            />
            <FeatureCard
              icon={<Banknote className="w-8 h-8 text-green-500" />}
              title="Payroll System"
              description="View monthly payslips, tax forms, and compensation history securely."
            />
            <FeatureCard
              icon={<Ticket className="w-8 h-8 text-purple-500" />}
              title="Ticketing System"
              description="Submit and track support requests for IT issues or HR inquiries."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-950 border-t border-slate-800">
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center">
              <Shield size={16} className="text-blue-500" />
            </div>
            <span className="text-lg font-bold text-slate-200">Cerventech</span>
          </div>
          <div className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Cerventech Inc. All rights reserved.
          </div>
          <div className="flex gap-6 text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const FeatureCard = ({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) => (
  <div className="p-8 rounded-2xl bg-slate-900 border border-slate-800 hover:border-blue-500/50 transition-all hover:shadow-2xl hover:shadow-blue-900/10 group">
    <div className="mb-6 p-4 bg-slate-950 rounded-xl inline-block border border-slate-800 group-hover:border-blue-500/30 transition-colors">
      {icon}
    </div>
    <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
    <p className="text-slate-400 leading-relaxed">{description}</p>
  </div>
);
