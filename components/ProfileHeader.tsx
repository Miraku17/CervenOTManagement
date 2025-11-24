import React from 'react';
import { UserProfile } from '@/types';
import { Mail, MapPin, Phone, BadgeCheck } from 'lucide-react';

interface ProfileHeaderProps {
  user: UserProfile;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  user: { first_name, last_name, positions, email, contact_number, address }
}) => {
  // Generate initials for avatar
  const initials = `${first_name?.[0] || ''}${last_name?.[0] || ''}`.toUpperCase();

  // Generate a color based on the name
  const getAvatarColor = (name: string) => {
    const colors = [
      'from-blue-500 to-blue-600',
      'from-purple-500 to-purple-600',
      'from-pink-500 to-pink-600',
      'from-indigo-500 to-indigo-600',
      'from-cyan-500 to-cyan-600',
      'from-teal-500 to-teal-600',
    ];
    const index = (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % colors.length;
    return colors[index];
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-xl relative overflow-hidden group h-full flex flex-col justify-center">
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center space-y-6">
        {/* Circular Avatar */}
        <div className={`w-32 h-32 rounded-full bg-gradient-to-br ${getAvatarColor(first_name || '')} flex items-center justify-center shadow-2xl ring-4 ring-slate-700/50`}>
          <span className="text-5xl font-bold text-white">{initials}</span>
        </div>

        {/* Info Section */}
        <div className="space-y-3">
          <div>
            <h2 className="text-3xl font-bold text-white flex items-center justify-center gap-2">
              {first_name} {last_name}
              <BadgeCheck className="w-6 h-6 text-blue-400" />
            </h2>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="text-lg text-blue-400 font-medium">{positions?.name}</span>
              <span className="text-slate-600">•</span>
              <span className="text-emerald-400 text-sm font-bold bg-emerald-400/10 px-2 py-0.5 rounded-full border border-emerald-400/20">Active Employee</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300 pt-2">
            <div className="flex items-center gap-3 justify-center bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
              <Mail className="w-4 h-4 text-blue-400" />
              {email}
            </div>
            <div className="flex items-center gap-3 justify-center bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors">
              <Phone className="w-4 h-4 text-blue-400" />
              {contact_number}
            </div>
            <div className="flex items-center gap-3 justify-center bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-700/50 hover:border-blue-500/30 transition-colors md:col-span-2">
              <MapPin className="w-4 h-4 text-blue-400" />
              {address}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};