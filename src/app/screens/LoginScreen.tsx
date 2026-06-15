import React, { useState } from 'react';
import { Role, useAuth } from '@/app/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Button } from '@/app/components/ui/button';
import { Label } from '@/app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

interface LoginScreenProps {
  onLogin: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { loginWithRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | ''>('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) {
      setError('Please select a role to continue.');
      return;
    }
    loginWithRole(selectedRole as Role);
    onLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white tracking-tight">PRISM</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Priority · Resource · Incident · Simulation · Monitoring
          </p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-white text-lg">Demo Login</CardTitle>
            <CardDescription className="text-slate-400">
              Select your role to enter the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="role" className="text-slate-300">Role</Label>
                <Select value={selectedRole} onValueChange={(v) => { setSelectedRole(v as Role); setError(''); }}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                    <SelectValue placeholder="Select your role..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IC">Incident Commander (IC)</SelectItem>
                    <SelectItem value="EMSFire">EMS / Fire Personnel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-sm text-red-400">{error}</p>}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Enter PRISM
              </Button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500 text-center">
                IC — full command view &nbsp;·&nbsp; EMS/Fire — field dispatch view
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
