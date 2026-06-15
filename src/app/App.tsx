import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/app/contexts/AuthContext';
import { DataProvider } from '@/app/contexts/DataContext';
import { TopNav } from '@/app/components/ics/TopNav';
import { SideNav } from '@/app/components/ics/SideNav';
import { LoginScreen } from '@/app/screens/LoginScreen';
import { IncidentSelectScreen } from '@/app/screens/IncidentSelectScreen';
import { ICDashboard } from '@/app/screens/ICDashboard';
import { FieldHomeScreen } from '@/app/screens/FieldHomeScreen';
import { EventLogScreen } from '@/app/screens/EventLogScreen';
import { HospitalScreen } from '@/app/screens/HospitalScreen';
import { InventoryScreen } from '@/app/screens/InventoryScreen';
import { PlanningScreen } from '@/app/screens/PlanningScreen';
import { Toaster } from '@/app/components/ui/sonner';

const AppContent: React.FC = () => {
  const { user, incident, clearIncident } = useAuth();
  const [currentPath, setCurrentPath] = useState('/dashboard');

  const goToIncidentSelect = () => {
    clearIncident();
    setCurrentPath('/select-incident');
  };

  if (!user) {
    return <LoginScreen onLogin={() => setCurrentPath('/select-incident')} />;
  }

  if (!incident) {
    return (
      <IncidentSelectScreen
        onSelect={() => {
          if (user.role === 'IC') setCurrentPath('/dashboard');
          else if (user.role === 'EMSFire') setCurrentPath('/field');
        }}
      />
    );
  }

  return (
    <div className="h-screen flex flex-col bg-white">
      <TopNav />
      <div className="flex-1 flex overflow-hidden">
        <SideNav currentPath={currentPath} onNavigate={setCurrentPath} />
        <main className="flex-1 overflow-y-auto bg-[#f8fafc]">
          {user.role === 'IC' && currentPath === '/dashboard' && <ICDashboard />}
          {user.role === 'IC' && currentPath === '/hospitals' && <HospitalScreen />}
          {user.role === 'IC' && currentPath === '/inventory' && <InventoryScreen />}
          {user.role === 'IC' && currentPath === '/planning' && <PlanningScreen />}
          {user.role === 'IC' && currentPath === '/event-log' && <EventLogScreen />}

          {user.role === 'EMSFire' && currentPath === '/field' && <FieldHomeScreen />}
          {user.role === 'EMSFire' && currentPath === '/event-log' && <EventLogScreen />}
        </main>
      </div>
      <Toaster />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </AuthProvider>
  );
};

export default App;
