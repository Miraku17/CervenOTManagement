import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'violet' | 'slate' | 'emerald' | 'rose' | 'cyan';
  onClick?: () => void;
  trend?: 'up' | 'down' | 'neutral';
}

const colorStyles = {
  blue: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
    gradient: 'from-blue-500/20 to-blue-600/5',
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
    gradient: 'from-amber-500/20 to-amber-600/5',
  },
  violet: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
    text: 'text-violet-400',
    glow: 'shadow-violet-500/20',
    gradient: 'from-violet-500/20 to-violet-600/5',
  },
  slate: {
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    text: 'text-slate-400',
    glow: 'shadow-slate-500/20',
    gradient: 'from-slate-500/20 to-slate-600/5',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
  },
  rose: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    glow: 'shadow-rose-500/20',
    gradient: 'from-rose-500/20 to-rose-600/5',
  },
  cyan: {
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/20',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/20',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  icon,
  color,
  onClick,
  trend
}) => {
  const styles = colorStyles[color];

  return (
    <div
      onClick={onClick}
      className={`
        relative group overflow-hidden
        bg-slate-900/50 backdrop-blur-sm
        border border-slate-800 hover:border-slate-700
        rounded-2xl p-6
        transition-all duration-300 ease-in-out
        hover:shadow-lg hover:-translate-y-1
        ${onClick ? 'cursor-pointer' : ''}
      `}
    >
      {/* Background Gradient Effect */}
      <div className={`
        absolute -right-6 -top-6 w-24 h-24 rounded-full 
        bg-gradient-to-br ${styles.gradient} blur-2xl opacity-0 
        group-hover:opacity-100 transition-opacity duration-500
      `} />

      <div className="relative z-10 flex justify-between items-start mb-4">
        <div>
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            {title}
          </p>
          <h3 className="text-3xl font-bold text-white tracking-tight">
            {value}
          </h3>
        </div>
        
        <div className={`
          p-3 rounded-xl 
          ${styles.bg} ${styles.border} border
          ${styles.text}
          shadow-sm group-hover:shadow-md
          transition-all duration-300
        `}>
          {React.cloneElement(icon as React.ReactElement, { 
            size: 24, 
            strokeWidth: 2 
          })}
        </div>
      </div>

      <div className="relative z-10 flex items-center gap-2">
        <div className={`h-1 w-1 rounded-full ${styles.bg.replace('/10', '')}`} />
        <p className="text-xs font-medium text-slate-500 group-hover:text-slate-400 transition-colors">
          {change}
        </p>
      </div>
    </div>
  );
};
