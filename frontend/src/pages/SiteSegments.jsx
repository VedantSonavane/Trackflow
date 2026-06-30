import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../utils/api.js';
import { Plus, Trash2, Filter, Check } from 'lucide-react';

const FIELDS = [
  { key: 'country', label: 'Country', ops: ['eq', 'neq'] },
  { key: 'device_type', label: 'Device', ops: ['eq', 'neq'] },
  { key: 'browser', label: 'Browser', ops: ['eq', 'neq', 'contains'] },
  { key: 'source', label: 'Source', ops: ['eq', 'neq', 'contains'] },
  { key: 'medium', label: 'Medium', ops: ['eq', 'neq'] },
  { key: 'event', label: 'Event type', ops: ['eq'] },
  { key: 'date', label: 'Date (last N days)', ops: ['within'] },
  { key: 'sequence', label: 'Sequence (did A then B)', ops: ['followedBy'] },
];

function emptyRow() {
  return { field: 'country', op: 'eq', value: '' };
}
function emptySequenceRow() {
  return { field: 'sequence', op: 'followedBy', first: '', then: '', withinDays: 7 };
}

export default function SiteSegments() {
  const { id } = useParams();
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);

  async function fetchSegments() {
    setLoading(true);
    try { setSegments(await api.get(`/analytics/${id}/segments`)); } catch { setSegments([]); }
    setLoading(false);
  }
  useEffect(() => { fetchSegments(); }, [id]);

  function updateRow(i, key, val) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [key]: val } : row));
  }
  function addRow() { setRows(r => [...r, emptyRow()]); }
  function removeRow(i) { setRows(r => r.filter((_, idx) => idx !== i)); }

  async function saveSegment() {
    if (!name.trim()) return;
    const invalid = rows.some(r => r.field === 'sequence' ? (!r.first || !r.then) : (!r.value && r.op !== 'within'));
    if (invalid) return;
    setSaving(true);
    try {
      await api.post(`/analytics/${id}/segments`, { name: name.trim(), filters: rows });
      setName('');
      setRows([emptyRow()]);
      fetchSegments();
    } catch {}
    setSaving(false);
  }

  async function deleteSegment(segId) {
    await api.delete(`/analytics/${id}/segments/${segId}`);
    setSegments(s => s.filter(x => x.id !== segId));
  }

  return (
    <div className="p-6 flex-1 overflow-auto bg-trackflow-bg">
      <div className="mb-6">
        <h1 className="text-xl font-medium tracking-tight text-trackflow-text">Segments</h1>
        <p className="text-[13px] text-trackflow-text-3 mt-0.5">Build and save filters to scope your dashboard</p>
      </div>

      {/* Builder */}
      <div className="bg-white border border-trackflow-bg-3 rounded-xl p-5 mb-6">
        <h3 className="text-[13px] font-medium text-trackflow-text mb-3">New segment</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Segment name (e.g. India mobile users)"
          className="w-full mb-3 px-3 py-2 border border-trackflow-border rounded-lg text-[12px] bg-trackflow-bg outline-none focus:border-trackflow-border-2"
        />
        <div className="flex flex-col gap-2 mb-3">
          {rows.map((row, i) => {
            const fieldDef = FIELDS.find(f => f.key === row.field);
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={row.field}
                  onChange={e => {
                    const f = FIELDS.find(x => x.key === e.target.value);
                    if (e.target.value === 'sequence') { setRows(r => r.map((rr, idx) => idx === i ? emptySequenceRow() : rr)); return; }
                    updateRow(i, 'field', e.target.value);
                    updateRow(i, 'op', f.ops[0]);
                  }}
                  className="px-2 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-white outline-none"
                >
                  {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                {row.field === 'sequence' ? (
                  <>
                    <input value={row.first} onChange={e => updateRow(i, 'first', e.target.value)} placeholder="first event (e.g. add_to_cart)"
                      className="flex-1 px-2.5 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-trackflow-bg outline-none" />
                    <span className="text-[11px] text-trackflow-text-3 shrink-0">followed by</span>
                    <input value={row.then} onChange={e => updateRow(i, 'then', e.target.value)} placeholder="then event (e.g. purchase)"
                      className="flex-1 px-2.5 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-trackflow-bg outline-none" />
                    <span className="text-[11px] text-trackflow-text-3 shrink-0">within</span>
                    <input type="number" value={row.withinDays} onChange={e => updateRow(i, 'withinDays', e.target.value)} placeholder="7"
                      className="w-16 px-2 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-trackflow-bg outline-none" />
                    <span className="text-[11px] text-trackflow-text-3 shrink-0">days</span>
                  </>
                ) : (
                  <>
                <select
                  value={row.op}
                  onChange={e => updateRow(i, 'op', e.target.value)}
                  className="px-2 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-white outline-none"
                >
                  {fieldDef.ops.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <input
                  value={row.value}
                  onChange={e => updateRow(i, 'value', e.target.value)}
                  placeholder={row.field === 'date' ? 'days, e.g. 7' : 'value'}
                  className="flex-1 px-2.5 py-1.5 border border-trackflow-border rounded-md text-[12px] bg-trackflow-bg outline-none"
                />
                  </>
                )}
                <button onClick={() => removeRow(i)} className="p-1.5 text-trackflow-text-3 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button onClick={addRow} className="flex items-center gap-1 text-[11px] text-trackflow-text-2 hover:text-trackflow-text px-2 py-1">
            <Plus size={11} /> Add filter
          </button>
          <div className="flex-1" />
          <button
            onClick={saveSegment}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 bg-trackflow-accent text-white rounded-md text-[12px] font-medium cursor-pointer hover:bg-trackflow-accent-hover disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save segment'}
          </button>
        </div>
      </div>

      {/* Saved list */}
      <div className="bg-white border border-trackflow-bg-3 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-trackflow-bg-2 flex items-center gap-2">
          <Filter size={13} className="text-trackflow-text-3" />
          <h3 className="text-[11px] font-medium text-trackflow-text-2 tracking-wide uppercase">Saved segments</h3>
        </div>
        {loading ? (
          <div className="p-8 text-center text-trackflow-text-3 text-sm">Loading…</div>
        ) : segments.length === 0 ? (
          <div className="p-8 text-center text-trackflow-text-3 text-sm">No segments yet</div>
        ) : (
          <div className="divide-y divide-trackflow-bg-2">
            {segments.map(seg => (
              <div key={seg.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-trackflow-text">{seg.name}</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {(seg.filters || []).map((f, i) => (
                      <span key={i} className="text-[10px] bg-trackflow-bg-2 text-trackflow-text-3 px-1.5 py-0.5 rounded font-mono">
                        {f.field === 'sequence' ? `${f.first} → ${f.then} (${f.withinDays}d)` : `${f.field} ${f.op} ${f.value}`}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteSegment(seg.id)} className="p-1.5 text-trackflow-text-3 hover:text-red-500">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}