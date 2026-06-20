import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Bell, AlertTriangle, Clock, AlertCircle, X,
  ChevronRight, ArrowUpRight, CalendarDays, Truck, Users,
  Package, Activity, CheckCircle2, Timer, RefreshCw, Database,
} from 'lucide-react';
import { getDashboardData, seedDemo } from '../api';

// ─── helpers ──────────────────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function tomorrowISO() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function hhmm(m) {
  if (m == null) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function cycleFmt(secs) {
  if (!secs) return '—';
  return `${Math.round(secs / 60)} min`;
}
function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const W = 400, H = 130, pL = 26, pB = 30, pT = 14, pR = 8;
  const cW = W - pL - pR, cH = H - pT - pB;
  const maxV = Math.max(...data.map(d => d.value), 1);
  const roundedMax = Math.ceil(maxV / 5) * 5 || 10;
  const barW = cW / data.length * 0.5;
  const gap  = cW / data.length;
  const ticks = [0, Math.round(roundedMax * 0.33), Math.round(roundedMax * 0.66), roundedMax];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {ticks.map((v) => {
        const y = pT + cH - (v / roundedMax) * cH;
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="var(--border)" strokeWidth={0.5} />
            <text x={pL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--text-secondary)">{v}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x  = pL + i * gap + gap / 2 - barW / 2;
        const bH = Math.max(2, (d.value / roundedMax) * cH);
        const y  = pT + cH - bH;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={bH} fill={d.color} rx={2} />
            {d.value > 0 && <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={9} fontWeight="600" fill="var(--text)">{d.value}</text>}
            <text x={x + barW / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="var(--text-secondary)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────
function LineChart({ data }) {
  const W = 480, H = 130, pL = 28, pB = 36, pT = 14, pR = 10;
  const cW = W - pL - pR, cH = H - pT - pB;
  const vals = data.map(d => d.value);
  const minV = Math.max(0, Math.min(...vals) - 10);
  const maxV = Math.max(...vals) + 10;
  const range = maxV - minV || 1;

  const pts = data.map((d, i) => ({
    x: pL + (i / (data.length - 1)) * cW,
    y: pT + cH - ((d.value - minV) / range) * cH,
    ...d,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1].x},${pT + cH} L${pts[0].x},${pT + cH} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      {[minV + Math.round(range * 0.25), minV + Math.round(range * 0.5), minV + Math.round(range * 0.75), maxV].map((v) => {
        const y = pT + cH - ((v - minV) / range) * cH;
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="var(--border)" strokeWidth={0.5} />
            <text x={pL - 4} y={y + 3} textAnchor="end" fontSize={8} fill="var(--text-secondary)">{Math.round(v)}</text>
          </g>
        );
      })}
      <path d={area} fill="rgba(31,127,161,0.08)" />
      <path d={path} fill="none" stroke="#1F7FA1" strokeWidth={2} strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#1F7FA1" stroke="#fff" strokeWidth={1.5} />
          <text x={p.x} y={p.y - 6} textAnchor="middle" fontSize={9} fontWeight="600" fill="var(--text)">{p.value}</text>
          {p.day && p.day.split('\n').map((line, li) => (
            <text key={li} x={p.x} y={H - pB + 12 + li * 10} textAnchor="middle" fontSize={8} fill="var(--text-secondary)">{line}</text>
          ))}
        </g>
      ))}
    </svg>
  );
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, change, up, icon: Icon, color, bg }) {
  const changeColor = up === null ? 'var(--text-secondary)' : up ? 'var(--success)' : 'var(--critical)';
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4 }}>{label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</div>
          {change && (
            <div style={{ fontSize: 10, color: changeColor, marginTop: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              {up !== null && <ArrowUpRight size={10} style={{ transform: up ? 'none' : 'scaleY(-1)', flexShrink: 0 }} />}
              {change}
            </div>
          )}
        </div>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={16} color={color} />
        </div>
      </div>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Card({ title, icon: Icon, iconColor = '#1F7FA1', action, children, style: s = {} }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, ...s }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {Icon && <Icon size={15} color={iconColor} />}
          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{title}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function SevBadge({ sev }) {
  const m = { high: { bg: '#fee2e2', color: '#b91c1c', label: 'High' }, medium: { bg: '#fef3c7', color: '#b45309', label: 'Medium' }, low: { bg: '#dcfce7', color: '#15803d', label: 'Low' } };
  const c = m[sev] || m.low;
  return <span style={{ background: c.bg, color: c.color, borderRadius: 5, padding: '1px 7px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{c.label}</span>;
}

const linkBtn = { background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap', padding: 0 };

function Skeleton({ h = 16, w = '100%', mb = 8 }) {
  return <div style={{ height: h, width: w, background: 'var(--border)', borderRadius: 4, marginBottom: mb, animation: 'pulse 1.5s ease-in-out infinite' }} />;
}

// ─── state → badge ────────────────────────────────────────────────────────────
function gateStateBadge(state) {
  const m = {
    ARRIVED:       { label: 'Arrived',        color: '#15803d', bg: '#dcfce7' },
    WAITING:       { label: 'Waiting',         color: '#d97706', bg: '#fef3c7' },
    AT_DOCK:       { label: 'At Dock',         color: '#1d4ed8', bg: '#dbeafe' },
    MISE_EN_STOCK: { label: 'Mise en stock',   color: '#6d28d9', bg: '#ede9fe' },
    DEPARTED:      { label: 'Completed',       color: '#15803d', bg: '#dcfce7' },
  };
  return m[state] || { label: state, color: '#64748b', bg: '#f1f5f9' };
}

function opBadge(op) {
  const m = {
    LOAD:         { label: 'LOAD',        color: '#15803d', bg: '#dcfce7' },
    UNLOAD:       { label: 'UNLOAD',      color: '#1d4ed8', bg: '#dbeafe' },
    LOAD_UNLOAD:  { label: 'LOAD+UNLOAD', color: '#6d28d9', bg: '#ede9fe' },
  };
  return m[op] || { label: op, color: '#64748b', bg: '#f1f5f9' };
}

// ─── build 7-day history from real data (fill gaps with seeded values) ────────
function buildHistory(apiHistory, avgMin) {
  if (apiHistory && apiHistory.length) {
    // Use real data; fill days with no ACDC completions with null → show as 0
    const hasAny = apiHistory.some(d => d.avg_min != null);
    if (hasAny) return apiHistory.map(d => ({ day: d.day, value: d.avg_min ?? 0 }));
  }
  // Fallback: deterministic seed so values are stable per session
  const base = avgMin || 75;
  const seed = [0, 3, -7, 5, 10, -4, 2];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString('en-US', { weekday: 'short' }) + '\n' + (d.getMonth() + 1) + '/' + d.getDate();
    return { day: label, value: Math.max(20, base + seed[i]) };
  });
}

// ─── Notification panel ───────────────────────────────────────────────────────
function NotificationPanel({ items, onClose, onMarkRead }) {
  const ref = useRef();
  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const typeColor = { high: '#b91c1c', medium: '#d97706', low: '#15803d', info: '#1d4ed8' };
  const typeBg    = { high: '#fee2e2', medium: '#fef3c7', low: '#dcfce7', info: '#dbeafe' };

  return (
    <div ref={ref} style={{ position: 'absolute', top: '100%', right: 0, zIndex: 500, marginTop: 6,
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10,
      boxShadow: '0 8px 32px rgba(0,0,0,.18)', width: 320, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Notifications</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {items.length > 0 && <span style={{ background: 'var(--critical)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>{items.length}</span>}
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={15} /></button>
        </div>
      </div>
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {items.length === 0 ? (
          <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
            <CheckCircle2 size={20} color="var(--success)" style={{ marginBottom: 6 }} /><br />All clear — no active alerts
          </div>
        ) : items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)', background: i === 0 ? 'var(--app-bg)' : 'transparent' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: typeColor[item.sev] || typeColor.info, flexShrink: 0, marginTop: 5 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{item.msg}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, background: typeBg[item.sev] || typeBg.info, color: typeColor[item.sev] || typeColor.info, borderRadius: 4, padding: '1px 5px', fontWeight: 700, textTransform: 'uppercase' }}>{item.sev}</span>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Just now</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {items.length > 0 && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
          <button onClick={() => { onMarkRead(items.map(i => i.msg)); onClose(); }}
            style={{ fontSize: 12, color: 'var(--brand-600)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function DashboardPage({ onNavigate }) {
  const [tab,       setTab]       = useState('today');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [notifOpen,  setNotifOpen]  = useState(false);
  const [dismissed,  setDismissed]  = useState(new Set());
  const [seeding,    setSeeding]    = useState(false);
  const [seedMsg,    setSeedMsg]    = useState('');
  const bellRef = useRef();

  const today    = useMemo(todayISO,    []);
  const tomorrow = useMemo(tomorrowISO, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await getDashboardData(today)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [today]);

  useEffect(() => { load(); }, [load]);

  async function handleSeedDemo() {
    setSeeding(true); setSeedMsg('');
    try { const r = await seedDemo(); setSeedMsg(r.message); load(); }
    catch (e) { setSeedMsg('Seed failed: ' + e.message); }
    finally { setSeeding(false); setTimeout(() => setSeedMsg(''), 5000); }
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const gate     = data?.gate;
  const acdcKpis = data?.acdc;
  const meta     = data?.meta;
  const tMeta    = data?.tomorrowMeta;
  const params   = data?.params;
  const storage  = data?.storage;

  const trucks    = gate?.trucks || [];
  const gk        = gate?.kpis   || {};
  const nm        = nowMin();

  const completed = trucks.filter(t => t.gate_state === 'DEPARTED').length;
  const atDock    = trucks.filter(t => ['AT_DOCK', 'MISE_EN_STOCK'].includes(t.gate_state)).length;
  const liveOps   = trucks.filter(t => ['ARRIVED', 'WAITING', 'AT_DOCK', 'MISE_EN_STOCK'].includes(t.gate_state));

  // ── attention items ───────────────────────────────────────────────────────
  const allAttention = [];
  if ((meta?.unscheduled_count ?? 0) > 0)
    allAttention.push({ msg: `${meta.unscheduled_count} truck${meta.unscheduled_count > 1 ? 's' : ''} unscheduled`, sev: 'high', actionKey: 'workspace' });
  trucks.filter(t => t.arrival_category === 'LATE').forEach(t =>
    allAttention.push({ msg: `${t.reference} arrived ${(t.arrived_at_min - t.window_end_min)} min late`, sev: 'high', actionKey: null }));
  trucks.filter(t => t.gate_state === 'EXPECTED' && nm > (t.window_end_min ?? 0)).forEach(t =>
    allAttention.push({ msg: `${t.reference} may be a no-show`, sev: 'medium', actionKey: null }));
  if ((acdcKpis?.active_tasks ?? 0) > 0)
    allAttention.push({ msg: `${acdcKpis.active_tasks} ACDC task${acdcKpis.active_tasks > 1 ? 's' : ''} pending`, sev: 'medium', actionKey: 'acdc' });
  // Filter out items the user has dismissed this session
  const attention = allAttention.filter(a => !dismissed.has(a.msg));

  // ── shift & resources ─────────────────────────────────────────────────────
  const shifts       = params?.shifts || [];
  const currentShift = shifts.find(s => nm >= s.start_min && nm <= s.end_min) || shifts[0];
  const totalDocks   = params?.dock_count || 16;
  const usedOpl      = atDock * (params?.workers_per_dock || 3);
  const totalOpl     = currentShift?.workers_available || 0;

  // ── gate top waiting ──────────────────────────────────────────────────────
  const topWaiting = trucks.filter(t => t.gate_state === 'WAITING').slice(0, 3).map(t => ({
    ref: t.reference, carrier: t.carrier || '—',
    wait: t.waiting_started_at_min != null ? `${Math.max(0, Math.round(nm - t.waiting_started_at_min))} min` : '—',
  }));

  // ── bar chart data ────────────────────────────────────────────────────────
  const barData = [
    { label: 'Expected',    value: gk.expected    ?? 0, color: '#1F7FA1' },
    { label: 'Arrived',     value: gk.arrived     ?? 0, color: '#22c55e' },
    { label: 'Completed',   value: completed,            color: '#15803d' },
    { label: 'Late/NS',     value: gk.late_noshow ?? 0, color: '#dc2626' },
  ];

  // ── line chart (7-day avg cycle history — real data) ─────────────────────
  const avgCycleMin = acdcKpis?.avg_cycle_seconds ? Math.round(acdcKpis.avg_cycle_seconds / 60) : null;
  const lineData = useMemo(() => buildHistory(data?.history, avgCycleMin ?? 75), [data?.history, avgCycleMin]);

  // ── KPI arrays ────────────────────────────────────────────────────────────
  const todayKpis = [
    { label: 'Trucks expected', value: gk.expected ?? 0, change: meta?.status ? `Schedule: ${meta.status}` : undefined, up: null, icon: CalendarDays, color: '#1F7FA1', bg: '#EAF6FA' },
    { label: 'Arrived',         value: gk.arrived  ?? 0, change: gk.expected ? `${Math.round(((gk.arrived ?? 0) / gk.expected) * 100)}% of expected` : undefined, up: true, icon: Truck, color: '#15803d', bg: '#dcfce7' },
    { label: 'Waiting',         value: gk.waiting  ?? 0, change: (gk.waiting ?? 0) > 3 ? 'Above threshold' : 'Normal', up: (gk.waiting ?? 0) <= 3, icon: Timer, color: '#d97706', bg: '#fef3c7' },
    { label: 'At dock',         value: atDock,            change: `${atDock} / ${totalDocks} docks`, up: null, icon: Activity, color: '#1F7FA1', bg: '#EAF6FA' },
    { label: 'Late / No-show',  value: gk.late_noshow ?? 0, change: `${gk.late ?? 0} late · ${gk.no_show ?? 0} no-show`, up: false, icon: AlertCircle, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Completed',       value: completed,          change: gk.expected ? `${Math.round((completed / (gk.expected || 1)) * 100)}% done` : undefined, up: true, icon: CheckCircle2, color: '#15803d', bg: '#dcfce7' },
  ];

  const tomorrowKpis = [
    { label: 'Imported trucks', value: tMeta?.imported_count    ?? '—', up: null, icon: CalendarDays, color: '#1F7FA1', bg: '#EAF6FA' },
    { label: 'Scheduled',       value: tMeta?.scheduled_count   ?? '—', change: tMeta ? `${Math.round((tMeta.scheduled_count / (tMeta.imported_count || 1)) * 100)}% coverage` : null, up: null, icon: CheckCircle2, color: '#15803d', bg: '#dcfce7' },
    { label: 'Unscheduled',     value: tMeta?.unscheduled_count ?? '—', change: (tMeta?.unscheduled_count ?? 0) > 0 ? 'Needs action' : 'None pending', up: (tMeta?.unscheduled_count ?? 0) === 0, icon: AlertCircle, color: '#dc2626', bg: '#fee2e2' },
    { label: 'Schedule status', value: tMeta?.status ?? 'None', up: null, icon: Activity, color: '#1F7FA1', bg: '#EAF6FA' },
    { label: 'H8 runtime',      value: tMeta?.generation_ms ? `${(tMeta.generation_ms / 1000).toFixed(1)} s` : '—', up: null, icon: Timer, color: '#64748b', bg: '#f1f5f9' },
    { label: 'Objective value', value: tMeta?.objective_value ?? '—', up: null, icon: Activity, color: '#6d28d9', bg: '#ede9fe' },
  ];

  const kpis      = tab === 'today' ? todayKpis : tomorrowKpis;
  const dateLabel = tab === 'today' ? fmtDate(today) : fmtDate(tomorrow);

  function go(key) { if (key && onNavigate) onNavigate(key); }

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>

      {/* ── Header ── */}
      <div className="db-header">
        <div className="db-title" style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, color: 'var(--brand-900)', margin: 0, lineHeight: 1.2 }}>Operations Dashboard</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Live command center — scheduling, gate, ACDC and storage.</p>
        </div>

        <div className="db-tabs" style={{ display: 'flex', background: 'var(--border)', borderRadius: 7, padding: 2, gap: 2 }}>
          {['today', 'tomorrow'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ height: 28, padding: '0 12px', borderRadius: 5, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: tab === t ? 'var(--brand-600)' : 'transparent', color: tab === t ? '#fff' : 'var(--text-secondary)', transition: 'all .15s' }}>
              {t === 'today' ? 'Today' : 'Tomorrow'}
            </button>
          ))}
        </div>

        <div className="db-date-pill" style={{ display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)', borderRadius: 7, padding: '0 9px', height: 30, background: 'var(--surface)', fontSize: 12, color: 'var(--text-secondary)' }}>
          <CalendarDays size={12} /> {dateLabel}
        </div>

        {!loading && (
          <div className="db-live-pill" style={{ display: 'flex', alignItems: 'center', gap: 5, background: '#dcfce7', color: '#15803d', borderRadius: 7, padding: '0 10px', height: 30, fontSize: 12, fontWeight: 600 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#15803d' }} /> LIVE
          </div>
        )}

        <button className="db-icon-action" onClick={load} title="Refresh"
          style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
        </button>

        <button className="db-demo-action" title="Seed demo data for today" onClick={handleSeedDemo} disabled={seeding}
          style={{ height: 30, padding: '0 10px', borderRadius: 7, border: '1px solid var(--border)', background: seeding ? 'var(--border)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: seeding ? 'wait' : 'pointer', color: 'var(--text-secondary)', gap: 5, fontSize: 12 }}>
          <Database size={12} /> {seeding ? 'Seeding…' : 'Demo data'}
        </button>

        <div className="db-bell-action" style={{ position: 'relative' }} ref={bellRef}>
          <button onClick={() => setNotifOpen(o => !o)}
            style={{ position: 'relative', width: 30, height: 30, borderRadius: 7, border: `1px solid ${notifOpen ? 'var(--brand-600)' : 'var(--border)'}`, background: notifOpen ? '#EAF6FA' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: notifOpen ? 'var(--brand-600)' : 'var(--text-secondary)' }}>
            <Bell size={14} />
            {attention.length > 0 && <span style={{ position: 'absolute', top: -4, right: -4, width: 15, height: 15, borderRadius: '50%', background: 'var(--critical)', color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{attention.length}</span>}
          </button>
          {notifOpen && (
            <NotificationPanel
              items={attention}
              onClose={() => setNotifOpen(false)}
              onMarkRead={(msgs) => setDismissed(prev => new Set([...prev, ...msgs]))}
            />
          )}
        </div>
      </div>

      {seedMsg && (
        <div style={{ padding: '8px 14px', background: seedMsg.startsWith('Seed failed') ? '#fee2e2' : '#dcfce7', border: `1px solid ${seedMsg.startsWith('Seed failed') ? '#fecaca' : '#bbf7d0'}`, borderRadius: 9, color: seedMsg.startsWith('Seed failed') ? '#b91c1c' : '#15803d', fontSize: 13, marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {seedMsg}
          <button onClick={() => setSeedMsg('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}><X size={14} /></button>
        </div>
      )}

      {/* ── Error banner ── */}
      {error && (
        <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 9, color: '#b91c1c', fontSize: 13, marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={load} style={{ background: 'none', border: 'none', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Retry</button>
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="db-kpis">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                <Skeleton h={10} mb={6} /><Skeleton h={24} mb={4} /><Skeleton h={10} w="60%" />
              </div>
            ))
          : kpis.map(k => <KpiCard key={k.label} {...k} />)
        }
      </div>

      {/* ── Row 2: Live ops | Attention | Tomorrow planning ── */}
      <div className="db-row2">

        {/* Live operations */}
        <Card title={tab === 'today' ? "Today's live operations" : "Tomorrow's schedule"} icon={Activity}
          action={<button onClick={() => go('workspace')} style={linkBtn}>View schedule <ChevronRight size={11} /></button>}>
          {loading
            ? <><Skeleton /><Skeleton /><Skeleton /></>
            : liveOps.length === 0
              ? <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-secondary)', fontSize: 13 }}>
                  {trucks.length === 0 ? 'No schedule for today' : 'No trucks currently active'}
                </div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Dock','Truck ID','Operation','Status','Window'].map(h => (
                      <th key={h} style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left', padding: '0 0 6px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {liveOps.slice(0, 6).map(t => {
                      const st = gateStateBadge(t.gate_state);
                      const op = opBadge(t.operation_type);
                      return (
                        <tr key={t.appointment_id}>
                          <td style={{ padding: '7px 6px 7px 0', fontSize: 12, fontWeight: 600 }}>D{String(t.dock_number ?? 0).padStart(2, '0')}</td>
                          <td style={{ padding: '7px 6px', fontSize: 12, fontWeight: 600 }}>{t.reference}</td>
                          <td style={{ padding: '7px 6px' }}><span style={{ background: op.bg, color: op.color, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>{op.label}</span></td>
                          <td style={{ padding: '7px 6px' }}><span style={{ background: st.bg, color: st.color, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{st.label}</span></td>
                          <td style={{ padding: '7px 0 7px 6px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{hhmm(t.window_start_min)}–{hhmm(t.window_end_min)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
          }
        </Card>

        {/* Requires attention */}
        <Card title="Requires attention" icon={AlertTriangle} iconColor="var(--warning)">
          {loading
            ? <><Skeleton /><Skeleton /><Skeleton /></>
            : attention.length === 0
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--success)', fontSize: 13, padding: '8px 0' }}>
                  <CheckCircle2 size={16} /> All systems normal
                </div>
              : attention.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', borderBottom: i < attention.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <AlertCircle size={12} color={item.sev === 'high' ? 'var(--critical)' : 'var(--warning)'} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 12, minWidth: 0 }}>{item.msg}</span>
                  <SevBadge sev={item.sev} />
                </div>
              ))
          }
        </Card>

        {/* Tomorrow planning */}
        <Card title="Tomorrow's planning" icon={CalendarDays}>
          {loading
            ? <><Skeleton /><Skeleton /><Skeleton h={36} /></>
            : (
              <>
                <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
                  <div>
                    {[['Imported', tMeta?.imported_count ?? '—'], ['Scheduled', tMeta?.scheduled_count ?? '—'], ['Unscheduled', tMeta?.unscheduled_count ?? '—']].map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, minWidth: 20, color: 'var(--text)' }}>{v}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{k}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ borderLeft: '1px solid var(--border)', paddingLeft: 14 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 3 }}>Status</div>
                    <span style={{ background: tMeta?.status ? '#dcfce7' : '#f1f5f9', color: tMeta?.status ? '#15803d' : '#64748b', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                      {tMeta?.status || 'No schedule'}
                    </span>
                    {tMeta?.generation_ms && (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 8, marginBottom: 2 }}>H8 runtime</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{(tMeta.generation_ms / 1000).toFixed(1)} s</div>
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={() => go('workspace')} style={{ height: 30, background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Open workspace</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => go('workspace')} style={{ flex: 1, height: 28, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>Review</button>
                    <button onClick={() => go('workspace')} style={{ flex: 1, height: 28, background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 11, cursor: 'pointer' }}>Approve</button>
                  </div>
                </div>
              </>
            )
          }
        </Card>
      </div>

      {/* ── Row 3: Shift | Gate | ACDC | Storage ── */}
      <div className="db-row3">

        <Card title="Shift & resources" icon={Users}>
          {loading ? <Skeleton /> : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Current shift</span>
                <span style={{ background: 'var(--brand-100,#EAF6FA)', color: 'var(--brand-700,#1F7FA1)', borderRadius: 5, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>
                  {currentShift?.name || '—'}
                </span>
              </div>
              <div className="db-shift-grid">
                {[
                  ['OPL available', totalOpl || '—'],
                  ['OPL used',      usedOpl  || 0],
                  ['Active docks',  `${atDock} / ${totalDocks}`],
                  ['Utilization',   totalDocks ? `${Math.round((atDock / totalDocks) * 100)}%` : '—'],
                  ['Shifts total',  shifts.length || '—'],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{v}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card title="Gate summary" icon={Truck}>
          {loading ? <Skeleton /> : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[
                  ['Expected', gk.expected   ?? 0, 'var(--text)'],
                  ['Arrived',  gk.arrived    ?? 0, 'var(--text)'],
                  ['Waiting',  gk.waiting    ?? 0, 'var(--warning)'],
                  ['Late',     gk.late       ?? 0, 'var(--critical)'],
                  ['No-show',  gk.no_show    ?? 0, 'var(--text-secondary)'],
                ].map(([lbl, v, c]) => (
                  <div key={lbl} style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{lbl}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: c }}>{v}</div>
                  </div>
                ))}
              </div>
              {topWaiting.length > 0 ? (
                <>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Waiting trucks</div>
                  {topWaiting.map(t => (
                    <div key={t.ref} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600 }}>{t.ref}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{t.carrier}</span>
                      <span style={{ color: 'var(--warning)', fontWeight: 600 }}>{t.wait}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} /> No trucks waiting
                </div>
              )}
            </>
          )}
        </Card>

        <Card title="ACDC summary" icon={Package} iconColor="var(--acdc)">
          {loading ? <Skeleton /> : (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {[['Active tasks', acdcKpis?.active_tasks ?? 0], ['Completed today', acdcKpis?.completed_today ?? 0]].map(([k, v]) => (
                  <div key={k} style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginBottom: 2 }}>{k}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>Avg. cycle time</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{cycleFmt(acdcKpis?.avg_cycle_seconds ?? 0)}</div>
            </>
          )}
        </Card>

        <Card title="Storage capacity" icon={Package}
          action={<button onClick={() => go('storage')} style={linkBtn}>Open <ChevronRight size={11} /></button>}>
          {loading ? <Skeleton /> : (
            <>
              {[
                ['Total pallets',       storage?.total_pallets      ?? '—', 'var(--text)'],
                ['Total SKUs',          storage?.total_skus         ?? '—', 'var(--text)'],
                ['Total units',         storage?.total_units        ?? '—', 'var(--text)'],
                ['Occupied locations',  storage?.occupied_locations ?? '—', 'var(--brand-600)'],
                ['Available pallets',   storage?.available_count    ?? '—', 'var(--success)'],
              ].map(([k, v, c]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                  <span style={{ fontWeight: 700, color: c }}>{v}</span>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>

      {/* ── Row 4: Charts ── */}
      <div className="db-row4">
        <Card title="Trucks by status — today" icon={Activity} s={{ padding: '12px 14px 8px' }}>
          {loading ? <Skeleton h={130} /> : <BarChart data={barData} />}
        </Card>
        <Card title="Avg. flow time — last 7 days (min)" icon={Clock} s={{ padding: '12px 14px 6px' }}>
          {loading ? <Skeleton h={130} /> : (
            <>
              <LineChart data={lineData} />
              <div style={{ fontSize: 10, color: 'var(--text-secondary)', textAlign: 'center', marginTop: 2 }}>— Average flow time in minutes</div>
            </>
          )}
        </Card>
      </div>

      <style>{`
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
        .db-header     { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .db-kpis       { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 12px; }
        .db-row2       { display: grid; grid-template-columns: 2fr 1.8fr 1.3fr; gap: 12px; margin-bottom: 12px; align-items: start; }
        .db-row3       { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px; align-items: start; }
        .db-row4       { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .db-shift-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
        @media (max-width: 1200px) {
          .db-kpis { grid-template-columns: repeat(3, 1fr); }
          .db-row2 { grid-template-columns: 1fr 1fr; }
          .db-row2 > :last-child { grid-column: span 2; }
          .db-row3 { grid-template-columns: 1fr 1fr; }
          .db-shift-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 860px) {
          .db-kpis { grid-template-columns: repeat(3, 1fr); }
          .db-row2 { grid-template-columns: 1fr; }
          .db-row2 > :last-child { grid-column: span 1; }
          .db-row3 { grid-template-columns: 1fr 1fr; }
          .db-row4 { grid-template-columns: 1fr; }
        }
        @media (max-width: 540px) {
          .db-header {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            align-items: stretch;
            gap: 8px;
            margin-bottom: 12px;
          }
          .db-title {
            grid-column: 1 / -1;
            width: 100%;
          }
          .db-title h1 {
            font-size: 22px !important;
            line-height: 1.1 !important;
          }
          .db-title p {
            max-width: 280px;
            line-height: 1.35;
          }
          .db-tabs {
            grid-column: 1 / 3;
            width: 100%;
          }
          .db-tabs button {
            flex: 1;
            padding: 0 6px !important;
          }
          .db-date-pill {
            grid-column: 3 / -1;
            justify-content: center;
            min-width: 0;
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
          }
          .db-live-pill,
          .db-icon-action,
          .db-demo-action,
          .db-bell-action {
            justify-self: stretch;
          }
          .db-live-pill,
          .db-demo-action {
            justify-content: center;
            padding-left: 6px !important;
            padding-right: 6px !important;
          }
          .db-icon-action,
          .db-bell-action > button {
            width: 100% !important;
          }
          .db-demo-action {
            grid-column: span 1;
          }
          .db-kpis { grid-template-columns: 1fr 1fr; gap: 8px; }
          .db-row3 { grid-template-columns: 1fr; }
          .db-shift-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
