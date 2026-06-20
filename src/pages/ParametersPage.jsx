import { useState, useEffect } from 'react';
import { Truck, Clock, Box, Users, Zap, Save, Info, CheckCircle2 } from 'lucide-react';
import { getParameters, saveParameters } from '../api';

function hhmmFromMin(m) { return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
function minFromHHMM(s) { const [h, m] = s.split(':').map(Number); return h * 60 + m; }

const opMeta = {
  LOAD: { label: 'LOAD', sub: 'Chargement', color: 'var(--success)', bg: '#E7F6EC' },
  UNLOAD: { label: 'UNLOAD', sub: 'Déchargement', color: '#B45309', bg: '#FEF3E2' },
  LOAD_UNLOAD: { label: 'LOAD + UNLOAD', sub: 'Chargement + Déchargement', color: '#7C3AED', bg: '#F3E8FF' },
};

export default function ParametersPage() {
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { (async () => {
    try { setP(await getParameters()); } catch (e) { setError(e.message); }
  })(); }, []);

  function set(field, value) { setP({ ...p, [field]: value }); setSaved(false); }
  function setDur(op, field, value) {
    setP({ ...p, durations: p.durations.map((d) => d.operation_type === op ? { ...d, [field]: Number(value) } : d) }); setSaved(false);
  }
  function setShift(idx, field, value) {
    const shifts = [...p.shifts];
    shifts[idx] = { ...shifts[idx], [field]: field === 'workers_available' ? Number(value) : minFromHHMM(value) };
    setP({ ...p, shifts }); setSaved(false);
  }

  async function handleSave() {
    setBusy(true); setError('');
    try {
      await saveParameters({
        dock_count: +p.dock_count, slot_minutes: +p.slot_minutes,
        horizon_start_min: +p.horizon_start_min, horizon_end_min: +p.horizon_end_min,
        workers_per_dock: +p.workers_per_dock, arrival_window_min: +p.arrival_window_min,
        lateness_tolerance_min: +p.lateness_tolerance_min, acdc_delay_threshold_min: +p.acdc_delay_threshold_min,
        max_overtime_min: +p.max_overtime_min, dock_turnover_buffer_min: +p.dock_turnover_buffer_min,
        blocked_docks: +p.blocked_docks, shifts: p.shifts, durations: p.durations,
      });
      setP(await getParameters()); setSaved(true);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  if (error && !p) return <div style={{ color: 'var(--critical)' }}>{error}</div>;
  if (!p) return <div style={{ color: 'var(--text-secondary)' }}>Loading…</div>;

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };
  const head = (icon, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <span className="sec-icon">{icon}</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
    </div>
  );
  const lbl = { fontSize: 12, color: 'var(--text-secondary)', display: 'block', marginBottom: 3 };
  const inp = { height: 34, border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', fontSize: 13, width: '100%', fontFamily: 'inherit' };
  const sm = { width: 62, height: 32, border: '1px solid var(--border)', borderRadius: 7, padding: '0 4px', fontSize: 13, textAlign: 'center', fontFamily: 'inherit' };

  return (
    <div className="params-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div>
          <h1>Parameters</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>Configure operational parameters for the scheduling engine </p>
        </div>
        <button onClick={handleSave} disabled={busy} style={{ height: 38, padding: '0 16px', background: saved ? 'var(--success)' : 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          {saved ? <><CheckCircle2 size={16} /> Saved</> : <><Save size={16} /> {busy ? 'Saving…' : 'Save all changes'}</>}
        </button>
      </div>

      {error && <div style={{ color: 'var(--critical)', marginBottom: 10 }}>{error}</div>}

      {/* Row 1: Durations + Dock */}
      <div className="params-row1" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>
        {/* Durations */}
        <div style={card}>
          {head(<Truck size={18} color="var(--brand-600)" />, 'Truck Type Durations')}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 440 }}>
              <thead><tr style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left' }}>
                <th style={{ padding: '4px 6px' }}>Truck type</th><th style={{ padding: '4px 6px' }}>Setup / prep</th><th style={{ padding: '4px 6px' }}>Mise en stock</th><th style={{ padding: '4px 6px' }}>Service</th><th style={{ padding: '4px 6px' }}>Total</th>
              </tr></thead>
              <tbody>
                {['LOAD', 'UNLOAD', 'LOAD_UNLOAD'].map((op) => {
                  const d = p.durations.find((x) => x.operation_type === op) || { preparation_min: 0, service_min: 0, mise_en_stock_min: 0 };
                  const m = opMeta[op]; const total = d.preparation_min + d.service_min + d.mise_en_stock_min;
                  return (
                    <tr key={op} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px' }}><span style={{ background: m.bg, color: m.color, padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{m.label}</span><div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{m.sub}</div></td>
                      <td style={{ padding: '6px' }}><input type="number" value={d.preparation_min} onChange={(e) => setDur(op, 'preparation_min', e.target.value)} style={sm} /></td>
                      <td style={{ padding: '6px' }}><input type="number" value={d.mise_en_stock_min} onChange={(e) => setDur(op, 'mise_en_stock_min', e.target.value)} style={sm} /></td>
                      <td style={{ padding: '6px' }}><input type="number" value={d.service_min} onChange={(e) => setDur(op, 'service_min', e.target.value)} style={sm} /></td>
                      <td style={{ padding: '6px' }}><span style={{ background: m.bg, color: m.color, padding: '3px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700 }}>{total} min</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Dock & Capacity */}
        <div style={card}>
          {head(<Box size={18} color="var(--brand-600)" />, 'Dock & Capacity')}
          <div style={{ display: 'grid', gap: 8 }}>
            <div><label style={lbl}>Total number of docks</label><input type="number" value={p.dock_count} onChange={(e) => set('dock_count', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Blocked docks (maintenance)</label><input type="number" value={p.blocked_docks} onChange={(e) => set('blocked_docks', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>OPL workers per active dock</label><input type="number" value={p.workers_per_dock} onChange={(e) => set('workers_per_dock', e.target.value)} style={inp} /></div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Effective docks: <b>{Math.max(0, p.dock_count - p.blocked_docks)}</b></div>
          </div>
        </div>
      </div>

      {/* Row 2: Scheduling + Shifts + ACDC */}
      <div className="params-row2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: 12, alignItems: 'start' }}>
        {/* Scheduling */}
        <div style={card}>
          {head(<Clock size={18} color="var(--brand-600)" />, 'Scheduling')}
          <div style={{ display: 'grid', gap: 8 }}>
            <div><label style={lbl}>Time-slot interval (min)</label><input type="number" value={p.slot_minutes} onChange={(e) => set('slot_minutes', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Arrival window (± min)</label><input type="number" value={p.arrival_window_min} onChange={(e) => set('arrival_window_min', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Dock turnover buffer (min)</label><input type="number" value={p.dock_turnover_buffer_min} onChange={(e) => set('dock_turnover_buffer_min', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>Max overtime (min)</label><input type="number" value={p.max_overtime_min} onChange={(e) => set('max_overtime_min', e.target.value)} style={inp} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={lbl}>Horizon start</label>
                <input type="time" step="60" value={hhmmFromMin(p.horizon_start_min || 360)} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); set('horizon_start_min', h * 60 + m); }} style={{ ...inp }} />
              </div>
              <div>
                <label style={lbl}>Horizon end</label>
                <input type="time" step="60" value={hhmmFromMin(p.horizon_end_min || 1080)} onChange={(e) => { const [h, m] = e.target.value.split(':').map(Number); set('horizon_end_min', h * 60 + m); }} style={{ ...inp }} />
              </div>
            </div>
          </div>
        </div>

        {/* Shifts */}
        <div style={card}>
          {head(<Users size={18} color="var(--brand-600)" />, 'Shifts & OPL')}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left' }}>
              <th style={{ padding: '3px 4px' }}>Shift</th><th style={{ padding: '3px 4px' }}>Start</th><th style={{ padding: '3px 4px' }}>End</th><th style={{ padding: '3px 4px' }}>OPL</th>
            </tr></thead>
            <tbody>
              {p.shifts.map((s, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '6px 4px', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>{s.name}</td>
                  <td style={{ padding: '6px 4px' }}><input type="time" step="60" value={hhmmFromMin(s.start_min)} onChange={(e) => setShift(i, 'start_min', e.target.value)} style={{ ...sm, width: 86 }} /></td>
                  <td style={{ padding: '6px 4px' }}><input type="time" step="60" value={hhmmFromMin(s.end_min)} onChange={(e) => setShift(i, 'end_min', e.target.value)} style={{ ...sm, width: 86 }} /></td>
                  <td style={{ padding: '6px 4px' }}><input type="number" value={s.workers_available} onChange={(e) => setShift(i, 'workers_available', e.target.value)} style={{ ...sm, width: 46 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 6 }}>Total OPL/24h: <b>{p.shifts.reduce((a, s) => a + s.workers_available, 0)}</b></div>
        </div>

        {/* Delay & ACDC */}
        <div style={card}>
          {head(<Zap size={18} color="var(--brand-600)" />, 'Delay & ACDC Rules')}
          <div style={{ display: 'grid', gap: 8 }}>
            <div><label style={lbl}>Lateness tolerance (min)</label><input type="number" value={p.lateness_tolerance_min} onChange={(e) => set('lateness_tolerance_min', e.target.value)} style={inp} /></div>
            <div><label style={lbl}>ACDC delay threshold (min)</label><input type="number" value={p.acdc_delay_threshold_min} onChange={(e) => set('acdc_delay_threshold_min', e.target.value)} style={inp} /></div>
            <div style={{ padding: 8, background: 'var(--brand-50)', borderRadius: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              A loading truck becomes ACDC-eligible once products are ready, it hasn't arrived, and the appointment time plus this threshold has passed.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}