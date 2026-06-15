import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Loader2, ChevronRight } from 'lucide-react';

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

type ApiLogEntry = {
  id: number;
  created_at: string;
  unit_id: number;
  from_status: string;
  to_status: string;
};

type ApiUnit = {
  id: number;
  name: string;
  unit_type: 'AMB' | 'ENG';
  status: string;
};

type UiLogRow = {
  id: number;
  timestamp: string;
  unitName: string;
  unitType: 'AMB' | 'ENG';
  statusFrom: string;
  statusTo: string;
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  ENROUTE: 'En Route',
  ON_SCENE: 'On Scene',
  TRANSPORTING: 'Transporting',
};

function statusColor(code: string) {
  if (code === 'AVAILABLE') return 'text-emerald-400';
  if (code === 'ENROUTE') return 'text-amber-400';
  if (code === 'ON_SCENE') return 'text-orange-400';
  if (code === 'TRANSPORTING') return 'text-blue-400';
  return 'text-slate-400';
}

function statusDotColor(code: string) {
  if (code === 'AVAILABLE') return 'bg-emerald-500';
  if (code === 'ENROUTE') return 'bg-amber-500';
  if (code === 'ON_SCENE') return 'bg-orange-500';
  if (code === 'TRANSPORTING') return 'bg-blue-500';
  return 'bg-slate-500';
}

export const EventLogScreen: React.FC = () => {
  const [searchValue, setSearchValue] = useState('');
  const [logs, setLogs] = useState<ApiLogEntry[]>([]);
  const [units, setUnits] = useState<ApiUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    setErr(null);
    try {
      const [logRows, unitRows] = await Promise.all([
        api<ApiLogEntry[]>('/logs/?limit=200'),
        api<ApiUnit[]>('/units/'),
      ]);
      setLogs(logRows);
      setUnits(unitRows);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to load event log');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh({ silent: false });
    const t = setInterval(() => refresh({ silent: true }).catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const unitById = useMemo(() => {
    const m = new Map<number, ApiUnit>();
    units.forEach((u) => m.set(u.id, u));
    return m;
  }, [units]);

  const uiLogs: UiLogRow[] = useMemo(() => {
    return (logs || []).map((le) => {
      const u = unitById.get(le.unit_id);
      return {
        id: le.id,
        timestamp: le.created_at,
        unitName: u?.name ?? `Unit ${le.unit_id}`,
        unitType: u?.unit_type ?? 'AMB',
        statusFrom: le.from_status,
        statusTo: le.to_status,
      };
    });
  }, [logs, unitById]);

  const filteredLogs = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return uiLogs;
    return uiLogs.filter((log) =>
      log.unitName.toLowerCase().includes(q) ||
      (STATUS_LABEL[log.statusFrom] ?? log.statusFrom).toLowerCase().includes(q) ||
      (STATUS_LABEL[log.statusTo] ?? log.statusTo).toLowerCase().includes(q)
    );
  }, [searchValue, uiLogs]);

  // Group logs by date
  const grouped = useMemo(() => {
    const groups: { date: string; entries: UiLogRow[] }[] = [];
    const seen = new Map<string, UiLogRow[]>();
    filteredLogs.forEach((log) => {
      const d = format(new Date(log.timestamp), 'MMM d, yyyy');
      if (!seen.has(d)) {
        const arr: UiLogRow[] = [];
        seen.set(d, arr);
        groups.push({ date: d, entries: arr });
      }
      seen.get(d)!.push(log);
    });
    return groups;
  }, [filteredLogs]);

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Event Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Unit status audit trail</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
          <span>{uiLogs.length} events</span>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {err}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="field-input"
        placeholder="Search unit name or status…"
      />

      {/* Timeline */}
      {loading && filteredLogs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-600 gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 text-slate-600 text-sm">
          No events match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, entries }) => (
            <div key={date}>
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">{date}</p>
              <div className="rounded-xl border border-white/[0.06] bg-[#111827] overflow-hidden divide-y divide-white/[0.04]">
                {entries.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Time */}
                    <span className="text-xs text-slate-600 font-mono shrink-0 w-16">
                      {format(new Date(log.timestamp), 'h:mm a')}
                    </span>

                    {/* Unit */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{log.unitName}</span>
                        <span className="text-xs text-slate-600 bg-white/[0.04] px-1.5 py-0.5 rounded shrink-0">
                          {log.unitType}
                        </span>
                      </div>
                    </div>

                    {/* Status transition */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(log.statusFrom)}`} />
                        <span className={`text-xs ${statusColor(log.statusFrom)}`}>
                          {STATUS_LABEL[log.statusFrom] ?? log.statusFrom}
                        </span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-slate-700" />
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(log.statusTo)}`} />
                        <span className={`text-xs font-semibold ${statusColor(log.statusTo)}`}>
                          {STATUS_LABEL[log.statusTo] ?? log.statusTo}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
