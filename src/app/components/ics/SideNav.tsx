import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  ScrollText,
  Building2,
  Package,
  ClipboardList,
} from 'lucide-react';
import { useAuth, Role } from '@/app/contexts/AuthContext';
import { cn } from '@/app/components/ui/utils';

interface NavItem {
  label: string;
  icon: React.ReactNode;
  path: string;
}

const navItemsByRole: Record<Role, NavItem[]> = {
  IC: [
    { label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, path: '/dashboard' },
    { label: 'Hospital Status', icon: <Building2 className="h-4 w-4" />, path: '/hospitals' },
    { label: 'Inventory', icon: <Package className="h-4 w-4" />, path: '/inventory' },
    { label: 'Planning', icon: <ClipboardList className="h-4 w-4" />, path: '/planning' },
    { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  ],
  EMSFire: [
    { label: 'Field Station', icon: <MapPin className="h-4 w-4" />, path: '/field' },
    { label: 'Event Log', icon: <ScrollText className="h-4 w-4" />, path: '/event-log' },
  ],
};

interface SideNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const SideNav: React.FC<SideNavProps> = ({ currentPath, onNavigate }) => {
  const { user } = useAuth();

  if (!user) return null;

  const navItems = navItemsByRole[user.role];

  return (
    <div className="w-52 border-r border-slate-200 bg-white h-full flex flex-col shrink-0">
      <nav className="p-3 space-y-0.5 flex-1 pt-4">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => onNavigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative',
                isActive
                  ? 'bg-red-50 text-red-700 font-medium'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              )}
            >
              {isActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-red-500" />
              )}
              <span className={isActive ? 'text-red-600' : ''}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-100">
        <p className="text-xs text-slate-300 text-center tracking-widest uppercase">
          {user.role === 'IC' ? 'Command' : 'Field'}
        </p>
      </div>
    </div>
  );
};
