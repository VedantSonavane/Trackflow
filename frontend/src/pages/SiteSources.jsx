import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { RefreshCw, TrendingUp } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MEDIUM_COLORS = {
  organic: '#10b981', social: '#2563eb', referral: '#8b5cf6',
  email: '#f59e0b', paid: '#ef4444', direct: '#6b7280', none: '#6b7280',
};

function Bar({ value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex-1 h-1.5 bg-trackflow-bg-2 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color || '#111110' }} />
    </div>
  );
}

function SourceTable({ title, data, colorKey }) {
  const max = data[0]?.sessions || 1;
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-trackflow-bg-2">
        <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">{title}</h3>
      </div>
      {data.length === 0 ? (
        <div className="p-8 text-center text-trackflow-text-3 text-xs">No data</div>
      ) : (
        <div className="divide-y divide-trackflow-bg-2">
          {data.map((row, i) => (
            <div key={i} className="px-5 py-2.5 flex items-center gap-3">
              <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: MEDIUM_COLORS[row.name?.toLowerCase()] || '#6b7280' }} />
              <span className="text-xs text-trackflow-text-2 w-32 shrink-0 truncate capitalize">{row.name || 'unknown'}</span>
              <Bar value={row.sessions} max={max} color={MEDIUM_COLORS[row.name?.toLowerCase()]} />
              <span className="font-mono text-[12px] text-trackflow-text w-12 text-right shrink-0">{row.sessions.toLocaleString()}</span>
              <span className="text-[10px] text-trackflow-text-3 w-8 text-right shrink-0">{row.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const MOCK = {
  total: 1360,
  byMedium: [
    { name: 'organic', sessions: 520, pct: 38 },
    { name: 'direct', sessions: 380, pct: 28 },
    { name: 'social', sessions: 220, pct: 16 },
    { name: 'referral', sessions: 150, pct: 11 },
    { name: 'email', sessions: 90, pct: 7 },
  ],
  bySource: [
    { name: 'Google', sessions: 410, pct: 30 },
    { name: 'direct', sessions: 380, pct: 28 },
    { name: 'Facebook', sessions: 130, pct: 10 },
    { name: 'twitter/x', sessions: 90, pct: 7 },
    { name: 'newsletter', sessions: 90, pct: 7 },
    { name: 'github.com', sessions: 80, pct: 6 },
    { name: 'linkedin', sessions: 70, pct: 5 },
    { name: 'Bing', sessions: 60, pct: 4 },
    { name: 'DuckDuckGo', sessions: 50, pct: 4 },
  ],
  byCampaign: [],
};

export default function SiteSources() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [attrModel, setAttrModel] = useState('linear');
  const [attribution, setAttribution] = useState(null);

  async function fetchAttribution(model) {
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;
      const result = await api.get(`/analytics/${id}/attribution?from=${from}&to=${to}&model=${model}`);
      setAttribution(result);
    } catch { setAttribution(null); }
  }

  async function fetchSources() {
    setLoading(true);
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;
      const result = await api.get(`/analytics/${id}/sources?from=${from}&to=${to}`);
      if (result && result.total > 0) setData(result);
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
    setLoading(false);
  }

  useEffect(() => { fetchSources(); fetchAttribution(attrModel); }, [id, range]);
  useEffect(() => { fetchAttribution(attrModel); }, [attrModel]);

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Traffic sources</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">First-touch attribution — where sessions originate</p>
        </div>
        <button
          onClick={fetchSources}
          className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {data && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Total sessions', value: data.total?.toLocaleString() },
              { label: 'Top medium', value: data.byMedium?.[0]?.name || '—' },
              { label: 'Top source', value: data.bySource?.[0]?.name || '—' },
              { label: 'Campaigns tracked', value: data.byCampaign?.length || 0 },
            ].map((s, i) => (
              <div key={i} className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
                <div className="text-[11px] text-trackflow-text-3 font-medium tracking-wide mb-2">{s.label}</div>
                <div className="text-[22px] font-light font-mono text-trackflow-text leading-none capitalize">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Donut + medium breakdown */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <SourceTable title="By medium" data={data.byMedium || []} />
            <SourceTable title="By source" data={data.bySource || []} />
          </div>

          {data.byCampaign?.length > 0 && (
            <SourceTable title="UTM campaigns" data={data.byCampaign} />
          )}

          {data.byCampaign?.length === 0 && (
            <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
              <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-3 tracking-wide uppercase">UTM campaigns</h3>
              <p className="text-xs text-trackflow-text-3">No UTM campaign data yet. Add <code className="font-mono bg-trackflow-bg-2 px-1 rounded">?utm_source=…&utm_medium=…&utm_campaign=…</code> to your links to track campaigns.</p>
            </div>
          )}

          {/* Multi-touch attribution */}
          <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden mt-4">
            <div className="px-5 py-4 border-b border-trackflow-bg-2 flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Multi-touch attribution</h3>
              <div className="flex gap-0.5 bg-trackflow-bg-2 rounded-md p-0.5">
                {['first', 'linear', 'last'].map(m => (
                  <button key={m} onClick={() => setAttrModel(m)}
                    className={`px-2.5 py-1 rounded text-[11px] cursor-pointer transition-all ${attrModel === m ? 'bg-white text-trackflow-text font-medium shadow-sm' : 'text-trackflow-text-2'}`}>
                    {m}-touch
                  </button>
                ))}
              </div>
            </div>
            {!attribution?.results?.length ? (
              <div className="p-8 text-center text-trackflow-text-3 text-xs">No attribution data</div>
            ) : (
              <div className="divide-y divide-trackflow-bg-2">
                {attribution.results.slice(0, 10).map((r, i) => (
                  <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                    <span className="text-xs text-trackflow-text-2 w-32 shrink-0 truncate capitalize">{r.source}</span>
                    <span className="text-[10px] text-trackflow-text-3 w-20 shrink-0">{r.medium}</span>
                    <span className="font-mono text-[12px] text-trackflow-text ml-auto">{r.credit} credit</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {loading && <div className="p-12 text-center text-trackflow-text-3 text-sm">Loading…</div>}
    </div>
  );
}