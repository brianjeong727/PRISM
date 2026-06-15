import React from 'react';
import {
  LayoutDashboard,
  MapPin,
  ScrollText,
  Building2,
  Package,
  ClipboardList,
} from 'lucide-react';
import { useAuth } from '@/app/contexts/AuthContext';
import { Role } from '@/app/contexts/AuthContext';
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
    { label: 'Field Home', icon: <MapPin className="h-4 w-4" />, path: '/field' },
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
    <div className="w-56 border-r bg-white h-full flex flex-col">
      <nav className="p-3 space-y-1 flex-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => onNavigate(item.path)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
              currentPath === item.path
                ? 'bg-slate-900 text-white'
                : 'hover:bg-slate-100 text-slate-700'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
