import React, { useState, createContext, useContext, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../utils/api.js';
import { BarChart2, Zap, Map, Code, LogOut, ChevronLeft, ChevronRight, Bell, Search, Activity, Layers, GitFork, Navigation, Users, Terminal, TrendingUp, Cookie, ShoppingCart, Filter } from 'lucide-react';
import logo from "./logo2.svg";

export const FilterContext = createContext({});
export const useFilters = () => useContext(FilterContext);

const COUNTRIES = ['All countries', 'United States', 'United Kingdom', 'India', 'Germany', 'France', 'Canada', 'Australia', 'Brazil', 'Japan', 'Other'];
const DEVICES = ['All devices', 'Desktop', 'Mobile', 'Tablet'];
const SOURCES = ['All sources', 'Direct', 'Organic search', 'Paid search', 'Social', 'Email', 'Referral'];
const DATE_RANGES = [
  { label: '24h', days: 1 },
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
];

function FilterSelect({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-7 px-2.5 text-[11px] border border-trackflow-bg-3 rounded-md bg-white text-trackflow-text-2 outline-none font-sans appearance-none cursor-pointer hover:border-trackflow-border-2 transition-colors"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

export default function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsed, setCollapsed] = useState(false);

  const [dateRange, setDateRangeState] = useState(() => parseInt(searchParams.get('range') || '7'));
  const [country, setCountryState] = useState(() => searchParams.get('country') || 'All countries');
  const [device, setDeviceState] = useState(() => searchParams.get('device') || 'All devices');
  const [source, setSourceState] = useState(() => searchParams.get('source') || 'All sources');
  const [segment, setSegmentState] = useState(() => searchParams.get('segment') || '');
  const [segmentsList, setSegmentsList] = useState([]);

  function updateParam(key, value, defaultValue) {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      if (value === defaultValue) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }

  function setDateRange(v) { setDateRangeState(v); updateParam('range', v, 7); }
  function setCountry(v) { setCountryState(v); updateParam('country', v, 'All countries'); }
  function setDevice(v) { setDeviceState(v); updateParam('device', v, 'All devices'); }
  function setSource(v) { setSourceState(v); updateParam('source', v, 'All sources'); }
  function setSegment(v) { setSegmentState(v); updateParam('segment', v, ''); }

  useEffect(() => {
    if (!id) return;
    api.get(`/analytics/${id}/segments`).then(setSegmentsList).catch(() => setSegmentsList([]));
  }, [id]);

  function handleLogout() { logout(); navigate('/auth'); }

  const inSite = location.pathname.startsWith('/sites/');
  const filters = { dateRange, country, device, source, segment };
  const hasActiveFilters = country !== 'All countries' || device !== 'All devices' || source !== 'All sources' || segment;

  const siteNavItems = [
    { to: `/sites/${id}`, label: 'Overview', icon: BarChart2, end: true },
    { to: `/sites/${id}/users`, label: 'Users', icon: Users },
    { to: `/sites/${id}/scroll`, label: 'Scroll', icon: Layers },
    { to: `/sites/${id}/funnels`, label: 'Funnels', icon: GitFork },
    { to: `/sites/${id}/retention`, label: 'Retention', icon: Activity },
    { to: `/sites/${id}/flow`, label: 'Flow', icon: Navigation },
    { to: `/sites/${id}/sources`, label: 'Sources', icon: TrendingUp },
    { to: `/sites/${id}/events`, label: 'Events', icon: Zap },
    { to: `/sites/${id}/debugger`, label: 'Debugger', icon: Terminal },
    { to: `/sites/${id}/heatmap`, label: 'Heatmap', icon: Map },
    { to: `/sites/${id}/ecommerce`, label: 'Ecommerce', icon: ShoppingCart },
    { to: `/sites/${id}/segments`, label: 'Segments', icon: Filter },
    { to: `/sites/${id}/cookies`, label: 'Cookies', icon: Cookie },
    { to: `/sites/${id}/generate`, label: 'Script', icon: Code },
  ];

  return (
    <FilterContext.Provider value={filters}>
      <div className="flex min-h-screen bg-trackflow-bg">
        <aside
          style={{ transition: 'width 0.22s cubic-bezier(.4,0,.2,1)' }}
          className={`${collapsed ? 'w-[64px]' : 'w-[150px]'} bg-white border-r border-trackflow-bg-3 flex flex-col py-5 shrink-0 sticky top-0 h-screen overflow-hidden`}
        >
          <div className="flex flex-col items-center mb-7">
            <img src={logo} alt="Trackflow" className="h-24 w-auto" />
          </div>

          <div className="flex-1 flex flex-col overflow-y-auto">
            {inSite && id && (
              <nav className="flex flex-col gap-0.5 px-2">
                {!collapsed && (
                  <NavLink to="/" className="flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs text-trackflow-text-3 rounded no-underline mb-0.5 hover:bg-trackflow-bg-2">
                    <ChevronLeft size={13} />
                    Back
                  </NavLink>
                )}
                <div className="h-px bg-trackflow-bg-3 my-2" />
                {siteNavItems.map(({ to, label, icon: Icon, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      `flex items-center justify-left gap-2 py-2 px-2 text-[13px] rounded no-underline transition-colors ${
                        isActive ? 'text-trackflow-text bg-trackflow-bg-2 font-medium' : 'text-trackflow-text-2 hover:bg-trackflow-bg-2'
                      }`
                    }
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    {!collapsed && label}
                  </NavLink>
                ))}
              </nav>
            )}

            {!inSite && (
              <nav className="flex flex-col gap-0.5 px-2">
                <NavLink
                  to="/"
                  end
                  title={collapsed ? 'Sites' : undefined}
                  className={({ isActive }) =>
                    `flex items-center justify-center gap-2 py-2 px-2 text-[13px] rounded no-underline transition-colors ${
                      isActive ? 'text-trackflow-text bg-trackflow-bg-2 font-medium' : 'text-trackflow-text-2 hover:bg-trackflow-bg-2'
                    }`
                  }
                >
                  <Activity size={14} strokeWidth={1.5} />
                  {!collapsed && 'Sites'}
                </NavLink>
              </nav>
            )}
          </div>

          <div className="px-3 pb-3 flex flex-col items-center gap-3">
            <button
              onClick={() => setCollapsed(v => !v)}
              className="w-8 h-8 rounded-full bg-trackflow-bg-2 flex items-center justify-center text-trackflow-text-3 hover:text-trackflow-text"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-md py-2 text-xs font-medium transition bg-red-50 text-red-600 hover:bg-red-100"
            >
              <LogOut size={14} strokeWidth={1.5} />
              {!collapsed && 'Logout'}
            </button>
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-[52px] bg-white border-b border-trackflow-bg-3 flex items-center px-6 gap-4 sticky top-0 z-20">
            <div className="flex-1 flex items-center gap-2 bg-trackflow-bg rounded-md px-3 py-1.5 max-w-[280px]">
              <Search size={13} className="text-trackflow-text-3 shrink-0" />
              <input
                type="text"
                placeholder="Search…"
                className="bg-transparent border-none outline-none text-xs text-trackflow-text font-sans placeholder:text-trackflow-text-3 w-full"
              />
            </div>
            <div className="flex-1" />
            <button className="bg-transparent border-none text-trackflow-text-3 cursor-pointer p-1.5 flex items-center rounded hover:bg-trackflow-bg-2 hover:text-trackflow-text relative">
              <Bell size={15} strokeWidth={1.5} />
              <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-trackflow-accent rounded-full" />
            </button>
          </header>

          {inSite && (
            <div className="bg-white border-b border-trackflow-bg-3 px-6 py-2 flex items-center gap-3 flex-wrap sticky top-[52px] z-10">
              <span className="text-[10px] text-trackflow-text-3 font-medium tracking-widest shrink-0 uppercase">Filters</span>
              <div className="h-4 w-px bg-trackflow-bg-3" />
              <div className="flex gap-0.5 bg-trackflow-bg-2 rounded-md p-0.5">
                {DATE_RANGES.map(r => (
                  <button
                    key={r.days}
                    onClick={() => setDateRange(r.days)}
                    className={`px-2.5 py-1 rounded text-[11px] font-sans cursor-pointer transition-all whitespace-nowrap ${
                      dateRange === r.days ? 'bg-white text-trackflow-text font-medium shadow-sm' : 'text-trackflow-text-2 hover:bg-white/50'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <div className="h-4 w-px bg-trackflow-bg-3" />
              <FilterSelect value={country} onChange={setCountry} options={COUNTRIES} />
              <FilterSelect value={device} onChange={setDevice} options={DEVICES} />
              <FilterSelect value={source} onChange={setSource} options={SOURCES} />
              <div className="h-4 w-px bg-trackflow-bg-3" />
              <select
                value={segment}
                onChange={e => setSegment(e.target.value)}
                className="h-7 px-2.5 text-[11px] border border-trackflow-bg-3 rounded-md bg-white text-trackflow-text-2 outline-none font-sans appearance-none cursor-pointer hover:border-trackflow-border-2 transition-colors"
              >
                <option value="">All users (no segment)</option>
                {segmentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={() => { setCountry('All countries'); setDevice('All devices'); setSource('All sources'); setSegment(''); }}
                  className="text-[11px] text-trackflow-accent hover:underline transition-colors ml-1"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          <main className="flex-1 min-w-0 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </FilterContext.Provider>
  );
}