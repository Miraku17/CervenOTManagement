import React from 'react';
import { UserProfile } from '@/types';
import { Mail, MapPin, Phone, BadgeCheck, Briefcase, CalendarCheck } from 'lucide-react';

interface ProfileHeaderProps {
  user: UserProfile | null;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  // Return null if user is not available (during logout, etc.)
  if (!user) {
    return null;
  }

  const { first_name, last_name, positions, email, contact_number, address, leave_credits } = user;

  // Generate initials for avatar
  const initials = `${first_name?.[0] || ''}${last_name?.[0] || ''}`.toUpperCase();

  // Generate a color based on the name (simplified for professional look)
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-blue-600',
      'bg-indigo-600',
      'bg-violet-600',
      'bg-sky-600',
      'bg-cyan-600',
    ];
    const index = (name.charCodeAt(0) + name.charCodeAt(name.length - 1)) % colors.length;
    return colors[index];
  };

  // Check if contact info exists
  const hasContactNumber = contact_number && contact_number.trim() !== '';
  const hasAddress = address && address.trim() !== '';
  const hasEmail = email && email.trim() !== '';

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-lg h-full flex flex-col">
      <div className="p-6 flex flex-col items-center text-center space-y-4 flex-1">
        {/* Avatar */}
        <div className="relative">
          <div className={`w-24 h-24 rounded-full ${getAvatarColor(first_name || '')} flex items-center justify-center shadow-lg ring-4 ring-slate-950/50`}>
            <span className="text-3xl font-bold text-white">{initials}</span>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-1.5 shadow-md ring-4 ring-slate-900">
            <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
          </div>
        </div>

        {/* Name and Position */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <h2 className="text-xl font-bold text-slate-100">
              {first_name} {last_name}
            </h2>
            <BadgeCheck className="w-5 h-5 text-blue-400" />
          </div>

          {positions?.name && (
            <div className="flex items-center justify-center gap-1.5 text-slate-400">
              <Briefcase className="w-3.5 h-3.5" />
              <span className="text-sm font-medium">{positions.name}</span>
            </div>
          )}
        </div>

        {/* Leave Credits */}
        {user.leave_credits !== undefined && (
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700">
            <CalendarCheck className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-sm text-slate-200 font-medium">{user.leave_credits} Leave Credits</span>
          </div>
        )}

        {/* Divider */}
        <div className="w-full h-px bg-slate-800 my-2" />

        {/* Contact Information Grid */}
        <div className="w-full space-y-2 pt-2">
          {hasEmail && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20">
                <Mail className="w-4 h-4" />
              </div>
              <span className="text-sm text-slate-400 group-hover:text-slate-200 truncate flex-1 text-left transition-colors">{email}</span>
            </div>
          )}

          {hasContactNumber && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-sm text-slate-400 group-hover:text-slate-200 flex-1 text-left transition-colors">{contact_number}</span>
            </div>
          )}

          {hasAddress && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors group">
              <div className="flex items-center justify-center w-8 h-8 rounded-md bg-purple-500/10 text-purple-400 group-hover:bg-purple-500/20">
                <MapPin className="w-4 h-4" />
              </div>
              <span className="text-sm text-slate-400 group-hover:text-slate-200 flex-1 text-left line-clamp-2 transition-colors">{address}</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Status */}
      <div className="px-6 py-4 bg-slate-950/30 border-t border-slate-800 rounded-b-xl flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-400">Active</span>
        </div>
      </div>
    </div>
  );
};