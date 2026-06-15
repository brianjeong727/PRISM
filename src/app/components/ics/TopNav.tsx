import React from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';

export const TopNav: React.FC = () => {
  const { user, incident, logout, clearIncident } = useAuth();

  const roleLabel = user?.role === 'IC' ? 'Incident Commander' : 'EMS / Fire';

  return (
    <div className="h-14 border-b border-white/[0.06] bg-[#0c111b] flex items-center justify-between px-5 shrink-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          {/* Live pulse dot */}
          <span className="live-pulse inline-block h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-sm font-semibold tracking-widest text-white/90 uppercase">PRISM</span>
        </div>

        {incident && (
          <>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={clearIncident}
              className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-white transition-colors group"
            >
              <span className="font-medium">{incident.name}</span>
              <span className="text-white/30">·</span>
              <span className="text-xs text-slate-500 group-hover:text-slate-400 transition-colors uppercase tracking-wide">
                {incident.status}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
            </button>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-white/90 leading-none mb-0.5">{user?.name}</p>
            <p className="text-xs text-slate-500 leading-none">{roleLabel}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-slate-300 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
