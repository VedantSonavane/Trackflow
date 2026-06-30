import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import {
  Eye, MousePointer, Users, AlertTriangle, Clock, Zap,
  CheckCircle2, XCircle, Code2, Wifi, TrendingUp, TrendingDown,
  Gauge, Activity, ArrowUpRight, Radio,
} from 'lucide-react';
import { Squircle } from '@squircle-js/react';
import { useFilters } from './DashboardLayout.jsx';

const DEVICE_COLORS = ['#111110', '#6366f1', '#d1d5db'];

// ── Shared primitives ─────────────────────────────────────────────────────────
function Pill({ label, cls }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap ${cls || 'bg-gray-100 text-gray-600'}`}>
      {label}
    </span>
  );
}

function Delta({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
      <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 whitespace-nowrap ${up ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
        {up ? '↑' : '↓'} {Math.abs(value)}%
      </span>
    </Squircle>
  );
}

// ── Stat card — same pattern as MissionControl ────────────────────────────────
function StatCard({ label, sub, value, bg, icon: Icon }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild className="flex-1 min-w-[130px]">
      <div className={`border border-white p-4 flex flex-col justify-between min-h-[100px] ${bg}`}>
        <div>
          <h4 className="text-sm font-bold text-gray-900 m-0">{label}</h4>
          <p className="text-[11px] text-gray-500 mt-0.5 mb-0">{sub}</p>
        </div>
        <div className="flex items-center justify-between mt-3">
          <span className="text-2xl font-bold text-gray-900">{value ?? '—'}</span>
          <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
            <div className="w-8 h-8 bg-gray-900 text-white flex items-center justify-center flex-shrink-0">
              {Icon ? <Icon size={13} /> : <ArrowUpRight size={14} />}
            </div>
          </Squircle>
        </div>
      </div>
    </Squircle>
  );
}

// ── Active users ──────────────────────────────────────────────────────────────
function ActiveUsersCard({ siteId }) {
  const [count, setCount] = useState(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let es;
    function connect() {
      try {
        const token = localStorage.getItem('tf_token');
        es = new EventSource(`/analytics/${siteId}/realtime/stream${token ? `?token=${token}` : ''}`);
        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setCount(data.activeUsers ?? data.active_users ?? 0);
            setPulse(true);
            setTimeout(() => setPulse(false), 600);
          } catch {}
        };
        es.onerror = () => {
          es.close();
          api.get(`/analytics/${siteId}/realtime`).then(d => setCount(d.activeUsers ?? 0)).catch(() => setCount(0));
          setTimeout(connect, 10000);
        };
      } catch { setCount(0); }
    }
    connect();
    return () => { if (es) es.close(); };
  }, [siteId]);

  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-4 flex items-center gap-4 min-w-[160px]">
        <div className="relative">
          <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
            <div className={`w-9 h-9 flex items-center justify-center transition-all ${count > 0 ? 'bg-emerald-50' : 'bg-gray-100'}`}>
              <Wifi size={15} strokeWidth={1.5} className={count > 0 ? 'text-emerald-500' : 'text-gray-400'} />
            </div>
          </Squircle>
          {count > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />}
        </div>
        <div>
          <div className={`text-[28px] font-bold font-mono leading-none tracking-tight transition-all ${pulse ? 'opacity-60 scale-95' : 'opacity-100 scale-100'} ${count > 0 ? 'text-emerald-600' : 'text-gray-400'}`} style={{ display: 'inline-block' }}>
            {count ?? '—'}
          </div>
          <div className="text-[11px] text-gray-400 mt-0.5">active now</div>
        </div>
      </div>
    </Squircle>
  );
}

// ── Script status badge ───────────────────────────────────────────────────────
function ScriptBadge({ status, lastEventTime }) {
  const active = status === 'installed';
  const Icon = active ? CheckCircle2 : XCircle;
  return (
    <Squircle cornerRadius={12} cornerSmoothing={1} asChild>
      <div className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold ${active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
        <Icon size={13} />
        <span>{active ? 'Script active' : 'No script'}</span>
        {lastEventTime && (
          <span className="text-[10px] text-gray-400 ml-1 border-l border-gray-200 pl-2">
            {lastEventTime.toLocaleTimeString()}
          </span>
        )}
      </div>
    </Squircle>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const styles = {
    positive: { bg: 'bg-emerald-50',  dot: 'bg-emerald-400', icon: TrendingUp,   text: 'text-emerald-700' },
    warning:  { bg: 'bg-amber-50',    dot: 'bg-amber-400',   icon: TrendingDown, text: 'text-amber-700'   },
    alert:    { bg: 'bg-red-50',      dot: 'bg-red-400',     icon: AlertTriangle, text: 'text-red-700'    },
    info:     { bg: 'bg-blue-50',     dot: 'bg-blue-400',    icon: Activity,     text: 'text-blue-700'    },
  };
  const s = styles[insight.type] || styles.info;
  const Icon = s.icon;
  return (
    <Squircle cornerRadius={16} cornerSmoothing={1} asChild>
      <div className={`p-3.5 flex items-start gap-2.5 ${s.bg}`}>
        <Icon size={13} className={`${s.text} shrink-0 mt-0.5`} />
        <div>
          <p className={`text-[12px] font-semibold ${s.text}`}>{insight.title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">{insight.detail}</p>
        </div>
      </div>
    </Squircle>
  );
}

// ── Vitals card ───────────────────────────────────────────────────────────────
function VitalCard({ label, value, good, warn }) {
  const status = value < good ? 'Good' : value < warn ? 'Needs improvement' : 'Poor';
  const statusCls = value < good ? 'text-emerald-600' : value < warn ? 'text-amber-600' : 'text-red-600';
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{label}</span>
          <Gauge size={13} strokeWidth={1.5} className="text-gray-300" />
        </div>
        <div className="font-mono text-[26px] font-bold text-gray-900 leading-none">{value}</div>
        <Pill label={status} cls={`${statusCls} bg-opacity-10 ${value < good ? 'bg-emerald-50' : value < warn ? 'bg-amber-50' : 'bg-red-50'}`} />
      </div>
    </Squircle>
  );
}

// ── Country chart ─────────────────────────────────────────────────────────────
function CountryChart({ data }) {
  const max = Math.max(...data.map(d => d.sessions));
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Top Countries</p>
        <div className="flex flex-col gap-2.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-gray-600 w-28 shrink-0 truncate">{d.country}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 rounded-full transition-all duration-700" style={{ width: `${(d.sessions / max) * 100}%` }} />
              </div>
              <span className="text-[11px] font-mono text-gray-700 w-12 text-right shrink-0">{d.sessions.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Squircle>
  );
}

// ── Device donut ──────────────────────────────────────────────────────────────
function DeviceChart({ data }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Devices</p>
        <div className="flex items-center gap-5">
          <PieChart width={90} height={90}>
            <Pie data={data} dataKey="value" cx={45} cy={45} innerRadius={28} outerRadius={42} strokeWidth={0}>
              {data.map((_, i) => <Cell key={i} fill={DEVICE_COLORS[i]} />)}
            </Pie>
          </PieChart>
          <div className="flex flex-col gap-2 flex-1">
            {data.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: DEVICE_COLORS[i] }} />
                  <span className="text-[11px] text-gray-600">{d.name}</span>
                </div>
                <span className="font-mono text-[11px] font-bold text-gray-900">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Squircle>
  );
}

// ── Browser list ──────────────────────────────────────────────────────────────
function BrowserList({ data }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Browsers</p>
        <div className="flex flex-col gap-0.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-600">{d.browser}</span>
              <div className="flex items-center gap-3">
                <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-400 rounded-full" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="font-mono text-[11px] font-bold text-gray-900 w-8 text-right">{d.pct}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Squircle>
  );
}

// ── Sources table ─────────────────────────────────────────────────────────────
function SourcesTable({ data }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild className="overflow-hidden">
      <div className="bg-white">
        <div className="px-5 py-4 border-b border-gray-50">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Traffic Sources</p>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="px-5 py-2 text-left text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Source</th>
              <th className="px-5 py-2 text-right text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Sessions</th>
              <th className="px-5 py-2 text-right text-[10px] font-semibold text-gray-400 tracking-widest uppercase">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-5 py-2.5 text-xs text-gray-700">{row.source}</td>
                <td className="px-5 py-2.5 text-right font-mono text-xs font-bold text-gray-900">{row.sessions.toLocaleString()}</td>
                <td className="px-5 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-1 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="font-mono text-[11px] text-gray-600 w-8 text-right">{row.pct}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Squircle>
  );
}

// ── Script not installed banner ───────────────────────────────────────────────
function ScriptBanner({ apiKey }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="relative bg-gradient-to-br from-indigo-950 via-indigo-800 to-violet-700 p-5 flex items-start gap-4 mb-4">
        <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
          <div className="w-9 h-9 bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Code2 size={15} className="text-white/80" />
          </div>
        </Squircle>
        <div className="flex-1 min-w-0">
          <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/10 text-white/80 px-2.5 py-1 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Tracking script not detected
            </span>
          </Squircle>
          <p className="text-[12px] text-white/70 mb-2">Add this snippet to your site's &lt;head&gt; to start capturing events.</p>
          <Squircle cornerRadius={12} cornerSmoothing={1} asChild>
            <code className="block p-3 bg-white/10 text-[11px] font-mono text-white/90 overflow-x-auto">
              &lt;script defer src="http://localhost:3251/track.js?k={apiKey}"&gt;&lt;/script&gt;
            </code>
          </Squircle>
          <p className="text-[10px] text-white/40 mt-2">For production: replace localhost:3251 with your backend URL.</p>
        </div>
      </div>
    </Squircle>
  );
}

// ── Top pages / referrers panel ───────────────────────────────────────────────
function ListPanel({ title, rows, labelKey, valueKey }) {
  return (
    <Squircle cornerRadius={20} cornerSmoothing={1} asChild>
      <div className="bg-white p-5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-4">{title}</p>
        <div className="flex flex-col">
          {rows.map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-50 last:border-0">
              <span className="text-xs text-gray-600 truncate max-w-[160px]" title={r[labelKey]}>
                {labelKey === 'url' ? (r[labelKey]?.replace(/^https?:\/\/[^/]+/, '') || '/') : (r[labelKey] || 'Direct')}
              </span>
              <span className="text-xs font-bold text-gray-900 font-mono shrink-0">{(r[valueKey] ?? 0).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </Squircle>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SiteOverview() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [site, setSite] = useState(null);
  const [stats, setStats] = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [insights, setInsights] = useState([]);
  const [audience, setAudience] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scriptStatus, setScriptStatus] = useState('unknown');
  const [lastEventTime, setLastEventTime] = useState(null);

  useEffect(() => {
    api.get(`/sites/${id}`).then(setSite).catch(() => {});
    fetchStats();
    checkScriptStatus();
    fetchInsights();
    fetchAudience();
  }, [id, range]);

  async function fetchAudience() {
    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;
      const data = await api.get(`/analytics/${id}/audience?from=${from}&to=${to}`);
      setAudience(data);
    } catch {}
  }

  async function fetchStats() {
    setLoading(true);
    const to = Math.floor(Date.now() / 1000);
    const from = to - range * 86400;
    const prevFrom = from - range * 86400;
    try {
      const [cur, prev] = await Promise.all([
        api.get(`/analytics/${id}/overview?from=${from}&to=${to}`),
        api.get(`/analytics/${id}/overview?from=${prevFrom}&to=${from}`),
      ]);
      setStats(cur);
      setPrevStats(prev);
    } catch {}
    setLoading(false);
  }

  async function fetchInsights() {
    try {
      const result = await api.get(`/analytics/${id}/insights`);
      setInsights(result.insights || []);
    } catch {}
  }

  function calcDelta(cur, prev) {
    if (!prev || prev === 0) return null;
    return Math.round(((cur - prev) / prev) * 100);
  }

  async function checkScriptStatus() {
    try {
      const to = Math.floor(Date.now() / 1000);
      const events = await api.get(`/analytics/${id}/events?limit=1&from=${to - 3600}&to=${to}`);
      if (events?.length > 0) { setScriptStatus('installed'); setLastEventTime(new Date(events[0].ts * 1000)); return; }
      const all = await api.get(`/analytics/${id}/events?limit=1`);
      if (all?.length > 0) { setScriptStatus('installed'); setLastEventTime(new Date(all[0].ts * 1000)); }
      else setScriptStatus('not_installed');
    } catch { setScriptStatus('unknown'); }
  }

  if (loading && !stats) return (
    <div className="p-10 text-gray-400 text-sm flex items-center gap-2">
      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
      Loading…
    </div>
  );

  const fmtDuration = (s) => s ? `${Math.round(s / 60)}m ${s % 60}s` : '—';

  return (
    <div className="flex-1 flex flex-col bg-gray-50 overflow-y-auto p-4 sm:p-6 box-border">

      {/* ── Header ── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">{site?.name || 'Overview'}</h1>
          <p className="text-sm text-gray-400 mt-1 mb-0">{site?.domain}</p>
        </div>
        <div className="flex items-center gap-3">
          <ActiveUsersCard siteId={id} />
          <ScriptBadge status={scriptStatus} lastEventTime={lastEventTime} />
        </div>
      </div>

      {/* ── Script banner ── */}
      {scriptStatus === 'not_installed' && <ScriptBanner apiKey={site?.api_key} />}

      {stats && (
        <>
          {/* ── Insights ── */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
            </div>
          )}

          {/* ── Stat row 1 — primary metrics ── */}
          <div className="flex flex-wrap gap-3 mb-4">
            <StatCard
              label="Pageviews"
              sub={`vs prev ${range}d`}
              value={stats.pageviews?.toLocaleString()}
              bg="bg-blue-50"
              icon={Eye}
            />
            <StatCard
              label="Sessions"
              sub={`vs prev ${range}d`}
              value={stats.sessions?.toLocaleString()}
              bg="bg-violet-50"
              icon={Users}
            />
            <StatCard
              label="Bounce Rate"
              sub="Single-page exits"
              value={stats.bounceRate != null ? `${stats.bounceRate}%` : '—'}
              bg="bg-orange-50"
              icon={TrendingDown}
            />
            <StatCard
              label="Avg Session"
              sub="Time on site"
              value={fmtDuration(stats.avgSessionDuration)}
              bg="bg-emerald-50"
              icon={Clock}
            />
          </div>

          {/* ── Stat row 2 — engagement / errors ── */}
          <div className="flex flex-wrap gap-3 mb-4">
            <StatCard
              label="Rage Clicks"
              sub="Frustration signals"
              value={stats.rageClicks ?? '—'}
              bg="bg-red-50"
              icon={AlertTriangle}
            />
            <StatCard
              label="JS Errors"
              sub="Captured exceptions"
              value={stats.errors ?? '—'}
              bg="bg-amber-50"
              icon={Zap}
            />
            <StatCard
              label="Unique Visitors"
              sub="Distinct user IDs"
              value={stats.uniqueVisitors?.toLocaleString() ?? '—'}
              bg="bg-sky-50"
              icon={Radio}
            />
            <StatCard
              label="Events"
              sub="Total interactions"
              value={stats.totalEvents?.toLocaleString() ?? '—'}
              bg="bg-pink-50"
              icon={Activity}
            />
          </div>

          {/* ── Web vitals ── */}
          {(stats.avgLCP || stats.avgCLS != null || stats.avgLoadTime) && (
            <div className="flex flex-wrap gap-3 mb-4">
              {stats.avgLoadTime > 0 && (
                <VitalCard label="Avg Load Time" value={`${stats.avgLoadTime}ms`} good={2000} warn={4000} />
              )}
              {stats.avgLCP > 0 && (
                <VitalCard label="LCP" value={`${stats.avgLCP}ms`} good={2500} warn={4000} />
              )}
              {stats.avgCLS != null && (
                <VitalCard label="CLS" value={stats.avgCLS} good={0.1} warn={0.25} />
              )}
            </div>
          )}

          {/* ── Timeseries chart ── */}
          {stats.byDay?.length > 0 && (
            <Squircle cornerRadius={20} cornerSmoothing={1} asChild className="mb-4">
              <div className="bg-white p-5 pb-3.5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest m-0">Pageviews over time</p>
                  <Squircle cornerRadius={999} cornerSmoothing={1} asChild>
                    <span className="text-[10px] font-semibold bg-gray-100 text-gray-500 px-3 py-1.5">
                      Last {range}d
                    </span>
                  </Squircle>
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={stats.byDay} margin={{ top: 5, right: 0, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}    />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, border: '1px solid #f3f4f6', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
                    />
                    <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#pvGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Squircle>
          )}

          {/* ── Audience row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <CountryChart data={audience?.countries || []} />
            <DeviceChart data={audience?.devices || []} />
            <BrowserList data={(audience?.browsers || []).map(b => ({ browser: b.name, pct: b.value }))} />
          </div>

          {/* ── Bottom row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {stats.topPages?.length > 0 && (
              <ListPanel title="Top Pages" rows={stats.topPages} labelKey="url" valueKey="views" />
            )}
            {stats.topReferrers?.length > 0 && (
              <ListPanel title="Top Referrers" rows={stats.topReferrers} labelKey="referrer" valueKey="count" />
            )}
          </div>
        </>
      )}
    </div>
  );
}