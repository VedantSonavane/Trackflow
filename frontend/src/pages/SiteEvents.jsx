import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Download, RefreshCw, Filter } from 'lucide-react';

const EVENT_COLORS = {
  pageview: '#2563eb',
  click: '#111110',
  rage_click: '#dc2626',
  dead_click: '#f59e0b',
  scroll: '#6b7280',
  timing: '#8b5cf6',
  error: '#ef4444',
  heartbeat: '#10b981',
  hesitation: '#f97316',
  outbound: '#0891b2',
  form_submit: '#059669',
  form_field: '#6d28d9',
  swipe: '#0284c7',
  navigation: '#64748b',
  custom: '#7c3aed',
  search: '#1d4ed8',
  visibility: '#94a3b8',
  resource_error: '#b91c1c',
  mousemove: '#d1d5db',
};

const EVENT_TYPES = ['all', 'pageview', 'click', 'rage_click', 'dead_click', 'scroll', 'error', 'heartbeat', 'hesitation', 'form_submit', 'outbound', 'timing', 'search', 'swipe', 'custom'];

export default function SiteEvents() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const fetchEvents = useCallback(async (reset = false) => {
    setLoading(true);
    const o = reset ? 0 : offset;
    try {
      const params = new URLSearchParams({ limit: 50, offset: o });
      if (filter !== 'all') params.set('type', filter);
      const data = await api.get(`/analytics/${id}/events?${params}`);
      setEvents(prev => reset ? data : [...prev, ...data]);
      if (reset) setOffset(50);
      else setOffset(o + 50);
    } catch {}
    setLoading(false);
  }, [id, filter, offset]);

  useEffect(() => { fetchEvents(true); }, [id, filter]);

  function formatTs(ts) {
    return new Date(ts * 1000).toLocaleString('en-IN', { hour12: false, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  async function exportData() {
    window.open(`/analytics/${id}/export`, '_blank');
  }

  return (
    <div className="p-6 flex-1 overflow-auto  ">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Events</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Live event feed from your site</p>
        </div>
        <div className="flex gap-2 items-center">
          <button 
            className="bg-white border border-trackflow-bg-3 rounded-md p-1.5 cursor-pointer flex items-center text-trackflow-text-2"
            onClick={() => fetchEvents(true)} 
            title="Refresh"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button 
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-trackflow-bg-3 rounded-md text-xs cursor-pointer text-trackflow-text-2 font-sans"
            onClick={exportData}
          >
            <Download size={13} />
            Export JSON
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2.5 mb-4 overflow-x-auto pb-1">
        <Filter size={12} className="text-gray-500 shrink-0" />
        <div className="flex gap-1 flex-wrap">
          {EVENT_TYPES.map(t => (
            <button 
              key={t} 
              className={`px-2.5 py-1 rounded text-[11px] cursor-pointer font-mono whitespace-nowrap transition-colors ${filter === t ? 'bg-trackflow-text text-white border border-trackflow-text' : 'bg-trackflow-bg-2 text-trackflow-text-2'}`}
              onClick={() => setFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white border border-trackflow-bg-3 rounded-[10px] overflow-hidden">
        {events.length === 0 && !loading ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">No events found</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide bg-trackflow-bg border-b border-trackflow-bg-3 whitespace-nowrap">Time</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide bg-trackflow-bg border-b border-trackflow-bg-3 whitespace-nowrap">Type</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide bg-trackflow-bg border-b border-trackflow-bg-3 whitespace-nowrap">URL</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide bg-trackflow-bg border-b border-trackflow-bg-3 whitespace-nowrap">Session</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide bg-trackflow-bg border-b border-trackflow-bg-3 whitespace-nowrap">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map(evt => (
                <React.Fragment key={evt.id}>
                  <tr 
                    className="border-b border-trackflow-bg-2 cursor-pointer transition-colors hover:bg-trackflow-bg"
                    onClick={() => setExpanded(expanded === evt.id ? null : evt.id)}
                  >
                    <td className="px-4 py-2 align-middle">
                      <span className="font-mono text-[11px] text-trackflow-text-3 whitespace-nowrap">{formatTs(evt.ts)}</span>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <span 
                        className="font-mono text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap"
                        style={{ 
                          background: (EVENT_COLORS[evt.type] || '#888') + '18', 
                          color: EVENT_COLORS[evt.type] || '#888' 
                        }}
                      >
                        {evt.type}
                      </span>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <span className="text-[11px] text-trackflow-text-2 font-mono" title={evt.url}>{evt.url?.replace(/^https?:\/\/[^/]+/, '').slice(0, 40) || '—'}</span>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <span className="font-mono text-[11px] text-trackflow-text-3">{evt.session_id?.slice(0, 8) || '—'}</span>
                    </td>
                    <td className="px-4 py-2 align-middle">
                      <span className="text-[11px] text-trackflow-text-3 font-mono">{Object.keys(evt.payload || {}).slice(0, 3).join(', ') || '{}'}</span>
                    </td>
                  </tr>
                  {expanded === evt.id && (
                    <tr>
                      <td colSpan={5} className="px-4 pb-3 bg-trackflow-bg">
                        <pre className="font-mono text-[11px] text-trackflow-text-2 leading-relaxed p-3 bg-trackflow-bg-2 rounded-md overflow-auto max-h-[300px]">{JSON.stringify(evt.payload, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}

        {loading && <div className="p-4 text-center text-trackflow-text-3 text-xs">Loading…</div>}

        {!loading && events.length > 0 && events.length % 50 === 0 && (
          <div className="p-4 flex justify-center">
            <button 
              className="px-5 py-1.5 bg-trackflow-bg-2 border-none rounded-md text-xs cursor-pointer font-sans text-trackflow-text-2"
              onClick={() => fetchEvents(false)}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
