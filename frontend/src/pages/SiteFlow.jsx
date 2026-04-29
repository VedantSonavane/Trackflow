import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { RefreshCw, ArrowRight } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MOCK_FLOW = [
  { path: ['/', '/features', '/pricing'], count: 340 },
  { path: ['/', '/pricing', '/register'], count: 280 },
  { path: ['/blog', '/', '/pricing'], count: 210 },
  { path: ['/', '/docs', '/docs/quickstart'], count: 185 },
  { path: ['/pricing', '/register', '/dashboard'], count: 160 },
  { path: ['/', '/about', '/pricing'], count: 140 },
  { path: ['/register', '/dashboard', '/settings'], count: 120 },
  { path: ['/', '/features', '/register'], count: 98 },
];

export default function SiteFlow() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [flows, setFlows] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchFlow() {
    setLoading(true);
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;
      const result = await api.get(`/analytics/${id}/flow?from=${from}&to=${to}`);
      if (result && result.length > 0) {
        setFlows(result);
      } else {
        setFlows(MOCK_FLOW);
      }
    } catch {
      setFlows(MOCK_FLOW);
    }
    setLoading(false);
  }

  useEffect(() => { fetchFlow(); }, [id, range]);

  const maxCount = flows ? Math.max(...flows.map(f => f.count)) : 1;

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">User flow</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Most common navigation paths through your site</p>
        </div>
        <button
          onClick={fetchFlow}
          className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      {flows && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Unique paths', value: flows.length },
            { label: 'Top path sessions', value: flows[0]?.count },
            { label: 'Avg path length', value: (flows.reduce((s, f) => s + f.path.length, 0) / flows.length).toFixed(1) + ' pages' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
              <div className="text-[11px] text-trackflow-text-3 font-medium tracking-wide mb-2">{s.label}</div>
              <div className="text-[26px] font-light font-mono text-trackflow-text leading-none">
                {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-trackflow-bg-2">
          <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Top navigation paths</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-trackflow-bg-2">
            {flows.map((flow, i) => {
              const barPct = Math.round((flow.count / maxCount) * 100);
              return (
                <div key={i} className="px-6 py-3.5 flex items-center gap-4 hover:bg-trackflow-bg transition-colors">
                  <span className="text-[11px] font-mono text-trackflow-text-3 w-5 shrink-0 text-right">{i + 1}</span>
                  <div className="flex-1 flex items-center gap-1 flex-wrap">
                    {flow.path.map((page, pi) => (
                      <React.Fragment key={pi}>
                        <span className="font-mono text-[11px] bg-trackflow-bg-2 text-trackflow-text px-2 py-0.5 rounded whitespace-nowrap">
                          {page}
                        </span>
                        {pi < flow.path.length - 1 && (
                          <ArrowRight size={11} className="text-trackflow-text-3 shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="w-32 shrink-0 flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-trackflow-bg-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-trackflow-text rounded-full transition-all duration-700"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[12px] text-trackflow-text w-10 text-right shrink-0">
                      {flow.count.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
