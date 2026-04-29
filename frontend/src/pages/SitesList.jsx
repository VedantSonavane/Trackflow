import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Plus, Globe, ArrowRight, Trash2, Activity, CheckCircle2, XCircle } from 'lucide-react';

export default function SitesList() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', domain: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [siteStatuses, setSiteStatuses] = useState({});
  const navigate = useNavigate();

  useEffect(() => { fetchSites(); }, []);

  async function fetchSites() {
    try {
      const data = await api.get('/sites');
      setSites(data);
      data.forEach(site => checkSiteStatus(site.id));
    } catch {}
    setLoading(false);
  }

  async function checkSiteStatus(siteId) {
    try {
      const events = await api.get(`/analytics/${siteId}/events?limit=1`);
      setSiteStatuses(prev => ({ ...prev, [siteId]: events && events.length > 0 ? 'installed' : 'not_installed' }));
    } catch {
      setSiteStatuses(prev => ({ ...prev, [siteId]: 'unknown' }));
    }
  }

  async function createSite(e) {
    e.preventDefault();
    setCreating(true); setError('');
    try {
      const site = await api.post('/sites', { name: form.name, domain: form.domain });
      setSites(s => [site, ...s]);
      setForm({ name: '', domain: '' });
      setShowCreate(false);
      navigate(`/sites/${site.id}/generate`);
    } catch (err) { setError(err.message); }
    setCreating(false);
  }

  async function deleteSite(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this site and all its data?')) return;
    await api.delete(`/sites/${id}`);
    setSites(s => s.filter(x => x.id !== id));
  }

  if (loading) return <div className="p-10 text-gray-500">Loading…</div>;

  return (
    <div className="p-6 flex-1 overflow-auto  ">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Sites</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Manage your tracked properties</p>
        </div>
        <button 
          className="flex items-center gap-1.5 px-3.5 py-2 bg-trackflow-accent text-white border-none rounded-md text-[13px] font-medium cursor-pointer font-sans hover:bg-trackflow-accent-hover transition-colors"
          onClick={() => setShowCreate(true)}
        >
          <Plus size={14} />
          Add site
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-trackflow-bg-3 rounded-[10px] p-6 mb-7">
          <h3 className="text-sm font-medium mb-4 text-trackflow-text">New site</h3>
          <form onSubmit={createSite} className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-3.5">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Site name</label>
                <input 
                  className="px-2.5 py-2 border border-trackflow-border rounded-md text-[13px] bg-trackflow-bg outline-none font-sans focus:border-trackflow-border-2"
                  value={form.name} 
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} 
                  placeholder="My Website" 
                  required 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Domain</label>
                <input 
                  className="px-2.5 py-2 border border-trackflow-border rounded-md text-[13px] bg-trackflow-bg outline-none font-sans focus:border-trackflow-border-2"
                  value={form.domain} 
                  onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} 
                  placeholder="example.com" 
                  required 
                />
              </div>
            </div>
            {error && <p className="text-xs text-trackflow-red">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button 
                type="button" 
                className="px-3.5 py-2 bg-transparent border border-trackflow-border rounded-md text-[13px] cursor-pointer font-sans text-trackflow-text-2 hover:bg-trackflow-bg-2"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="px-3.5 py-2 bg-trackflow-accent text-white border-none rounded-md text-[13px] font-medium cursor-pointer font-sans hover:bg-trackflow-accent-hover disabled:opacity-50"
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create & get script'}
              </button>
            </div>
          </form>
        </div>
      )}

      {sites.length === 0 && !showCreate ? (
        <div className="flex flex-col items-center justify-center py-20 px-10 gap-2.5">
          <Activity size={32} strokeWidth={1} className="text-gray-300" />
          <p className="text-[15px] font-medium text-trackflow-text mt-2">No sites yet</p>
          <p className="text-[13px] text-trackflow-text-3 mb-3">Add your first site to start tracking</p>
          <button 
            className="flex items-center gap-1.5 px-3.5 py-2 bg-trackflow-accent text-white border-none rounded-md text-[13px] font-medium cursor-pointer font-sans hover:bg-trackflow-accent-hover"
            onClick={() => setShowCreate(true)}
          >
            <Plus size={14} /> Add site
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {sites.map(site => {
            const status = siteStatuses[site.id];
            const isInstalled = status === 'installed';
            const StatusIcon = isInstalled ? CheckCircle2 : XCircle;
            const statusColor = isInstalled ? 'text-green-500' : 'text-red-500';
            const statusBg = isInstalled ? 'bg-green-50' : 'bg-red-50';
            
            return (
              <div 
                key={site.id} 
                className="bg-white border border-trackflow-bg-3 rounded-[10px] p-5 cursor-pointer transition-all hover:border-trackflow-border-2 hover:shadow-trackflow"
                onClick={() => navigate(`/sites/${site.id}`)}
              >
                <div className="flex justify-between items-center mb-3.5">
                  <div className="w-8 h-8 bg-trackflow-bg-2 rounded-md flex items-center justify-center text-trackflow-text-2">
                    <Globe size={14} strokeWidth={1.5} />
                  </div>
                  <div className="flex items-center gap-2">
                    {status && (
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${statusColor} ${statusBg}`}>
                        <StatusIcon size={12} />
                        <span>{isInstalled ? 'Active' : 'No data'}</span>
                      </div>
                    )}
                    <button 
                      className="bg-transparent border-none text-gray-400 cursor-pointer p-1 flex items-center hover:text-red-500"
                      onClick={e => deleteSite(e, site.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="text-sm font-medium text-trackflow-text mb-1">{site.name}</div>
                <div className="text-xs text-trackflow-text-3 mb-4">{site.domain}</div>
                <div className="flex justify-between items-center">
                  <span className="font-mono text-[11px] text-trackflow-text-3 bg-trackflow-bg-2 px-1.5 py-0.5 rounded">
                    {site.api_key.slice(0, 12)}…
                  </span>
                  <ArrowRight size={13} className="text-gray-500" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
