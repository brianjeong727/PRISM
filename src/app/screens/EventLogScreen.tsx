import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Loader2, ChevronRight } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE ?? '/api').replace(/\/$/, '');

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    const isHtml = text.trim().startsWith('<');
    throw new Error(isHtml ? `Server error (${res.status}) — check API configuration` : (text || `Request failed: ${res.status}`));
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

function statusTextClass(code: string) {
  if (code === 'AVAILABLE') return 'text-emerald-600';
  if (code === 'ENROUTE') return 'text-amber-600';
  if (code === 'ON_SCENE') return 'text-orange-600';
  if (code === 'TRANSPORTING') return 'text-blue-600';
  return 'text-slate-500';
}

function statusDotColor(code: string) {
  if (code === 'AVAILABLE') return 'bg-emerald-500';
  if (code === 'ENROUTE') return 'bg-amber-400';
  if (code === 'ON_SCENE') return 'bg-orange-500';
  if (code === 'TRANSPORTING') return 'bg-blue-500';
  return 'bg-slate-400';
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
          <h1 className="text-xl font-semibold text-slate-900">Event Log</h1>
          <p className="text-sm text-slate-400 mt-0.5">Unit status audit trail</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
          <span>{uiLogs.length} events</span>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {err}
        </div>
      )}

      <input
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="field-input"
        placeholder="Search unit name or status…"
      />

      {loading && filteredLogs.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading events…
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="text-center py-16 text-slate-400 text-sm">
          No events match your search.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ date, entries }) => (
            <div key={date}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">{date}</p>
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
                {entries.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-4 py-3">
                    <span className="text-xs text-slate-400 font-mono shrink-0 w-16">
                      {format(new Date(log.timestamp), 'h:mm a')}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-800 truncate">{log.unitName}</span>
                        <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                          {log.unitType}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(log.statusFrom)}`} />
                        <span className={`text-xs ${statusTextClass(log.statusFrom)}`}>
                          {STATUS_LABEL[log.statusFrom] ?? log.statusFrom}
                        </span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-slate-300" />
                      <div className="flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDotColor(log.statusTo)}`} />
                        <span className={`text-xs font-semibold ${statusTextClass(log.statusTo)}`}>
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
