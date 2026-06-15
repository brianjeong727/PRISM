import React, { useState } from 'react';
import { Role, useAuth } from '@/app/contexts/AuthContext';
import { Shield, Radio } from 'lucide-react';

interface LoginScreenProps {
  onLogin: () => void;
}

const roles: { value: Role; label: string; desc: string; icon: React.ReactNode }[] = [
  {
    value: 'IC',
    label: 'Incident Commander',
    desc: 'Command view — request resources, monitor units',
    icon: <Shield className="h-5 w-5" />,
  },
  {
    value: 'EMSFire',
    label: 'EMS / Fire Personnel',
    desc: 'Field view — dispatch units, respond to requests',
    icon: <Radio className="h-5 w-5" />,
  },
];

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { loginWithRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Select a role to continue.');
      return;
    }
    loginWithRole(selectedRole as Role);
    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c111b] p-4">
      {/* Subtle grid background */}
      <div
        className="fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#3b82f6 1px, transparent 1px), linear-gradient(to right, #3b82f6 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative w-full max-w-sm space-y-8">
        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center gap-2 mb-2">
            <span className="live-pulse h-2 w-2 rounded-full bg-emerald-400 inline-block" />
            <span className="text-xs font-semibold tracking-[0.3em] text-slate-500 uppercase">System Active</span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">PRISM</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Priority · Resource · Incident · Simulation · Monitoring
          </p>
        </div>

        {/* Role selector */}
        <form onSubmit={handleLogin} className="space-y-3">
          <p className="text-xs font-semibold tracking-widest uppercase text-slate-600 mb-4">
            Select your role
          </p>

          {roles.map((role) => {
            const isSelected = selectedRole === role.value;
            return (
              <button
                key={role.value}
                type="button"
                onClick={() => { setSelectedRole(role.value); setError(''); }}
                className={`
                  w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all
                  ${isSelected
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.3)]'
                    : 'bg-[#111827] border-white/[0.07] hover:border-white/[0.14] hover:bg-white/[0.03]'
                  }
                `}
              >
                <span className={`mt-0.5 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`}>
                  {role.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                    {role.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{role.desc}</p>
                </div>
                <span
                  className={`
                    mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center
                    ${isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-600'}
                  `}
                >
                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}

          {error && (
            <p className="text-sm text-red-400 px-1">{error}</p>
          )}

          <button
            type="submit"
            className="
              w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm
              bg-blue-600 hover:bg-blue-500 text-white
              transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              shadow-[0_1px_2px_rgba(0,0,0,0.5)]
            "
          >
            Enter PRISM
          </button>
        </form>

        <p className="text-center text-xs text-slate-700">
          Emergency Resource Command System · Demo
        </p>
      </div>
    </div>
  );
};
