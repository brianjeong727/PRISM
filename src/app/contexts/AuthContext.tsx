import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Role = 'IC' | 'EMSFire';

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Incident {
  id: string;
  name: string;
  type: string;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Monitoring' | 'Closed';
  startTime: string;
}

interface AuthContextType {
  user: User | null;
  incident: Incident | null;
  loginWithRole: (role: Role) => void;
  logout: () => void;
  selectIncident: (incident: Incident) => void;
  clearIncident: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const demoUsers: Record<Role, User> = {
  IC: { id: '1', name: 'Commander Sarah Chen', email: 'ic@prism.ops', role: 'IC' },
  EMSFire: { id: '2', name: 'EMS Station', email: 'ems@prism.ops', role: 'EMSFire' },
};

const STORAGE_KEY_USER = 'prism_user';
const STORAGE_KEY_INCIDENT = 'prism_incident';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [incident, setIncident] = useState<Incident | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_INCIDENT);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  }, [user]);

  useEffect(() => {
    if (incident) {
      localStorage.setItem(STORAGE_KEY_INCIDENT, JSON.stringify(incident));
    } else {
      localStorage.removeItem(STORAGE_KEY_INCIDENT);
    }
  }, [incident]);

  const loginWithRole = (role: Role) => {
    setUser(demoUsers[role]);
  };

  const logout = () => {
    setUser(null);
    setIncident(null);
  };

  const selectIncident = (inc: Incident) => {
    setIncident(inc);
  };

  const clearIncident = () => {
    setIncident(null);
  };

  return (
    <AuthContext.Provider value={{ user, incident, loginWithRole, logout, selectIncident, clearIncident }}>
      {children}
    </AuthContext.Provider>
  );
};
