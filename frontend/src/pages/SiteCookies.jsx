import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import {
  Cookie, Copy, Check, ChevronRight, Globe, Shield, Zap,
  BarChart2, Sliders, Code2, Eye, Plus, Trash2, GripVertical,
  ToggleLeft, ToggleRight, AlertCircle, Languages, RefreshCw,
  MousePointer, Layers, FileCode, Activity
} from 'lucide-react';

// ─── Design tokens (inherit from app; fallback inline) ────────────────────────
// Uses trackflow CSS vars throughout

// ─── Config skeleton ──────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  ui: {
    style: 'bar',           // bar | modal | fullscreen
    position: 'bottom',     // bottom | top | bottom-left | bottom-right
    theme: 'light',         // light | dark | auto
    animation: 'slide',     // slide | fade | none
    cornerRadius: 12,
    showLogo: false,
    accentColor: '#0f172a',
  },
  logic: {
    showOn: 'load',         // load | exit | scroll | delay
    showDelay: 0,
    scrollDepth: 50,
    geoRules: ['gdpr', 'ccpa'],
    blockScripts: true,
    consentExpiry: 180,     // days
    reConsentOn: 'policy_change', // policy_change | always | never
    respectDNT: true,
  },
  categories: [
    { id: 'necessary', label: 'Necessary', description: 'Essential for site functionality', required: true, enabled: true, scripts: [] },
    { id: 'analytics', label: 'Analytics', description: 'Understand how visitors interact', required: false, enabled: true, scripts: [] },
    { id: 'marketing', label: 'Marketing', description: 'Ad targeting and remarketing', required: false, enabled: false, scripts: [] },
    { id: 'preferences', label: 'Preferences', description: 'UI settings, language, theme', required: false, enabled: false, scripts: [] },
  ],
  scripts: [],
  localization: {
    defaultLang: 'en',
    translations: {
      en: {
        title: 'We value your privacy',
        body: 'We use cookies to improve your experience, analyze traffic, and serve personalized content.',
        acceptAll: 'Accept all',
        rejectAll: 'Reject non-essential',
        manage: 'Manage preferences',
        save: 'Save preferences',
        privacyLink: 'Privacy policy',
      },
    },
  },
  compliance: {
    privacyUrl: '/privacy',
    cookiePolicyUrl: '/cookies',
    showRegionBadge: true,
    iabTcf: false,
  },
};

const GEO_RULES = [
  { key: 'gdpr', label: 'GDPR', region: 'EU / EEA', behavior: 'Opt-in required', color: '#3b82f6' },
  { key: 'ccpa', label: 'CCPA', region: 'California', behavior: 'Opt-out mechanism', color: '#8b5cf6' },
  { key: 'lgpd', label: 'LGPD', region: 'Brazil', behavior: 'Consent or legitimate interest', color: '#10b981' },
  { key: 'pipeda', label: 'PIPEDA', region: 'Canada', behavior: 'Express or implied consent', color: '#f59e0b' },
  { key: 'global', label: 'Global', region: 'All regions', behavior: 'Most restrictive', color: '#ef4444' },
];

const SHOW_ON_OPTIONS = [
  { key: 'load', label: 'Page load', icon: Zap },
  { key: 'delay', label: 'After delay', icon: RefreshCw },
  { key: 'scroll', label: 'On scroll', icon: MousePointer },
  { key: 'exit', label: 'Exit intent', icon: AlertCircle },
];

const TABS = [
  { key: 'overview', label: 'Overview', icon: BarChart2 },
  { key: 'experience', label: 'Experience', icon: Sliders },
  { key: 'logic', label: 'Logic', icon: Zap },
  { key: 'categories', label: 'Categories', icon: Layers },
  { key: 'content', label: 'Content', icon: Languages },
  { key: 'script', label: 'Script', icon: Code2 },
  { key: 'preview', label: 'Preview', icon: Eye },
];

// ─── Primitives ───────────────────────────────────────────────────────────────

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'bg-trackflow-text' : 'bg-trackflow-border'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

function SegmentControl({ options, value, onChange }) {
  return (
    <div className="flex gap-0.5 bg-trackflow-bg-2 p-0.5 rounded-lg w-fit">
      {options.map(opt => (
        <button
          key={opt.key || opt}
          onClick={() => onChange(opt.key || opt)}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all cursor-pointer whitespace-nowrap ${(value === (opt.key || opt)) ? 'bg-white text-trackflow-text shadow-sm' : 'text-trackflow-text-3 hover:text-trackflow-text-2'}`}
        >
          {opt.label || opt}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
      <p className="text-[11px] text-trackflow-text-3 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-semibold tracking-tight ${accent ? 'text-green-600' : 'text-trackflow-text'}`}>{value}</p>
      {sub && <p className="text-[11px] text-trackflow-text-3 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionCard({ title, children, action }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-trackflow-bg-2">
          {title && <p className="text-[13px] font-medium text-trackflow-text">{title}</p>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-trackflow-text-3 uppercase tracking-wide">{label}</label>
        {hint && <span className="text-[10px] text-trackflow-text-3">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, className = '' }) {
  return (
    <input
      className={`w-full px-3 py-2 border border-trackflow-border rounded-lg text-[12px] bg-trackflow-bg text-trackflow-text outline-none focus:border-trackflow-border-2 transition-colors font-sans placeholder:text-trackflow-text-3 ${className}`}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

function Textarea({ value, onChange, rows = 3, placeholder }) {
  return (
    <textarea
      className="w-full px-3 py-2 border border-trackflow-border rounded-lg text-[12px] bg-trackflow-bg text-trackflow-text outline-none focus:border-trackflow-border-2 transition-colors font-sans resize-none placeholder:text-trackflow-text-3"
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
    />
  );
}

function RowToggle({ label, description, checked, onChange, disabled, badge }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-trackflow-bg-2 last:border-0">
      <div className="flex-1 pr-4">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-trackflow-text">{label}</span>
          {badge && <span className="text-[9px] bg-trackflow-bg-2 text-trackflow-text-3 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide">{badge}</span>}
        </div>
        {description && <p className="text-[11px] text-trackflow-text-3 mt-0.5 leading-snug">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const mockData = {
    acceptRate: '71.4%',
    rejectRate: '18.2%',
    manageRate: '10.4%',
    totalSessions: '12,840',
    trend: [42, 55, 61, 58, 70, 74, 71],
    byRegion: [
      { region: 'EU', accept: 58, reject: 31, manage: 11 },
      { region: 'US', accept: 81, reject: 12, manage: 7 },
      { region: 'BR', accept: 63, reject: 22, manage: 15 },
      { region: 'Other', accept: 77, reject: 16, manage: 7 },
    ],
    categories: [
      { name: 'Analytics', rate: 68 },
      { name: 'Marketing', rate: 41 },
      { name: 'Preferences', rate: 72 },
    ],
  };

  const maxTrend = Math.max(...mockData.trend);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Accept rate" value={mockData.acceptRate} sub="Last 7 days" accent />
        <StatCard label="Reject rate" value={mockData.rejectRate} sub="Last 7 days" />
        <StatCard label="Managed" value={mockData.manageRate} sub="Used preference panel" />
        <StatCard label="Total sessions" value={mockData.totalSessions} sub="With consent shown" />
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-5">
        <SectionCard title="7-day accept rate trend">
          <div className="flex items-end gap-2 h-28">
            {mockData.trend.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm bg-trackflow-text opacity-80 transition-all"
                  style={{ height: `${(v / maxTrend) * 100}%` }}
                />
                <span className="text-[9px] text-trackflow-text-3">{days[i]}</span>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Category opt-in">
          <div className="flex flex-col gap-3">
            {mockData.categories.map(c => (
              <div key={c.name}>
                <div className="flex justify-between mb-1">
                  <span className="text-[11px] text-trackflow-text">{c.name}</span>
                  <span className="text-[11px] text-trackflow-text-3">{c.rate}%</span>
                </div>
                <div className="h-1.5 bg-trackflow-bg-2 rounded-full overflow-hidden">
                  <div className="h-full bg-trackflow-text rounded-full transition-all" style={{ width: `${c.rate}%` }} />
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Consent by region">
        <div className="flex flex-col gap-0.5">
          {mockData.byRegion.map(r => (
            <div key={r.region} className="flex items-center gap-4 py-2.5 border-b border-trackflow-bg-2 last:border-0">
              <span className="text-[12px] font-medium text-trackflow-text w-10">{r.region}</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden bg-trackflow-bg-2 flex">
                <div className="h-full bg-green-400" style={{ width: `${r.accept}%` }} />
                <div className="h-full bg-red-300" style={{ width: `${r.reject}%` }} />
                <div className="h-full bg-amber-300" style={{ width: `${r.manage}%` }} />
              </div>
              <div className="flex gap-3 text-[11px] text-trackflow-text-3 w-32">
                <span className="text-green-600">{r.accept}%</span>
                <span className="text-red-500">{r.reject}%</span>
                <span className="text-amber-500">{r.manage}%</span>
              </div>
            </div>
          ))}
          <div className="flex gap-4 pt-2">
            {[['Accept', 'bg-green-400'], ['Reject', 'bg-red-300'], ['Manage', 'bg-amber-300']].map(([l, c]) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${c}`} />
                <span className="text-[10px] text-trackflow-text-3">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab: Experience ──────────────────────────────────────────────────────────

function ExperienceTab({ config, setConfig }) {
  const ui = config.ui;
  const set = (key, val) => setConfig(c => ({ ...c, ui: { ...c.ui, [key]: val } }));

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="flex flex-col gap-4">
        <SectionCard title="Layout style">
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'bar', label: 'Bar', desc: 'Compact bottom/top strip' },
              { key: 'modal', label: 'Modal', desc: 'Centered overlay dialog' },
              { key: 'fullscreen', label: 'Full screen', desc: 'Full-page takeover' },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => set('style', s.key)}
                className={`p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${ui.style === s.key ? 'border-trackflow-text bg-trackflow-bg' : 'border-trackflow-bg-3 bg-white hover:border-trackflow-border-2'}`}
              >
                <div className={`w-full h-10 rounded mb-2 flex items-end p-1 ${s.key === 'bar' ? 'bg-trackflow-bg-2 items-end' : s.key === 'modal' ? 'bg-trackflow-bg-2 items-center justify-center' : 'bg-trackflow-bg-2 items-center justify-center'}`}>
                  <div className={`bg-trackflow-text rounded opacity-60 ${s.key === 'bar' ? 'w-full h-4' : s.key === 'modal' ? 'w-3/4 h-6 rounded-md' : 'w-full h-full rounded'}`} />
                </div>
                <p className="text-[12px] font-medium text-trackflow-text">{s.label}</p>
                <p className="text-[10px] text-trackflow-text-3 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Position">
          <div className="grid grid-cols-2 gap-2">
            {[
              { key: 'bottom', label: 'Bottom' },
              { key: 'top', label: 'Top' },
              { key: 'bottom-left', label: 'Bottom left' },
              { key: 'bottom-right', label: 'Bottom right' },
            ].map(p => (
              <button
                key={p.key}
                onClick={() => set('position', p.key)}
                className={`py-2 px-3 rounded-lg border text-[12px] text-left cursor-pointer transition-all ${ui.position === p.key ? 'border-trackflow-text bg-trackflow-bg font-medium' : 'border-trackflow-bg-3 hover:border-trackflow-border-2'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Animation">
          <SegmentControl
            options={[{ key: 'slide', label: 'Slide' }, { key: 'fade', label: 'Fade' }, { key: 'none', label: 'None' }]}
            value={ui.animation}
            onChange={v => set('animation', v)}
          />
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Theme">
          <div className="flex flex-col gap-3">
            <SegmentControl
              options={[{ key: 'light', label: 'Light' }, { key: 'dark', label: 'Dark' }, { key: 'auto', label: 'System' }]}
              value={ui.theme}
              onChange={v => set('theme', v)}
            />
          </div>
        </SectionCard>

        <SectionCard title="Visual">
          <div className="flex flex-col gap-4">
            <Field label="Accent color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={ui.accentColor}
                  onChange={e => set('accentColor', e.target.value)}
                  className="w-9 h-9 border border-trackflow-border rounded-lg cursor-pointer overflow-hidden p-0.5 bg-white"
                />
                <Input value={ui.accentColor} onChange={v => set('accentColor', v)} />
              </div>
            </Field>
            <Field label="Corner radius" hint={`${ui.cornerRadius}px`}>
              <input
                type="range"
                min={0}
                max={24}
                value={ui.cornerRadius}
                onChange={e => set('cornerRadius', Number(e.target.value))}
                className="w-full accent-trackflow-text"
              />
            </Field>
            <RowToggle
              label="Show brand logo"
              description="Display your site logo in the banner"
              checked={ui.showLogo}
              onChange={v => set('showLogo', v)}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Tab: Logic ───────────────────────────────────────────────────────────────

function LogicTab({ config, setConfig }) {
  const logic = config.logic;
  const set = (key, val) => setConfig(c => ({ ...c, logic: { ...c.logic, [key]: val } }));

  function toggleGeo(key) {
    setConfig(c => ({
      ...c,
      logic: {
        ...c.logic,
        geoRules: c.logic.geoRules.includes(key)
          ? c.logic.geoRules.filter(r => r !== key)
          : [...c.logic.geoRules, key],
      },
    }));
  }

  return (
    <div className="grid grid-cols-2 gap-5">
      <div className="flex flex-col gap-4">
        <SectionCard title="Show banner when">
          <div className="flex flex-col gap-2">
            {SHOW_ON_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => set('showOn', opt.key)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer text-left transition-all ${logic.showOn === opt.key ? 'border-trackflow-text bg-trackflow-bg' : 'border-trackflow-bg-3 hover:border-trackflow-border'}`}
                >
                  <Icon size={14} className={logic.showOn === opt.key ? 'text-trackflow-text' : 'text-trackflow-text-3'} />
                  <span className={`text-[12px] font-medium ${logic.showOn === opt.key ? 'text-trackflow-text' : 'text-trackflow-text-2'}`}>{opt.label}</span>
                </button>
              );
            })}
            {logic.showOn === 'delay' && (
              <Field label="Delay (seconds)">
                <Input value={String(logic.showDelay)} onChange={v => set('showDelay', Number(v))} placeholder="0" />
              </Field>
            )}
            {logic.showOn === 'scroll' && (
              <Field label="Scroll depth (%)" hint={`${logic.scrollDepth}%`}>
                <input type="range" min={10} max={90} step={10} value={logic.scrollDepth} onChange={e => set('scrollDepth', Number(e.target.value))} className="w-full accent-trackflow-text" />
              </Field>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Consent storage">
          <div className="flex flex-col gap-4">
            <Field label="Expiry" hint={`${logic.consentExpiry} days`}>
              <input type="range" min={30} max={365} step={30} value={logic.consentExpiry} onChange={e => set('consentExpiry', Number(e.target.value))} className="w-full accent-trackflow-text" />
              <div className="flex justify-between text-[10px] text-trackflow-text-3 mt-0.5">
                <span>30d</span><span>180d</span><span>365d</span>
              </div>
            </Field>
            <Field label="Re-consent trigger">
              <SegmentControl
                options={[
                  { key: 'policy_change', label: 'Policy update' },
                  { key: 'always', label: 'Every visit' },
                  { key: 'never', label: 'Never' },
                ]}
                value={logic.reConsentOn}
                onChange={v => set('reConsentOn', v)}
              />
            </Field>
          </div>
        </SectionCard>
      </div>

      <div className="flex flex-col gap-4">
        <SectionCard title="Compliance regions">
          <div className="flex flex-col gap-0.5">
            {GEO_RULES.map(r => (
              <div key={r.key} className="flex items-center justify-between py-3 border-b border-trackflow-bg-2 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-medium text-trackflow-text">{r.label}</span>
                      <span className="text-[10px] text-trackflow-text-3">{r.region}</span>
                    </div>
                    <p className="text-[11px] text-trackflow-text-3">{r.behavior}</p>
                  </div>
                </div>
                <Switch checked={logic.geoRules.includes(r.key)} onChange={() => toggleGeo(r.key)} />
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Blocking & privacy">
          <div className="flex flex-col gap-0.5">
            <RowToggle
              label="Block scripts before consent"
              description='Uses <script type="text/plain"> pattern'
              checked={logic.blockScripts}
              onChange={v => set('blockScripts', v)}
              badge="recommended"
            />
            <RowToggle
              label="Respect Do Not Track"
              description="Auto-deny when browser DNT=1"
              checked={logic.respectDNT}
              onChange={v => set('respectDNT', v)}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// ─── Tab: Categories ──────────────────────────────────────────────────────────

function CategoriesTab({ config, setConfig }) {
  const [editingId, setEditingId] = useState(null);

  function addCategory() {
    const id = `custom_${Date.now()}`;
    setConfig(c => ({
      ...c,
      categories: [...c.categories, { id, label: 'New category', description: '', required: false, enabled: false, scripts: [] }],
    }));
    setEditingId(id);
  }

  function updateCategory(id, key, val) {
    setConfig(c => ({
      ...c,
      categories: c.categories.map(cat => cat.id === id ? { ...cat, [key]: val } : cat),
    }));
  }

  function removeCategory(id) {
    setConfig(c => ({ ...c, categories: c.categories.filter(cat => cat.id !== id) }));
  }

  function addScript(catId) {
    setConfig(c => ({
      ...c,
      categories: c.categories.map(cat =>
        cat.id === catId
          ? { ...cat, scripts: [...cat.scripts, { id: `s_${Date.now()}`, name: '', pattern: '' }] }
          : cat
      ),
    }));
  }

  function removeScript(catId, scriptId) {
    setConfig(c => ({
      ...c,
      categories: c.categories.map(cat =>
        cat.id === catId
          ? { ...cat, scripts: cat.scripts.filter(s => s.id !== scriptId) }
          : cat
      ),
    }));
  }

  function updateScript(catId, scriptId, key, val) {
    setConfig(c => ({
      ...c,
      categories: c.categories.map(cat =>
        cat.id === catId
          ? { ...cat, scripts: cat.scripts.map(s => s.id === scriptId ? { ...s, [key]: val } : s) }
          : cat
      ),
    }));
  }

  return (
    <div className="flex flex-col gap-4">
      {config.categories.map(cat => (
        <div key={cat.id} className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
          <div
            className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-trackflow-bg transition-colors"
            onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
          >
            <GripVertical size={14} className="text-trackflow-text-3 shrink-0" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium text-trackflow-text">{cat.label}</span>
                {cat.required && <span className="text-[9px] bg-trackflow-bg-2 text-trackflow-text-3 px-1.5 py-0.5 rounded-full font-mono uppercase tracking-wide">required</span>}
                {cat.scripts.length > 0 && <span className="text-[10px] text-trackflow-text-3">{cat.scripts.length} script{cat.scripts.length !== 1 ? 's' : ''} mapped</span>}
              </div>
              {cat.description && <p className="text-[11px] text-trackflow-text-3 mt-0.5">{cat.description}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={cat.enabled}
                onChange={v => updateCategory(cat.id, 'enabled', v)}
                disabled={cat.required}
              />
              {!cat.required && (
                <button
                  onClick={e => { e.stopPropagation(); removeCategory(cat.id); }}
                  className="p-1 text-trackflow-text-3 hover:text-red-500 transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <ChevronRight size={14} className={`text-trackflow-text-3 transition-transform ${editingId === cat.id ? 'rotate-90' : ''}`} />
            </div>
          </div>

          {editingId === cat.id && (
            <div className="border-t border-trackflow-bg-2 p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Label">
                  <Input value={cat.label} onChange={v => updateCategory(cat.id, 'label', v)} />
                </Field>
                <Field label="Description">
                  <Input value={cat.description} onChange={v => updateCategory(cat.id, 'description', v)} />
                </Field>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-medium text-trackflow-text-3 uppercase tracking-wide">Mapped scripts / patterns</p>
                  <button
                    onClick={() => addScript(cat.id)}
                    className="flex items-center gap-1 text-[11px] text-trackflow-text-2 hover:text-trackflow-text cursor-pointer"
                  >
                    <Plus size={11} /> Add
                  </button>
                </div>
                {cat.scripts.length === 0 ? (
                  <p className="text-[11px] text-trackflow-text-3 italic">No scripts mapped. Add patterns to auto-block matching tags.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {cat.scripts.map(s => (
                      <div key={s.id} className="flex items-center gap-2">
                        <Input value={s.name} onChange={v => updateScript(cat.id, s.id, 'name', v)} placeholder="Name (e.g. Google Analytics)" className="flex-1" />
                        <Input value={s.pattern} onChange={v => updateScript(cat.id, s.id, 'pattern', v)} placeholder="Pattern (e.g. google-analytics.com)" className="flex-1" />
                        <button onClick={() => removeScript(cat.id, s.id)} className="p-1.5 text-trackflow-text-3 hover:text-red-500 cursor-pointer">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      <button
        onClick={addCategory}
        className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-trackflow-border rounded-xl text-[12px] text-trackflow-text-3 hover:text-trackflow-text hover:border-trackflow-border-2 transition-all cursor-pointer"
      >
        <Plus size={13} /> Add category
      </button>
    </div>
  );
}

// ─── Tab: Content ─────────────────────────────────────────────────────────────

function ContentTab({ config, setConfig }) {
  const [lang, setLang] = useState('en');
  const t = config.localization.translations[lang] || config.localization.translations['en'];

  function setT(key, val) {
    setConfig(c => ({
      ...c,
      localization: {
        ...c.localization,
        translations: {
          ...c.localization.translations,
          [lang]: { ...t, [key]: val },
        },
      },
    }));
  }

  const LANGS = [
    { key: 'en', label: 'English' },
    { key: 'de', label: 'Deutsch' },
    { key: 'fr', label: 'Français' },
    { key: 'es', label: 'Español' },
  ];

  return (
    <div className="grid grid-cols-[200px_1fr] gap-5">
      <div className="flex flex-col gap-1">
        {LANGS.map(l => (
          <button
            key={l.key}
            onClick={() => setLang(l.key)}
            className={`flex items-center justify-between px-3 py-2 rounded-lg text-[12px] cursor-pointer transition-all ${lang === l.key ? 'bg-trackflow-text text-white font-medium' : 'text-trackflow-text-2 hover:bg-trackflow-bg-2'}`}
          >
            {l.label}
            {!config.localization.translations[l.key] && <span className="text-[9px] opacity-60">not set</span>}
          </button>
        ))}
        <button
          onClick={() => {
            setConfig(c => ({ ...c, localization: { ...c.localization, translations: { ...c.localization.translations, [lang]: { ...t } } } }));
          }}
          className="mt-2 flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] text-trackflow-text-3 hover:text-trackflow-text cursor-pointer"
        >
          <Plus size={11} /> Add language
        </button>
      </div>

      <SectionCard title={`Content — ${LANGS.find(l => l.key === lang)?.label}`}>
        <div className="flex flex-col gap-4">
          <Field label="Banner title">
            <Input value={t.title || ''} onChange={v => setT('title', v)} placeholder="We value your privacy" />
          </Field>
          <Field label="Body text" hint="Use {{siteName}} for dynamic values">
            <Textarea value={t.body || ''} onChange={v => setT('body', v)} rows={3} placeholder="We use cookies to..." />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Accept button">
              <Input value={t.acceptAll || ''} onChange={v => setT('acceptAll', v)} placeholder="Accept all" />
            </Field>
            <Field label="Reject button">
              <Input value={t.rejectAll || ''} onChange={v => setT('rejectAll', v)} placeholder="Reject non-essential" />
            </Field>
            <Field label="Manage button">
              <Input value={t.manage || ''} onChange={v => setT('manage', v)} placeholder="Manage preferences" />
            </Field>
            <Field label="Save button">
              <Input value={t.save || ''} onChange={v => setT('save', v)} placeholder="Save preferences" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Privacy policy URL">
              <Input value={config.compliance.privacyUrl} onChange={v => setConfig(c => ({ ...c, compliance: { ...c.compliance, privacyUrl: v } }))} placeholder="/privacy" />
            </Field>
            <Field label="Cookie policy URL">
              <Input value={config.compliance.cookiePolicyUrl} onChange={v => setConfig(c => ({ ...c, compliance: { ...c.compliance, cookiePolicyUrl: v } }))} placeholder="/cookies" />
            </Field>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab: Script ──────────────────────────────────────────────────────────────

function generateScript(config) {
  const cats = config.categories.map(c => ({
    id: c.id,
    label: c.label,
    required: c.required,
    enabled: c.enabled,
  }));

  const t = config.localization.translations[config.localization.defaultLang] || {};

  return `<!-- TrackFlow Consent OS -->
<script>
(function() {
  'use strict';
  var TF = window.trackflow = window.trackflow || {};
  var KEY = 'tf_consent_v2';

  // ── Config ──────────────────────────────────────────────────
  var CONFIG = {
    categories: ${JSON.stringify(cats, null, 4)},
    blockScripts: ${config.logic.blockScripts},
    expiry: ${config.logic.consentExpiry},
    respectDNT: ${config.logic.respectDNT},
    accentColor: '${config.ui.accentColor}',
    theme: '${config.ui.theme}',
    style: '${config.ui.style}',
    position: '${config.ui.position}',
    animation: '${config.ui.animation}',
    cornerRadius: ${config.ui.cornerRadius},
    geoRules: ${JSON.stringify(config.logic.geoRules)},
    privacyUrl: '${config.compliance.privacyUrl}',
    text: ${JSON.stringify(t)},
  };

  // ── Storage ──────────────────────────────────────────────────
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (Date.now() > data.expires) { localStorage.removeItem(KEY); return null; }
      return data;
    } catch(e) { return null; }
  }

  function save(prefs) {
    try {
      var expires = Date.now() + CONFIG.expiry * 86400000;
      localStorage.setItem(KEY, JSON.stringify({ prefs: prefs, expires: expires, ts: Date.now() }));
    } catch(e) {}
  }

  // ── Consent API ──────────────────────────────────────────────
  var _handlers = [];
  TF.onConsentChange = function(fn) { _handlers.push(fn); };

  function dispatch(prefs) {
    _handlers.forEach(function(fn) { try { fn(prefs); } catch(e) {} });
    window.dispatchEvent(new CustomEvent('trackflow:consent', { detail: prefs }));
    if (window.dataLayer) window.dataLayer.push({ event: 'tf_consent', ...prefs });
  }

  function applyPrefs(prefs, opts) {
    opts = opts || {};
    save(prefs);
    if (!opts.silent) dispatch(prefs);
    unblockScripts(prefs);
    hideBanner();
  }

  // ── Script blocking engine ───────────────────────────────────
  function unblockScripts(prefs) {
    if (!CONFIG.blockScripts) return;
    document.querySelectorAll('script[type="text/plain"][data-category]').forEach(function(el) {
      var cat = el.getAttribute('data-category');
      if (prefs[cat] === true) {
        var s = document.createElement('script');
        Array.from(el.attributes).forEach(function(a) {
          if (a.name !== 'type' && a.name !== 'data-category') s.setAttribute(a.name, a.value);
        });
        s.textContent = el.textContent;
        el.parentNode.replaceChild(s, el);
      }
    });
  }

  // ── Public API ───────────────────────────────────────────────
  TF.getConsent = function() { var d = load(); return d ? d.prefs : null; };
  TF.hasConsent = function(cat) { var p = TF.getConsent(); return p ? !!p[cat] : false; };
  TF.acceptAll = function() {
    var prefs = {};
    CONFIG.categories.forEach(function(c) { prefs[c.id] = true; });
    applyPrefs(prefs);
  };
  TF.rejectAll = function() {
    var prefs = {};
    CONFIG.categories.forEach(function(c) { prefs[c.id] = !!c.required; });
    applyPrefs(prefs);
  };
  TF.savePrefs = function(prefs) { applyPrefs(prefs); };

  // ── Banner ───────────────────────────────────────────────────
  function hideBanner() {
    var el = document.getElementById('tf-banner');
    if (el) { el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(function() { el.remove(); }, 200); }
  }

  function renderBanner() {
    if (load()) return;
    if (CONFIG.respectDNT && navigator.doNotTrack === '1') {
      TF.rejectAll(); return;
    }

    var isDark = CONFIG.theme === 'dark' || (CONFIG.theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var bg = isDark ? '#111' : '#fff';
    var fg = isDark ? '#f8fafc' : '#0f172a';
    var border = isDark ? '#1e293b' : '#f1f5f9';
    var subFg = isDark ? '#94a3b8' : '#64748b';
    var accent = CONFIG.accentColor;
    var r = CONFIG.cornerRadius;
    var isBar = CONFIG.style === 'bar';
    var isModal = CONFIG.style === 'modal';
    var t = CONFIG.text;

    var pos = '';
    if (isModal) {
      pos = 'top:50%;left:50%;transform:translate(-50%,-50%);max-width:480px;width:calc(100% - 32px);';
    } else if (CONFIG.position === 'bottom') {
      pos = 'bottom:0;left:0;right:0;' + (isBar ? '' : 'max-width:480px;bottom:16px;right:16px;left:auto;');
    } else if (CONFIG.position === 'top') {
      pos = 'top:0;left:0;right:0;';
    } else if (CONFIG.position === 'bottom-left') {
      pos = 'bottom:16px;left:16px;max-width:400px;';
    } else if (CONFIG.position === 'bottom-right') {
      pos = 'bottom:16px;right:16px;max-width:400px;';
    }

    var bannerR = (isBar && (CONFIG.position === 'bottom' || CONFIG.position === 'top')) ? '0' : r + 'px';

    // Category rows for manage panel
    var catRows = CONFIG.categories.filter(function(c) { return !c.required; }).map(function(c) {
      return '<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid ' + border + ';">'
        + '<div><div style="font-size:12px;font-weight:500;color:' + fg + ';">' + c.label + '</div></div>'
        + '<input type="checkbox" data-tf-cat="' + c.id + '" ' + (c.enabled ? 'checked' : '') + ' style="width:16px;height:16px;cursor:pointer;accent-color:' + accent + ';" />'
        + '</label>';
    }).join('');

    var html = '<div id="tf-banner" role="dialog" aria-modal="true" aria-label="Cookie consent" style="position:fixed;' + pos + 'z-index:2147483647;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;background:' + bg + ';color:' + fg + ';border:1px solid ' + border + ';border-radius:' + bannerR + ';padding:20px 24px;box-shadow:0 8px 32px rgba(0,0,0,' + (isDark ? '0.4' : '0.1') + ');transition:opacity .2s,transform .2s;">'
      + (t.title ? '<p style="font-size:14px;font-weight:600;margin:0 0 6px;">' + t.title + '</p>' : '')
      + '<p style="font-size:12px;color:' + subFg + ';margin:0 0 16px;line-height:1.6;">' + (t.body || '') + ' <a href="' + CONFIG.privacyUrl + '" style="color:' + fg + ';font-size:11px;">' + (t.privacyLink || 'Privacy policy') + '</a></p>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">'
      + '<button id="tf-accept-all" style="padding:8px 18px;background:' + accent + ';color:#fff;border:none;border-radius:' + Math.min(r, 8) + 'px;font-size:12px;font-weight:500;cursor:pointer;">' + (t.acceptAll || 'Accept all') + '</button>'
      + '<button id="tf-reject-all" style="padding:8px 18px;background:transparent;color:' + fg + ';border:1px solid ' + border + ';border-radius:' + Math.min(r, 8) + 'px;font-size:12px;cursor:pointer;">' + (t.rejectAll || 'Reject all') + '</button>'
      + '<button id="tf-manage" style="padding:8px 12px;background:transparent;border:none;font-size:12px;cursor:pointer;text-decoration:underline;color:' + subFg + ';">' + (t.manage || 'Manage') + '</button>'
      + '</div>'
      + '<div id="tf-manage-panel" style="display:none;margin-top:16px;border-top:1px solid ' + border + ';padding-top:12px;">'
      + catRows
      + '<button id="tf-save-prefs" style="margin-top:12px;padding:8px 16px;background:' + accent + ';color:#fff;border:none;border-radius:' + Math.min(r, 8) + 'px;font-size:12px;font-weight:500;cursor:pointer;">' + (t.save || 'Save preferences') + '</button>'
      + '</div>'
      + '</div>';

    document.body.insertAdjacentHTML(CONFIG.position === 'top' ? 'afterbegin' : 'beforeend', html);
    requestAnimationFrame(function() {
      var el = document.getElementById('tf-banner');
      if (el) { el.style.opacity = '1'; el.style.transform = 'none'; }
    });

    document.getElementById('tf-accept-all').addEventListener('click', TF.acceptAll);
    document.getElementById('tf-reject-all').addEventListener('click', TF.rejectAll);
    document.getElementById('tf-manage').addEventListener('click', function() {
      var p = document.getElementById('tf-manage-panel');
      if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
    });
    document.getElementById('tf-save-prefs').addEventListener('click', function() {
      var prefs = {};
      CONFIG.categories.forEach(function(c) { prefs[c.id] = !!c.required; });
      document.querySelectorAll('[data-tf-cat]').forEach(function(el) { prefs[el.dataset.tfCat] = el.checked; });
      TF.savePrefs(prefs);
    });
  }

  // ── Init ─────────────────────────────────────────────────────
  var existing = load();
  if (existing) {
    dispatch(existing.prefs);
    unblockScripts(existing.prefs);
  } else {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', renderBanner);
    } else {
      renderBanner();
    }
  }

})();
</script>
<!-- End TrackFlow Consent OS -->`;
}

function ScriptTab({ config }) {
  const [copied, setCopied] = useState(false);
  const script = generateScript(config);

  function copy() {
    navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const hooks = [
    { name: 'window.trackflow.onConsentChange(fn)', desc: 'Fires whenever consent changes', example: "trackflow.onConsentChange(prefs => {\n  if (prefs.analytics) initGA();\n});" },
    { name: 'window.trackflow.hasConsent(category)', desc: 'Returns true/false for a category', example: "if (trackflow.hasConsent('marketing')) {\n  loadFBPixel();\n}" },
    { name: 'window.trackflow.getConsent()', desc: 'Returns full prefs object or null', example: "const prefs = trackflow.getConsent();" },
    { name: 'window.trackflow.acceptAll()', desc: 'Programmatically accept all', example: "// e.g. inside a CTA button\ntrackflow.acceptAll();" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <SectionCard
        title="Generated script"
        action={
          <button
            onClick={copy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-all ${copied ? 'bg-trackflow-text text-white' : 'bg-trackflow-bg-2 text-trackflow-text-2 hover:bg-trackflow-bg-3'}`}
          >
            {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy script</>}
          </button>
        }
      >
        <div className="bg-trackflow-bg border border-trackflow-bg-3 rounded-lg p-4 overflow-auto max-h-96">
          <pre className="text-[11px] text-trackflow-text-2 whitespace-pre leading-relaxed font-mono">{script}</pre>
        </div>
        <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
          <AlertCircle size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-medium text-amber-700">Place before any tracking scripts</p>
            <p className="text-[11px] text-amber-600 mt-0.5">Add <code className="font-mono bg-amber-100 px-0.5 rounded">type="text/plain" data-category="analytics"</code> to any script tags you want blocked until consent.</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Event hooks & API">
        <div className="flex flex-col gap-3">
          {hooks.map(h => (
            <div key={h.name} className="border border-trackflow-bg-3 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-trackflow-bg">
                <div>
                  <code className="text-[11px] font-mono text-trackflow-text">{h.name}</code>
                  <p className="text-[11px] text-trackflow-text-3 mt-0.5">{h.desc}</p>
                </div>
              </div>
              <div className="px-4 py-2.5 bg-trackflow-bg-2 border-t border-trackflow-bg-3">
                <pre className="text-[10px] font-mono text-trackflow-text-2 whitespace-pre">{h.example}</pre>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab: Preview ─────────────────────────────────────────────────────────────

function PreviewTab({ config }) {
  const [scenario, setScenario] = useState('new');
  const [interaction, setInteraction] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [prefs, setPrefs] = useState({});
  const t = config.localization.translations[config.localization.defaultLang] || {};

  const SCENARIOS = [
    { key: 'new', label: 'New visitor', desc: 'First visit, no consent stored' },
    { key: 'returning', label: 'Returning', desc: 'Has previously accepted' },
    { key: 'gdpr', label: 'EU visitor', desc: 'GDPR region, opt-in required' },
    { key: 'dnt', label: 'DNT=1', desc: 'Do Not Track set in browser' },
  ];

  const isDark = config.ui.theme === 'dark';
  const bg = isDark ? '#111' : '#fff';
  const fg = isDark ? '#f8fafc' : '#0f172a';
  const border = isDark ? '#1e293b' : '#f1f5f9';
  const subFg = isDark ? '#94a3b8' : '#64748b';
  const accent = config.ui.accentColor;
  const r = config.ui.cornerRadius;

  const showBanner = scenario === 'new' || scenario === 'gdpr';
  const autoRejected = scenario === 'dnt';
  const accepted = scenario === 'returning';

  const trackingActive = accepted || interaction === 'accept';
  const trackingBlocked = autoRejected || interaction === 'reject';

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2 flex-wrap">
        {SCENARIOS.map(s => (
          <button
            key={s.key}
            onClick={() => { setScenario(s.key); setInteraction(null); setShowManage(false); }}
            className={`px-4 py-2 rounded-lg text-[12px] cursor-pointer transition-all text-left ${scenario === s.key ? 'bg-trackflow-text text-white' : 'bg-white border border-trackflow-bg-3 text-trackflow-text-2 hover:border-trackflow-border-2'}`}
          >
            <span className="font-medium">{s.label}</span>
            <span className={`ml-2 text-[10px] ${scenario === s.key ? 'opacity-60' : 'text-trackflow-text-3'}`}>{s.desc}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_200px] gap-5">
        {/* Simulated page */}
        <div className="bg-trackflow-bg-2 rounded-xl overflow-hidden relative min-h-80 border border-trackflow-bg-3">
          {/* Mock page content */}
          <div className="p-8 opacity-40">
            <div className="h-5 bg-gray-300 rounded w-48 mb-4" />
            <div className="h-3 bg-gray-200 rounded w-full mb-2" />
            <div className="h-3 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-3 bg-gray-200 rounded w-5/6 mb-6" />
            <div className="grid grid-cols-3 gap-3">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg" />)}
            </div>
          </div>

          {/* Banner */}
          {showBanner && !interaction && (
            <div className="absolute inset-x-0 bottom-0 p-4 flex justify-center">
              <div
                style={{
                  background: bg, color: fg,
                  border: `1px solid ${border}`,
                  borderRadius: r,
                  padding: '20px 24px',
                  maxWidth: config.ui.style === 'bar' ? '100%' : '480px',
                  width: '100%',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                {t.title && <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 6px', color: fg }}>{t.title}</p>}
                <p style={{ fontSize: 12, color: subFg, margin: '0 0 16px', lineHeight: 1.6 }}>
                  {t.body || 'We use cookies to improve your experience.'}{' '}
                  <span style={{ textDecoration: 'underline', fontSize: 11, color: fg }}>{t.privacyLink || 'Privacy policy'}</span>
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button
                    onClick={() => setInteraction('accept')}
                    style={{ padding: '8px 18px', background: accent, color: '#fff', border: 'none', borderRadius: Math.min(r, 8), fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                  >
                    {t.acceptAll || 'Accept all'}
                  </button>
                  <button
                    onClick={() => setInteraction('reject')}
                    style={{ padding: '8px 18px', background: 'transparent', color: fg, border: `1px solid ${border}`, borderRadius: Math.min(r, 8), fontSize: 12, cursor: 'pointer' }}
                  >
                    {t.rejectAll || 'Reject all'}
                  </button>
                  <button
                    onClick={() => setShowManage(!showManage)}
                    style={{ padding: '8px 12px', background: 'transparent', border: 'none', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', color: subFg }}
                  >
                    {t.manage || 'Manage'}
                  </button>
                </div>
                {showManage && (
                  <div style={{ marginTop: 16, borderTop: `1px solid ${border}`, paddingTop: 12 }}>
                    {config.categories.filter(c => !c.required).map(cat => (
                      <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${border}` }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 500, margin: 0, color: fg }}>{cat.label}</p>
                          <p style={{ fontSize: 11, color: subFg, margin: 0 }}>{cat.description}</p>
                        </div>
                        <input
                          type="checkbox"
                          defaultChecked={cat.enabled}
                          onChange={e => setPrefs(p => ({ ...p, [cat.id]: e.target.checked }))}
                          style={{ width: 14, height: 14, cursor: 'pointer', accentColor: accent }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => setInteraction('manage')}
                      style={{ marginTop: 12, padding: '8px 16px', background: accent, color: '#fff', border: 'none', borderRadius: Math.min(r, 8), fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
                    >
                      {t.save || 'Save preferences'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Accepted state */}
          {(trackingActive) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-2 shadow">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[12px] font-medium text-green-700">Tracking active — all scripts unblocked</span>
              </div>
            </div>
          )}
          {trackingBlocked && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-2 shadow">
                <div className="w-2 h-2 bg-red-500 rounded-full" />
                <span className="text-[12px] font-medium text-red-700">Tracking blocked — only necessary cookies</span>
              </div>
            </div>
          )}
        </div>

        {/* State panel */}
        <div className="flex flex-col gap-3">
          <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4">
            <p className="text-[11px] font-medium text-trackflow-text-3 uppercase tracking-wide mb-2">Consent state</p>
            {config.categories.map(cat => {
              const active = cat.required || (trackingActive && cat.enabled) || (interaction === 'manage' && prefs[cat.id] !== false && cat.enabled);
              const blocked = trackingBlocked && !cat.required;
              return (
                <div key={cat.id} className="flex items-center justify-between py-1.5 border-b border-trackflow-bg-2 last:border-0">
                  <span className="text-[11px] text-trackflow-text">{cat.label}</span>
                  {cat.required ? (
                    <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">required</span>
                  ) : blocked ? (
                    <span className="text-[9px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-mono">blocked</span>
                  ) : active ? (
                    <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-mono">active</span>
                  ) : (
                    <span className="text-[9px] bg-trackflow-bg-2 text-trackflow-text-3 px-1.5 py-0.5 rounded font-mono">pending</span>
                  )}
                </div>
              );
            })}
          </div>

          {interaction && (
            <button
              onClick={() => { setInteraction(null); setShowManage(false); }}
              className="flex items-center justify-center gap-1.5 py-2 border border-trackflow-bg-3 rounded-lg text-[11px] text-trackflow-text-3 hover:text-trackflow-text cursor-pointer transition-colors"
            >
              <RefreshCw size={11} /> Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function SiteCookies() {
  const { id } = useParams();
  const [site, setSite] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState('overview');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get(`/sites/${id}`).then(data => {
      setSite(data);
      if (data.config?.consentOS) {
        setConfig(c => ({ ...c, ...data.config.consentOS }));
      }
    }).catch(() => {});
  }, [id]);

  async function save() {
    try {
      await api.patch(`/sites/${id}`, { config: { ...site?.config, consentOS: config } });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {}
  }

  const tabContent = {
    overview: <OverviewTab />,
    experience: <ExperienceTab config={config} setConfig={setConfig} />,
    logic: <LogicTab config={config} setConfig={setConfig} />,
    categories: <CategoriesTab config={config} setConfig={setConfig} />,
    content: <ContentTab config={config} setConfig={setConfig} />,
    script: <ScriptTab config={config} />,
    preview: <PreviewTab config={config} />,
  };

  return (
    <div className="flex flex-col h-full bg-trackflow-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-trackflow-bg-3 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-trackflow-bg-2 rounded-lg flex items-center justify-center">
            <Shield size={15} className="text-trackflow-text" />
          </div>
          <div>
            <h1 className="text-[14px] font-semibold text-trackflow-text leading-none">Consent OS</h1>
            <p className="text-[11px] text-trackflow-text-3 mt-0.5">Tracking control center</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab !== 'overview' && activeTab !== 'script' && activeTab !== 'preview' && (
            <button
              onClick={save}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer transition-all ${saved ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-trackflow-accent text-white hover:bg-trackflow-accent-hover'}`}
            >
              {saved ? <><Check size={12} /> Saved</> : 'Save changes'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 px-6 pt-4 pb-0 shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-t-lg text-[12px] font-medium transition-all cursor-pointer border border-b-0 ${activeTab === tab.key ? 'bg-white text-trackflow-text border-trackflow-bg-3' : 'text-trackflow-text-3 border-transparent hover:text-trackflow-text-2'}`}
            >
              <Icon size={12} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-5 border-t border-trackflow-bg-3">
        {tabContent[activeTab]}
      </div>
    </div>
  );
}