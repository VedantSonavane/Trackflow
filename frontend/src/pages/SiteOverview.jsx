import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Eye, MousePointer, Users, AlertTriangle, Clock, Zap, CheckCircle2, XCircle, Code2, Wifi, TrendingUp, TrendingDown, Gauge, Activity } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';
// Import your branding image - update path as needed
import brandingImage from "./sample.jpg"; 

// ── Mock fallback ─────────────────────────────────────────────────────────────
const MOCK_COUNTRIES = [
  { country: 'United States', sessions: 1240 },
  { country: 'United Kingdom', sessions: 430 },
  { country: 'India', sessions: 380 },
  { country: 'Germany', sessions: 210 },
  { country: 'Canada', sessions: 175 },
];
const MOCK_DEVICES = [
  { name: 'Desktop', value: 58 },
  { name: 'Mobile', value: 34 },
  { name: 'Tablet', value: 8 },
];
const MOCK_BROWSERS = [
  { browser: 'Chrome', pct: 62 },
  { browser: 'Safari', pct: 22 },
  { browser: 'Firefox', pct: 9 },
  { browser: 'Edge', pct: 5 },
  { browser: 'Other', pct: 2 },
];
const MOCK_SOURCES = [
  { source: 'Direct', sessions: 520, pct: 38 },
  { source: 'Organic search', sessions: 410, pct: 30 },
  { source: 'Social', sessions: 220, pct: 16 },
  { source: 'Email', sessions: 130, pct: 10 },
  { source: 'Referral', sessions: 80, pct: 6 },
];
const DEVICE_COLORS = ['#111110', '#6b7280', '#d1d5db'];

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ value }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full ${up ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
      {up ? '↑' : '↓'} {Math.abs(value)}%
    </span>
  );
}

// ── Insight card ──────────────────────────────────────────────────────────────
function InsightCard({ insight }) {
  const styles = {
    positive: { bg: 'bg-green-50 border-green-200', icon: TrendingUp, iconColor: 'text-green-500', titleColor: 'text-green-700' },
    warning: { bg: 'bg-amber-50 border-amber-200', icon: TrendingDown, iconColor: 'text-amber-500', titleColor: 'text-amber-700' },
    alert: { bg: 'bg-red-50 border-red-200', icon: AlertTriangle, iconColor: 'text-red-500', titleColor: 'text-red-700' },
    info: { bg: 'bg-blue-50 border-blue-200', icon: Activity, iconColor: 'text-blue-500', titleColor: 'text-blue-700' },
  };
  const s = styles[insight.type] || styles.info;
  const Icon = s.icon;
  return (
    <div className={`rounded-xl border p-3.5 flex items-start gap-2.5 ${s.bg}`}>
      <Icon size={14} className={`${s.iconColor} shrink-0 mt-0.5`} />
      <div>
        <p className={`text-[12px] font-semibold ${s.titleColor}`}>{insight.title}</p>
        <p className="text-[11px] text-trackflow-text-3 mt-0.5">{insight.detail}</p>
      </div>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────
function MetricCard({ label, value, icon: Icon, delta }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4 flex flex-col gap-2.5">
      <div className="flex justify-between items-center">
        <span className="text-[11px] text-trackflow-text-3 font-medium tracking-wide">{label}</span>
        <Icon size={13} strokeWidth={1.5} className="text-trackflow-text-3" />
      </div>
      <div className="text-[26px] font-light text-trackflow-text tracking-tight font-mono leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value ?? '—'}
      </div>
      <Delta value={delta} />
    </div>
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
          api.get(`/analytics/${siteId}/realtime`).then(data => setCount(data.activeUsers ?? 0)).catch(() => setCount(0));
          setTimeout(connect, 10000);
        };
      } catch { setCount(0); }
    }
    connect();
    return () => { if (es) es.close(); };
  }, [siteId]);

  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4 flex items-center gap-4 min-w-[160px]">
      <div className="relative">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${count > 0 ? 'bg-green-50' : 'bg-trackflow-bg-2'}`}>
          <Wifi size={15} strokeWidth={1.5} className={count > 0 ? 'text-green-500' : 'text-trackflow-text-3'} />
        </div>
        {count > 0 && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
      </div>
      <div>
        <div className={`text-[28px] font-light font-mono leading-none tracking-tight transition-all ${pulse ? 'opacity-60 scale-95' : 'opacity-100 scale-100'} ${count > 0 ? 'text-green-600' : 'text-trackflow-text-3'}`} style={{ display: 'inline-block' }}>
          {count ?? '—'}
        </div>
        <div className="text-[11px] text-trackflow-text-3 mt-0.5">active now</div>
      </div>
    </div>
  );
}

// ── Country chart ─────────────────────────────────────────────────────────────
function CountryChart({ data }) {
  const max = Math.max(...data.map(d => d.sessions));
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
      <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Top countries</h3>
      <div className="flex flex-col gap-2.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-trackflow-text-2 w-28 shrink-0 truncate">{d.country}</span>
            <div className="flex-1 h-1.5 bg-trackflow-bg-2 rounded-full overflow-hidden">
              <div className="h-full bg-trackflow-text rounded-full transition-all duration-700" style={{ width: `${(d.sessions / max) * 100}%` }} />
            </div>
            <span className="text-[11px] font-mono text-trackflow-text-2 w-12 text-right shrink-0">{d.sessions.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeviceChart({ data }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
      <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Devices</h3>
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
                <span className="text-[11px] text-trackflow-text-2">{d.name}</span>
              </div>
              <span className="font-mono text-[11px] text-trackflow-text">{d.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function BrowserList({ data }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
      <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Browsers</h3>
      <div className="flex flex-col gap-0.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-trackflow-bg-2 last:border-0">
            <span className="text-xs text-trackflow-text-2">{d.browser}</span>
            <div className="flex items-center gap-3">
              <div className="w-20 h-1 bg-trackflow-bg-2 rounded-full overflow-hidden">
                <div className="h-full bg-trackflow-text-3 rounded-full" style={{ width: `${d.pct}%` }} />
              </div>
              <span className="font-mono text-[11px] text-trackflow-text w-8 text-right">{d.pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SourcesTable({ data }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-trackflow-bg-2">
        <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Traffic sources</h3>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-trackflow-bg">
            <th className="px-5 py-2 text-left text-[10px] font-medium text-trackflow-text-3 tracking-wide">Source</th>
            <th className="px-5 py-2 text-right text-[10px] font-medium text-trackflow-text-3 tracking-wide">Sessions</th>
            <th className="px-5 py-2 text-right text-[10px] font-medium text-trackflow-text-3 tracking-wide">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} className="border-t border-trackflow-bg-2 hover:bg-trackflow-bg transition-colors">
              <td className="px-5 py-2.5 text-xs text-trackflow-text-2">{row.source}</td>
              <td className="px-5 py-2.5 text-right font-mono text-xs text-trackflow-text">{row.sessions.toLocaleString()}</td>
              <td className="px-5 py-2.5 text-right">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-12 h-1 bg-trackflow-bg-2 rounded-full overflow-hidden">
                    <div className="h-full bg-trackflow-text rounded-full" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="font-mono text-[11px] text-trackflow-text-2 w-8 text-right">{row.pct}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  const [loading, setLoading] = useState(true);
  const [scriptStatus, setScriptStatus] = useState('unknown');
  const [lastEventTime, setLastEventTime] = useState(null);

  useEffect(() => {
    api.get(`/sites/${id}`).then(setSite).catch(() => {});
    fetchStats();
    checkScriptStatus();
    fetchInsights();
  }, [id, range]);

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

  if (loading && !stats) return <div className="p-10 text-gray-500 text-sm">Loading…</div>;

  const metrics = stats ? [
    { label: 'Pageviews', value: stats.pageviews, icon: Eye, delta: calcDelta(stats.pageviews, prevStats?.pageviews) },
    { label: 'Sessions', value: stats.sessions, icon: Users, delta: calcDelta(stats.sessions, prevStats?.sessions) },
    { label: 'Bounce rate', value: stats.bounceRate != null ? `${stats.bounceRate}%` : '—', icon: TrendingDown, delta: null },
    { label: 'Avg session', value: stats.avgSessionDuration ? `${Math.round(stats.avgSessionDuration / 60)}m ${stats.avgSessionDuration % 60}s` : '—', icon: Clock, delta: null },
    { label: 'Rage clicks', value: stats.rageClicks, icon: AlertTriangle, delta: calcDelta(stats.rageClicks, prevStats?.rageClicks) },
    { label: 'Errors', value: stats.errors, icon: Zap, delta: calcDelta(stats.errors, prevStats?.errors) },
  ] : [];

  const isScriptActive = scriptStatus === 'installed';
  const StatusIcon = isScriptActive ? CheckCircle2 : XCircle;

  return (
    <div className="flex-1 flex flex-col bg-trackflow-bg"
   >
     

      <div className="p-6 overflow-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-trackflow-text">{site?.name || 'Overview'}</h1>
            <p className="text-sm text-trackflow-text-3 mt-0.5">{site?.domain}</p>
          </div>
          <div className="flex items-center gap-3">
            <ActiveUsersCard siteId={id} />
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${isScriptActive ? 'text-green-600 border-green-200 bg-green-50' : 'text-red-500 border-red-200 bg-red-50'}`}>
              <StatusIcon size={13} />
              <span>{isScriptActive ? 'Script active' : 'No script'}</span>
              {lastEventTime && (
                <span className="text-[10px] text-gray-400 ml-1 border-l border-gray-200 pl-2">{lastEventTime.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>

        {/* Script not installed */}
        {scriptStatus === 'not_installed' && (
          <div className="flex gap-3 p-4 bg-red-50 border border-red-200 rounded-xl mb-5 items-start">
            <Code2 size={18} className="text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-red-600 mb-1">Tracking script not detected</p>
              <p className="text-xs text-red-800 mb-2">Add this to your site's &lt;head&gt;:</p>
              <code className="block p-2.5 bg-white border border-red-200 rounded-lg text-[11px] font-mono text-gray-600 overflow-x-auto">
                &lt;script defer src="http://localhost:3251/track.js?k={site?.api_key}"&gt;&lt;/script&gt;
              </code>
              <p className="text-[10px] text-red-700 mt-2 italic">💡 For production: Replace localhost:3251 with your backend URL (e.g., https://api.yourdomain.com)</p>
            </div>
          </div>
        )}

        {stats && (
          <>
            {/* Insights */}
            {insights.length > 0 && (
              <div className="grid grid-cols-2 gap-3 mb-5">
                {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
              </div>
            )}

            {/* Metric cards */}
            <div className="grid grid-cols-6 gap-3 mb-5">
              {metrics.map(m => <MetricCard key={m.label} {...m} />)}
            </div>

            {/* Web vitals row */}
            {(stats.avgLCP || stats.avgCLS != null || stats.avgLoadTime) && (
              <div className="grid grid-cols-3 gap-3 mb-5">
                {stats.avgLoadTime > 0 && (
                  <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-trackflow-text-3 font-medium tracking-wide">Avg load time</span>
                      <Gauge size={13} strokeWidth={1.5} className="text-trackflow-text-3" />
                    </div>
                    <div className="font-mono text-[22px] font-light text-trackflow-text">{stats.avgLoadTime}ms</div>
                    <div className={`text-[10px] mt-1 ${stats.avgLoadTime < 2000 ? 'text-green-500' : stats.avgLoadTime < 4000 ? 'text-amber-500' : 'text-red-500'}`}>
                      {stats.avgLoadTime < 2000 ? 'Good' : stats.avgLoadTime < 4000 ? 'Needs improvement' : 'Poor'}
                    </div>
                  </div>
                )}
                {stats.avgLCP > 0 && (
                  <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-trackflow-text-3 font-medium tracking-wide">LCP (Largest Contentful Paint)</span>
                    </div>
                    <div className="font-mono text-[22px] font-light text-trackflow-text">{stats.avgLCP}ms</div>
                    <div className={`text-[10px] mt-1 ${stats.avgLCP < 2500 ? 'text-green-500' : stats.avgLCP < 4000 ? 'text-amber-500' : 'text-red-500'}`}>
                      {stats.avgLCP < 2500 ? 'Good' : stats.avgLCP < 4000 ? 'Needs improvement' : 'Poor'}
                    </div>
                  </div>
                )}
                {stats.avgCLS != null && (
                  <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] text-trackflow-text-3 font-medium tracking-wide">CLS (Cumulative Layout Shift)</span>
                    </div>
                    <div className="font-mono text-[22px] font-light text-trackflow-text">{stats.avgCLS}</div>
                    <div className={`text-[10px] mt-1 ${stats.avgCLS < 0.1 ? 'text-green-500' : stats.avgCLS < 0.25 ? 'text-amber-500' : 'text-red-500'}`}>
                      {stats.avgCLS < 0.1 ? 'Good' : stats.avgCLS < 0.25 ? 'Needs improvement' : 'Poor'}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Time-series */}
            {stats.byDay?.length > 0 && (
              <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5 pb-3.5 mb-5">
                <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Pageviews over time</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={stats.byDay} margin={{ top: 5, right: 0, left: -24, bottom: 0 }}>
                    <defs>
                      <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#111110" stopOpacity={0.08} />
                        <stop offset="95%" stopColor="#111110" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e8e8e4', borderRadius: 8, boxShadow: 'none' }} />
                    <Area type="monotone" dataKey="count" stroke="#111110" strokeWidth={1.5} fill="url(#pv)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Audience row */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <CountryChart data={MOCK_COUNTRIES} />
              <DeviceChart data={MOCK_DEVICES} />
              <BrowserList data={MOCK_BROWSERS} />
            </div>

            {/* Bottom row */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              {stats.topPages?.length > 0 && (
                <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
                  <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Top pages</h3>
                  <div className="flex flex-col">
                    {stats.topPages.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-trackflow-bg-2 last:border-0">
                        <span className="text-xs text-trackflow-text-2 truncate max-w-[160px]" title={p.url}>{p.url?.replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
                        <span className="text-xs font-medium text-trackflow-text font-mono shrink-0">{p.views.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {stats.topReferrers?.length > 0 && (
                <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
                  <h3 className="text-[11px] font-medium text-trackflow-text-2 mb-4 tracking-wide uppercase">Top referrers</h3>
                  <div className="flex flex-col">
                    {stats.topReferrers.map((r, i) => (
                      <div key={i} className="flex justify-between items-center py-1.5 border-b border-trackflow-bg-2 last:border-0">
                        <span className="text-xs text-trackflow-text-2">{r.referrer || 'Direct'}</span>
                        <span className="text-xs font-medium text-trackflow-text font-mono shrink-0">{r.count.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <SourcesTable data={MOCK_SOURCES} />
            </div>
          </>
        )}
      </div>
    </div>
  );
} 
