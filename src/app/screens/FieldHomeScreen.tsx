import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { format } from 'date-fns';
import { X, Loader2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api';

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

type UnitTypeCode = 'AMB' | 'ENG';
type UnitStatusCode = 'AVAILABLE' | 'ENROUTE' | 'ON_SCENE' | 'TRANSPORTING';

type ApiUnit = {
  id: number;
  name: string;
  unit_type: UnitTypeCode;
  status: UnitStatusCode;
  last_status_at: string;
  updated_at: string;
};

type ApiResourceRequest = {
  id: number;
  unit_type: UnitTypeCode;
  quantity: number;
  priority: string;
  location: string;
  status: 'PENDING' | 'APPROVED' | 'DENIED' | 'PARTIAL' | 'COMPLETED';
  created_at: string;
  updated_at: string;
};

const STATUS_LABEL: Record<UnitStatusCode, string> = {
  AVAILABLE: 'Available',
  ENROUTE: 'En Route',
  ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transporting',
};

const UNIT_LABEL: Record<UnitTypeCode, string> = {
  AMB: 'Ambulance',
  ENG: 'Engine',
};

function statusDotClass(s: UnitStatusCode) {
  if (s === 'AVAILABLE') return 'available';
  if (s === 'ENROUTE') return 'enroute';
  if (s === 'ON_SCENE') return 'on-scene';
  return 'transporting';
}

function statusTextClass(s: UnitStatusCode) {
  if (s === 'AVAILABLE') return 'text-emerald-600';
  if (s === 'ENROUTE') return 'text-amber-600';
  if (s === 'ON_SCENE') return 'text-orange-600';
  return 'text-blue-600';
}

function priorityBorder(priority: string) {
  if (priority === 'High') return 'border-red-200';
  if (priority === 'Medium') return 'border-amber-200';
  return 'border-slate-200';
}

function priorityBg(priority: string) {
  if (priority === 'High') return 'bg-red-50';
  if (priority === 'Medium') return 'bg-amber-50/50';
  return 'bg-white';
}

function priorityDot(priority: string) {
  if (priority === 'High') return 'bg-red-500';
  if (priority === 'Medium') return 'bg-amber-400';
  return 'bg-slate-400';
}

export const FieldHomeScreen: React.FC = () => {
  const { user } = useAuth();
  const isEMS = user?.role === 'EMSFire';

  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [requests, setRequests] = useState<ApiResourceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        api<ApiUnit[]>('/units/'),
        api<ApiResourceRequest[]>('/requests/?status=PENDING'),
      ]);
      setUnits(u);
      setRequests(r);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEMS) return;
    refresh();
    const t = setInterval(() => refresh().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [isEMS, refresh]);

  const allUnits = useMemo(() => units || [], [units]);

  const unitCounts = useMemo(() => {
    const c = { Available: 0, Enroute: 0, 'On Scene': 0, Transporting: 0 };
    allUnits.forEach((u) => {
      if (u.status === 'AVAILABLE') c.Available++;
      if (u.status === 'ENROUTE') c.Enroute++;
      if (u.status === 'ON_SCENE') c['On Scene']++;
      if (u.status === 'TRANSPORTING') c.Transporting++;
    });
    return c;
  }, [allUnits]);

  const [respondOpen, setRespondOpen] = useState(false);
  const [activeRequest, setActiveRequest] = useState<ApiResourceRequest | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<number[]>([]);
  const [note, setNote] = useState('');
  const [dispatching, setDispatching] = useState(false);
  const [unitStatusUpdating, setUnitStatusUpdating] = useState<number | null>(null);

  const openRespond = (req: ApiResourceRequest) => {
    setActiveRequest(req);
    setSelectedUnitIds([]);
    setNote('');
    setRespondOpen(true);
  };

  const closeRespond = () => {
    setRespondOpen(false);
    setActiveRequest(null);
    setSelectedUnitIds([]);
    setNote('');
  };

  const toggleSelected = (unitId: number) =>
    setSelectedUnitIds((prev) => prev.includes(unitId) ? prev.filter((id) => id !== unitId) : [...prev, unitId]);

  const availableUnitsForActiveRequest = useMemo(() => {
    if (!activeRequest) return [];
    return allUnits.filter((u) => u.status === 'AVAILABLE' && u.unit_type === activeRequest.unit_type);
  }, [allUnits, activeRequest]);

  const dispatchRequest = async () => {
    if (!activeRequest || selectedUnitIds.length === 0) return;
    setDispatching(true);
    setErr(null);
    setUnits((prev) => prev.map((u) => selectedUnitIds.includes(u.id) ? { ...u, status: 'ENROUTE' as UnitStatusCode } : u));
    try {
      await api(`/requests/${activeRequest.id}/dispatch/`, {
        method: 'POST',
        body: JSON.stringify({ unit_ids: selectedUnitIds, note }),
      });
      closeRespond();
      await refresh();
    } catch (e: any) {
      await refresh();
      setErr(e?.message ?? 'Dispatch failed');
    } finally {
      setDispatching(false);
    }
  };

  const markUnitAvailable = async (unitId: number) => {
    setErr(null);
    setUnitStatusUpdating(unitId);
    try {
      const updated = await api<ApiUnit>(`/units/${unitId}/status/`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'AVAILABLE' }),
      });
      setUnits((prev) => prev.map((u) => u.id === unitId ? { ...u, status: updated.status } : u));
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to update unit status');
    } finally {
      setUnitStatusUpdating(null);
    }
  };

  if (!isEMS) return null;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Field Station</h1>
          <p className="text-sm text-slate-400 mt-0.5">Unit readiness and IC dispatch requests</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <span>5s refresh</span>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {err}
        </div>
      )}

      {/* Status count cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Available', count: unitCounts.Available, dotClass: 'available', textClass: 'text-emerald-600' },
          { label: 'En Route', count: unitCounts.Enroute, dotClass: 'enroute', textClass: 'text-amber-600' },
          { label: 'On Scene', count: unitCounts['On Scene'], dotClass: 'on-scene', textClass: 'text-orange-600' },
          { label: 'Transporting', count: unitCounts.Transporting, dotClass: 'transporting', textClass: 'text-blue-600' },
        ].map(({ label, count, dotClass, textClass }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`status-dot ${dotClass}`} />
              <span className="text-xs text-slate-400">{label}</span>
            </div>
            <p className={`text-3xl font-bold ${textClass}`}>{count}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* All units */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">All Units</h2>
            <span className="text-xs text-slate-400">{allUnits.length} total</span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {allUnits.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                {loading ? 'Loading units…' : 'No units found'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {allUnits.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`status-dot ${statusDotClass(u.status)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{u.name}</p>
                      <p className={`text-xs ${statusTextClass(u.status)}`}>{STATUS_LABEL[u.status]}</p>
                    </div>
                    <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                      {UNIT_LABEL[u.unit_type]}
                    </span>
                    {u.status === 'TRANSPORTING' && (
                      <button
                        onClick={() => markUnitAvailable(u.id)}
                        disabled={unitStatusUpdating === u.id || dispatching}
                        className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors disabled:opacity-40"
                      >
                        {unitStatusUpdating === u.id ? '…' : 'Mark Available'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Incoming requests */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Incoming Requests</h2>
            {requests.length > 0 && (
              <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                {requests.length} pending
              </span>
            )}
          </div>

          {requests.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
              <p className="text-sm text-slate-400">No incoming requests</p>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => {
                const availableForReq = allUnits.filter((u) => u.status === 'AVAILABLE' && u.unit_type === req.unit_type);
                const noneAvailable = availableForReq.length === 0;

                return (
                  <div
                    key={req.id}
                    className={`rounded-xl border p-4 space-y-3 ${priorityBorder(req.priority)} ${priorityBg(req.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot(req.priority)}`} />
                          <span className="text-sm font-semibold text-slate-800">REQ #{req.id}</span>
                          <span className="text-xs text-slate-400">{req.priority} priority</span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {req.quantity}× {UNIT_LABEL[req.unit_type]}
                          {req.location && <span className="text-slate-400"> · {req.location}</span>}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {format(new Date(req.created_at), 'h:mm a')}
                        </p>
                      </div>
                      <button
                        onClick={() => openRespond(req)}
                        disabled={noneAvailable}
                        className="text-xs px-3 py-2 rounded-lg font-semibold shrink-0 bg-red-600 hover:bg-red-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-sm"
                      >
                        Respond
                      </button>
                    </div>
                    {noneAvailable && (
                      <p className="text-xs text-slate-400">
                        No available {UNIT_LABEL[req.unit_type].toLowerCase()}s to dispatch.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dispatch Modal */}
      {respondOpen && activeRequest && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-base font-semibold text-slate-900">Respond to REQ #{activeRequest.id}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select {UNIT_LABEL[activeRequest.unit_type].toLowerCase()}s to dispatch
                </p>
              </div>
              <button
                onClick={closeRespond}
                disabled={dispatching}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Request info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">Priority</p>
                  <p className="text-sm font-semibold text-slate-800">{activeRequest.priority || 'Medium'}</p>
                </div>
                <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                  <p className="text-xs text-slate-400 mb-0.5">Location</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{activeRequest.location || '—'}</p>
                </div>
              </div>

              {/* Unit picker */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Available {UNIT_LABEL[activeRequest.unit_type]}s
                </p>
                <div className="rounded-xl border border-slate-200 max-h-52 overflow-y-auto divide-y divide-slate-100">
                  {availableUnitsForActiveRequest.length === 0 ? (
                    <p className="text-sm text-slate-400 p-4">No available units for this request type.</p>
                  ) : (
                    availableUnitsForActiveRequest.map((u) => {
                      const checked = selectedUnitIds.includes(u.id);
                      return (
                        <label
                          key={u.id}
                          className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${checked ? 'bg-red-50' : 'hover:bg-slate-50'}`}
                        >
                          <span className={`h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${checked ? 'border-red-500 bg-red-500' : 'border-slate-300'}`}>
                            {checked && (
                              <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 12 12">
                                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggleSelected(u.id)} disabled={dispatching} />
                          <span className="text-sm text-slate-700 flex-1">{u.name}</span>
                          <span className="status-dot available" />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Note (optional)</label>
                <textarea
                  className="field-input resize-none"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g., 2 units now, 1 delayed 10 min"
                  disabled={dispatching}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={closeRespond}
                  disabled={dispatching}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={dispatchRequest}
                  disabled={dispatching || selectedUnitIds.length === 0}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {dispatching
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Dispatching…</>
                    : `Dispatch ${selectedUnitIds.length > 0 ? selectedUnitIds.length + ' Unit' + (selectedUnitIds.length !== 1 ? 's' : '') : ''}`
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
