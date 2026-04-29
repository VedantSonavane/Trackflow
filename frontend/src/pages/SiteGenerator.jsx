import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Copy, Check, RefreshCw, Code, Eye, EyeOff } from 'lucide-react';

const TOGGLE_OPTIONS = [
  { key: 'heatmap', label: 'Heatmap tracking', desc: 'Mouse moves & click density', default: true },
  { key: 'heartbeat', label: 'Heartbeat pings', desc: '15s dwell time signals', default: true },
  { key: 'rageClick', label: 'Rage click detection', desc: '5+ clicks/sec on same spot', default: true },
  { key: 'deadClick', label: 'Dead click detection', desc: 'Clicks on non-interactive elements', default: true },
  { key: 'hesitation', label: 'Friction / hesitation', desc: 'Hover >3s signals', default: true },
  { key: 'gestures', label: 'Touch gestures', desc: 'Swipe & pinch events', default: true },
  { key: 'errors', label: 'JS error tracking', desc: 'Uncaught errors & rejections', default: true },
  { key: 'resourceErrors', label: 'Resource errors', desc: 'Failed img/script/link loads', default: false },
  { key: 'scrollDepth', label: 'Scroll depth', desc: 'Per-page scroll milestones', default: true },
  { key: 'formTracking', label: 'Form analytics', desc: 'Submit, abandon, field dwell', default: true },
  { key: 'outbound', label: 'Outbound links', desc: 'Clicks leaving your domain', default: true },
  { key: 'searchTracking', label: 'Site search', desc: 'Track internal search queries', default: true },
  { key: 'customLayer', label: 'dataLayer / custom events', desc: 'window.dataLayer push capture', default: true },
  { key: 'performance', label: 'Performance metrics', desc: 'FCP, LCP, load timing', default: true },
];

export default function SiteGenerator() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [config, setConfig] = useState({});
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get(`/sites/${id}`).then(data => {
      setSite(data);
      // Initialize toggles from saved config or defaults
      const saved = data.config || {};
      const defaults = {};
      TOGGLE_OPTIONS.forEach(o => { defaults[o.key] = saved[o.key] !== undefined ? saved[o.key] : o.default; });
      setConfig(defaults);
    });
  }, [id]);

  function toggleOption(key) {
    setConfig(c => ({ ...c, [key]: !c[key] }));
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const updated = await api.patch(`/sites/${id}`, { config });
      setSite(updated);
    } catch {}
    setSaving(false);
  }

  async function regenKey() {
    if (!confirm('Regenerate API key? Your current script will stop working.')) return;
    setRegenLoading(true);
    try {
      const { api_key } = await api.post(`/sites/${id}/regenerate-key`);
      setSite(s => ({ ...s, api_key }));
    } catch {}
    setRegenLoading(false);
  }

  function getConfigB64() {
    const minConfig = {};
    TOGGLE_OPTIONS.forEach(o => {
      if (config[o.key] !== undefined) minConfig[o.key] = config[o.key];
    });
    return btoa(JSON.stringify(minConfig));
  }

  function getScriptTag() {
    if (!site) return '';
    const host = import.meta.env.VITE_BACKEND_URL || window.location.origin;
    const configB64 = getConfigB64();
    return `<script defer src="${host}/track.js?k=${site.api_key}&c=${configB64}"></script>`;
  }

  function copyScript() {
    navigator.clipboard.writeText(getScriptTag());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!site) return <div className="p-10 text-gray-500 text-sm">Loading…</div>;

  return (
    <div className="p-6 flex-1 overflow-auto  ">
      <div className="mb-7">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Script generator</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Configure and copy your tracking snippet for {site.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.2fr] gap-5 items-start">
        <div className="flex flex-col gap-4">
          {/* API Key section */}
          <div className="bg-white border border-trackflow-bg-3 rounded-[10px] px-5 py-5">
            <h3 className="text-[13px] font-medium text-trackflow-text mb-1.5">API Key</h3>
            <div className="flex gap-2 items-center mb-2">
              <div className="flex-1 flex items-center justify-between bg-trackflow-bg-2 rounded-md px-3 py-2 border border-trackflow-bg-3">
                <span className="font-mono text-xs text-trackflow-text-2 flex-1">{showKey ? site.api_key : site.api_key.slice(0, 6) + '•'.repeat(26)}</span>
                <button className="bg-transparent border-none text-trackflow-text-3 cursor-pointer p-1.5 flex items-center rounded" onClick={() => setShowKey(v => !v)}>
                  {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <button className="bg-transparent border-none text-trackflow-text-3 cursor-pointer p-1.5 flex items-center rounded" onClick={regenKey} disabled={regenLoading} title="Regenerate key">
                <RefreshCw size={13} className={regenLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-[11px] text-trackflow-text-3">Domain: <code className="font-mono bg-trackflow-bg-2 px-1 py-0.5 rounded text-[11px]">{site.domain}</code></p>
          </div>

          {/* Toggles */}
          <div className="bg-white border border-trackflow-bg-3 rounded-[10px] px-5 py-5">
            <h3 className="text-[13px] font-medium text-trackflow-text mb-1.5">Tracking options</h3>
            <p className="text-xs text-trackflow-text-3 mb-4 leading-relaxed">Enable or disable individual signals. Core tracking (pageview, click, scroll, timing) is always active.</p>
            <div className="flex flex-col">
              {TOGGLE_OPTIONS.map(opt => (
                <label key={opt.key} className="flex items-center justify-between py-2.5 border-b border-trackflow-bg-2 last:border-b-0 cursor-pointer">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-trackflow-text">{opt.label}</span>
                    <span className="text-[11px] text-trackflow-text-3">{opt.desc}</span>
                  </div>
                  <div
                    className={`w-8 h-[18px] rounded-[9px] relative cursor-pointer transition-colors shrink-0 ${config[opt.key] ? 'bg-trackflow-text' : 'bg-trackflow-border'}`}
                    onClick={() => toggleOption(opt.key)}
                  >
                    <div className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all shadow-sm ${config[opt.key] ? 'left-4' : 'left-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>
            <button className="mt-4 w-full px-2 py-2 bg-trackflow-accent text-white border-none rounded-md text-xs font-medium cursor-pointer font-sans hover:bg-trackflow-accent-hover disabled:opacity-50" onClick={saveConfig} disabled={saving}>
              {saving ? 'Saving…' : 'Save configuration'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Script output */}
          <div className="bg-white border border-trackflow-bg-3 rounded-[10px] px-5 py-5">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-1.5 text-[13px] font-medium text-trackflow-text">
                <Code size={14} />
                <span>Script tag</span>
              </div>
              <button className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs cursor-pointer font-sans transition-colors ${copied ? 'bg-trackflow-text text-white border border-trackflow-text' : 'bg-trackflow-bg-2 border border-trackflow-bg-3 text-trackflow-text-2'}`} onClick={copyScript}>
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
            </div>
            <div className="bg-trackflow-bg border border-trackflow-bg-3 rounded-md p-3.5 overflow-auto mb-2.5">
              <pre className="font-mono text-[11px] text-trackflow-text-2 whitespace-pre-wrap break-all leading-relaxed">{getScriptTag()}</pre>
            </div>
            <p className="text-[11px] text-trackflow-text-3">Paste this tag into your <code className="font-mono bg-trackflow-bg-2 px-1 py-0.5 rounded text-[11px]">&lt;head&gt;</code> or just before <code className="font-mono bg-trackflow-bg-2 px-1 py-0.5 rounded text-[11px]">&lt;/body&gt;</code>.</p>
          </div>

          {/* Manual event tracking */}
          <div className="bg-white border border-trackflow-bg-3 rounded-[10px] px-5 py-5">
            <h3 className="text-[13px] font-medium text-trackflow-text mb-1.5">Manual event tracking</h3>
            <p className="text-xs text-trackflow-text-3 mb-4 leading-relaxed">After installing the script, fire custom events from anywhere:</p>
            <div className="bg-trackflow-bg border border-trackflow-bg-3 rounded-md p-3.5">
              <pre className="font-mono text-[11px] text-trackflow-text-2 leading-relaxed whitespace-pre">{`// Track a custom event
window.tf('purchase', {
  amount: 49.99,
  currency: 'USD',
  plan: 'pro'
});

// Or via dataLayer
window.dataLayer.push({
  event: 'sign_up',
  method: 'google'
});`}</pre>
            </div>
          </div>

          {/* Active signals */}
          <div className="bg-white border border-trackflow-bg-3 rounded-[10px] px-5 py-5">
            <h3 className="text-[13px] font-medium text-trackflow-text mb-1.5">Active signals</h3>
            <div className="flex flex-wrap gap-1.5">
              {[
                'pageview', 'click', 'scroll', 'timing',
                ...TOGGLE_OPTIONS.filter(o => config[o.key]).map(o => o.key)
              ].map(sig => (
                <span key={sig} className="font-mono text-[10px] bg-trackflow-bg-2 text-trackflow-text-2 px-1.5 py-0.5 rounded">{sig.replace(/([A-Z])/g, '_$1').toLowerCase()}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
