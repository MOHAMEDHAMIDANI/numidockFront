import React, { useState, useEffect, useRef } from 'react';
import {
  Calendar, Upload, Zap, RotateCcw, CheckCircle, Send, ChevronDown,
  Lock, Unlock, Pencil, MoreVertical, Maximize2, Minimize2,
  ChevronsUp, ChevronsDown, AlertTriangle, Info, ChevronRight,
  Truck, BarChart2, X, AlignJustify, LayoutList, Bell,
} from 'lucide-react';
import { uploadExcel, getScheduleMeta, getScheduleUnscheduled, generateSchedule, getSchedule, approveSchedule, publishSchedule, updateAppointment, reoptimizeSchedule } from '../api';

// ─── helpers ─────────────────────────────────────────────────────────────────
function hhmm(m) {
  if (m == null) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function toISO(d) { return d.toISOString().slice(0, 10); }
function todayISO() { return toISO(new Date()); }
function minsToHM(m) {
  if (!m) return '0h 0m';
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function computeConflicts(appointments) {
  const result = [];
  const byDock = {};
  for (const a of appointments) {
    if (!byDock[a.dock_number]) byDock[a.dock_number] = [];
    byDock[a.dock_number].push(a);
  }
  for (const dockAppts of Object.values(byDock)) {
    for (let i = 0; i < dockAppts.length; i++) {
      for (let j = i + 1; j < dockAppts.length; j++) {
        const a = dockAppts[i], b = dockAppts[j];
        const aS = a.preparation_start_min, aE = a.expected_dock_release_min;
        const bS = b.preparation_start_min, bE = b.expected_dock_release_min;
        if (aS < bE && bS < aE) {
          result.push({
            id: `overlap-${a.id}-${b.id}`,
            type: 'dock_overlap', severity: 'error',
            label: 'Dock overlap',
            detail: `${a.reference} overlaps with ${b.reference}`,
            timeRange: `${hhmm(Math.max(aS, bS))} – ${hhmm(Math.min(aE, bE))}`,
            affectedIds: new Set([a.id, b.id]),
            refA: a.reference, refB: b.reference,
          });
        }
      }
    }
  }
  for (const a of appointments) {
    if (a.window_end_min && a.window_end_min > 990) {
      result.push({
        id: `tight-${a.id}`,
        type: 'window_tight', severity: 'info',
        label: 'Arrival window tight',
        detail: `${a.reference} window ends at ${hhmm(a.window_end_min)}`,
        affectedIds: new Set([a.id]),
      });
    }
  }
  return result;
}

// ─── OP badge ─────────────────────────────────────────────────────────────────
const OP_COLORS = {
  UNLOAD: { bg: '#dbeafe', color: '#1d4ed8' },
  LOAD: { bg: '#dcfce7', color: '#15803d' },
  LOAD_UNLOAD: { bg: '#ede9fe', color: '#6d28d9' },
};
function OpBadge({ type }) {
  const c = OP_COLORS[type] || { bg: '#f1f5f9', color: '#475569' };
  const label = type === 'LOAD_UNLOAD' ? 'LOAD+UNLOAD' : type;
  return (
    <span style={{ background: c.bg, color: c.color, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    GENERATED: { bg: '#dcfce7', color: '#15803d', icon: '✓', label: 'Generated' },
    APPROVED: { bg: '#dbeafe', color: '#1d4ed8', icon: '✓', label: 'Approved' },
    PUBLISHED: { bg: '#ede9fe', color: '#6d28d9', icon: '✓', label: 'Published' },
  };
  const c = map[status] || { bg: '#f1f5f9', color: '#64748b', icon: '○', label: 'No schedule' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: c.bg, color: c.color, borderRadius: 20, padding: '5px 12px', fontSize: 13, fontWeight: 600 }}>
      {c.icon} {c.label}
    </span>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ importStats, genStats, conflicts }) {
  const steps = [
    {
      n: 1, label: 'Import trucks',
      sub: importStats
        ? <><span style={{ color: 'var(--success)' }}>{importStats.imported_count} valid</span>{importStats.error_count > 0 && <> · <span style={{ color: 'var(--critical)' }}>{importStats.error_count} errors</span></>}</>
        : <span style={{ color: 'var(--text-secondary)' }}>No data yet</span>,
      done: !!importStats && importStats.imported_count > 0,
    },
    {
      n: 2, label: 'Generate appointments',
      sub: genStats
        ? <><span style={{ color: 'var(--success)' }}>{genStats.scheduled_count} scheduled</span>{genStats.unscheduled_count > 0 && <> · <span style={{ color: 'var(--warning)' }}>{genStats.unscheduled_count} unscheduled</span></>} · <span style={{ color: 'var(--text-secondary)' }}>{genStats.generation_ms} ms</span></>
        : <span style={{ color: 'var(--text-secondary)' }}>Not generated</span>,
      done: !!genStats,
    },
    {
      n: 3, label: 'Review & publish',
      sub: conflicts != null
        ? <span style={{ color: conflicts === 0 ? 'var(--success)' : 'var(--warning)' }}>{conflicts === 0 ? 'No conflicts' : `${conflicts} conflict${conflicts > 1 ? 's' : ''}`}</span>
        : <span style={{ color: 'var(--text-secondary)' }}>Pending</span>,
      done: conflicts === 0 && !!genStats,
    },
  ];

  return (
    <div className="workspace-stepper" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 24px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => (
        <div className="workspace-step" key={s.n} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <div className="workspace-step-content" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              background: s.done ? 'var(--brand-600)' : 'var(--border)', color: s.done ? '#fff' : 'var(--text-secondary)',
              fontSize: 13, fontWeight: 700,
            }}>{s.n}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap' }}>{s.label}</div>
              <div style={{ fontSize: 12, marginTop: 1 }}>{s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <div className="workspace-step-line" style={{ flex: 1, height: 1, background: 'var(--border)', margin: '0 16px', minWidth: 20 }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Mini Gantt ───────────────────────────────────────────────────────────────
function MiniGantt({ appointments, horizonStart = 360, horizonEnd = 1080 }) {
  if (!appointments.length) return null;
  const range = horizonEnd - horizonStart;
  const docks = [...new Set(appointments.map((a) => a.dock_number))].sort((a, b) => a - b).slice(0, 8);
  const timeMarks = [];
  for (let t = horizonStart; t <= horizonEnd; t += 120) timeMarks.push(t);

  return (
    <div style={{ position: 'relative' }}>
      {/* time labels */}
      <div style={{ display: 'flex', paddingLeft: 32, marginBottom: 2 }}>
        {timeMarks.map((t) => (
          <div key={t} style={{ flex: 1, fontSize: 10, color: 'var(--text-secondary)', textAlign: 'left' }}>{hhmm(t)}</div>
        ))}
      </div>
      {docks.map((dock) => {
        const row = appointments.filter((a) => a.dock_number === dock);
        return (
          <div key={dock} style={{ display: 'flex', alignItems: 'center', marginBottom: 3, height: 14 }}>
            <div style={{ width: 28, fontSize: 10, color: 'var(--text-secondary)', flexShrink: 0 }}>D{String(dock).padStart(2, '0')}</div>
            <div style={{ flex: 1, position: 'relative', height: 10, background: 'var(--app-bg)', borderRadius: 2 }}>
              {row.map((a) => {
                const prepLeft = ((a.preparation_start_min - horizonStart) / range) * 100;
                const prepW = ((a.service_start_min - a.preparation_start_min) / range) * 100;
                const svcLeft = ((a.service_start_min - horizonStart) / range) * 100;
                const svcW = ((a.expected_completion_min - a.service_start_min) / range) * 100;
                const miseLeft = ((a.expected_completion_min - horizonStart) / range) * 100;
                const miseW = ((a.expected_dock_release_min - a.expected_completion_min) / range) * 100;
                return (
                  <div key={a.id || a.truck_request_id}>
                    {prepW > 0 && <div style={{ position: 'absolute', left: `${prepLeft}%`, width: `${prepW}%`, height: '100%', background: '#3b82f6', borderRadius: '2px 0 0 2px' }} />}
                    <div style={{ position: 'absolute', left: `${svcLeft}%`, width: `${svcW}%`, height: '100%', background: '#22c55e' }} />
                    {miseW > 0 && <div style={{ position: 'absolute', left: `${miseLeft}%`, width: `${miseW}%`, height: '100%', background: '#f59e0b', borderRadius: '0 2px 2px 0' }} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* legend */}
      <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 32 }}>
        {[['#3b82f6', 'Prep'], ['#22c55e', 'Service'], ['#f59e0b', 'Mise en stock']].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-secondary)' }}>
            <div style={{ width: 10, height: 6, background: color, borderRadius: 1 }} /> {label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full Gantt ───────────────────────────────────────────────────────────────
function GanttView({ appointments, horizonStart = 360, horizonEnd = 1080 }) {
  if (!appointments.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No appointments to display.</div>;
  const range = horizonEnd - horizonStart;
  const docks = [...new Set(appointments.map((a) => a.dock_number))].sort((a, b) => a - b);
  const timeMarks = [];
  for (let t = horizonStart; t <= horizonEnd; t += 60) timeMarks.push(t);
  const ROW_H = 36;

  return (
    <div className="workspace-gantt-scroll" style={{ overflowX: 'auto' }}>
      <div className="workspace-gantt-inner" style={{ minWidth: 700 }}>
        {/* time axis */}
        <div style={{ display: 'flex', paddingLeft: 56, borderBottom: '1px solid var(--border)', paddingBottom: 6 }}>
          {timeMarks.map((t) => (
            <div key={t} style={{ flex: 1, fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap' }}>{hhmm(t)}</div>
          ))}
        </div>
        {docks.map((dock) => {
          const row = appointments.filter((a) => a.dock_number === dock);
          return (
            <div key={dock} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)', height: ROW_H }}>
              <div style={{ width: 52, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 }}>D{String(dock).padStart(2, '0')}</div>
              <div style={{ flex: 1, position: 'relative', height: ROW_H - 8, margin: '4px 0' }}>
                {row.map((a) => {
                  const prepLeft = ((a.preparation_start_min - horizonStart) / range) * 100;
                  const prepW = ((a.service_start_min - a.preparation_start_min) / range) * 100;
                  const svcLeft = ((a.service_start_min - horizonStart) / range) * 100;
                  const svcW = ((a.expected_completion_min - a.service_start_min) / range) * 100;
                  const miseLeft = ((a.expected_completion_min - horizonStart) / range) * 100;
                  const miseW = ((a.expected_dock_release_min - a.expected_completion_min) / range) * 100;
                  const title = `${a.reference} (${hhmm(a.preparation_start_min)}–${hhmm(a.expected_dock_release_min)})`;
                  return (
                    <div key={a.id || a.truck_request_id} title={title}>
                      {prepW > 0 && <div style={{ position: 'absolute', left: `${prepLeft}%`, width: `${prepW}%`, height: '100%', background: '#3b82f6', opacity: 0.85, borderRadius: '4px 0 0 4px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                        <span style={{ fontSize: 9, color: '#fff', paddingLeft: 3, whiteSpace: 'nowrap' }}>{a.reference}</span>
                      </div>}
                      <div style={{ position: 'absolute', left: `${svcLeft}%`, width: `${svcW}%`, height: '100%', background: '#22c55e', opacity: 0.9, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
                        {prepW === 0 && <span style={{ fontSize: 9, color: '#fff', paddingLeft: 3, whiteSpace: 'nowrap' }}>{a.reference}</span>}
                      </div>
                      {miseW > 0 && <div style={{ position: 'absolute', left: `${miseLeft}%`, width: `${miseW}%`, height: '100%', background: '#f59e0b', opacity: 0.85, borderRadius: '0 4px 4px 0' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* legend */}
        <div style={{ display: 'flex', gap: 16, padding: '10px 0 4px 56px' }}>
          {[['#3b82f6', 'Prep'], ['#22c55e', 'Service'], ['#f59e0b', 'Mise en stock']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{ width: 14, height: 10, background: color, borderRadius: 2 }} /> {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Force place modal ────────────────────────────────────────────────────────
function ForcePlaceModal({ truck, date, onSave, onClose }) {
  const DOCKS = Array.from({ length: 16 }, (_, i) => i + 1);
  const [dock, setDock]     = useState(1);
  const [apptMin, setApptMin] = useState(480);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState('');

  function minsVal(m) {
    const h = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${h}:${mm}`;
  }
  function parseMins(v) {
    const [h, m] = v.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await onSave({ truck, dock_number: dock, appointment_min: apptMin });
      onClose();
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  const inp2 = { height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Force Place — {truck.reference}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <form onSubmit={submit} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {err && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#b91c1c', fontSize: 12 }}>{err}</div>}
          <div style={{ padding: '8px 12px', background: 'var(--app-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
            {truck.carrier || '—'} · {truck.operation_type} · Window: {hhmm(truck.window_start_min)}–{hhmm(truck.window_end_min)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Dock *</label>
              <div style={{ position: 'relative' }}>
                <select style={{ ...inp2, appearance: 'none', cursor: 'pointer' }} value={dock} onChange={e => setDock(parseInt(e.target.value))}>
                  {DOCKS.map(d => <option key={d} value={d}>Dock {String(d).padStart(2,'0')}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Appointment time</label>
              <input type="time" style={inp2} value={minsVal(apptMin)} onChange={e => setApptMin(parseMins(e.target.value))} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
            Prep, service, and release times will be estimated from parameters after placing.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} style={{ height: 34, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ height: 34, padding: '0 18px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Placing…' : 'Force Place'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Row context menu ─────────────────────────────────────────────────────────
// Uses position:fixed + getBoundingClientRect so it never gets clipped by overflow:auto
function RowMenu({ appt, rect, onClose, onLockToggle, onMoveFirst, onMoveLast }) {
  const ref = useRef();
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const top   = rect ? rect.bottom + 4 : 0;
  const right = rect ? window.innerWidth - rect.right : 0;

  const item = (label, action, danger = false) => (
    <button onClick={() => { action(); onClose(); }}
      style={{ display: 'block', width: '100%', padding: '8px 14px', border: 'none', background: 'none', textAlign: 'left', fontSize: 13, cursor: 'pointer', color: danger ? '#b91c1c' : 'var(--text)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--app-bg)'}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
      {label}
    </button>
  );

  return (
    <div ref={ref} style={{ position: 'fixed', top, right, zIndex: 9999, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', minWidth: 160, overflow: 'hidden' }}>
      {item(appt.is_locked ? 'Unlock' : 'Lock', () => onLockToggle(appt.id))}
      {item('Move to first', () => onMoveFirst(appt.id))}
      {item('Move to last',  () => onMoveLast(appt.id))}
    </div>
  );
}

// ─── Right panel ──────────────────────────────────────────────────────────────
function RightPanel({ unscheduled, conflicts, engineStats, onForcePlaceTruck, onResolveConflict }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Unscheduled trucks */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Truck size={16} color="var(--warning)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Unscheduled trucks</span>
          </div>
          <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
            {unscheduled.length}
          </span>
        </div>
        {unscheduled.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>All trucks scheduled.</p>
          : unscheduled.map((t) => (
            <div key={t.id || t.truck_request_id} style={{ borderRadius: 8, border: '1px solid var(--border)', padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{t.reference}</span>
                <span style={{ fontSize: 11, background: '#fee2e2', color: '#b91c1c', borderRadius: 6, padding: '2px 6px', fontWeight: 600 }}>Not scheduled</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t.carrier || '—'} · {t.operation_type}</div>
              <button onClick={() => onForcePlaceTruck(t)} style={{ width: '100%', height: 32, border: '1px solid var(--brand-600)', borderRadius: 7, background: 'transparent', color: 'var(--brand-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                Force place <ChevronRight size={14} />
              </button>
            </div>
          ))
        }
      </div>

      {/* Validation & conflicts */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} color="var(--warning)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Validation & conflicts</span>
          </div>
          {conflicts.length > 0 && (
            <span style={{ background: '#fef3c7', color: '#b45309', borderRadius: 10, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>
              {conflicts.length}
            </span>
          )}
        </div>
        {conflicts.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--success)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle size={14} /> No conflicts detected
            </p>
          : conflicts.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              {c.severity === 'error'
                ? <AlertTriangle size={14} color="var(--critical)" style={{ flexShrink: 0, marginTop: 1 }} />
                : <Info size={14} color="var(--brand-600)" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1, wordBreak: 'break-word' }}>{c.detail}</div>
                {c.type === 'dock_overlap' && (
                  <button onClick={() => onResolveConflict(c)} style={{ marginTop: 5, height: 26, padding: '0 10px', border: '1px solid var(--brand-600)', borderRadius: 6, background: 'transparent', color: 'var(--brand-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                    Auto-resolve
                  </button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* Engine summary */}
      {engineStats && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart2 size={16} color="var(--brand-600)" />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Engine summary</span>
          </div>
          {[
            ['Objective value', engineStats.objective_value?.toLocaleString() ?? '—'],
            ['Makespan', engineStats.makespan_min != null ? minsToHM(engineStats.makespan_min) : '—'],
            ['Docks used', engineStats.docks_used != null ? `${engineStats.docks_used} / ${engineStats.dock_count ?? '?'}` : '—'],
            ['Locked trucks', engineStats.locked_count ?? 0],
            ['Model', 'H8'],
            ['Runtime', `${engineStats.generation_ms ?? '—'} ms`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
              <span style={{ fontWeight: 600, color: k === 'Runtime' ? 'var(--warning)' : 'var(--text)' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────
function AppTable({ appointments, onDockChange, onLockToggle, onMoveFirst, onMoveLast, onMoveSingle, onResolveConflict, editedIds, conflicts, selectedIds, setSelectedIds }) {
  const conflictedIds = new Set(conflicts.flatMap((c) => [...c.affectedIds]));
  const conflictByAppt = {};
  for (const c of conflicts) {
    for (const id of c.affectedIds) {
      if (!conflictByAppt[id]) conflictByAppt[id] = [];
      conflictByAppt[id].push(c);
    }
  }

  const DOCKS = Array.from({ length: 16 }, (_, i) => i + 1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuRect,   setMenuRect]   = useState(null);
  const menuRef = useRef();

  const th = { padding: '9px 10px', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap', background: 'var(--app-bg)', borderBottom: '1px solid var(--border)' };
  const td = { padding: '9px 10px', fontSize: 13, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };

  function toggleSelect(id) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }
  function toggleAll() {
    if (selectedIds.size === appointments.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(appointments.map((a) => a.id)));
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="workspace-table-toolbar" style={{ display: 'flex', gap: 8, padding: '10px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => onMoveFirst()} disabled={selectedIds.size === 0} style={{ height: 34, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: selectedIds.size ? 'var(--text)' : 'var(--text-secondary)', fontSize: 13, cursor: selectedIds.size ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronsUp size={15} /> Move to first
        </button>
        <button onClick={() => onMoveLast()} disabled={selectedIds.size === 0} style={{ height: 34, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: selectedIds.size ? 'var(--text)' : 'var(--text-secondary)', fontSize: 13, cursor: selectedIds.size ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronsDown size={15} /> Move to last
        </button>
      </div>

      <div className="workspace-table-scroll" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 32 }}><input type="checkbox" checked={selectedIds.size === appointments.length && appointments.length > 0} onChange={toggleAll} /></th>
              <th style={{ ...th, width: 28 }}>#</th>
              <th style={th}>Reference</th>
              <th style={th}>Carrier</th>
              <th style={th}>Operation</th>
              <th style={th}>Appt time</th>
              <th style={th}>Arrival window</th>
              <th style={th}>Dock</th>
              <th style={th}>Prep start</th>
              <th style={th}>Service end</th>
              <th style={th}>Dock release</th>
              <th style={{ ...th, width: 56 }}>Lock</th>
              <th style={{ ...th, width: 50 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {appointments.map((a, idx) => {
              const hasConflict = conflictedIds.has(a.id);
              const isSelected = selectedIds.has(a.id);
              const isEdited = editedIds.has(a.id);
              const rowBg = hasConflict ? '#fffbeb' : isSelected ? '#f0f9ff' : 'var(--surface)';

              return (
                <React.Fragment key={String(a.id ?? idx)}>
                  <tr style={{ background: rowBg, transition: 'background .1s' }}
                    onMouseEnter={(e) => { if (!hasConflict && !isSelected) e.currentTarget.style.background = 'var(--app-bg)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = rowBg; }}>
                    <td style={td}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(a.id)} /></td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{idx + 1}</td>
                    <td style={{ ...td, fontWeight: 600 }}>
                      {a.reference}
                      {isEdited && <span title="Manually edited" style={{ marginLeft: 4, width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-600)', display: 'inline-block' }} />}
                    </td>
                    <td style={td}>{a.carrier}</td>
                    <td style={td}><OpBadge type={a.operation_type} /></td>
                    <td style={{ ...td, fontWeight: 600, color: hasConflict ? '#d97706' : 'var(--text)' }}>
                      {hhmm(a.appointment_min)}
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>
                      {hhmm(a.window_start_min)}–{hhmm(a.window_end_min)}
                    </td>
                    <td style={td}>
                      <select
                        value={a.dock_number}
                        onChange={(e) => onDockChange(a.id, parseInt(e.target.value))}
                        style={{ height: 28, border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, padding: '0 4px', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
                      >
                        {DOCKS.map((d) => <option key={d} value={d}>D{String(d).padStart(2, '0')}</option>)}
                      </select>
                    </td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{hhmm(a.preparation_start_min)}</td>
                    <td style={{ ...td, color: 'var(--text-secondary)' }}>{hhmm(a.expected_completion_min)}</td>
                    <td style={{ ...td, color: hasConflict ? '#d97706' : 'var(--text-secondary)' }}>{hhmm(a.expected_dock_release_min)}</td>
                    <td style={td}>
                      <button
                        onClick={() => onLockToggle(a.id)}
                        title={a.is_locked ? 'Unlock' : 'Lock'}
                        style={{ background: a.is_locked ? 'var(--brand-600)' : 'var(--border)', border: 'none', borderRadius: 20, width: 40, height: 22, cursor: 'pointer', position: 'relative', transition: 'background .2s', display: 'flex', alignItems: 'center' }}
                      >
                        <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', left: a.is_locked ? 'calc(100% - 19px)' : 3, transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                      </button>
                    </td>
                    <td style={td}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMenuRect(e.currentTarget.getBoundingClientRect()); setOpenMenuId(id => id === a.id ? null : a.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 2 }}>
                        <MoreVertical size={16} />
                      </button>
                      {openMenuId === a.id && (
                        <RowMenu
                          appt={a}
                          rect={menuRect}
                          onClose={() => setOpenMenuId(null)}
                          onLockToggle={onLockToggle}
                          onMoveFirst={(id) => onMoveSingle(id, 'first')}
                          onMoveLast={(id) => onMoveSingle(id, 'last')}
                        />
                      )}
                    </td>
                  </tr>
                  {hasConflict && conflictByAppt[a.id]?.map((c) => (
                    <tr key={`conflict-${a.id}-${c.id}`} style={{ background: '#fffbeb' }}>
                      <td colSpan={13} style={{ padding: '6px 10px 6px 44px', borderBottom: '1px solid #fde68a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                          <AlertTriangle size={13} color="#d97706" />
                          <span style={{ color: '#92400e' }}><strong>Conflict:</strong> {c.detail}{c.timeRange ? ` (${c.timeRange})` : ''}.</span>
                          <button onClick={() => onResolveConflict && onResolveConflict(c)} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontWeight: 600, fontSize: 12, cursor: 'pointer', padding: 0 }}>Resolve conflict</button>
                          <span style={{ color: 'var(--text-secondary)' }}>·</span>
                          <button onClick={() => {}} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', padding: 0 }}>Ignore</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Import guide modal ───────────────────────────────────────────────────────
function ImportGuideModal({ date, onClose, onImportDone }) {
  const [file,   setFile]   = useState(null);
  const [busy,   setBusy]   = useState(false);
  const [result, setResult] = useState(null);
  const [err,    setErr]    = useState('');
  const fileRef = useRef();

  const COLUMNS = [
    { col: 'truck_reference', req: true,  example: 'TRK-001', desc: 'Unique truck reference' },
    { col: 'operation_type',  req: true,  example: 'LOAD / UNLOAD / LOAD_UNLOAD', desc: 'Also accepts French: CHARGEMENT, DECHARGEMENT' },
    { col: 'carrier',         req: false, example: 'Carrier Alpha', desc: 'Carrier / transporter name' },
    { col: 'priority',        req: false, example: 'NORMAL / HIGH', desc: 'Default: NORMAL' },
    { col: 'driver_name',     req: false, example: 'Ali Benali', desc: 'Driver full name' },
    { col: 'driver_phone',    req: false, example: '+213 555 123 456', desc: 'Driver phone number' },
    { col: 'vehicle_plate',   req: false, example: '123456-213-16', desc: 'Vehicle registration plate' },
  ];

  async function handleImport() {
    if (!file) { setErr('Select an Excel file first.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await uploadExcel(date, file);
      setResult(r);
      onImportDone(r);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const box = { background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };

  if (result) return (
    <div style={overlay}>
      <div style={{ ...box, maxWidth: 440 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Import complete</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[['Total rows', result.total_rows], ['Imported', result.valid_count], ['Errors', result.error_count]].map(([k, v]) => (
              <div key={k} style={{ padding: '10px 12px', background: 'var(--app-bg)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: k === 'Errors' && v > 0 ? 'var(--critical)' : 'var(--text)' }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{k}</div>
              </div>
            ))}
          </div>
          {result.errors?.length > 0 && (
            <div style={{ maxHeight: 140, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 14 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead><tr style={{ background: 'var(--app-bg)' }}>
                  <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Line</th>
                  <th style={{ padding: '5px 8px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Error</th>
                </tr></thead>
                <tbody>{result.errors.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '5px 8px', color: 'var(--critical)', fontWeight: 600 }}>{e.line}</td>
                    <td style={{ padding: '5px 8px', color: 'var(--text)' }}>{e.errors?.join(', ') || e.error}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          <button onClick={onClose} style={{ width: '100%', height: 36, border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done — Generate schedule</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={overlay}>
      <div style={box}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Import Excel — Format Guide</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {err && <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#b91c1c', fontSize: 12, marginBottom: 14 }}>{err}</div>}

          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Your Excel file must have these columns in the first sheet. Column order does not matter. Re-importing replaces all trucks for the selected date.
          </div>

          {/* Column guide table */}
          <div style={{ overflowX: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--app-bg)' }}>
                  {['Column name', 'Required', 'Example', 'Notes'].map(h => (
                    <th key={h} style={{ padding: '7px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COLUMNS.map(c => (
                  <tr key={c.col} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px', fontFamily: 'monospace', fontSize: 11, color: 'var(--brand-600)', fontWeight: 600 }}>{c.col}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                      {c.req ? <span style={{ color: '#b91c1c', fontWeight: 700, fontSize: 11 }}>✓ Yes</span> : <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>No</span>}
                    </td>
                    <td style={{ padding: '6px 10px', color: 'var(--text)', fontSize: 11 }}>{c.example}</td>
                    <td style={{ padding: '6px 10px', color: 'var(--text-secondary)', fontSize: 11 }}>{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* File picker */}
          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${file ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer', background: file ? '#EAF6FA' : 'var(--app-bg)', marginBottom: 14 }}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.xlsx')) setFile(f); else setErr('Only .xlsx files supported.'); }}>
            <Upload size={24} color={file ? 'var(--brand-600)' : 'var(--text-secondary)'} style={{ marginBottom: 6 }} />
            {file ? (
              <div><div style={{ fontWeight: 700, color: 'var(--brand-600)', fontSize: 13 }}>{file.name}</div><div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>Click to change</div></div>
            ) : (
              <div><div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 13 }}>Drop your Excel file here or click to browse</div><div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>.xlsx only · max 5 MB</div></div>
            )}
            <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleImport} disabled={!file || busy}
              style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!file || busy) ? 'not-allowed' : 'pointer', opacity: (!file || busy) ? .6 : 1 }}>
              {busy ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WorkspacePage() {
  const [date, setDate] = useState(todayISO());
  const [status, setStatus] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [importStats, setImportStats] = useState(null);
  const [genStats, setGenStats] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState('');
  const [activeTab, setActiveTab] = useState('table');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [editedIds, setEditedIds] = useState(new Set());
  const [ganttExpanded, setGanttExpanded] = useState(false);
  const [toast, setToast] = useState(null);
  const [error, setError] = useState('');
  const [forcePlaceTruck, setForcePlaceTruck] = useState(null);
  const [importGuideOpen, setImportGuideOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);
  const fileRef = useRef();

  const conflicts = computeConflicts(appointments);

  // Close notification on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function h(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  function showToast(msg, type = 'info') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }

  async function loadDate(d) {
    try {
      const [meta, appts, unsched] = await Promise.all([
        getScheduleMeta(d).catch(() => ({ exists: false })),
        getSchedule(d).catch(() => []),
        getScheduleUnscheduled(d).catch(() => []),
      ]);
      setStatus(meta.status || null);
      setAppointments(appts);
      setUnscheduled(unsched);
      if (meta.exists) {
        setImportStats({ imported_count: meta.imported_count, error_count: 0 });
        if (meta.scheduled_count > 0) {
          setGenStats({
            scheduled_count: meta.scheduled_count,
            unscheduled_count: meta.unscheduled_count,
            generation_ms: meta.generation_ms,
            objective_value: meta.objective_value,
            locked_count: appts.filter((a) => a.is_locked).length,
            docks_used: new Set(appts.map((a) => a.dock_number)).size,
          });
        } else {
          setGenStats(null);
        }
      } else {
        setImportStats(null);
        setGenStats(null);
      }
      setEditedIds(new Set());
      setSelectedIds(new Set());
    } catch (e) {
      // silent — schedule may not exist yet
    }
  }

  useEffect(() => { loadDate(date); }, [date]);

  async function handleImport(directFile) {
    const f = directFile || file;
    if (!f) { setError('Select an Excel file first.'); return; }
    setError(''); setBusy(true); setBusyLabel('Importing…');
    try {
      const r = await uploadExcel(date, f);
      setImportStats({ imported_count: r.valid_count, error_count: r.error_count });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      showToast(`Imported ${r.valid_count} trucks (${r.error_count} errors).`);
      await loadDate(date);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setBusyLabel(''); }
  }

  async function handleGenerate() {
    setError(''); setBusy(true); setBusyLabel('Generating…');
    try {
      const r = await generateSchedule(date);
      setGenStats({
        scheduled_count: r.scheduled_count,
        unscheduled_count: r.unscheduled_count,
        generation_ms: r.generation_ms,
        objective_value: r.unscheduled_count,
        locked_count: 0,
        docks_used: new Set(r.appointments.map((a) => a.dock_number)).size,
      });
      setStatus('GENERATED');
      setUnscheduled(r.unscheduled);
      setEditedIds(new Set());
      // Reload from DB so appointments have real integer `id` values (engine response lacks ids)
      const appts = await getSchedule(date).catch(() => []);
      setAppointments(appts);
      showToast('Schedule generated successfully. You can review, resolve conflicts and publish.', 'success');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setBusyLabel(''); }
  }

  async function handleReoptimize() {
    setError(''); setBusy(true); setBusyLabel('Re-optimizing…');
    try {
      const r = await reoptimizeSchedule(date);
      await loadDate(date);
      showToast(`Re-optimized: ${r.scheduled_count} scheduled, ${r.unscheduled_count} unscheduled · ${r.generation_ms} ms`, 'success');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setBusyLabel(''); }
  }

  async function handleApprove() {
    setBusy(true); setBusyLabel('Approving…');
    try {
      await approveSchedule(date);
      setStatus('APPROVED');
      showToast('Schedule approved.', 'success');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setBusyLabel(''); }
  }

  async function handlePublish() {
    setBusy(true); setBusyLabel('Publishing…');
    try {
      await publishSchedule(date);
      setStatus('PUBLISHED');
      showToast('Schedule published. Driver tokens generated.', 'success');
    } catch (e) { setError(e.message); }
    finally { setBusy(false); setBusyLabel(''); }
  }

  async function handleDockChange(id, dock) {
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, dock_number: dock } : a));
    setEditedIds((prev) => new Set([...prev, id]));
    try {
      await updateAppointment(date, id, { dock_number: dock });
    } catch (e) {
      setError(`Failed to save dock change: ${e.message}`);
    }
  }

  async function handleLockToggle(id) {
    const appt = appointments.find((a) => a.id === id);
    if (!appt) return;
    const newLocked = !appt.is_locked;
    setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, is_locked: newLocked } : a));
    setGenStats((g) => g ? { ...g, locked_count: appointments.filter((a) => (a.id === id ? newLocked : a.is_locked)).length } : g);
    try {
      await updateAppointment(date, id, { is_locked: newLocked });
    } catch (e) {
      setError(`Failed to save lock: ${e.message}`);
      setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, is_locked: appt.is_locked } : a));
    }
  }

  function handleMoveFirst() {
    if (selectedIds.size === 0) return;
    const sel = appointments.filter((a) => selectedIds.has(a.id));
    const rest = appointments.filter((a) => !selectedIds.has(a.id));
    setAppointments([...sel, ...rest]);
    showToast('Moved to top. Re-optimize to apply the new order.');
  }

  function handleMoveLast() {
    if (selectedIds.size === 0) return;
    const sel = appointments.filter((a) => selectedIds.has(a.id));
    const rest = appointments.filter((a) => !selectedIds.has(a.id));
    setAppointments([...rest, ...sel]);
    showToast('Moved to bottom. Re-optimize to apply the new order.');
  }

  function handleMoveSingle(id, direction) {
    if (direction === 'first') {
      const appt = appointments.find(a => a.id === id);
      const rest = appointments.filter(a => a.id !== id);
      setAppointments([appt, ...rest]);
      showToast(`${appt.reference} moved to top. Re-optimize to apply.`);
    } else {
      const appt = appointments.find(a => a.id === id);
      const rest = appointments.filter(a => a.id !== id);
      setAppointments([...rest, appt]);
      showToast(`${appt.reference} moved to bottom. Re-optimize to apply.`);
    }
  }

  async function handleForcePlaceTruck({ truck, dock_number, appointment_min }) {
    const truckId = truck.id || truck.truck_request_id;
    try {
      await updateAppointment(date, truckId, { dock_number, appointment_min });
      setUnscheduled(prev => prev.filter(t => (t.id || t.truck_request_id) !== truckId));
      await loadDate(date);
      showToast(`${truck.reference} placed on Dock ${String(dock_number).padStart(2,'0')} at ${String(Math.floor(appointment_min/60)).padStart(2,'0')}:${String(appointment_min%60).padStart(2,'00')}.`, 'success');
    } catch (e) {
      throw new Error(e.message);
    }
  }

  async function handleResolveConflict(conflict) {
    const affectedIds = [...conflict.affectedIds];
    if (affectedIds.length < 2) return;
    const usedDocks = new Set(appointments.map(a => a.dock_number));
    let freeDock = null;
    for (let d = 1; d <= 16; d++) {
      if (!usedDocks.has(d)) { freeDock = d; break; }
    }
    if (!freeDock) { showToast('No free dock available to auto-resolve. Please change a dock manually.'); return; }
    const apptToMove = appointments.find(a => a.id === affectedIds[1]);
    if (!apptToMove) return;
    try {
      await handleDockChange(apptToMove.id, freeDock);
      showToast(`Moved ${apptToMove.reference} to Dock ${String(freeDock).padStart(2,'0')} to resolve overlap.`, 'success');
    } catch (e) {
      setError(e.message);
    }
  }

  // derive horizon from appointments or use default
  const horizonStart = appointments.length > 0 ? Math.min(...appointments.map((a) => a.preparation_start_min)) : 360;
  const horizonEnd = appointments.length > 0 ? Math.max(...appointments.map((a) => a.expected_dock_release_min)) + 30 : 1080;

  const engineStats = genStats ? {
    ...genStats,
    dock_count: new Set(appointments.map((a) => a.dock_number)).size || genStats.docks_used,
    locked_count: appointments.filter((a) => a.is_locked).length,
  } : null;

  const btnBase = { height: 36, padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', whiteSpace: 'nowrap' };

  return (
    <div className="workspace-page" style={{ maxWidth: 1400 }}>
      {/* ── Header ── */}
      <div className="workspace-header" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-900)', margin: 0, flex: '1 1 auto' }}>Scheduling Workspace</h1>
        {/* date picker */}
        <div className="workspace-date" style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 8, padding: '0 10px', height: 36, background: 'var(--surface)' }}>
          <Calendar size={14} color="var(--text-secondary)" />
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text)' }} />
        </div>
        {status && <StatusBadge status={status} />}
        {/* import */}
        <button onClick={() => setImportGuideOpen(true)} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
          <Upload size={14} /> Import Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }}
          onChange={(e) => { const f = e.target.files[0]; if (f) { setFile(f); handleImport(f); } }} />
        <button onClick={handleGenerate} disabled={busy} style={{ ...btnBase, background: 'var(--brand-600)', color: '#fff' }}>
          <Zap size={14} /> Generate (H8)
        </button>
        {appointments.length > 0 && (
          <button onClick={handleReoptimize} disabled={busy} style={{ ...btnBase, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }}>
            <RotateCcw size={14} /> Re-optimize
          </button>
        )}
        <button onClick={handleApprove} disabled={busy || status !== 'GENERATED'} style={{ ...btnBase, background: 'var(--surface)', color: status === 'GENERATED' ? 'var(--text)' : 'var(--text-secondary)', border: '1px solid var(--border)', opacity: status === 'GENERATED' ? 1 : 0.5 }}>
          <CheckCircle size={14} /> Approve
        </button>
        <button onClick={handlePublish} disabled={busy || status !== 'APPROVED'} style={{ ...btnBase, background: status === 'APPROVED' ? 'var(--brand-600)' : 'var(--border)', color: status === 'APPROVED' ? '#fff' : 'var(--text-secondary)' }}>
          <Send size={14} /> Publish
        </button>
        {/* Bell notification */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button onClick={() => setNotifOpen(o => !o)} title="Notifications" style={{ ...btnBase, background: notifOpen ? '#EAF6FA' : 'var(--surface)', color: notifOpen ? 'var(--brand-600)' : 'var(--text)', border: `1px solid ${notifOpen ? 'var(--brand-600)' : 'var(--border)'}`, position: 'relative', padding: '0 10px' }}>
            <Bell size={14} />
            {(unscheduled.length > 0 || conflicts.filter(c => c.severity === 'error').length > 0) && (
              <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)' }} />
            )}
          </button>
          {notifOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 500, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', width: 300, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Schedule Notifications</span>
                <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={14} /></button>
              </div>
              <div style={{ padding: '8px 0' }}>
                {conflicts.filter(c => c.severity === 'error').length > 0 && (
                  <div style={{ padding: '8px 14px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#b91c1c', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ fontSize: 12 }}><strong>{conflicts.filter(c => c.severity === 'error').length} conflict(s)</strong> — Multiple trucks scheduled on the same dock and time.</div>
                  </div>
                )}
                {unscheduled.length > 0 && (
                  <div style={{ padding: '8px 14px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ fontSize: 12 }}><strong>{unscheduled.length} truck(s)</strong> could not be scheduled. Use Force Place to assign them.</div>
                  </div>
                )}
                {conflicts.filter(c => c.severity === 'error').length === 0 && unscheduled.length === 0 && (
                  <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>No schedule issues</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div style={{ background: '#fee2e2', color: '#b91c1c', borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {error}
          <button onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c' }}><X size={15} /></button>
        </div>
      )}

      {/* ── Stepper ── */}
      <Stepper importStats={importStats} genStats={genStats} conflicts={genStats ? conflicts.filter((c) => c.severity === 'error').length : null} />

      {/* ── Two-panel layout ── */}
      <div className="workspace-layout" style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        {/* Main panel */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="workspace-main-panel" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
            {/* Mini gantt preview + expand */}
            {appointments.length > 0 && !ganttExpanded && activeTab === 'table' && (
              <div style={{ marginBottom: 12, padding: 10, background: 'var(--app-bg)', borderRadius: 8, position: 'relative' }}>
                <MiniGantt appointments={appointments} horizonStart={horizonStart} horizonEnd={horizonEnd} />
                <button onClick={() => setGanttExpanded(true)} style={{ position: 'absolute', top: 6, right: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <Maximize2 size={12} />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="workspace-tabs" style={{ display: 'flex', alignItems: 'center', gap: 2, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
              {[['table', <LayoutList size={14} />, 'Table'], ['gantt', <AlignJustify size={14} />, 'Timeline / Gantt']].map(([key, icon, label]) => (
                <button key={key} onClick={() => setActiveTab(key)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', background: 'none', fontSize: 13, fontWeight: activeTab === key ? 600 : 500, color: activeTab === key ? 'var(--brand-600)' : 'var(--text-secondary)', borderBottom: activeTab === key ? '2px solid var(--brand-600)' : '2px solid transparent', marginBottom: -1, cursor: 'pointer' }}>
                  {icon} {label}
                </button>
              ))}
              {ganttExpanded && (
                <button onClick={() => setGanttExpanded(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                  <Minimize2 size={13} /> Collapse preview
                </button>
              )}
            </div>

            {appointments.length === 0
              ? <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Truck size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p style={{ margin: 0 }}>Import trucks then generate a schedule to get started.</p>
                </div>
              : activeTab === 'table'
                ? <>
                    {ganttExpanded && <div style={{ marginBottom: 12 }}><GanttView appointments={appointments} horizonStart={horizonStart} horizonEnd={horizonEnd} /></div>}
                    <AppTable
                      appointments={appointments}
                      onDockChange={handleDockChange}
                      onLockToggle={handleLockToggle}
                      onMoveFirst={handleMoveFirst}
                      onMoveLast={handleMoveLast}
                      onMoveSingle={handleMoveSingle}
                      onResolveConflict={handleResolveConflict}
                      editedIds={editedIds}
                      conflicts={conflicts}
                      selectedIds={selectedIds}
                      setSelectedIds={setSelectedIds}
                    />
                  </>
                : <GanttView appointments={appointments} horizonStart={horizonStart} horizonEnd={horizonEnd} />
            }

            {/* Table footer */}
            {appointments.length > 0 && activeTab === 'table' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', flex: '1 1 auto' }}>
                  Showing 1 to {appointments.length} of {appointments.length} trucks
                </span>
                {editedIds.size > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dbeafe', color: '#1d4ed8', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
                    <Pencil size={11} /> {editedIds.size} row{editedIds.size > 1 ? 's' : ''} edited
                  </span>
                )}
                {conflicts.filter((c) => c.severity === 'error').length > 0 && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fef3c7', color: '#b45309', borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 600 }}>
                    <AlertTriangle size={11} /> {conflicts.filter((c) => c.severity === 'error').length} conflict{conflicts.filter((c) => c.severity === 'error').length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div className="workspace-right-panel" style={{ width: 280, flexShrink: 0 }}>
          <RightPanel unscheduled={unscheduled} conflicts={conflicts} engineStats={engineStats}
            onForcePlaceTruck={setForcePlaceTruck}
            onResolveConflict={handleResolveConflict} />
        </div>
      </div>

      {/* ── Import guide modal ── */}
      {importGuideOpen && (
        <ImportGuideModal
          date={date}
          onClose={() => setImportGuideOpen(false)}
          onImportDone={(r) => {
            setImportStats({ imported_count: r.valid_count, error_count: r.error_count });
            loadDate(date);
          }}
        />
      )}

      {/* ── Force place modal ── */}
      {forcePlaceTruck && (
        <ForcePlaceModal
          truck={forcePlaceTruck}
          date={date}
          onSave={handleForcePlaceTruck}
          onClose={() => setForcePlaceTruck(null)}
        />
      )}

      {/* ── Bottom toast ── */}
      {(toast || busy) && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: busy ? '#1e293b' : '#0f172a', color: '#fff', borderRadius: 10, padding: '12px 20px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.2)', zIndex: 100, maxWidth: 480, width: 'calc(100vw - 48px)' }}>
          {busy
            ? <><RotateCcw size={14} style={{ animation: 'spin 1s linear infinite' }} /> <strong>{busyLabel}</strong></>
            : <><Info size={14} /> {toast.msg}</>
          }
          {!busy && toast && (
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', marginLeft: 'auto', display: 'flex' }}><X size={14} /></button>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .workspace-page,
        .workspace-layout,
        .workspace-main-panel {
          min-width: 0;
        }
        .workspace-table-scroll,
        .workspace-gantt-scroll {
          max-width: 100%;
          width: 100%;
          overflow-x: scroll !important;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: thin;
          scrollbar-color: var(--brand-500) var(--app-bg);
        }
        .workspace-table-scroll::-webkit-scrollbar,
        .workspace-gantt-scroll::-webkit-scrollbar {
          height: 10px;
        }
        .workspace-table-scroll::-webkit-scrollbar-track,
        .workspace-gantt-scroll::-webkit-scrollbar-track {
          background: var(--app-bg);
          border-radius: 999px;
        }
        .workspace-table-scroll::-webkit-scrollbar-thumb,
        .workspace-gantt-scroll::-webkit-scrollbar-thumb {
          background: var(--brand-500);
          border-radius: 999px;
          border: 2px solid var(--app-bg);
        }
        @media (max-width: 900px) {
          .workspace-layout { flex-direction: column !important; }
          .workspace-right-panel { width: 100% !important; }
        }
        @media (max-width: 760px) {
          .workspace-page {
            max-width: none !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }
          .workspace-header { align-items: stretch !important; }
          .workspace-header h1 { flex-basis: 100% !important; font-size: 20px !important; }
          .workspace-header > button,
          .workspace-header > label,
          .workspace-date {
            flex: 1 1 calc(50% - 6px) !important;
            justify-content: center !important;
            min-width: 0 !important;
          }
          .workspace-date input { width: 100% !important; min-width: 0 !important; }
          .workspace-stepper {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .workspace-step { width: 100% !important; flex: none !important; }
          .workspace-step-content { width: 100% !important; }
          .workspace-step-line { display: none !important; }
          .workspace-main-panel {
            padding: 12px !important;
            max-width: 100% !important;
            overflow: visible !important;
          }
          .workspace-tabs {
            overflow-x: auto !important;
            padding-bottom: 1px !important;
          }
          .workspace-tabs button { flex: 0 0 auto !important; }
          .workspace-table-toolbar button {
            flex: 1 1 160px !important;
            justify-content: center !important;
          }
          .workspace-table-scroll,
          .workspace-gantt-scroll {
            display: block !important;
            width: calc(100vw - 52px) !important;
            max-width: 100% !important;
            margin-left: 0 !important;
            margin-right: 0 !important;
            padding-bottom: 10px !important;
            border-bottom: 1px solid var(--border);
          }
          .workspace-gantt-inner { min-width: 620px !important; }
        }
        @media (max-width: 520px) {
          .workspace-header > button,
          .workspace-header > label,
          .workspace-date {
            flex-basis: 100% !important;
            width: 100% !important;
          }
          .workspace-header .workspace-date { justify-content: flex-start !important; }
          .workspace-table-toolbar button { flex-basis: 100% !important; }
        }
      `}</style>
    </div>
  );
}
