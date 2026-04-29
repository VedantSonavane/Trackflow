import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { api } from '../utils/api.js';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password };
      const data = await api.post(path, body);
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-trackflow-bg">
      <div className="flex-1 flex flex-col justify-center px-16 bg-trackflow-text text-white">
        <div className="flex items-center gap-2.5 mb-16">
          <span className="w-2 h-2 rounded-full bg-white block" />
          <span className="font-mono text-lg tracking-tight text-white">trackflow</span>
        </div>
        <div className="mb-12">
          <p className="text-[32px] font-light tracking-tight leading-tight text-white mb-2">Self-hosted analytics.</p>
          <p className="text-[15px] text-trackflow-text-3 font-light">50+ signals. Zero cookies. Full control.</p>
        </div>
        <div className="flex flex-col gap-3.5">
          {['Heatmaps & rage clicks', 'Session intelligence', 'AI anomaly detection', 'Privacy-first by design', '<5KB tracking script'].map(f => (
            <div key={f} className="flex items-center gap-3">
              <span className="w-1 h-1 rounded-full bg-trackflow-text-2 shrink-0" />
              <span className="text-[13px] text-trackflow-text-3 font-light">{f}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-10">
        <div className="w-full max-w-[360px]">
          <div className="flex mb-8 border-b border-trackflow-bg-3">
            <button 
              className={`flex-1 py-2.5 bg-none border-none text-[13px] font-sans cursor-pointer transition-colors ${mode === 'login' ? 'text-trackflow-text font-medium border-b-[1.5px] border-trackflow-text -mb-px' : 'text-trackflow-text-3'}`} 
              onClick={() => setMode('login')}
            >
              Sign in
            </button>
            <button 
              className={`flex-1 py-2.5 bg-none border-none text-[13px] font-sans cursor-pointer transition-colors ${mode === 'register' ? 'text-trackflow-text font-medium border-b-[1.5px] border-trackflow-text -mb-px' : 'text-trackflow-text-3'}`} 
              onClick={() => setMode('register')}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === 'register' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-trackflow-text-2 font-medium tracking-wide">Name</label>
                <input
                  className="px-3 py-2.5 border border-trackflow-border rounded-md text-[13px] bg-white outline-none text-trackflow-text focus:border-trackflow-border-2 transition-colors"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Your name"
                  required
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-trackflow-text-2 font-medium tracking-wide">Email</label>
              <input
                className="px-3 py-2.5 border border-trackflow-border rounded-md text-[13px] bg-white outline-none text-trackflow-text focus:border-trackflow-border-2 transition-colors"
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-trackflow-text-2 font-medium tracking-wide">Password</label>
              <input
                className="px-3 py-2.5 border border-trackflow-border rounded-md text-[13px] bg-white outline-none text-trackflow-text focus:border-trackflow-border-2 transition-colors"
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'}
                required
              />
            </div>
            {error && <p className="text-xs text-trackflow-red px-3 py-2 bg-red-50 rounded-md border border-red-200">{error}</p>}
            <button 
              className="mt-1 py-2.5 bg-trackflow-accent text-white border-none rounded-md text-[13px] font-medium cursor-pointer font-sans hover:bg-trackflow-accent-hover transition-colors disabled:opacity-60"
              disabled={loading} 
              type="submit"
            >
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
