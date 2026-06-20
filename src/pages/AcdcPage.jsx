import { useState, useEffect, useRef } from 'react';
import { ClipboardList, CheckCircle2, Clock, Bell, Search, Truck, Inbox, X, AlertTriangle, Info } from 'lucide-react';
import { acdcTasks, acdcTransition, request } from '../api';

function hhmm(m) {
  if (m == null) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function clock(ts) {
  if (!ts) return null;
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function cycleFmt(secs) {
  if (!secs) return '—';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const STEPS = ['REQUESTED', 'ACCEPTED', 'COLLECTION_STARTED', 'PRODUCTS_COLLECTED', 'TRANSFERRED', 'DOCK_RELEASED'];
const ACTIONS = {
  REQUESTED: { to: 'ACCEPTED', label: 'Accept task' },
  ACCEPTED: { to: 'COLLECTION_STARTED', label: 'Start collection' },
  COLLECTION_STARTED: { to: 'PRODUCTS_COLLECTED', label: 'Products collected' },
  PRODUCTS_COLLECTED: { to: 'TRANSFERRED', label: 'Confirm transfer' },
  TRANSFERRED: { to: 'DOCK_RELEASED', label: 'Confirm dock release' },
};
const STATUS_TIME = {
  REQUESTED: (t) => clock(t.requested_at) && `Requested at ${clock(t.requested_at)}`,
  ACCEPTED: (t) => clock(t.accepted_at) && `Accepted at ${clock(t.accepted_at)}`,
  COLLECTION_STARTED: (t) => clock(t.collection_started_at) && `Started at ${clock(t.collection_started_at)}`,
  PRODUCTS_COLLECTED: (t) => clock(t.products_collected_at) && `Completed at ${clock(t.products_collected_at)}`,
  TRANSFERRED: (t) => clock(t.transferred_at) && `Transferred at ${clock(t.transferred_at)}`,
  DOCK_RELEASED: (t) => clock(t.released_at) && `Released at ${clock(t.released_at)}`,
};
const opBadge = {
  LOAD: { bg: 'var(--brand-50)', color: 'var(--brand-700)' },
  UNLOAD: { bg: '#FEF3E2', color: '#B45309' },
  LOAD_UNLOAD: { bg: '#F3E8FF', color: '#7C3AED' },
};

function Stepper({ status }) {
  const idx = STEPS.indexOf(status);
  return (
    <div className="acdc-stepper">
      {STEPS.map((s, i) => {
        const done = i < idx, current = i === idx;
        return (
          <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' }}>
            {i < STEPS.length - 1 && (
              <div style={{
                position: 'absolute', top: 11, left: '50%', width: '100%', height: 2,
                background: i < idx ? 'var(--brand-600)' : 'var(--border)',
              }} />
            )}
            <div style={{
              width: 24, height: 24, borderRadius: '50%', zIndex: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done || current ? 'var(--brand-600)' : 'var(--surface)',
              border: done || current ? 'none' : '2px solid var(--border)', color: '#fff',
            }}>
              {done && <CheckCircle2 size={16} />}
              {current && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
            </div>
            <span className="acdc-step-label" style={{ fontSize: 9, color: done || current ? 'var(--brand-700)' : 'var(--text-secondary)', marginTop: 6, textAlign: 'center', fontWeight: 500 }}>
              {s}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AcdcPage({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [kpis, setKpis] = useState({ active_tasks: 0, completed_today: 0, avg_cycle_seconds: 0 });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('active'); // active | completed
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  async function load() {
    setError('');
    try {
      const [t, k] = await Promise.all([acdcTasks(tab), request('/acdc/kpis')]);
      setTasks(t);
      setKpis(k);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [tab]);

  async function advance(taskId, to) {
    setBusy(true);
    try { await acdcTransition(taskId, to); await load(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (!notifOpen) return;
    function h(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  const filtered = tasks.filter((t) =>
    !search || t.reference.toLowerCase().includes(search.toLowerCase()) || `d${t.dock_number}`.includes(search.toLowerCase())
  );

  // Derive notification alerts from live task data
  const alerts = [];
  const requestedTasks = tasks.filter(t => t.status === 'REQUESTED');
  if (requestedTasks.length > 0)
    alerts.push({ type: 'warn', msg: `${requestedTasks.length} task${requestedTasks.length > 1 ? 's' : ''} awaiting acceptance` });
  if (kpis.avg_cycle_seconds > 3600)
    alerts.push({ type: 'warn', msg: `Avg. cycle time ${cycleFmt(kpis.avg_cycle_seconds)} — above 1h` });
  if (kpis.active_tasks >= 5)
    alerts.push({ type: 'info', msg: `${kpis.active_tasks} active tasks currently in progress` });

  // FIXED: Safe guard for user.name being undefined
  const initials = (user?.name || 'OP').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      {/* Header */}
      <div style={{ ...card, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 18, color: 'var(--brand-600)' }}>
          <div style={{ width: 32, height: 32, border: '2px solid var(--brand-600)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>N</div>
          <span className="acdc-brand-text">NUMIDOCK</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Bell notification */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button onClick={() => setNotifOpen(o => !o)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', borderRadius: 8 }}>
              <Bell size={20} color={alerts.length > 0 ? 'var(--warning)' : 'var(--text-secondary)'} />
              {alerts.length > 0 && (
                <span style={{ position: 'absolute', top: 0, right: 0, width: 16, height: 16, borderRadius: '50%', background: 'var(--critical)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {alerts.length}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 290, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.13)', zIndex: 500, overflow: 'hidden' }}>
                <div style={{ padding: '11px 14px', fontWeight: 700, fontSize: 13, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  Notifications
                  <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}><X size={14} /></button>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>All clear — no alerts</div>
                ) : alerts.map((a, i) => (
                  <div key={i} style={{ padding: '10px 14px', borderBottom: i < alerts.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                    {a.type === 'warn'
                      ? <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
                      : <Info size={15} color="var(--brand-600)" style={{ flexShrink: 0, marginTop: 1 }} />
                    }
                    <span>{a.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--brand-100)', color: 'var(--brand-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>{initials}</div>
          <button onClick={onLogout} style={{ height: 38, padding: '0 14px', background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Sign out</button>
        </div>
      </div>

      <div className="acdc-body">
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--brand-900)' }}>NumiDock — ACDC</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          Live operations · {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>

        {/* KPIs */}
        <div className="acdc-kpis">
          <div className="acdc-kpi" style={card}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><ClipboardList size={20} color="var(--brand-600)" /></div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpis.active_tasks}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Active tasks</div>
          </div>
          <div className="acdc-kpi" style={card}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E7F6EC', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><CheckCircle2 size={20} color="var(--success)" /></div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{kpis.completed_today}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Completed today</div>
          </div>
          <div className="acdc-kpi" style={card}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FEF3E2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><Clock size={20} color="var(--warning)" /></div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{cycleFmt(kpis.avg_cycle_seconds)}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Avg. cycle time</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['active', 'completed'].map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              height: 40, padding: '0 20px', borderRadius: 8, fontSize: 14, fontWeight: 600, textTransform: 'capitalize',
              border: tab === t ? 'none' : '1px solid var(--border)',
              background: tab === t ? 'var(--brand-600)' : 'var(--surface)',
              color: tab === t ? '#fff' : 'var(--text)',
            }}>{t}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ ...card, padding: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search size={18} color="var(--text-secondary)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by reference or dock…" style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit', background: 'transparent' }} />
        </div>

        {error && <div style={{ color: 'var(--critical)', marginBottom: 16 }}>{error}</div>}

        {/* Task cards */}
        {filtered.map((t) => {
          const action = ACTIONS[t.status];
          const ob = opBadge[t.operation_type] || opBadge.LOAD;
          const timeLabel = STATUS_TIME[t.status]?.(t);
          return (
            <div key={t.task_id} className="acdc-task" style={{ ...card, padding: 18, marginBottom: 12 }}>
              <div className="acdc-task-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Truck size={20} color="var(--brand-600)" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{t.reference}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                      <span style={{ background: ob.bg, color: ob.color, padding: '2px 7px', borderRadius: 5, fontSize: 11, fontWeight: 600 }}>{t.operation_type}</span>
                      {' '}· D{String(t.dock_number).padStart(2, '0')} · {hhmm(t.appointment_min)}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ background: 'var(--brand-50)', color: 'var(--brand-700)', padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>{t.status}</span>
                  {timeLabel && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>{timeLabel}</div>}
                </div>
              </div>

              <Stepper status={t.status} />

              {action && (
                <button onClick={() => advance(t.task_id, action.to)} disabled={busy} className="acdc-action" style={{ height: 44, background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, marginTop: 14 }}>
                  {action.label}
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Inbox size={36} style={{ marginBottom: 12 }} />
            <div style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>No {tab} tasks</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>{tab === 'active' ? "You're all caught up." : 'Completed tasks will appear here.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}