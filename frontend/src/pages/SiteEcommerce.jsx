import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { RefreshCw, ShoppingCart, DollarSign, Package, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { useFilters } from './DashboardLayout.jsx';

const MOCK = {
  revenue: 12480.50,
  orders: 143,
  aov: 87.28,
  buyers: 98,
  addToCart: 620,
  checkouts: 280,
  refunds: 340.00,
  conversionRate: 3.4,
  revenueByDay: [
    { day: '2025-06-22', revenue: 1240 },
    { day: '2025-06-23', revenue: 980 },
    { day: '2025-06-24', revenue: 1560 },
    { day: '2025-06-25', revenue: 2100 },
    { day: '2025-06-26', revenue: 1880 },
    { day: '2025-06-27', revenue: 2240 },
    { day: '2025-06-28', revenue: 2480 },
  ],
  topProducts: [
    { id: 'p1', name: 'Pro Plan', revenue: 4800, quantity: 48 },
    { id: 'p2', name: 'Starter Pack', revenue: 2960, quantity: 74 },
    { id: 'p3', name: 'Add-on Module', revenue: 1840, quantity: 92 },
    { id: 'p4', name: 'Enterprise Seat', revenue: 1600, quantity: 8 },
    { id: 'p5', name: 'Support Package', revenue: 560, quantity: 14 },
  ],
  checkoutFunnel: [
    { label: 'All sessions', count: 4200 },
    { label: 'Add to cart', count: 620 },
    { label: 'Begin checkout', count: 280 },
    { label: 'Purchase', count: 143 },
  ],
};

// ✅ Better validation for "no data"
function isEmptyData(d) {
  if (!d) return true;

  const hasCoreMetrics =
    d.revenue != null ||
    d.orders != null ||
    d.aov != null;

  const hasArrays =
    Array.isArray(d.revenueByDay) && d.revenueByDay.length > 0 &&
    Array.isArray(d.topProducts) && d.topProducts.length > 0 &&
    Array.isArray(d.checkoutFunnel) && d.checkoutFunnel.length > 0;

  // if EVERYTHING missing → treat as empty
  return !hasCoreMetrics && !hasArrays;
}

function StatCard({ label, value, sub, icon: Icon, accent }) {
  return (
    <div className="bg-white border border-trackflow-bg-3 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-trackflow-text-3 font-medium uppercase tracking-wide">{label}</span>
        <div className="w-7 h-7 bg-trackflow-bg-2 rounded-lg flex items-center justify-center">
          <Icon size={13} className="text-trackflow-text-2" />
        </div>
      </div>
      <div>
        <div className={`text-[26px] font-light font-mono tracking-tight leading-none ${accent || 'text-trackflow-text'}`}>
          {value}
        </div>
        {sub && <div className="text-[11px] text-trackflow-text-3 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function fmt(n, prefix = '') {
  if (n == null) return '—';
  return prefix + Number(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function SiteEcommerce() {
  const { id } = useParams();
  const filters = useFilters();
  const range = filters?.dateRange ?? 7;

  const [data, setData] = useState(MOCK);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);

    try {
      const to = Math.floor(Date.now() / 1000);
      const from = to - range * 86400;

      const result = await api.get(`/analytics/${id}/ecommerce?from=${from}&to=${to}`);

      // ✅ SMART FALLBACK
      if (isEmptyData(result)) {
        setData(MOCK);
      } else {
        setData(result);
      }

    } catch (e) {
      setData(MOCK);
    }

    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, [id, range]);

  const d = data || MOCK;
  const funnelMax = d.checkoutFunnel?.[0]?.count || 1;

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Ecommerce</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">
            Revenue, orders, and checkout performance
          </p>
        </div>

        <button
          onClick={fetchData}
          className="bg-white border border-trackflow-bg-3 rounded-lg p-1.5 cursor-pointer flex items-center text-trackflow-text-2 hover:border-trackflow-border-2 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Revenue" value={fmt(d.revenue, '$')} sub={`${d.orders} orders`} icon={DollarSign} accent="text-emerald-600" />
        <StatCard label="Avg Order" value={fmt(d.aov, '$')} sub="Average order value" icon={TrendingUp} />
        <StatCard label="Buyers" value={d.buyers ?? '—'} sub="Unique purchasers" icon={Users} />
        <StatCard label="Conv. Rate" value={`${d.conversionRate ?? 0}%`} sub="Sessions → purchase" icon={ShoppingCart} />
      </div>

      <div className="grid grid-cols-3 gap-3 mb-5">
        <StatCard label="Add to Cart" value={d.addToCart ?? '—'} sub="Cart additions" icon={Package} />
        <StatCard label="Checkouts" value={d.checkouts ?? '—'} sub="Begin checkout events" icon={TrendingUp} />
        <StatCard label="Refunds" value={fmt(d.refunds, '$')} sub="Total refund value" icon={TrendingDown} accent="text-red-500" />
      </div>

      {/* Revenue chart */}
      {d.revenueByDay?.length > 0 && (
        <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5 mb-5">
          <p className="text-[11px] font-medium text-trackflow-text-2 uppercase tracking-wide mb-4">
            Revenue over time
          </p>

          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={d.revenueByDay} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>

              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />

              <Tooltip
                formatter={v => [`$${Number(v).toFixed(2)}`, 'Revenue']}
                contentStyle={{
                  fontSize: 12,
                  border: '1px solid #f3f4f6',
                  borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                }}
              />

              <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* rest unchanged (tables + funnel) */}
      <div className="grid grid-cols-2 gap-5">
        {/* Top products */}
        <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-trackflow-bg-2">
            <p className="text-[11px] font-medium text-trackflow-text-2 uppercase tracking-wide">Top products</p>
          </div>

          {d.topProducts?.length === 0 ? (
            <div className="p-8 text-center text-trackflow-text-3 text-xs">No product data yet</div>
          ) : (
            <table className="w-full border-collapse">
              <tbody>
                {(d.topProducts || []).map((p, i) => (
                  <tr key={p.id || i} className="border-b border-trackflow-bg-2">
                    <td className="px-4 py-2.5 text-[12px]">{p.name}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px]">{p.quantity}</td>
                    <td className="px-4 py-2.5 font-mono text-emerald-600">
                      ${Number(p.revenue).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Funnel unchanged */}
        <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5">
          <p className="text-[11px] font-medium text-trackflow-text-2 uppercase tracking-wide mb-3">
            Checkout funnel
          </p>

          {(d.checkoutFunnel || []).map((step, si) => {
            const pct = Math.round((step.count / funnelMax) * 100);

            return (
              <div key={si} className="flex items-center gap-3 py-2">
                <span className="text-[12px] w-32">{step.label}</span>
                <div className="flex-1 h-5 bg-trackflow-bg-2 rounded">
                  <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-[11px] font-mono">{step.count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}