import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { RefreshCw, TrendingDown, Plus, X, ShoppingCart } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MOCK_FUNNELS = [
  {
    name: 'Signup funnel',
    steps: [
      { label: 'Landing page', count: 2400 },
      { label: 'Pricing page', count: 1320 },
      { label: 'Register page', count: 680 },
      { label: 'Confirmed', count: 310 },
    ],
  },
];

const MOCK_ECOM_FUNNEL = [
  { label: 'All sessions',   count: 4200 },
  { label: 'Add to cart',    count: 1840 },
  { label: 'Begin checkout', count: 920 },
  { label: 'Purchase',       count: 310 },
];

function FunnelCard({ funnel }) {
  const maxCount = funnel.steps[0]?.count || 1;
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-trackflow-bg-2 flex items-center gap-2">
        <TrendingDown size={13} className="text-trackflow-text-3" />
        <h3 className="text-[13px] font-medium text-trackflow-text">{funnel.name}</h3>
      </div>
      <div className="p-6 flex flex-col gap-0">
        {funnel.steps.map((step, si) => {
          const pct     = Math.round((step.count / maxCount) * 100);
          const dropOff = si > 0 ? Math.round(((funnel.steps[si-1].count - step.count) / funnel.steps[si-1].count) * 100) : null;
          return (
            <div key={si}>
              <div className="flex items-center gap-4 py-3">
                <div className="w-5 h-5 rounded-full bg-trackflow-bg-2 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-mono text-trackflow-text-3">{si+1}</span>
                </div>
                <div className="w-36 shrink-0">
                  <span className="text-xs text-trackflow-text-2 truncate block">{step.label}</span>
                </div>
                <div className="flex-1 h-7 bg-trackflow-bg-2 rounded-md overflow-hidden">
                  <div className="h-full bg-trackflow-text rounded-md transition-all duration-700" style={{ width:`${pct}%`, minWidth: pct>0?'2px':0 }} />
                </div>
                <div className="w-28 shrink-0 flex items-center justify-between gap-2">
                  <span className="font-mono text-[12px] text-trackflow-text">{step.count.toLocaleString()}</span>
                  <span className="text-[10px] text-trackflow-text-3">{pct}%</span>
                </div>
                <div className="w-14 shrink-0 text-right">
                  {dropOff !== null && <span className="text-[10px] text-red-400 font-medium">-{dropOff}%</span>}
                </div>
              </div>
              {si < funnel.steps.length - 1 && <div className="ml-[38px] h-3 w-px bg-trackflow-bg-3" />}
            </div>
          );
        })}
      </div>
      <div className="px-6 py-3 border-t border-trackflow-bg-2 bg-trackflow-bg flex gap-6">
        <div><span className="text-[10px] text-trackflow-text-3 uppercase tracking-wide">Total entered</span><span className="ml-2 font-mono text-[12px] text-trackflow-text">{funnel.steps[0]?.count.toLocaleString()}</span></div>
        <div><span className="text-[10px] text-trackflow-text-3 uppercase tracking-wide">Completed</span><span className="ml-2 font-mono text-[12px] text-trackflow-text">{funnel.steps[funnel.steps.length-1]?.count.toLocaleString()}</span></div>
        <div><span className="text-[10px] text-trackflow-text-3 uppercase tracking-wide">Overall rate</span><span className="ml-2 font-mono text-[12px] text-trackflow-text">{Math.round((funnel.steps[funnel.steps.length-1]?.count / funnel.steps[0]?.count) * 100)}%</span></div>
      </div>
    </div>
  );
}

export default function SiteFunnels() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [mode, setMode]             = useState('pages');   // 'pages' | 'ecommerce'
  const [funnels, setFunnels]       = useState(null);
  const [ecomFunnel, setEcomFunnel] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [customSteps, setCustomSteps] = useState([]);
  const [stepInput, setStepInput]   = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const to   = Math.floor(Date.now() / 1000);
  const from = to - range * 86400;

  async function fetchFunnels(steps) {
    setLoading(true);
    try {
      const stepsParam = steps?.length ? `&steps=${steps.join(',')}` : '';
      const result = await api.get(`/analytics/${id}/funnels?from=${from}&to=${to}${stepsParam}`);
      setFunnels(result?.length ? result : MOCK_FUNNELS);
    } catch { setFunnels(MOCK_FUNNELS); }
    setLoading(false);
  }

  async function fetchEcomFunnel() {
    setLoading(true);
    try {
      const data = await api.get(`/analytics/${id}/ecommerce?from=${from}&to=${to}`);
      if (data?.checkoutFunnel?.length) {
        setEcomFunnel(data.checkoutFunnel);
      } else {
        setEcomFunnel(MOCK_ECOM_FUNNEL);
      }
    } catch { setEcomFunnel(MOCK_ECOM_FUNNEL); }
    setLoading(false);
  }

  useEffect(() => {
    if (mode === 'pages') fetchFunnels(customSteps);
    else fetchEcomFunnel();
  }, [id, range, mode]);

  function addStep() {
    const val = stepInput.trim();
    if (!val || customSteps.includes(val)) return;
    const next = [...customSteps, val];
    setCustomSteps(next); setStepInput('');
    fetchFunnels(next);
  }

  function removeStep(s) {
    const next = customSteps.filter(x => x !== s);
    setCustomSteps(next); fetchFunnels(next);
  }

  const ecomSteps = ecomFunnel ? [{ name: 'Checkout funnel', steps: ecomFunnel }] : [];

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Funnels</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Step-by-step conversion analysis</p>
        </div>
        <div className="flex gap-2">
          {mode === 'pages' && (
            <button
              onClick={() => setShowCustom(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs cursor-pointer font-sans transition-colors ${showCustom ? 'bg-trackflow-text text-white border-trackflow-text' : 'bg-white border-trackflow-bg-3 text-trackflow-text-2'}`}
            >
              <Plus size={12} /> Custom steps
            </button>
          )}
          <button
            onClick={() => mode === 'pages' ? fetchFunnels(customSteps) : fetchEcomFunnel()}
            className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-0.5 bg-trackflow-bg-2 rounded-md p-0.5 w-fit mb-5">
        <button onClick={() => setMode('pages')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[12px] font-sans cursor-pointer transition-all ${mode==='pages'?'bg-white text-trackflow-text font-medium shadow-sm':'text-trackflow-text-2'}`}>
          <TrendingDown size={12} /> Page funnels
        </button>
        <button onClick={() => setMode('ecommerce')} className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded text-[12px] font-sans cursor-pointer transition-all ${mode==='ecommerce'?'bg-white text-trackflow-text font-medium shadow-sm':'text-trackflow-text-2'}`}>
          <ShoppingCart size={12} /> Checkout funnel
        </button>
      </div>

      {mode === 'pages' && showCustom && (
        <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4 mb-5">
          <p className="text-[11px] text-trackflow-text-3 mb-3">Enter page paths (e.g. <code className="font-mono bg-trackflow-bg-2 px-1 rounded">/pricing</code>)</p>
          <div className="flex gap-2 mb-3">
            <input value={stepInput} onChange={e=>setStepInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addStep()} placeholder="/pricing"
              className="flex-1 px-2.5 py-1.5 border border-trackflow-border rounded-md text-[12px] font-mono outline-none focus:border-trackflow-border-2 bg-trackflow-bg" />
            <button onClick={addStep} className="px-3 py-1.5 bg-trackflow-accent text-white rounded-md text-xs font-sans cursor-pointer hover:bg-trackflow-accent-hover">Add</button>
          </div>
          {customSteps.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {customSteps.map((s,i) => (
                <div key={s} className="flex items-center gap-1 bg-trackflow-bg-2 rounded px-2 py-0.5">
                  <span className="text-[10px] text-trackflow-text-3 font-mono">{i+1}</span>
                  <span className="text-[11px] font-mono text-trackflow-text">{s}</span>
                  <button onClick={()=>removeStep(s)} className="text-trackflow-text-3 hover:text-red-500 ml-1"><X size={10}/></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center text-trackflow-text-3 text-sm">Loading…</div>
      ) : (
        <div className="flex flex-col gap-5">
          {mode === 'pages' && funnels?.map((f,i) => <FunnelCard key={i} funnel={f} />)}
          {mode === 'ecommerce' && ecomSteps.map((f,i) => <FunnelCard key={i} funnel={f} />)}
        </div>
      )}
    </div>
  );
}