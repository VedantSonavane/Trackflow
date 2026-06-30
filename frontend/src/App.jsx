import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import DashboardLayout from './pages/DashboardLayout.jsx';
import SitesList from './pages/SitesList.jsx';
import SiteUsers from './pages/SiteUsers.jsx';
import SiteEcommerce from './pages/SiteEcommerce.jsx';
import SiteSegments from './pages/SiteSegments.jsx';

import SiteOverview from './pages/SiteOverview.jsx';
import SiteGenerator from './pages/SiteGenerator.jsx';
import SiteHeatmap from './pages/SiteHeatmap.jsx';
import SiteEvents from './pages/SiteEvents.jsx';
import SiteRetention from './pages/SiteRetention.jsx';
import SiteDebugger from './pages/SiteDebugger.jsx';
import SiteScroll from './pages/SiteScroll.jsx';
import SiteSources from './pages/SiteSources.jsx';
import SiteCookies from './pages/SiteCookies.jsx';
import SiteFunnels from './pages/SiteFunnels.jsx';
import SiteFlow from './pages/SiteFlow.jsx';
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen text-gray-500">loading…</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route index element={<SitesList />} />
            <Route path="sites/:id" element={<SiteOverview />} />
            <Route path="/sites/:id/scroll" element={<SiteScroll />} />
            <Route path="/sites/:id/funnels" element={<SiteFunnels />} />
           <Route path="/sites/:id/users" element={<SiteUsers />} />
<Route path="/sites/:id/ecommerce" element={<SiteEcommerce />} />
<Route path="/sites/:id/segments" element={<SiteSegments />} />

            <Route path="/sites/:id/retention" element={<SiteRetention />} />
            <Route path="/sites/:id/debugger" element={<SiteDebugger />} />
            <Route path="/sites/:id/flow" element={<SiteFlow />} />
            <Route path="/sites/:id/sources" element={<SiteSources />} />
            <Route path="/sites/:id/cookies" element={<SiteCookies />} />
            <Route path="sites/:id/generate" element={<SiteGenerator />} />
            <Route path="sites/:id/heatmap" element={<SiteHeatmap />} />
            <Route path="sites/:id/events" element={<SiteEvents />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}