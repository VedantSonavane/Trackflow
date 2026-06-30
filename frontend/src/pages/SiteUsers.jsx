import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Users, X, Clock, Globe, Monitor, ChevronRight } from 'lucide-react';

const EVENT_COLORS = {
  pageview:'#2563eb', click:'#111110', rage_click:'#dc2626',
  error:'#ef4444', scroll:'#6b7280', heartbeat:'#10b981', custom:'#7c3aed',
};

function formatTs(ts) {
  return new Date(ts * 1000).toLocaleString('en-IN', { hour12:false, month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
}

function TraitBadge({ k, v }) {
  return (
    <span className="inline-flex gap-1 text-[10px] bg-trackflow-bg-2 text-trackflow-text-2 px-2 py-0.5 rounded font-mono">
      <span className="text-trackflow-text-3">{k}:</span>{String(v)}
    </span>
  );
}

function UserDrawer({ hash, siteId, onClose }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/analytics/${siteId}/users/${hash}`).then(setData).catch(() => {});
  }, [hash, siteId]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-[440px] bg-white h-full shadow-xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-trackflow-bg-3">
          <div>
            <p className="text-[13px] font-medium text-trackflow-text font-mono">{hash}</p>
            {data?.profile?.user_id && (
              <p className="text-[11px] text-trackflow-text-3 mt-0.5">ID: {data.profile.user_id}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 text-trackflow-text-3 hover:text-trackflow-text">
            <X size={15} />
          </button>
        </div>

        {!data ? (
          <div className="flex-1 flex items-center justify-center text-trackflow-text-3 text-sm">Loading…</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Traits */}
            {data.profile?.traits && Object.keys(data.profile.traits).length > 0 && (
              <div className="px-5 py-4 border-b border-trackflow-bg-2">
                <p className="text-[10px] text-trackflow-text-3 uppercase tracking-wide mb-2">Traits</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(data.profile.traits).map(([k,v]) => <TraitBadge key={k} k={k} v={v} />)}
                </div>
              </div>
            )}

            {/* Sessions */}
            {data.sessions?.length > 0 && (
              <div className="px-5 py-4 border-b border-trackflow-bg-2">
                <p className="text-[10px] text-trackflow-text-3 uppercase tracking-wide mb-3">Sessions ({data.sessions.length})</p>
                <div className="flex flex-col gap-2">
                  {data.sessions.map((s, i) => (
                    <div key={i} className="bg-trackflow-bg rounded-lg px-3 py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-trackflow-text font-mono truncate">{s.entry_url?.replace(/^https?:\/\/[^/]+/,'') || '/'}</p>
                        <p className="text-[10px] text-trackflow-text-3 mt-0.5">{formatTs(s.started_at)}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 text-[10px] text-trackflow-text-3">
                        <span>{s.page_count || 0}p</span>
                        {s.duration_s > 0 && <span>{Math.round(s.duration_s/60)}m</span>}
                        {s.device_type && <Monitor size={11} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event timeline */}
            <div className="px-5 py-4">
              <p className="text-[10px] text-trackflow-text-3 uppercase tracking-wide mb-3">Event timeline ({data.events?.length || 0})</p>
              <div className="flex flex-col gap-1">
                {(data.events || []).map((e, i) => (
                  <div key={i} className="flex items-center gap-2.5 py-1.5 border-b border-trackflow-bg-2 last:border-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: EVENT_COLORS[e.type] || '#888' }} />
                    <span className="font-mono text-[10px] text-trackflow-text-3 w-14 shrink-0">{formatTs(e.ts)}</span>
                    <span className="text-[11px] font-mono" style={{ color: EVENT_COLORS[e.type] || '#888' }}>{e.type}</span>
                    <span className="text-[10px] text-trackflow-text-3 truncate flex-1">{e.url?.replace(/^https?:\/\/[^/]+/,'') || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SiteUsers() {
  const { id } = useParams();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedHash, setSelectedHash] = useState(null);

  const fetchUsers = useCallback(async (reset = false) => {
    setLoading(true);
    const o = reset ? 0 : offset;
    try {
      const data = await api.get(`/analytics/${id}/users?limit=50&offset=${o}`);
      setUsers(prev => reset ? data : [...prev, ...data]);
      if (reset) setOffset(50); else setOffset(o + 50);
    } catch {}
    setLoading(false);
  }, [id, offset]);

  useEffect(() => { fetchUsers(true); }, [id]);

  return (
    <div className="p-6 flex-1 overflow-auto">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Users</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Anonymous + identified user profiles</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-trackflow-bg-2 rounded-lg text-[12px] text-trackflow-text-2">
          <Users size={13} />
          {users.length} users
        </div>
      </div>

      <div className="bg-white border border-trackflow-bg-3 rounded-[10px] overflow-hidden">
        {users.length === 0 && !loading ? (
          <div className="p-12 text-center text-trackflow-text-3 text-sm">No users yet</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-trackflow-bg border-b border-trackflow-bg-3">
                {['User', 'ID', 'First seen', 'Last seen', 'Sessions', 'Traits', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-trackflow-text-3 tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_hash} className="border-b border-trackflow-bg-2 hover:bg-trackflow-bg cursor-pointer transition-colors" onClick={() => setSelectedHash(u.user_hash)}>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-trackflow-text-2">{u.user_hash}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-[11px] text-trackflow-text">{u.user_id || <span className="text-trackflow-text-3">—</span>}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-trackflow-text-3">{formatTs(u.first_seen)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11px] text-trackflow-text-3">{formatTs(u.last_seen)}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[12px] text-trackflow-text">{u.sessions}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      {Object.entries(u.traits || {}).slice(0,2).map(([k,v]) => (
                        <span key={k} className="text-[9px] bg-trackflow-bg-2 text-trackflow-text-3 px-1.5 py-0.5 rounded font-mono">{k}</span>
                      ))}
                      {Object.keys(u.traits || {}).length > 2 && (
                        <span className="text-[9px] text-trackflow-text-3">+{Object.keys(u.traits).length - 2}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <ChevronRight size={13} className="text-trackflow-text-3" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {loading && <div className="p-4 text-center text-trackflow-text-3 text-xs">Loading…</div>}
        {!loading && users.length > 0 && users.length % 50 === 0 && (
          <div className="p-4 flex justify-center">
            <button onClick={() => fetchUsers(false)} className="px-5 py-1.5 bg-trackflow-bg-2 border-none rounded-md text-xs cursor-pointer font-sans text-trackflow-text-2">
              Load more
            </button>
          </div>
        )}
      </div>

      {selectedHash && (
        <UserDrawer hash={selectedHash} siteId={id} onClose={() => setSelectedHash(null)} />
      )}
    </div>
  );
}
