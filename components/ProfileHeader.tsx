import React from 'react';
import { UserProfile } from '@/types';
import { Mail, MapPin, Phone, BadgeCheck, Briefcase } from 'lucide-react';

interface ProfileHeaderProps {
  user: UserProfile | null;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  // Return null if user is not available (during logout, etc.)
  if (!user) {
    return null;
  }

  const { first_name, last_name, positions, email, contact_number, address } = user;

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

  // Check if contact info exists
  const hasContactNumber = contact_number && contact_number.trim() !== '';
  const hasAddress = address && address.trim() !== '';
  const hasEmail = email && email.trim() !== '';

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl shadow-2xl relative overflow-hidden group h-full">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-transparent to-purple-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Decorative glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 flex flex-col items-center text-center space-y-6">
        {/* Avatar with pulse animation */}
        <div className="relative">
          <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${getAvatarColor(first_name || '')} flex items-center justify-center shadow-2xl ring-4 ring-slate-700/50 group-hover:ring-blue-500/30 transition-all duration-300`}>
            <span className="text-4xl font-bold text-white">{initials}</span>
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-500 rounded-full p-2 shadow-lg ring-4 ring-slate-800">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          </div>
        </div>

        {/* Name and Position */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-bold text-white">
              {first_name} {last_name}
            </h2>
            <BadgeCheck className="w-5 h-5 text-blue-400" />
          </div>

          {positions?.name && (
            <div className="flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-full border border-blue-500/20">
              <Briefcase className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-sm text-blue-300 font-medium">{positions.name}</span>
            </div>
          )}
        </div>

        {/* Contact Information Grid */}
        <div className="w-full space-y-2 pt-2">
          {hasEmail && (
            <div className="group/item flex items-center gap-3 bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-700/50 hover:border-blue-500/40 hover:bg-slate-900/70 transition-all duration-200 cursor-default">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 group-hover/item:bg-blue-500/20 transition-colors">
                <Mail className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm text-slate-300 truncate flex-1 text-left">{email}</span>
            </div>
          )}

          {hasContactNumber && (
            <div className="group/item flex items-center gap-3 bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-700/50 hover:border-emerald-500/40 hover:bg-slate-900/70 transition-all duration-200 cursor-default">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/10 group-hover/item:bg-emerald-500/20 transition-colors">
                <Phone className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm text-slate-300 flex-1 text-left">{contact_number}</span>
            </div>
          )}

          {hasAddress && (
            <div className="group/item flex items-center gap-3 bg-slate-900/50 px-4 py-3 rounded-xl border border-slate-700/50 hover:border-purple-500/40 hover:bg-slate-900/70 transition-all duration-200 cursor-default">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 group-hover/item:bg-purple-500/20 transition-colors">
                <MapPin className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-sm text-slate-300 flex-1 text-left line-clamp-2">{address}</span>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="pt-2">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Active Employee</span>
          </div>
        </div>
      </div>
    </div>
  );
};