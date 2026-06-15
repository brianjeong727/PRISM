import React, { useState } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { useData } from '@/app/contexts/DataContext';
import { format } from 'date-fns';
import { X, Plus, Search, ChevronDown } from 'lucide-react';

interface IncidentSelectScreenProps {
  onSelect: () => void;
}

const PREDICTION_SUBCATEGORIES: Record<string, string[]> = {
  Fire: ['Structure Fire', 'Brush Fire', 'Warehouse Fire', 'Industrial Fire', 'High-Rise Fire', 'Hazmat Fire', 'Vehicle Fire', 'Wildland Fire'],
  'Public Health': ['Disease Outbreak', 'Heat Illness Surge', 'Hospital Surge', 'Mass Casualty'],
  Weather: ['Ice Storm', 'Heatwave', 'Severe Thunderstorm', 'Tropical Storm', 'Tornado', 'Flash Flood', 'Blizzard', 'River Flood', 'Extreme Cold', 'Hurricane'],
  Infrastructure: ['Water Main Break', 'Bridge Collapse', 'Cyber Outage', 'Damaged Gas Line', 'Power Outage'],
};

const INCIDENT_CATEGORIES = Object.keys(PREDICTION_SUBCATEGORIES);

function severityColor(severity: string) {
  if (severity === 'Critical') return 'text-red-600';
  if (severity === 'High') return 'text-orange-500';
  if (severity === 'Medium') return 'text-amber-500';
  return 'text-emerald-600';
}

function severityDot(severity: string) {
  if (severity === 'Critical') return 'bg-red-500';
  if (severity === 'High') return 'bg-orange-400';
  if (severity === 'Medium') return 'bg-amber-400';
  return 'bg-emerald-500';
}

export const IncidentSelectScreen: React.FC<IncidentSelectScreenProps> = ({ onSelect }) => {
  const { selectIncident } = useAuth();
  const { incidents, addIncident } = useData();

  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);

  const defaultCategory = INCIDENT_CATEGORIES[0];
  const defaultSubcategory = PREDICTION_SUBCATEGORIES[defaultCategory][0];

  const [newIncident, setNewIncident] = useState({
    name: '',
    category: defaultCategory,
    subcategory: defaultSubcategory,
    severity: 'Medium',
    status: 'Active',
  });

  const handleRowClick = (incident: any) => {
    selectIncident(incident);
    onSelect();
  };

  const filteredIncidents = incidents.filter((inc: any) => {
    const matchesSearch = inc.name.toLowerCase().includes(searchValue.toLowerCase());
    const matchesStatus = statusFilter === 'all' || inc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreateIncident = () => {
    if (!newIncident.name.trim()) return;
    addIncident({
      name: newIncident.name.trim(),
      type: newIncident.subcategory,
      severity: newIncident.severity as any,
      status: newIncident.status as any,
    });
    setNewIncident({ name: '', category: defaultCategory, subcategory: defaultSubcategory, severity: 'Medium', status: 'Active' });
    setCreateOpen(false);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="max-w-4xl w-full mx-auto p-8 flex-1">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <span className="live-pulse h-2 w-2 rounded-full bg-red-500 inline-block" />
              <span className="text-xs font-semibold tracking-widest text-slate-400 uppercase">PRISM</span>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900">Select Incident</h1>
            <p className="text-sm text-slate-400 mt-1">Choose an incident to access the resource management system</p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Add Incident
          </button>
        </div>

        {/* Search + filter */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search incidents…"
              className="field-input pl-9"
            />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="field-input pr-8 appearance-none"
              style={{ width: '160px' }}
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Monitoring">Monitoring</option>
              <option value="Closed">Closed</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] px-4 py-3 border-b border-slate-100 bg-slate-50">
            {['Incident Name', 'Type', 'Severity', 'Status', 'Start Time'].map((h) => (
              <span key={h} className="text-xs font-semibold text-slate-400 uppercase tracking-widest">{h}</span>
            ))}
          </div>

          {filteredIncidents.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-400">
              No incidents found
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredIncidents.map((inc: any) => (
                <button
                  key={inc.id}
                  onClick={() => handleRowClick(inc)}
                  className="w-full grid grid-cols-[2fr_1.5fr_1fr_1fr_1.5fr] px-4 py-3.5 text-left hover:bg-red-50/60 transition-colors group"
                >
                  <span className="text-sm font-medium text-slate-800 group-hover:text-red-700 transition-colors truncate pr-3">
                    {inc.name}
                  </span>
                  <span className="text-sm text-slate-500 truncate pr-3">{inc.type ?? '—'}</span>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${severityDot(inc.severity)}`} />
                    <span className={`text-sm font-medium ${severityColor(inc.severity)}`}>{inc.severity}</span>
                  </div>
                  <div>
                    <span className={`
                      text-xs font-semibold px-2.5 py-1 rounded-full
                      ${inc.status === 'Active'
                        ? 'bg-red-50 text-red-600'
                        : inc.status === 'Monitoring'
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-slate-100 text-slate-500'
                      }
                    `}>
                      {inc.status}
                    </span>
                  </div>
                  <span className="text-sm text-slate-400">
                    {inc.startTime ? format(new Date(inc.startTime), 'MMM d, h:mm a') : '—'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Incident Modal */}
      {createOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl">
            <div className="flex items-start justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <p className="text-base font-semibold text-slate-900">Create Incident</p>
                <p className="text-xs text-slate-400 mt-0.5">Add a new incident for IC + EMS/Fire</p>
              </div>
              <button
                onClick={() => setCreateOpen(false)}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Incident Name</label>
                <input
                  className="field-input"
                  value={newIncident.name}
                  onChange={(e) => setNewIncident((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g., Cedar Ridge Response"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                  <select
                    className="field-input"
                    value={newIncident.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      const firstSub = PREDICTION_SUBCATEGORIES[category]?.[0] ?? '';
                      setNewIncident((p) => ({ ...p, category, subcategory: firstSub }));
                    }}
                  >
                    {INCIDENT_CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Type</label>
                  <select
                    className="field-input"
                    value={newIncident.subcategory}
                    onChange={(e) => setNewIncident((p) => ({ ...p, subcategory: e.target.value }))}
                  >
                    {PREDICTION_SUBCATEGORIES[newIncident.category].map((sub) => <option key={sub}>{sub}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Severity</label>
                  <select
                    className="field-input"
                    value={newIncident.severity}
                    onChange={(e) => setNewIncident((p) => ({ ...p, severity: e.target.value }))}
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                  <select
                    className="field-input"
                    value={newIncident.status}
                    onChange={(e) => setNewIncident((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option>Active</option>
                    <option>Monitoring</option>
                    <option>Closed</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setCreateOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateIncident}
                  disabled={!newIncident.name.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
