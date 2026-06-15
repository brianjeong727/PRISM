import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useData, Request } from '@/app/contexts/DataContext';
import { useAuth } from '@/app/contexts/AuthContext';
import { AlertTriangle, RotateCcw, Ambulance, Flame, X, ChevronRight, Loader2 } from 'lucide-react';
import { RequestDetailDrawer } from './RequestDetailDrawer';

const API_BASE = (import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api').replace(/\/$/, '');

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

const PREDICTION_SUBCATEGORIES: Record<string, string[]> = {
  Fire: ['Structure Fire', 'Brush Fire', 'Warehouse Fire', 'Industrial Fire', 'High-Rise Fire', 'Hazmat Fire', 'Vehicle Fire', 'Wildland Fire'],
  'Public Health': ['Disease Outbreak', 'Heat Illness Surge', 'Hospital Surge', 'Mass Casualty'],
  Weather: ['Ice Storm', 'Heatwave', 'Severe Thunderstorm', 'Tropical Storm', 'Tornado', 'Flash Flood', 'Blizzard', 'River Flood', 'Extreme Cold', 'Hurricane'],
  Infrastructure: ['Water Main Break', 'Bridge Collapse', 'Cyber Outage', 'Damaged Gas Line', 'Power Outage'],
};

type UnitTypeCode = 'AMB' | 'ENG';
type UnitStatusCode = 'AVAILABLE' | 'ENROUTE' | 'ON_SCENE' | 'TRANSPORTING';

type ApiUnit = {
  id: number;
  name: string;
  unit_type: UnitTypeCode;
  status: UnitStatusCode;
};

function statusDotClass(s: UnitStatusCode) {
  if (s === 'AVAILABLE') return 'available';
  if (s === 'ENROUTE') return 'enroute';
  if (s === 'ON_SCENE') return 'on-scene';
  return 'transporting';
}

function statusLabel(s: UnitStatusCode) {
  if (s === 'AVAILABLE') return 'Available';
  if (s === 'ENROUTE') return 'En Route';
  if (s === 'ON_SCENE') return 'On Scene';
  return 'Transporting';
}

function statusTextClass(s: UnitStatusCode) {
  if (s === 'AVAILABLE') return 'text-emerald-600';
  if (s === 'ENROUTE') return 'text-amber-600';
  if (s === 'ON_SCENE') return 'text-orange-600';
  return 'text-blue-600';
}

export const ICDashboard: React.FC = () => {
  const { addRequest, logEvent } = useData();
  const { user, incident } = useAuth();
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);

  const [dbUnits, setDbUnits] = useState<ApiUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [unitsErr, setUnitsErr] = useState<string | null>(null);

  const refreshUnits = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setUnitsLoading(true);
    try {
      const u = await api<ApiUnit[]>('/units/');
      setDbUnits(u);
      setUnitsErr(null);
    } catch (e: any) {
      setUnitsErr(e?.message ?? 'Failed to load units');
    } finally {
      if (!opts?.silent) setUnitsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUnits({ silent: false });
    const t = setInterval(() => refreshUnits({ silent: true }).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [refreshUnits]);

  const deployedUnits = useMemo(
    () => dbUnits.filter((u) => u.status === 'ENROUTE' || u.status === 'ON_SCENE' || u.status === 'TRANSPORTING'),
    [dbUnits]
  );

  const availableAmb = useMemo(() => dbUnits.filter((u) => u.unit_type === 'AMB' && u.status === 'AVAILABLE').length, [dbUnits]);
  const availableEng = useMemo(() => dbUnits.filter((u) => u.unit_type === 'ENG' && u.status === 'AVAILABLE').length, [dbUnits]);
  const totalAmb = useMemo(() => dbUnits.filter((u) => u.unit_type === 'AMB').length, [dbUnits]);
  const totalEng = useMemo(() => dbUnits.filter((u) => u.unit_type === 'ENG').length, [dbUnits]);

  const [lowDispatch, setLowDispatch] = useState<{ low: boolean; warning: string } | null>(null);
  const [lowDispatchLoading, setLowDispatchLoading] = useState(false);
  const [lowDispatchError, setLowDispatchError] = useState<string | null>(null);

  const fetchLowDispatchAlert = useCallback(async () => {
    setLowDispatchLoading(true);
    setLowDispatchError(null);
    try {
      const res = await fetch(`${API_BASE}/monitor/ambulances/low/`, { headers: { 'Content-Type': 'application/json' } });
      if (!res.ok) throw new Error(`Low dispatch check failed (${res.status})`);
      const data = await res.json();
      setLowDispatch({ low: Boolean(data.low_ambulances), warning: String(data.warning ?? '') });
    } catch (e) {
      setLowDispatch(null);
      setLowDispatchError(e instanceof Error ? e.message : 'Failed to load alert.');
    } finally {
      setLowDispatchLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLowDispatchAlert();
    const id = window.setInterval(fetchLowDispatchAlert, 30000);
    return () => window.clearInterval(id);
  }, [fetchLowDispatchAlert]);

  const [showPredictionModal, setShowPredictionModal] = useState(false);
  const [predictionInput, setPredictionInput] = useState({
    location: '',
    buildings: 0,
    patientCount: 0,
    disasterType: 'Fire',
    subCategory: PREDICTION_SUBCATEGORIES['Fire'][0],
  });
  const [predicted, setPredicted] = useState<{ engines: number; ambulances: number } | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const [reqEngines, setReqEngines] = useState(0);
  const [reqAmbulances, setReqAmbulances] = useState(0);
  const [reqLocation, setReqLocation] = useState('');
  const [reqPriority, setReqPriority] = useState<'Low' | 'Medium' | 'High'>('High');

  const handleMarkOnScene = async (dbUnitId: number) => {
    try {
      await api(`/units/${dbUnitId}/status/`, { method: 'PATCH', body: JSON.stringify({ status: 'ON_SCENE' }) });
      await refreshUnits();
      logEvent({ actor: user?.name || 'IC', action: 'Unit On Scene', entityType: 'Unit', entityId: String(dbUnitId), payload: { to_status: 'ON_SCENE' } });
    } catch (e: any) { alert(e?.message ?? 'Failed to update unit status'); }
  };

  const handleTransporting = async (dbUnitId: number) => {
    try {
      await api(`/units/${dbUnitId}/status/`, { method: 'PATCH', body: JSON.stringify({ status: 'TRANSPORTING' }) });
      await refreshUnits();
      logEvent({ actor: user?.name || 'IC', action: 'Unit Transporting', entityType: 'Unit', entityId: String(dbUnitId), payload: { to_status: 'TRANSPORTING' } });
    } catch (e: any) { alert(e?.message ?? 'Failed to update unit status'); }
  };

  const runPrediction = async () => {
    setPredictionLoading(true);
    setPredictionError(null);
    try {
      const response = await fetch(`${API_BASE}/api/initial-prediction/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incident: {
            incident_category: predictionInput.disasterType,
            incident_subtype: predictionInput.subCategory,
            city: predictionInput.location,
            state: '',
            population_affected_est: predictionInput.patientCount,
            injuries_est: predictionInput.patientCount,
            structures_threatened: predictionInput.buildings,
            structures_damaged: predictionInput.buildings,
            start_time: new Date().toISOString(),
          },
        }),
      });
      if (!response.ok) throw new Error('Prediction request failed.');
      const data = await response.json();
      const engines = Math.max(0, Math.round(data.prediction?.firetrucks_dispatched_engines ?? 0));
      const ambulances = Math.max(0, Math.round(data.prediction?.ambulances_dispatched ?? 0));
      setPredicted({ engines, ambulances });
      if (!reqLocation.trim() && predictionInput.location.trim()) setReqLocation(predictionInput.location.trim());
    } catch (error) {
      setPredicted(null);
      setPredictionError(error instanceof Error ? error.message : 'Unable to run prediction.');
    } finally {
      setPredictionLoading(false);
    }
  };

  const submitToDatabase = async (engines: number, ambulances: number) => {
    const location = reqLocation.trim() || predictionInput.location?.trim() || 'Unknown';
    const priority = reqPriority || 'Medium';
    const calls: Promise<any>[] = [];
    if (ambulances > 0) calls.push(api('/requests/create/', { method: 'POST', body: JSON.stringify({ unit_type: 'AMB', quantity: ambulances, priority, location }) }));
    if (engines > 0) calls.push(api('/requests/create/', { method: 'POST', body: JSON.stringify({ unit_type: 'ENG', quantity: engines, priority, location }) }));
    if (calls.length === 0) return;
    await Promise.all(calls);
  };

  const handleSubmitRequest = async (fromPrediction = false) => {
    if (!incident || !user) return;
    const engines = fromPrediction && predicted ? predicted.engines : reqEngines;
    const ambulances = fromPrediction && predicted ? predicted.ambulances : reqAmbulances;
    const finalLocation = reqLocation.trim() || predictionInput.location?.trim() || 'Unknown';
    const finalPriority = reqPriority || 'Medium';
    try {
      await submitToDatabase(engines, ambulances);
      const resources = [] as any[];
      if (ambulances > 0) resources.push({ id: `RL-A-${Date.now()}`, resourceType: 'Ambulances', qtyRequested: ambulances });
      if (engines > 0) resources.push({ id: `RL-E-${Date.now()}`, resourceType: 'Fire Engines', qtyRequested: engines });
      addRequest({ incidentId: incident.id, requesterId: user.id, requesterName: user.name, requesterOrg: user.role, priority: finalPriority, status: 'Submitted', neededBy: new Date(Date.now() + 3600000).toISOString(), location: finalLocation, justification: fromPrediction ? `Auto-generated: ${predictionInput.disasterType} / ${predictionInput.subCategory}` : 'Manual request from IC', patientImpact: String(predictionInput.patientCount || ''), resources });
      logEvent({ actor: user.name, action: 'Submitted Request (DB)', entityType: 'ResourceRequest', entityId: 'created', payload: { engines, ambulances, location: finalLocation, priority: finalPriority } });
      setShowPredictionModal(false);
      setPredicted(null);
      setReqAmbulances(0);
      setReqEngines(0);
      setReqLocation('');
      setReqPriority('High');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit request');
    }
  };

  const populateRequestFromPrediction = () => {
    if (!predicted) return;
    setReqEngines(predicted.engines);
    setReqAmbulances(predicted.ambulances);
    if (predictionInput.location.trim()) setReqLocation(predictionInput.location.trim());
    setShowPredictionModal(false);
    setPredicted(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Alert banner */}
      {lowDispatch?.low && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-700">Low Ambulance Availability</p>
            <p className="text-sm text-red-500 mt-0.5 leading-relaxed">{lowDispatch.warning}</p>
          </div>
          <button onClick={fetchLowDispatchAlert} disabled={lowDispatchLoading} className="shrink-0 text-red-400 hover:text-red-600 transition-colors">
            <RotateCcw className={`h-4 w-4 ${lowDispatchLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Operations Dashboard</h1>
        <p className="text-sm text-slate-400 mt-0.5">{incident?.name} · Resource status &amp; requests</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Ambulance className="h-4 w-4" />} label="Ambulances Available" value={availableAmb} total={totalAmb} loading={unitsLoading} critical={availableAmb <= 2} />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Engines Available" value={availableEng} total={totalEng} loading={unitsLoading} critical={availableEng <= 1} />
        <StatCard label="Units Deployed" value={deployedUnits.length} loading={unitsLoading} />
        <StatCard
          label="Alert Status"
          value={lowDispatch?.low ? 'LOW' : (lowDispatch ? 'OK' : '—')}
          valueClass={lowDispatch?.low ? 'text-red-600' : 'text-emerald-600'}
          loading={lowDispatchLoading && !lowDispatch}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Deployed units */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Active Units</h2>
            {unitsErr && <span className="text-xs text-red-500">{unitsErr}</span>}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {deployedUnits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {unitsLoading ? 'Loading units…' : 'No units currently deployed'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {deployedUnits.map((u) => (
                  <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                    <span className={`status-dot ${statusDotClass(u.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{u.name}</p>
                      <p className={`text-xs ${statusTextClass(u.status)}`}>{statusLabel(u.status)}</p>
                    </div>
                    <div className="flex gap-2">
                      {u.status === 'ENROUTE' && (
                        <button onClick={() => handleMarkOnScene(u.id)} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-600 hover:text-slate-900 transition-colors">
                          Mark On Scene
                        </button>
                      )}
                      {u.status === 'ON_SCENE' && (
                        <button onClick={() => handleTransporting(u.id)} className="text-xs px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                          Transporting
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Request form */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Request Resources</h3>
              <button
                onClick={() => setShowPredictionModal(true)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
              >
                AI Prediction
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Location</label>
                <input value={reqLocation} onChange={(e) => setReqLocation(e.target.value)} className="field-input" placeholder="e.g., UPMC Presby, 200 Lothrop St" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Priority</label>
                <select value={reqPriority} onChange={(e) => setReqPriority(e.target.value as any)} className="field-input">
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Ambulances</label>
                <input type="number" min={0} value={reqAmbulances} onChange={(e) => setReqAmbulances(Number(e.target.value))} className="field-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Fire Engines</label>
                <input type="number" min={0} value={reqEngines} onChange={(e) => setReqEngines(Number(e.target.value))} className="field-input" />
              </div>
            </div>

            <button
              onClick={() => handleSubmitRequest(false)}
              disabled={reqAmbulances === 0 && reqEngines === 0}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              Submit Request
            </button>
          </div>
        </div>

        {/* Right panel */}
        <div className="lg:col-span-2 space-y-4">
          {/* Dispatch monitor */}
          <div className={`rounded-xl border p-4 space-y-3 ${lowDispatch?.low ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${lowDispatch?.low ? 'text-red-500' : 'text-slate-400'}`} />
                <span className="text-sm font-semibold text-slate-800">Dispatch Monitor</span>
              </div>
              <button onClick={fetchLowDispatchAlert} disabled={lowDispatchLoading} className="text-slate-400 hover:text-slate-600 transition-colors">
                <RotateCcw className={`h-3.5 w-3.5 ${lowDispatchLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {lowDispatchError && <p className="text-xs text-red-500">{lowDispatchError}</p>}
            {!lowDispatch && !lowDispatchError && <p className="text-xs text-slate-400">Checking…</p>}
            {lowDispatch && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${lowDispatch.low ? 'bg-red-500' : 'bg-emerald-500'}`} />
                  <span className={`text-sm font-semibold ${lowDispatch.low ? 'text-red-600' : 'text-emerald-600'}`}>
                    {lowDispatch.low ? 'LOW AVAILABILITY' : 'NORMAL'}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">30s refresh</span>
                </div>
                {lowDispatch.warning && <p className="text-xs text-slate-500 leading-relaxed">{lowDispatch.warning}</p>}
              </div>
            )}
          </div>

          {/* Available units */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Available Units</h3>
            <div className="space-y-2">
              {dbUnits.filter((u) => u.status === 'AVAILABLE').length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No units available</p>
              ) : (
                dbUnits.filter((u) => u.status === 'AVAILABLE').map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5">
                    <span className="status-dot available" />
                    <span className="text-sm text-slate-700 flex-1">{u.name}</span>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                      {u.unit_type === 'AMB' ? 'AMB' : 'ENG'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedRequest && <RequestDetailDrawer request={selectedRequest} onClose={() => setSelectedRequest(null)} />}

      {/* AI Prediction Modal */}
      {showPredictionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-semibold text-slate-900">AI Resource Prediction</h3>
                <p className="text-xs text-slate-400 mt-0.5">Enter incident details to get a resource estimate</p>
              </div>
              <button onClick={() => { setShowPredictionModal(false); setPredicted(null); setPredictionError(null); }} className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">City / Location</label>
                  <input value={predictionInput.location} onChange={(e) => setPredictionInput((i) => ({ ...i, location: e.target.value }))} className="field-input" placeholder="e.g., Pittsburgh, PA" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Disaster Type</label>
                  <select value={predictionInput.disasterType} onChange={(e) => { const t = e.target.value; setPredictionInput((i) => ({ ...i, disasterType: t, subCategory: PREDICTION_SUBCATEGORIES[t][0] })); }} className="field-input">
                    {Object.keys(PREDICTION_SUBCATEGORIES).map((k) => <option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Subcategory</label>
                  <select value={predictionInput.subCategory} onChange={(e) => setPredictionInput((i) => ({ ...i, subCategory: e.target.value }))} className="field-input">
                    {(PREDICTION_SUBCATEGORIES[predictionInput.disasterType] ?? []).map((sub) => <option key={sub}>{sub}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Buildings Affected</label>
                  <input type="number" value={predictionInput.buildings} onChange={(e) => setPredictionInput((i) => ({ ...i, buildings: Number(e.target.value) }))} className="field-input" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Affected Population</label>
                  <input type="number" value={predictionInput.patientCount} onChange={(e) => setPredictionInput((i) => ({ ...i, patientCount: Number(e.target.value) }))} className="field-input" />
                </div>
              </div>

              {predictionError && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{predictionError}</p>}

              <button onClick={runPrediction} disabled={predictionLoading} className="w-full py-2.5 rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 transition-colors flex items-center justify-center gap-2 shadow-sm">
                {predictionLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Running…</> : 'Run Prediction'}
              </button>

              {predicted && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Prediction Results</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Fire Engines</p>
                      <p className="text-3xl font-bold text-slate-900">{predicted.engines}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                      <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Ambulances</p>
                      <p className="text-3xl font-bold text-slate-900">{predicted.ambulances}</p>
                    </div>
                  </div>
                  <button onClick={populateRequestFromPrediction} className="w-full py-2.5 rounded-xl font-semibold text-sm border border-red-200 text-red-600 hover:bg-red-50 transition-colors flex items-center justify-center gap-2">
                    Use This Prediction <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: number | string;
  total?: number;
  loading?: boolean;
  critical?: boolean;
  valueClass?: string;
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, total, loading, critical, valueClass }) => (
  <div className={`rounded-xl border p-4 space-y-2 bg-white ${critical ? 'border-red-200' : 'border-slate-200'}`}>
    {icon && <div className={`${critical ? 'text-red-500' : 'text-slate-400'}`}>{icon}</div>}
    <div>
      <p className="text-xs text-slate-400 leading-tight">{label}</p>
      <div className="flex items-baseline gap-1.5 mt-1">
        {loading ? (
          <span className="h-7 w-8 rounded bg-slate-100 animate-pulse block" />
        ) : (
          <span className={`text-2xl font-bold ${valueClass ?? (critical ? 'text-red-600' : 'text-slate-900')}`}>
            {value}
          </span>
        )}
        {total !== undefined && !loading && (
          <span className="text-xs text-slate-400">/ {total}</span>
        )}
      </div>
    </div>
  </div>
);
