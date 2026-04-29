import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Terminal, Trash2, Pause, Play, Users } from 'lucide-react';

const EVENT_COLORS = {
  pageview: '#2563eb', click: '#111110', rage_click: '#dc2626',
  dead_click: '#f59e0b', scroll: '#6b7280', error: '#ef4444',
  heartbeat: '#10b981', hesitation: '#f97316', outbound: '#0891b2',
  form_submit: '#059669', timing: '#8b5cf6', custom: '#7c3aed',
  web_vitals: '#0284c7', resource_error: '#b91c1c',
};

const MAX_EVENTS = 300;

function formatNow() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function SessionTimeline({ events, sessionId }) {
  const sessionEvents = events.filter(e => e.session_id === sessionId).slice().reverse();
  return (
    <div className="bg-white/5 rounded-lg p-3 mt-1 mb-2">
      <p className="text-white/40 text-[9px] uppercase tracking-wide mb-2 font-mono">Session {sessionId.slice(0, 8)} · {sessionEvents.length} events</p>
      <div className="flex flex-col gap-1">
        {sessionEvents.slice(0, 20).map((evt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-white/30 font-mono text-[9px] w-14 shrink-0">{evt.receivedAt || '—'}</span>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EVENT_COLORS[evt.type] || '#888' }} />
            <span className="text-white/60 text-[10px] font-mono">{evt.type}</span>
            <span className="text-white/40 text-[10px] truncate">{evt.url?.replace(/^https?:\/\/[^/]+/, '') || '—'}</span>
          </div>
        ))}
        {sessionEvents.length > 20 && <p className="text-white/30 text-[10px] font-mono">+{sessionEvents.length - 20} more</p>}
      </div>
    </div>
  );
}

export default function SiteDebugger() {
  const { id } = useParams();
  const [events, setEvents] = useState([]);
  const [paused, setPaused] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('stream'); // 'stream' | 'sessions'
  const [expandedSession, setExpandedSession] = useState(null);
  const bottomRef = useRef(null);
  const pausedRef = useRef(false);
  const lastFetchedRef = useRef(0);

  pausedRef.current = paused;

  // SSE connection for real-time stream
  useEffect(() => {
    const token = localStorage.getItem('tf_token');
    let pollInterval;
    let lastIds = new Set();

    // Primary: SSE stream
    let es;
    function connectSSE() {
      try {
        es = new EventSource(`/analytics/${id}/realtime/stream${token ? `?token=${token}` : ''}`);
        es.onerror = () => { es.close(); startPolling(); };
      } catch { startPolling(); }
    }

    // Fallback: polling events endpoint
    function startPolling() {
      pollInterval = setInterval(async () => {
        if (pausedRef.current) return;
        try {
          const res = await fetch(`/analytics/${id}/events?limit=10`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) return;
          const data = await res.json();
          setEvents(prev => {
            const existingIds = new Set(prev.map(e => e.id || e.client_id));
            const newEvts = data
              .filter(e => !existingIds.has(e.id || e.client_id))
              .map(e => ({ ...e, receivedAt: formatNow() }));
            if (!newEvts.length) return prev;
            return [...prev, ...newEvts].slice(-MAX_EVENTS);
          });
        } catch {}
      }, 2000);
    }

    connectSSE();
    // Also start polling to fill events regardless of SSE activity data
    startPolling();

    return () => {
      if (es) es.close();
      clearInterval(pollInterval);
    };
  }, [id]);

  useEffect(() => {
    if (!paused) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events, paused]);

  const visible = filter === 'all' ? events : events.filter(e => e.type === filter);
  const types = ['all', ...new Set(events.map(e => e.type))];

  // Sessions grouping
  const sessions = {};
  events.forEach(e => {
    const sid = e.session_id || 'unknown';
    if (!sessions[sid]) sessions[sid] = [];
    sessions[sid].push(e);
  });
  const sessionList = Object.entries(sessions)
    .sort((a, b) => (b[1][b[1].length - 1]?.ts || 0) - (a[1][a[1].length - 1]?.ts || 0))
    .slice(0, 20);

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-5">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text flex items-center gap-2">
            <Terminal size={16} className="text-trackflow-text-3" />
            Event debugger
          </h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Live event stream — updates every 2s</p>
        </div>
        <div className="flex gap-2">
          {/* View mode */}
          <div className="flex gap-0.5 bg-trackflow-bg-2 rounded-md p-0.5">
            <button onClick={() => setViewMode('stream')} className={`px-3 py-1 rounded text-[11px] font-sans cursor-pointer transition-all ${viewMode === 'stream' ? 'bg-white text-trackflow-text font-medium shadow-sm' : 'text-trackflow-text-2'}`}>Stream</button>
            <button onClick={() => setViewMode('sessions')} className={`px-3 py-1 rounded text-[11px] font-sans cursor-pointer transition-all ${viewMode === 'sessions' ? 'bg-white text-trackflow-text font-medium shadow-sm' : 'text-trackflow-text-2'}`}>Sessions</button>
          </div>
          <button
            onClick={() => setPaused(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-sans cursor-pointer transition-colors ${paused ? 'bg-trackflow-text text-white border-trackflow-text' : 'bg-white border-trackflow-bg-3 text-trackflow-text-2'}`}
          >
            {paused ? <><Play size={12} /> Resume</> : <><Pause size={12} /> Pause</>}
          </button>
          <button onClick={() => setEvents([])} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-trackflow-bg-3 rounded-md text-xs cursor-pointer text-trackflow-text-2">
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex gap-1 flex-wrap mb-4">
        {types.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-2.5 py-1 rounded text-[11px] cursor-pointer font-mono whitespace-nowrap transition-colors ${filter === t ? 'bg-trackflow-text text-white' : 'bg-white border border-trackflow-bg-3 text-trackflow-text-2 hover:border-trackflow-border-2'}`}
          >
            {t}
            {t !== 'all' && <span className="ml-1 opacity-60">{events.filter(e => e.type === t).length}</span>}
          </button>
        ))}
      </div>

      {viewMode === 'stream' && (
        <div className="bg-trackflow-text rounded-xl overflow-hidden font-mono text-[11px]" style={{ minHeight: 400, maxHeight: 600 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-yellow-400' : 'bg-green-400'}`} style={{ animation: paused ? 'none' : 'pulse 2s infinite' }} />
            <span className="text-white/50 text-[10px] tracking-wide uppercase">{paused ? 'Paused' : 'Live'} · {visible.length} events</span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 540 }}>
            {visible.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-xs">Waiting for events… Make sure your tracking script is installed.</div>
            ) : (
              <div>
                {visible.map((evt, i) => (
                  <div key={evt.id || i}>
                    <div
                      className="flex items-start gap-3 px-4 py-1.5 cursor-pointer hover:bg-white/5 transition-colors"
                      onClick={() => setExpanded(expanded === (evt.id || i) ? null : (evt.id || i))}
                    >
                      <span className="text-white/30 shrink-0 w-16">{evt.receivedAt || '—'}</span>
                      <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: (EVENT_COLORS[evt.type] || '#888') + '30', color: EVENT_COLORS[evt.type] || '#aaa' }}>{evt.type}</span>
                      <span className="text-white/60 flex-1 truncate">{evt.url?.replace(/^https?:\/\/[^/]+/, '') || '—'}</span>
                      <span className="text-white/30 shrink-0 text-[10px]">{evt.session_id?.slice(0, 6) || '—'}</span>
                    </div>
                    {expanded === (evt.id || i) && (
                      <div className="mx-4 mb-1 bg-white/5 rounded px-3 py-2">
                        <pre className="text-white/70 text-[10px] leading-relaxed overflow-auto max-h-40">{JSON.stringify(evt.payload || {}, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {viewMode === 'sessions' && (
        <div className="bg-trackflow-text rounded-xl overflow-hidden font-mono text-[11px]" style={{ minHeight: 400, maxHeight: 600 }}>
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
            <Users size={12} className="text-white/50" />
            <span className="text-white/50 text-[10px] tracking-wide uppercase">{sessionList.length} sessions · {events.length} total events</span>
          </div>
          <div className="overflow-y-auto p-2" style={{ maxHeight: 540 }}>
            {sessionList.length === 0 ? (
              <div className="p-8 text-center text-white/30 text-xs">No sessions yet</div>
            ) : (
              sessionList.map(([sid, sevents]) => (
                <div key={sid} className="mb-1">
                  <div
                    className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setExpandedSession(expandedSession === sid ? null : sid)}
                  >
                    <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-white/60 font-mono text-[10px] w-20 shrink-0">{sid.slice(0, 8)}</span>
                    <span className="text-white/40 text-[10px] flex-1">{sevents[sevents.length - 1]?.url?.replace(/^https?:\/\/[^/]+/, '') || '—'}</span>
                    <span className="text-white/30 text-[10px] shrink-0">{sevents.length} events</span>
                  </div>
                  {expandedSession === sid && <SessionTimeline events={events} sessionId={sid} />}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`}</style>
    </div>
  );
}