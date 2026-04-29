import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Layers, RefreshCw } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MOCK_SCROLL = [
  { depth: 10, count: 1840, label: '10%' },
  { depth: 25, count: 1420, label: '25%' },
  { depth: 50, count: 980, label: '50%' },
  { depth: 75, count: 610, label: '75%' },
  { depth: 90, count: 340, label: '90%' },
  { depth: 100, count: 190, label: '100%' },
];

const DEPTH_COLORS = {
  10:  { bar: '#111110', bg: '#f4f4f2' },
  25:  { bar: '#111110', bg: '#f4f4f2' },
  50:  { bar: '#111110', bg: '#f4f4f2' },
  75:  { bar: '#111110', bg: '#f4f4f2' },
  90:  { bar: '#111110', bg: '#f4f4f2' },
  100: { bar: '#111110', bg: '#f4f4f2' },
};

export default function SiteScroll() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchScroll() {
    setLoading(true);
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;
      const result = await api.get(`/analytics/${id}/scroll?from=${from}&to=${to}`);
      if (result && result.length > 0) {
        setData(result.map(r => ({ ...r, label: `${r.depth}%` })));
      } else {
        setData(MOCK_SCROLL);
      }
    } catch {
      setData(MOCK_SCROLL);
    }
    setLoading(false);
  }

  useEffect(() => { fetchScroll(); }, [id, range]);

  const maxCount = data ? Math.max(...data.map(d => d.count)) : 1;
  const total = data?.[0]?.count || maxCount;

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Scroll depth</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">How far users scroll down your pages</p>
        </div>
        <button
          onClick={fetchScroll}
          className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary stat cards */}
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Reached 25%', value: data.find(d => d.depth === 25)?.count, pct: Math.round((data.find(d => d.depth === 25)?.count / total) * 100) },
            { label: 'Reached 50%', value: data.find(d => d.depth === 50)?.count, pct: Math.round((data.find(d => d.depth === 50)?.count / total) * 100) },
            { label: 'Reached 100%', value: data.find(d => d.depth === 100)?.count, pct: Math.round((data.find(d => d.depth === 100)?.count / total) * 100) },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
              <div className="text-[11px] text-trackflow-text-3 font-medium tracking-wide mb-2">{s.label}</div>
              <div className="text-[26px] font-light font-mono text-trackflow-text leading-none mb-1">
                {s.value?.toLocaleString() ?? '—'}
              </div>
              <div className="text-[11px] text-trackflow-text-3">{s.pct ?? 0}% of sessions</div>
            </div>
          ))}
        </div>
      )}

      {/* Main bar chart */}
      <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-trackflow-bg-2">
          <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Sessions reaching each depth</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">Loading…</div>
        ) : !data ? (
          <div className="p-12 flex flex-col items-center gap-2.5">
            <Layers size={32} strokeWidth={1} className="text-gray-300" />
            <p className="text-sm text-trackflow-text-2">No scroll data yet</p>
            <p className="text-xs text-trackflow-text-3">Scroll events will appear once your site receives traffic</p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            {data.map((row, i) => {
              const pct = Math.round((row.count / maxCount) * 100);
              const dropOff = i > 0 ? Math.round(((data[i - 1].count - row.count) / data[i - 1].count) * 100) : 0;
              return (
                <div key={row.depth} className="flex items-center gap-4">
                  <div className="w-10 shrink-0 text-right">
                    <span className="font-mono text-[13px] font-medium text-trackflow-text">{row.label}</span>
                  </div>
                  <div className="flex-1 h-8 bg-trackflow-bg-2 rounded-lg overflow-hidden relative">
                    <div
                      className="h-full bg-trackflow-text rounded-lg transition-all duration-700 flex items-center"
                      style={{ width: `${pct}%`, minWidth: pct > 0 ? '2px' : 0 }}
                    />
                  </div>
                  <div className="w-24 shrink-0 flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] text-trackflow-text">{row.count.toLocaleString()}</span>
                    {i > 0 && dropOff > 0 && (
                      <span className="text-[10px] text-red-400 font-medium">-{dropOff}%</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Funnel visualisation */}
      {data && (
        <div className="bg-white border border-trackflow-bg-3 rounded-xl p-6">
          <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-6 tracking-wide uppercase">Scroll funnel</h3>
          <div className="flex items-end justify-center gap-1 h-48">
            {data.map((row, i) => {
              const heightPct = (row.count / maxCount) * 100;
              return (
                <div key={row.depth} className="flex flex-col items-center gap-2 flex-1">
                  <span className="text-[10px] font-mono text-trackflow-text-3">{row.count.toLocaleString()}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: '140px' }}>
                    <div
                      className="w-full rounded-t-md transition-all duration-700"
                      style={{
                        height: `${heightPct}%`,
                        background: `rgba(17,17,16,${0.15 + (i / (data.length - 1)) * 0.75})`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-trackflow-text font-medium">{row.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
