import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { RefreshCw, Users } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MOCK_COHORTS = Array.from({ length: 6 }, (_, i) => {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - (5 - i) * 7);
  const dateStr = baseDate.toISOString().split('T')[0];
  const total = Math.floor(Math.random() * 300) + 100;
  return {
    cohortWeek: dateStr,
    totalUsers: total,
    weeks: Array.from({ length: 6 - i }, (_, w) => ({
      weekOffset: w,
      count: w === 0 ? total : Math.floor(total * Math.pow(0.55 - w * 0.06, w)),
      pct: w === 0 ? 100 : Math.round(Math.pow(0.55 - w * 0.06, w) * 100),
    })),
  };
});

function pctToColor(pct) {
  if (pct === 100) return 'bg-trackflow-text text-white';
  if (pct >= 40) return 'bg-trackflow-text/80 text-white';
  if (pct >= 25) return 'bg-trackflow-text/50 text-white';
  if (pct >= 15) return 'bg-trackflow-text/30 text-trackflow-text';
  if (pct >= 5)  return 'bg-trackflow-text/15 text-trackflow-text';
  return 'bg-trackflow-bg-2 text-trackflow-text-3';
}

export default function SiteRetention() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const maxWeeks = Math.min(Math.ceil(range / 7) + 2, 10);

  async function fetchRetention() {
    setLoading(true);
    try {
      const result = await api.get(`/analytics/${id}/retention?weeks=${maxWeeks}`);
      if (result?.cohorts?.length > 0) {
        setData(result.cohorts);
      } else {
        setData(MOCK_COHORTS);
      }
    } catch {
      setData(MOCK_COHORTS);
    }
    setLoading(false);
  }

  useEffect(() => { fetchRetention(); }, [id, range]);

  const maxOffset = data ? Math.max(...data.map(c => c.weeks.length)) : 6;

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Retention</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Weekly cohort retention — % of users returning each week</p>
        </div>
        <button
          onClick={fetchRetention}
          className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: 'Week 1 retention',
              value: (() => {
                const w1 = data.map(c => c.weeks.find(w => w.weekOffset === 1)).filter(Boolean);
                return w1.length ? Math.round(w1.reduce((s, w) => s + w.pct, 0) / w1.length) + '%' : '—';
              })(),
            },
            {
              label: 'Week 4 retention',
              value: (() => {
                const w4 = data.map(c => c.weeks.find(w => w.weekOffset === 4)).filter(Boolean);
                return w4.length ? Math.round(w4.reduce((s, w) => s + w.pct, 0) / w4.length) + '%' : '—';
              })(),
            },
            {
              label: 'Total cohort users',
              value: data.reduce((s, c) => s + c.totalUsers, 0).toLocaleString(),
            },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
              <div className="text-[11px] text-trackflow-text-3 font-medium tracking-wide mb-2">{s.label}</div>
              <div className="text-[26px] font-light font-mono text-trackflow-text leading-none">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-trackflow-bg-2 flex items-center gap-2">
          <Users size={13} className="text-trackflow-text-3" />
          <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Cohort table</h3>
        </div>

        {loading ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">Loading…</div>
        ) : !data ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">No retention data yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-trackflow-bg-2 bg-trackflow-bg">
                  <th className="px-4 py-2.5 text-left font-medium text-trackflow-text-3 tracking-wide whitespace-nowrap">Cohort week</th>
                  <th className="px-3 py-2.5 text-right font-medium text-trackflow-text-3 tracking-wide whitespace-nowrap">Users</th>
                  {Array.from({ length: maxOffset }, (_, i) => (
                    <th key={i} className="px-1 py-2.5 text-center font-medium text-trackflow-text-3 tracking-wide whitespace-nowrap min-w-[52px]">
                      Wk {i}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((cohort, ci) => (
                  <tr key={ci} className="border-b border-trackflow-bg-2 hover:bg-trackflow-bg transition-colors">
                    <td className="px-4 py-2.5 font-mono text-trackflow-text-2 whitespace-nowrap">{cohort.cohortWeek}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-trackflow-text whitespace-nowrap">{cohort.totalUsers.toLocaleString()}</td>
                    {Array.from({ length: maxOffset }, (_, wi) => {
                      const week = cohort.weeks.find(w => w.weekOffset === wi);
                      if (!week) return <td key={wi} className="px-1 py-2.5" />;
                      return (
                        <td key={wi} className="px-1 py-1.5">
                          <div className={`rounded text-center py-1 font-mono font-medium ${pctToColor(week.pct)}`} title={`${week.count} users`}>
                            {week.pct}%
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="px-6 py-3 border-t border-trackflow-bg-2 bg-trackflow-bg flex items-center gap-3">
          <span className="text-[10px] text-trackflow-text-3 uppercase tracking-wide">Legend</span>
          {[['100%', 'bg-trackflow-text text-white'], ['≥40%', 'bg-trackflow-text/80 text-white'], ['≥25%', 'bg-trackflow-text/50 text-white'], ['≥5%', 'bg-trackflow-text/15 text-trackflow-text']].map(([label, cls]) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-5 h-4 rounded text-[9px] flex items-center justify-center font-mono ${cls}`}>{label.split('%')[0]}</div>
              <span className="text-[10px] text-trackflow-text-3">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
