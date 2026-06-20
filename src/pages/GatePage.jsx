import { useState, useEffect, useRef } from 'react';
import {
  Calendar, Truck, Clock, AlertTriangle, Search, RefreshCw, LogOut, Zap, Bell,
  ChevronDown, ChevronUp, Package, ArrowRight, LogIn, CheckCircle2, X,
  Building2, ArrowDown, ArrowUp, ArrowLeftRight, Timer, LayoutList,
  AlertCircle, UserX, Navigation,
} from 'lucide-react';
import {
  gateDay, gateCheckIn, gateLaunchAcdc, gateWaiting, gateAdmit,
  prepStart, prepReady, gateServiceDone, gateReleaseDock,
} from '../api';
import './GatePage.css';


/* ─── helpers ──────────────────────────────────────────────────── */
function hhmm(m) {
  if (m == null || m < 0) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function liveClock() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}
function prettyDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}
function shortDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function relTime(mins) {
  const a = Math.abs(mins); const h = Math.floor(a/60), m = a%60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/* ─── config ───────────────────────────────────────────────────── */
const opConfig = {
  LOAD:       { bg:'var(--brand-50)',  color:'var(--brand-700)', label:'LOAD',      icon:<ArrowUp size={10}/> },
  UNLOAD:     { bg:'#FEF3E2',          color:'#B45309',          label:'UNLOAD',    icon:<ArrowDown size={10}/> },
  LOAD_UNLOAD:{ bg:'#F3E8FF',          color:'#7C3AED',          label:'L+UNLOAD',  icon:<ArrowLeftRight size={10}/> },
};
const verdictStyle = {
  EARLY:   { bg:'#FEF3E2', color:'#B45309',           label:'EARLY' },
  ON_TIME: { bg:'#E7F6EC', color:'var(--success)',    label:'ON TIME' },
  LATE:    { bg:'#FDE8E8', color:'var(--critical)',   label:'LATE' },
};
const stateMeta = {
  EXPECTED:     { color:'#94A3B8',         label:'EXPECTED' },
  ARRIVED:      { color:'var(--success)',   label:'ARRIVED' },
  WAITING:      { color:'var(--warning)',   label:'WAITING' },
  AT_DOCK:      { color:'var(--brand-600)', label:'AT DOCK' },
  MISE_EN_STOCK:{ color:'#7C3AED',         label:'STOCKING' },
  DEPARTED:     { color:'#475569',         label:'DEPARTED' },
};
const ACDC_LABEL = {
  REQUESTED:'ACDC requested', ACCEPTED:'ACDC accepted',
  COLLECTION_STARTED:'Collecting', PRODUCTS_COLLECTED:'Collected',
  TRANSFERRED:'Transferred', DOCK_RELEASED:'ACDC done',
};

const STEPS = [
  { label:'Arrived' },
  { label:'Gate check' },
  { label:'Waiting' },
  { label:'Admit to dock' },
  { label:'At dock' },
  { label:'Service done' },
  { label:'Departed' },
];
function stateToStepIdx(state) {
  const MAP = { ARRIVED:1, WAITING:2, AT_DOCK:4, MISE_EN_STOCK:5, DEPARTED:7 };
  return MAP[state] ?? -1;
}
function effState(t, nowM) {
  if (t.gate_state === 'EXPECTED' && !t.arrival_category && nowM > t.window_end_min) return 'NO_SHOW';
  return t.gate_state;
}
function prepStatus(t) {
  if (!t.prep_needed) return null;
  if (t.prep_state === 'READY')   return { label:'Prep ready',   bg:'#E7F6EC', color:'var(--success)' };
  if (t.prep_state === 'STARTED') return { label:'Preparing…',   bg:'#FEF3E2', color:'#B45309' };
  if (t.prep_overdue)             return { label:'Prep overdue', bg:'#FDE8E8', color:'var(--critical)' };
  return { label:'Prep pending', bg:'#FEF3E2', color:'#B45309' };
}

/* ─── Stepper ─────────────────────────────────────────────────── */
function TruckStepper({ currentStep, color, compact = false }) {
  if (compact) {
    const label = currentStep < STEPS.length ? STEPS[currentStep]?.label : 'Completed';
    return (
      <div>
        <div style={{ display:'flex', alignItems:'center', width:'100%', marginBottom:5 }}>
          {STEPS.map((_, idx) => {
            const done    = idx < currentStep;
            const current = idx === currentStep;
            const dc = done ? 'var(--success)' : current ? color : '#CBD5E1';
            const lc = idx + 1 <= currentStep ? 'var(--success)' : '#E2E8F0';
            return (
              <div key={idx} style={{ display:'flex', alignItems:'center', flex: idx < STEPS.length - 1 ? 1 : 0 }}>
                <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${dc}`, background: done ? 'var(--success)' : current ? color : '#F8FAFC', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {done && <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', display:'block' }}/>}
                </div>
                {idx < STEPS.length - 1 && <div style={{ height:2, background:lc, flex:1, borderRadius:1 }}/>}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize:10, color, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>Step {Math.min(currentStep+1, STEPS.length)}/{STEPS.length} ·</span> {label}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display:'flex', alignItems:'flex-start', width:'100%' }}>
      {STEPS.map((step, idx) => {
        const done    = idx < currentStep;
        const current = idx === currentStep;
        const dc = done ? 'var(--success)' : current ? color : '#CBD5E1';
        const lc = idx + 1 <= currentStep ? 'var(--success)' : '#E2E8F0';
        return (
          <div key={idx} style={{ display:'flex', alignItems:'flex-start', flex: idx < STEPS.length - 1 ? 1 : 0 }}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0, minWidth:38 }}>
              <div style={{ width:24, height:24, borderRadius:'50%', border:`2.5px solid ${dc}`, background: done ? 'var(--success)' : current ? color : '#F8FAFC', display:'flex', alignItems:'center', justifyContent:'center', color: done || current ? '#fff' : '#CBD5E1', flexShrink:0 }}>
                {done
                  ? <CheckCircle2 size={13} color="#fff" strokeWidth={2.5}/>
                  : current
                    ? <span style={{ width:8, height:8, borderRadius:'50%', background:'#fff', display:'inline-block' }}/>
                    : <span style={{ fontSize:9, color:'#CBD5E1', fontWeight:700 }}>{idx+1}</span>
                }
              </div>
              <div style={{ fontSize:9, marginTop:4, textAlign:'center', lineHeight:1.2, maxWidth:44, color: current ? color : done ? 'var(--success)' : '#94A3B8', fontWeight: current || done ? 700 : 400 }}>
                {step.label}
              </div>
            </div>
            {idx < STEPS.length - 1 && <div style={{ height:2.5, background:lc, flex:1, marginTop:10, minWidth:4, borderRadius:2 }}/>}
          </div>
        );
      })}
    </div>
  );
}

/* ─── TruckCard (single render path, CSS-driven layout) ─────────── */
function TruckCard({ t, nowM, busy, isOpen, onToggle, onRecordArrival, onAct }) {
  const es      = effState(t, nowM);
  const meta    = es === 'NO_SHOW' ? { color:'var(--critical)', label:'NO-SHOW' } : (stateMeta[es] || stateMeta.EXPECTED);
  const op      = opConfig[t.operation_type] || opConfig.UNLOAD;
  const prep    = prepStatus(t);
  const notReady = t.prep_needed && t.prep_state !== 'READY';
  const stepIdx  = stateToStepIdx(es);
  const arrived  = t.arrived_at_min != null;
  const delta    = t.appointment_min - nowM;

  let arrivalLine, arrivalColor = '#94A3B8';
  if (arrived) {
    arrivalLine  = `Arrived ${hhmm(t.arrived_at_min)}`;
    arrivalColor = t.arrival_category === 'LATE' ? 'var(--critical)' : t.arrival_category === 'EARLY' ? '#B45309' : 'var(--success)';
  } else if (es === 'NO_SHOW') {
    arrivalLine  = 'No arrival detected';
    arrivalColor = 'var(--critical)';
  } else if (delta > 0) {
    arrivalLine  = `Due in ${relTime(delta)}`;
    arrivalColor = '#64748B';
  } else {
    arrivalLine  = 'Expected any moment';
    arrivalColor = 'var(--warning)';
  }

  const abtn = (label, icon, onClick, bg = 'var(--brand-600)') => (
    <button onClick={onClick} disabled={busy} style={{
      height:34, padding:'0 13px', background:bg, color:'#fff', border:'none',
      borderRadius:8, fontSize:12, fontWeight:700, display:'flex', alignItems:'center',
      gap:6, cursor:busy?'not-allowed':'pointer', opacity:busy?0.65:1, whiteSpace:'nowrap', width:'100%',
      boxShadow:`0 1px 3px ${bg}55`,
    }}>{icon}{label}</button>
  );
  const badge = (label, bg, color, icon) => (
    <span style={{ background:bg, color, padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700, display:'inline-flex', alignItems:'center', gap:3 }}>
      {icon}{label}
    </span>
  );

  const statusBadge = badge(meta.label, meta.color+'18', meta.color,
    es === 'ARRIVED'      ? <Navigation size={9}/> :
    es === 'WAITING'      ? <Clock size={9}/> :
    es === 'AT_DOCK'      ? <Building2 size={9}/> :
    es === 'MISE_EN_STOCK'? <Package size={9}/> :
    es === 'DEPARTED'     ? <CheckCircle2 size={9}/> :
    es === 'NO_SHOW'      ? <AlertCircle size={9}/> : <Timer size={9}/>
  );

  const detailsBlock = isOpen && (
    <div style={{ margin:'0 14px 12px', padding:'12px 14px', background:'var(--app-bg)', borderRadius:10, display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:10 }}>
      {[
        ['Appointment',     hhmm(t.appointment_min)],
        ['Window',          `${hhmm(t.window_start_min)} – ${hhmm(t.window_end_min)}`],
        ['Arrived at',      t.arrived_at_min!=null ? hhmm(t.arrived_at_min) : '—'],
        ['Waiting since',   t.waiting_started_at_min!=null ? hhmm(t.waiting_started_at_min):'—'],
        ['Admitted at',     t.dock_admitted_at_min!=null ? hhmm(t.dock_admitted_at_min):'—'],
        ['Service done',    t.service_done_at_min!=null ? hhmm(t.service_done_at_min):'—'],
        ['Departed at',     t.departed_at_min!=null ? hhmm(t.departed_at_min):'—'],
        ['Exp. completion', hhmm(t.expected_completion_min)],
        ['Products ready',  t.products_ready ? 'Yes':'No'],
        ['Prep state',      t.prep_state||'—'],
        ['ACDC status',     t.acdc_status||'none'],
        ['Needs stocking',  t.needs_mise ? 'Yes':'No'],
      ].map(([lbl,val]) => (
        <div key={lbl}>
          <div style={{ fontSize:10, color:'var(--text-secondary)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{lbl}</div>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>{val}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', boxShadow:'0 1px 4px rgba(15,52,66,.06)', borderLeft:`4px solid ${meta.color}` }}>
      <div className="gc-grid">

        {/* ── Identity column ── */}
        <div className="gc-identity">
          <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
            <div style={{ width:40, height:40, borderRadius:10, background:meta.color+'15', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, border:`1px solid ${meta.color}25` }}>
              <Truck size={20} color={meta.color}/>
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:14, marginBottom:1 }}>{t.reference}</div>
              <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:5 }}>{t.carrier||'—'}</div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:4, background:op.bg, color:op.color, padding:'3px 7px', borderRadius:6, fontSize:10, fontWeight:700, marginBottom:5 }}>
                {op.icon}{op.label}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-secondary)', marginBottom:2 }}>
                <Building2 size={10}/> D{String(t.dock_number).padStart(2,'0')}
                <span style={{ color:'#CBD5E1' }}>·</span>
                <Clock size={10}/> {hhmm(t.window_start_min)}–{hhmm(t.window_end_min)}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:arrivalColor, fontWeight:600 }}>
                <Navigation size={10}/> {arrivalLine}
              </div>
            </div>
          </div>
        </div>

        {/* ── Stepper — desktop only, hidden by CSS on tablet/mobile ── */}
        <div className="gc-stepper">
          <TruckStepper currentStep={stepIdx} color={meta.color}/>
        </div>

        {/* ── Actions column ── */}
        <div className="gc-actions">
          {(es === 'EXPECTED' || es === 'NO_SHOW') && abtn(es === 'NO_SHOW' ? 'Record arrival' : 'Check in →', <LogIn size={13}/>, onRecordArrival, es === 'NO_SHOW' ? 'var(--critical)' : 'var(--brand-600)')}
          {(es === 'ARRIVED' || es === 'WAITING') && (<>
            {abtn('Admit to dock →', <ArrowRight size={13}/>, () => onAct(gateAdmit, t.appointment_id))}
            {es === 'ARRIVED' && abtn('Send to waiting', <Clock size={13}/>, () => onAct(gateWaiting, t.appointment_id), 'var(--warning)')}
          </>)}
          {es === 'AT_DOCK' && abtn(t.needs_mise ? 'Done → Stock' : 'Service done ✓', <CheckCircle2 size={13}/>, () => onAct(gateServiceDone, t.appointment_id), '#16A34A')}
          {es === 'MISE_EN_STOCK' && abtn('Release dock', <ArrowRight size={13}/>, () => onAct(gateReleaseDock, t.appointment_id), '#7C3AED')}
          {t.acdc_eligible && abtn('Launch ACDC', <Zap size={13}/>, () => onAct(gateLaunchAcdc, t.appointment_id), '#7C3AED')}
          <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
            {statusBadge}
            {t.arrival_category && badge(verdictStyle[t.arrival_category].label, verdictStyle[t.arrival_category].bg, verdictStyle[t.arrival_category].color,
              t.arrival_category === 'LATE' ? <AlertTriangle size={9}/> : t.arrival_category === 'EARLY' ? <Timer size={9}/> : <CheckCircle2 size={9}/>
            )}
            {prep && badge(prep.label, prep.bg, prep.color, <Package size={9}/>)}
            {t.acdc_status && badge(ACDC_LABEL[t.acdc_status], '#F3E8FF', '#7C3AED', <Zap size={9}/>)}
          </div>
          {notReady && !['EXPECTED','DEPARTED'].includes(es) && (
            <span style={{ fontSize:11, color:'var(--critical)', display:'flex', alignItems:'center', gap:4 }}>
              <AlertTriangle size={11}/> Products not ready
            </span>
          )}
          <button onClick={onToggle} style={{ height:28, background:'none', border:'1px solid var(--border)', borderRadius:7, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', justifyContent:'center', gap:4, cursor:'pointer', color:'var(--text-secondary)' }}>
            {isOpen ? <ChevronUp size={12}/> : <ChevronDown size={12}/>} {isOpen ? 'Hide details' : 'View details'}
          </button>
        </div>

        {/* ── Compact stepper — shown on tablet/mobile via CSS ── */}
        <div className="gc-stepper-below">
          <TruckStepper currentStep={stepIdx} color={meta.color} compact={true}/>
        </div>

      </div>
      {detailsBlock}
    </div>
  );
}

/* ─── Sidebar panel ─────────────────────────────────────────────── */
function SidePanel({ title, icon, iconBg, count, countBg, countColor, children }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:18 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <div style={{ width:32, height:32, borderRadius:8, background:iconBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {icon}
        </div>
        <span style={{ fontWeight:700 }}>{title}</span>
        <span style={{ marginLeft:'auto', background:countBg, color:countColor, padding:'2px 10px', borderRadius:20, fontSize:12, fontWeight:700 }}>
          {count}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ─── Main page ─────────────────────────────────────────────────── */
export default function GatePage({ user, onLogout }) {
  const [date,      setDate]      = useState(new Date().toISOString().slice(0,10));
  const [data,      setData]      = useState(null);
  const [error,     setError]     = useState('');
  const [busy,      setBusy]      = useState(false);
  const [search,    setSearch]    = useState('');
  const [filter,    setFilter]    = useState('ALL');
  const [clock,     setClock]     = useState(liveClock());
  const [expanded,  setExpanded]  = useState(null);
  const [notified,  setNotified]  = useState({});
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  async function load() {
    setError('');
    try { setData(await gateDay(date)); } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, [date]);
  useEffect(() => {
    const r = setInterval(load, 30000);
    const t = setInterval(() => setClock(liveClock()), 1000);
    return () => { clearInterval(r); clearInterval(t); };
  }, [date]);

  async function act(fn, id) {
    setBusy(true);
    try { await fn(id); await load(); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const recordArrival = id => act(x => gateCheckIn(x, nowMinutes(), null), id);

  const trucks = data?.trucks || [];
  const k      = data?.kpis || { expected:0, arrived:0, waiting:0, late_noshow:0, late:0, no_show:0 };
  const nowM   = data?.current_time_min ?? nowMinutes();

  const needsActionList = trucks.filter(t => ['ARRIVED','WAITING'].includes(t.gate_state));
  const atDockList      = trucks.filter(t => ['AT_DOCK','MISE_EN_STOCK'].includes(t.gate_state));
  const waitingList     = trucks.filter(t => t.gate_state === 'WAITING');
  const completedList   = trucks.filter(t => t.gate_state === 'DEPARTED');
  const lateList        = trucks.filter(t => t.arrival_category === 'LATE');
  const noShowList      = trucks.filter(t => effState(t,nowM) === 'NO_SHOW');
  const prepList        = trucks.filter(t => t.prep_needed && t.prep_state !== 'READY');
  const problemList     = trucks.filter(t => t.arrival_category === 'LATE' || (t.gate_state === 'EXPECTED' && !t.arrival_category && nowM > t.window_end_min));

  const TABS = [
    { key:'ALL',     label:'All',     count:trucks.length,          icon:<LayoutList size={12}/> },
    { key:'ACTION',  label:'Action',  count:needsActionList.length, icon:<AlertCircle size={12}/>, alert:'var(--warning)' },
    { key:'AT_DOCK', label:'At Dock', count:atDockList.length,      icon:<Building2 size={12}/>,  alert:'var(--brand-600)' },
    { key:'WAITING', label:'Waiting', count:waitingList.length,     icon:<Clock size={12}/> },
    { key:'DONE',    label:'Done',    count:completedList.length,   icon:<CheckCircle2 size={12}/> },
    { key:'LATE',    label:'Late',    count:lateList.length,        icon:<Timer size={12}/>, alert:'var(--critical)' },
    { key:'NO_SHOW', label:'No-show', count:noShowList.length,      icon:<UserX size={12}/>, alert:'var(--critical)' },
  ];

  function matchFilter(t) {
    const es = effState(t, nowM);
    if (filter === 'ALL')     return true;
    if (filter === 'ACTION')  return ['ARRIVED','WAITING'].includes(t.gate_state);
    if (filter === 'AT_DOCK') return ['AT_DOCK','MISE_EN_STOCK'].includes(t.gate_state);
    if (filter === 'WAITING') return t.gate_state === 'WAITING';
    if (filter === 'DONE')    return t.gate_state === 'DEPARTED';
    if (filter === 'LATE')    return t.arrival_category === 'LATE';
    if (filter === 'NO_SHOW') return es === 'NO_SHOW';
    return true;
  }
  const filtered = trucks.filter(t => {
    const ms = !search || t.reference.toLowerCase().includes(search.toLowerCase()) || (t.carrier||'').toLowerCase().includes(search.toLowerCase());
    return ms && matchFilter(t);
  });

  useEffect(() => {
    if (!notifOpen) return;
    function h(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  const gateAlerts = [];
  if (waitingList.length > 0)   gateAlerts.push({ type:'warn',     msg:`${waitingList.length} truck(s) waiting at gate` });
  if (lateList.length > 0)      gateAlerts.push({ type:'warn',     msg:`${lateList.length} truck(s) arrived late` });
  if (noShowList.length > 0)    gateAlerts.push({ type:'critical', msg:`${noShowList.length} truck(s) — no-show` });
  if (gateAlerts.length === 0 && trucks.length > 0)
    gateAlerts.push({ type:'ok', msg:'All trucks on schedule — no issues' });

  const alertCount = gateAlerts.filter(a => a.type !== 'ok').length;
  const initials   = (user?.name||'GA').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const card       = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14 };

  /* ── Sidebar content (shared between desktop sticky + mobile panel) ── */
  const sidebarContent = (
    <>
      {/* Preparation queue */}
      <SidePanel
        title="Preparation queue"
        icon={<Package size={16} color="var(--brand-600)"/>}
        iconBg="var(--brand-50)"
        count={prepList.length}
        countBg={prepList.length > 0 ? 'var(--brand-50)' : '#E7F6EC'}
        countColor={prepList.length > 0 ? 'var(--brand-700)' : 'var(--success)'}
      >
        {prepList.length === 0
          ? <div style={{ color:'var(--text-secondary)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}><CheckCircle2 size={14} color="var(--success)"/> All done.</div>
          : prepList.slice(0,4).map(t => (
            <div key={t.appointment_id} style={{ paddingBottom:12, marginBottom:12, borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:3 }}>
                <span style={{ fontWeight:700, fontSize:14 }}>{t.reference}</span>
                <button onClick={() => act(t.prep_state==='PENDING' ? prepStart : prepReady, t.appointment_id)} disabled={busy} style={{ height:27, padding:'0 10px', background: t.prep_state==='STARTED' ? 'var(--success)' : 'var(--brand-600)', color:'#fff', border:'none', borderRadius:6, fontSize:11, fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  {t.prep_state === 'STARTED' ? <><CheckCircle2 size={11}/> Mark ready</> : <><Package size={11}/> Start prep</>}
                </button>
              </div>
              <div style={{ fontSize:11, color:'var(--text-secondary)', display:'flex', alignItems:'center', gap:4, marginBottom:3 }}>
                {opConfig[t.operation_type]?.icon} {t.operation_type} · <Building2 size={10}/> D{String(t.dock_number).padStart(2,'0')}
              </div>
              <div style={{ fontSize:11, color: t.prep_overdue ? 'var(--critical)' : t.prep_state==='STARTED' ? '#B45309' : 'var(--text-secondary)', display:'flex', alignItems:'center', gap:4 }}>
                {t.prep_overdue ? <AlertTriangle size={10}/> : <Clock size={10}/>}
                {t.prep_state === 'STARTED' ? 'Preparing…' : t.prep_overdue ? 'OVERDUE' : `Start at ${hhmm(t.preparation_start_min)}`}
              </div>
            </div>
          ))
        }
        {prepList.length > 4 && (
          <button onClick={() => setFilter('ACTION')} style={{ fontSize:12, color:'var(--brand-600)', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}>
            <ArrowRight size={12}/> View all {prepList.length} trucks
          </button>
        )}
      </SidePanel>

      {/* Waiting area */}
      <SidePanel
        title="Waiting area"
        icon={<Clock size={16} color="var(--warning)"/>}
        iconBg="#FEF3E2"
        count={waitingList.length}
        countBg={waitingList.length > 0 ? '#FEF3E2' : '#E7F6EC'}
        countColor={waitingList.length > 0 ? '#B45309' : 'var(--success)'}
      >
        {waitingList.length === 0
          ? <div style={{ color:'var(--text-secondary)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}><CheckCircle2 size={14} color="var(--success)"/> No trucks waiting.</div>
          : waitingList.map(t => (
            <div key={t.appointment_id} style={{ paddingBottom:12, marginBottom:12, borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{t.reference}</div>
                  <div style={{ fontSize:11, color:'var(--text-secondary)', marginTop:2 }}>{t.carrier} · D{String(t.dock_number).padStart(2,'0')}</div>
                </div>
                {t.waiting_started_at_min != null && (
                  <span style={{ fontSize:11, color:'var(--warning)', fontWeight:700, display:'flex', alignItems:'center', gap:3 }}>
                    <Timer size={11}/>{relTime(nowM - t.waiting_started_at_min)}
                  </span>
                )}
              </div>
              <button onClick={() => act(gateAdmit, t.appointment_id)} disabled={busy} style={{ height:30, width:'100%', background:'var(--brand-600)', color:'#fff', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                <ArrowRight size={13}/> Admit to dock
              </button>
            </div>
          ))
        }
      </SidePanel>

      {/* Exceptions */}
      <SidePanel
        title="Exceptions"
        icon={<AlertTriangle size={16} color="var(--critical)"/>}
        iconBg="#FDE8E8"
        count={problemList.length}
        countBg={problemList.length > 0 ? '#FDE8E8' : '#E7F6EC'}
        countColor={problemList.length > 0 ? 'var(--critical)' : 'var(--success)'}
      >
        {problemList.length === 0
          ? <div style={{ color:'var(--text-secondary)', fontSize:13, display:'flex', alignItems:'center', gap:6 }}><CheckCircle2 size={14} color="var(--success)"/> All on track.</div>
          : problemList.slice(0,5).map(t => {
            const noShow = !t.arrival_category;
            const by     = noShow ? nowM - t.window_end_min : (t.arrived_at_min||0) - (t.window_end_min||0);
            return (
              <div key={t.appointment_id} style={{ paddingBottom:10, marginBottom:10, borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <span style={{ fontWeight:700, fontSize:13, display:'flex', alignItems:'center', gap:5 }}>
                    <Truck size={12} color={noShow ? 'var(--critical)' : '#B45309'}/>{t.reference}
                  </span>
                  <span style={{ background: noShow ? '#FDE8E8' : '#FEF3E2', color: noShow ? 'var(--critical)' : '#B45309', padding:'2px 7px', borderRadius:5, fontSize:10, fontWeight:700 }}>
                    {noShow ? 'NO-SHOW' : 'LATE'}{by > 0 ? ` +${relTime(by)}` : ''}
                  </span>
                </div>
                <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:6 }}>
                  <Clock size={10}/> {hhmm(t.window_start_min)} – {hhmm(t.window_end_min)}
                </div>
                <div style={{ display:'flex', gap:5 }}>
                  {t.acdc_eligible && (
                    <button onClick={() => act(gateLaunchAcdc, t.appointment_id)} disabled={busy} style={{ height:26, padding:'0 8px', background:'#7C3AED', color:'#fff', border:'none', borderRadius:5, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:3, cursor:'pointer' }}>
                      <Zap size={11}/> ACDC
                    </button>
                  )}
                  <button onClick={() => setNotified({...notified, [t.appointment_id]:true})} disabled={notified[t.appointment_id]} style={{ height:26, padding:'0 8px', background: notified[t.appointment_id] ? '#E7F6EC' : 'var(--surface)', color: notified[t.appointment_id] ? 'var(--success)' : 'var(--text)', border:'1px solid var(--border)', borderRadius:5, fontSize:11, fontWeight:600, display:'flex', alignItems:'center', gap:3, cursor:'pointer' }}>
                    <Bell size={11}/> {notified[t.appointment_id] ? '✓ Notified' : 'Notify'}
                  </button>
                </div>
              </div>
            );
          })
        }
        {problemList.length > 5 && (
          <button onClick={() => setFilter('LATE')} style={{ fontSize:12, color:'var(--critical)', fontWeight:600, background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}>
            <ArrowRight size={12}/> View all {problemList.length} exceptions
          </button>
        )}
      </SidePanel>
    </>
  );

  return (
    <div className="gp-root">

      {/* ── Header ── */}
      <div className="gh-header">
        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <div style={{ width:34, height:34, border:'2px solid var(--brand-600)', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--brand-600)', fontWeight:700, fontSize:15 }}>N</div>
          <div className="gh-brand-text">
            <div style={{ fontWeight:700, fontSize:16 }}>NumiDock</div>
            <div style={{ fontSize:10, color:'var(--text-secondary)' }}>Gate Control · <span style={{ color:'var(--success)' }}>● Live</span></div>
          </div>
        </div>

        {/* Clock (center) */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flex:1 }}>
          <div className="gh-date-full">{prettyDate(date)}</div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <Clock size={13} color="var(--text-secondary)"/>
            <span className="gh-clock">{clock}</span>
            <span style={{ fontSize:10, color:'var(--success)', fontWeight:600 }}>● LIVE</span>
          </div>
          <div className="gh-date-short">{shortDate(date)}</div>
        </div>

        {/* Right actions */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          {/* Notification bell */}
          <div style={{ position:'relative' }} ref={notifRef}>
            <button onClick={() => setNotifOpen(o=>!o)} style={{ position:'relative', background:'none', border:'none', cursor:'pointer', padding:6, display:'flex', alignItems:'center', borderRadius:8 }}>
              <Bell size={18} color={alertCount > 0 ? 'var(--warning)' : 'var(--text-secondary)'}/>
              {alertCount > 0 && (
                <span style={{ position:'absolute', top:2, right:2, width:15, height:15, borderRadius:'50%', background:'var(--critical)', color:'#fff', fontSize:9, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {alertCount}
                </span>
              )}
            </button>
            {notifOpen && (
              <div style={{ position:'absolute', top:'calc(100% + 8px)', right:0, width:280, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, boxShadow:'0 8px 24px rgba(0,0,0,.13)', zIndex:500, overflow:'hidden' }}>
                <div style={{ padding:'10px 14px', fontWeight:700, fontSize:13, borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ display:'flex', alignItems:'center', gap:6 }}><Bell size={13}/> Notifications</span>
                  <button onClick={() => setNotifOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-secondary)', display:'flex' }}><X size={14}/></button>
                </div>
                {gateAlerts.map((a,i) => (
                  <div key={i} style={{ padding:'10px 14px', borderBottom: i<gateAlerts.length-1 ? '1px solid var(--border)' : 'none', display:'flex', gap:8, alignItems:'flex-start', fontSize:13 }}>
                    {a.type==='critical' ? <AlertTriangle size={14} color="var(--critical)" style={{flexShrink:0,marginTop:1}}/>
                     : a.type==='warn'   ? <AlertTriangle size={14} color="var(--warning)"  style={{flexShrink:0,marginTop:1}}/>
                     : <CheckCircle2 size={14} color="var(--success)" style={{flexShrink:0,marginTop:1}}/>}
                    <span style={{ fontSize:12, color: a.type==='critical' ? 'var(--critical)' : a.type==='ok' ? 'var(--success)' : 'var(--text)' }}>{a.msg}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar toggle — shown on tablet/mobile via CSS */}
          {/* Avatar + name — desktop only via CSS */}
          <div className="gh-user-info">
            <div style={{ width:34, height:34, borderRadius:'50%', background:'var(--brand-100)', color:'var(--brand-700)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:12 }}>{initials}</div>
            <div style={{ fontSize:13 }}>
              <div style={{ fontWeight:600, whiteSpace:'nowrap' }}>{user?.name}</div>
              <div style={{ color:'var(--text-secondary)', fontSize:11 }}>Gate Agent</div>
            </div>
          </div>

          <button onClick={onLogout} style={{ height:34, padding:'0 10px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer', flexShrink:0 }}>
            <LogOut size={13}/>
            <span className="gh-panels-lbl">Sign out</span>
          </button>
        </div>
      </div>

      <div className="gp-page">

        {/* ── KPIs ── */}
        <div className="gp-kpis">
          {[
            { icon:<Calendar size={18} color="var(--brand-600)"/>, bg:'var(--brand-50)', label:'Expected',      val:k.expected,    vc:'var(--text)',      sub:'scheduled' },
            { icon:<Truck    size={18} color="var(--success)"/>,   bg:'#E7F6EC',         label:'Arrived',       val:k.arrived,     vc:'var(--success)',   sub:`${k.arrived&&trucks.length?Math.round(k.arrived/trucks.length*100):0}%` },
            { icon:<Clock    size={18} color="var(--warning)"/>,   bg:'#FEF3E2',         label:'Waiting',       val:k.waiting,     vc: k.waiting>0?'var(--warning)':'var(--text)',  sub: k.waiting===0?'Clear':`${k.waiting} holding` },
            { icon:<AlertTriangle size={18} color="var(--critical)"/>, bg:'#FDE8E8',     label:'Late / No-show',val:k.late_noshow, vc: k.late_noshow>0?'var(--critical)':'var(--text)', sub:`${k.late}L · ${k.no_show}NS` },
          ].map(({ icon,bg,label,val,vc,sub }) => (
            <div key={label} style={{ ...card, padding:'14px 16px', display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:44, height:44, borderRadius:10, background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{icon}</div>
              <div>
                <div style={{ fontSize:11, color:'var(--text-secondary)', marginBottom:1 }}>{label}</div>
                <div style={{ fontSize:24, fontWeight:700, color:vc, lineHeight:1 }}>{val}</div>
                <div style={{ fontSize:10, color:'var(--text-secondary)', marginTop:2 }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Main layout ── */}
        <div className="gp-layout">

          {/* LEFT — truck list */}
          <div>
            {/* Search + date + refresh */}
            <div style={{ ...card, padding:'11px 14px', marginBottom:12, display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
              <div style={{ flex:1, minWidth:140, display:'flex', alignItems:'center', gap:6, border:'1px solid var(--border)', borderRadius:9, padding:'0 10px', height:38, background:'var(--app-bg)' }}>
                <Search size={14} color="var(--text-secondary)"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search trucks…" style={{ border:'none', outline:'none', flex:1, fontSize:13, fontFamily:'inherit', background:'transparent' }}/>
                {search && <button onClick={()=>setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex' }}><X size={12} color="var(--text-secondary)"/></button>}
              </div>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} style={{ height:38, border:'1px solid var(--border)', borderRadius:9, padding:'0 10px', fontSize:13, fontFamily:'inherit', background:'var(--app-bg)', flexShrink:0 }}/>
              <button onClick={load} title="Refresh" style={{ height:38, width:38, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
                <RefreshCw size={14} color="var(--text-secondary)"/>
              </button>
            </div>

            {/* Filter tabs */}
            <div className="gp-tabs">
              {TABS.map(tab => {
                const active   = filter === tab.key;
                const hasAlert = !active && tab.alert && tab.count > 0;
                return (
                  <button key={tab.key} onClick={() => setFilter(tab.key)} style={{
                    height:32, padding:'0 11px', borderRadius:8, fontSize:12, fontWeight:600,
                    border: active ? 'none' : '1px solid var(--border)',
                    background: active ? 'var(--brand-600)' : 'var(--surface)',
                    color: active ? '#fff' : 'var(--text)',
                    display:'flex', alignItems:'center', gap:4, cursor:'pointer', flexShrink:0,
                  }}>
                    <span style={{ color: active ? '#fff' : hasAlert ? tab.alert : 'var(--text-secondary)', display:'flex', alignItems:'center' }}>{tab.icon}</span>
                    {tab.label}
                    <span style={{ background: active ? 'rgba(255,255,255,.22)' : hasAlert ? tab.alert+'20' : 'var(--app-bg)', color: active ? '#fff' : hasAlert ? tab.alert : 'var(--text-secondary)', padding:'1px 6px', borderRadius:20, fontSize:11, fontWeight:700, minWidth:18, textAlign:'center' }}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
              <div style={{ background:'#FDE8E8', border:'1px solid #FECACA', borderRadius:10, padding:'10px 14px', color:'var(--critical)', marginBottom:12, fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
                <AlertTriangle size={15}/>{error}
              </div>
            )}

            {/* Truck cards */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {filtered.map(t => (
                <TruckCard
                  key={t.appointment_id}
                  t={t} nowM={nowM} busy={busy}
                  isOpen={expanded === t.appointment_id}
                  onToggle={() => setExpanded(expanded === t.appointment_id ? null : t.appointment_id)}
                  onRecordArrival={() => recordArrival(t.appointment_id)}
                  onAct={act}
                />
              ))}
              {filtered.length === 0 && trucks.length > 0 && (
                <div style={{ ...card, padding:36, textAlign:'center', color:'var(--text-secondary)', fontSize:14 }}>
                  No trucks match your filter.
                </div>
              )}
              {trucks.length === 0 && (
                <div style={{ ...card, padding:36, textAlign:'center', color:'var(--text-secondary)', fontSize:14 }}>
                  <Calendar size={28} color="#CBD5E1" style={{ marginBottom:10 }}/>
                  <div>No schedule found for {prettyDate(date)}.</div>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT — desktop sticky sidebar */}
          <div className="gp-sidebar-desktop">
            {sidebarContent}
          </div>

        </div>
      </div>
    </div>
  );
}
