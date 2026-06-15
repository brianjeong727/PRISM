import React from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';

export const TopNav: React.FC = () => {
  const { user, incident, logout, clearIncident } = useAuth();

  const roleLabel = user?.role === 'IC' ? 'Incident Commander' : 'EMS / Fire';

  return (
    <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-5 shrink-0 z-20">
      {/* Left */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <span className="live-pulse inline-block h-2 w-2 rounded-full bg-red-500" />
          <span className="text-sm font-bold tracking-widest text-slate-900 uppercase">PRISM</span>
        </div>

        {incident && (
          <>
            <div className="h-4 w-px bg-slate-200" />
            <button
              onClick={clearIncident}
              className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors group"
            >
              <span className="font-medium">{incident.name}</span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-wide">
                {incident.status}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 transition-colors" />
            </button>
          </>
        )}
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-900 leading-none mb-0.5">{user?.name}</p>
            <p className="text-xs text-slate-400 leading-none">{roleLabel}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
