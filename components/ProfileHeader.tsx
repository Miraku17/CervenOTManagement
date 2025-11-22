import React from 'react';
import { UserProfile } from '../types';
import { Mail, MapPin, Phone, BadgeCheck } from 'lucide-react';

interface ProfileHeaderProps {
  user: UserProfile;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  return (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden group h-full flex flex-col justify-center">
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative z-10">
        {/* Info Section */}
        <div className="flex-1 text-center md:text-left space-y-4">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center justify-center md:justify-start gap-2">
              {user.name}
              <BadgeCheck className="w-6 h-6 text-blue-400" />
            </h2>
            <div className="flex flex-col md:flex-row md:items-center gap-2 mt-1">
              <span className="text-lg text-blue-400 font-medium">{user.position}</span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="text-slate-400 font-medium">{user.department}</span>
              <span className="hidden md:inline text-slate-600">•</span>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Active Employee</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300 pt-4">
            <div className="flex items-center gap-3 justify-center md:justify-start bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
              <Mail className="w-4 h-4 text-blue-400" />
              {user.email}
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
              <Phone className="w-4 h-4 text-blue-400" />
              {user.contactNumber}
            </div>
            <div className="flex items-center gap-3 justify-center md:justify-start bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors md:col-span-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              {user.address}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};