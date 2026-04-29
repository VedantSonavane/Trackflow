import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Map } from 'lucide-react';

export default function SiteHeatmap() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [selectedUrl, setSelectedUrl] = useState('');
  const [mode, setMode] = useState('click'); // 'click' or 'move'
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get(`/analytics/${id}/heatmap`).then(d => {
      setData(d);
      if (d.urls?.length) setSelectedUrl(d.urls[0]);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    drawHeatmap();
  }, [data, selectedUrl, mode]);

  function drawHeatmap() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const points = data.points.filter(p => {
      const urlMatch = !selectedUrl || data.urls.find(u => u === selectedUrl)
        ? (selectedUrl ? p.url === selectedUrl || p.url?.includes(selectedUrl) : true)
        : true;
      return p.type === mode && urlMatch;
    });

    if (!points.length) {
      ctx.fillStyle = '#888';
      ctx.font = '14px DM Sans, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No data for this view', W / 2, H / 2);
      return;
    }

    // Draw gradient blobs per point
    points.forEach(p => {
      const x = p.x * W;
      const y = p.y * H;
      const r = mode === 'click' ? 40 : 20;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (mode === 'click') {
        grad.addColorStop(0, 'rgba(17,17,16,0.15)');
        grad.addColorStop(1, 'rgba(17,17,16,0)');
      } else {
        grad.addColorStop(0, 'rgba(80,80,80,0.06)');
        grad.addColorStop(1, 'rgba(80,80,80,0)');
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Overlay click dots
    if (mode === 'click') {
      points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x * W, p.y * H, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(17,17,16,0.5)';
        ctx.fill();
      });
    }
  }

  return (
    <div className="p-6 flex-1 overflow-auto  ">
      <div className="mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Heatmap</h1>
          <p className="text-[13px] text-trackflow-text-3 mt-0.5">Click and mouse movement density visualization</p>
        </div>
      </div>

      <div className="flex gap-3 mb-5 items-center">
        <div className="flex gap-0.5 bg-trackflow-bg-2 rounded-md p-0.5">
          {['click', 'move'].map(m => (
            <button 
              key={m} 
              className={`px-3.5 py-1 bg-none border-none rounded text-xs font-sans cursor-pointer transition-all ${mode === m ? 'bg-white text-trackflow-text font-medium shadow-sm' : 'text-trackflow-text-2'}`}
              onClick={() => setMode(m)}
            >
              {m === 'click' ? 'Click map' : 'Move map'}
            </button>
          ))}
        </div>

        {data?.urls?.length > 0 && (
          <select 
            className="px-2.5 py-1.5 border border-trackflow-border rounded-md text-xs bg-white font-sans text-trackflow-text-2 outline-none"
            value={selectedUrl} 
            onChange={e => setSelectedUrl(e.target.value)}
          >
            <option value="">All pages</option>
            {data.urls.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}
      </div>

      <div className="bg-white border border-trackflow-bg-3 rounded-[10px] overflow-hidden min-h-[500px] flex items-center justify-center">
        {(!data || !data.points?.length) ? (
          <div className="flex flex-col items-center gap-2.5 p-16">
            <Map size={32} strokeWidth={1} className="text-gray-300" />
            <p className="text-sm font-medium text-trackflow-text-2">No heatmap data yet</p>
            <p className="text-xs text-trackflow-text-3">Data will appear here once your site receives traffic</p>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="block w-full h-auto"
          />
        )}
      </div>

      {data && (
        <div className="flex gap-6 mt-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[22px] font-light text-trackflow-text font-mono tracking-tight">{data.points.filter(p => p.type === 'click').length.toLocaleString()}</span>
            <span className="text-[11px] text-trackflow-text-3">Click points</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[22px] font-light text-trackflow-text font-mono tracking-tight">{data.points.filter(p => p.type === 'move').length.toLocaleString()}</span>
            <span className="text-[11px] text-trackflow-text-3">Move points</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[22px] font-light text-trackflow-text font-mono tracking-tight">{data.urls?.length || 0}</span>
            <span className="text-[11px] text-trackflow-text-3">Tracked pages</span>
          </div>
        </div>
      )}
    </div>
  );
}
