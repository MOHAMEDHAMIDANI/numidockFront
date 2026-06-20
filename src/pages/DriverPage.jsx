import { useState } from 'react';
import { Truck, Calendar, Clock, MapPin, Package, FileText, Globe, HelpCircle, CircleDot, Headphones, ShieldCheck, ChevronRight } from 'lucide-react';
import { driverLookup, driverReportDelay } from '../api';

function hhmm(m) {
  if (m == null) return '—';
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
function prettyDate(d) {
  if (!d) return '';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function opLabel(op) {
  return op === 'LOAD' ? 'Loading' : op === 'UNLOAD' ? 'Unloading' : 'Loading + Unloading';
}
function delayText(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const ACDC_STEPS = ['REQUESTED', 'ACCEPTED', 'COLLECTION_STARTED', 'PRODUCTS_COLLECTED', 'TRANSFERRED', 'DOCK_RELEASED'];
const ACDC_LABEL = { REQUESTED: 'Requested', ACCEPTED: 'Accepted', COLLECTION_STARTED: 'Collection Started', PRODUCTS_COLLECTED: 'Products Collected', TRANSFERRED: 'Transferred', DOCK_RELEASED: 'Dock Released' };

export default function DriverPage() {
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [appt, setAppt] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // delay UI
  const [showDelay, setShowDelay] = useState(false);
  const [delayH, setDelayH] = useState('0');
  const [delayM, setDelayM] = useState('30');
  const [delayMsg, setDelayMsg] = useState('');

  async function handleLookup() {
    setError(''); setAppt(null); setDelayMsg(''); setShowDelay(false);
    if (!reference.trim()) { setError('Please enter your Truck ID.'); return; }
    setBusy(true);
    try {
      const data = await driverLookup(reference.trim(), date);
      setAppt(data);
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitDelay() {
    const total = parseInt(delayH || '0', 10) * 60 + parseInt(delayM || '0', 10);
    if (total <= 0) { setDelayMsg('Enter a delay greater than zero.'); return; }
    setBusy(true);
    try {
      await driverReportDelay(reference.trim(), date, total);
      setDelayMsg(`Delay of ${delayText(total)} reported. Thank you.`);
      setShowDelay(false);
    } catch (err) { setDelayMsg(err.message); }
    finally { setBusy(false); }
  }

  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 };
  const field = (icon, label, value, strong, color) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--brand-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
        <div style={{ fontSize: 17, fontWeight: 700, color: color || 'var(--text)' }}>{value}</div>
      </div>
    </div>
  );

  const hasAcdc = appt && appt.acdc_status;
  const acdcIdx = hasAcdc ? ACDC_STEPS.indexOf(appt.acdc_status) : -1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--app-bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--brand-600)' }}>NumiDock</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, color: 'var(--text-secondary)', fontSize: 14 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={16} /> English</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><HelpCircle size={16} /> Help</span>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: 24 }}>
        <h1 style={{ textAlign: 'center', fontSize: 34, fontWeight: 700, color: 'var(--brand-900)', marginTop: 16 }}>Driver Appointment Portal</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: 32 }}>Enter your Truck ID to view your appointment.</p>

        {/* Lookup card */}
        <div style={{ ...card, padding: 24, maxWidth: 560, margin: '0 auto 24px' }}>
          <label style={{ fontSize: 14, fontWeight: 600 }}>Truck ID</label>
          <input value={reference} onChange={(e) => setReference(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()} placeholder="e.g. TRK-2026-0142"
            style={{ width: '100%', height: 50, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 15, marginTop: 8, marginBottom: 14, fontFamily: 'inherit' }} />
          <label style={{ fontSize: 14, fontWeight: 600 }}>RDV date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
            style={{ width: '100%', height: 50, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 12, fontSize: 15, marginTop: 8, marginBottom: 16, fontFamily: 'inherit' }} />
          <button onClick={handleLookup} disabled={busy} style={{ width: '100%', height: 50, background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600 }}>
            {busy ? 'Checking…' : 'Check Appointment'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 14, fontSize: 14 }}>
            <span style={{ color: 'var(--brand-600)', fontWeight: 500 }}>Need help? Contact dispatch</span>
          </p>
        </div>

        {error && <div style={{ ...card, padding: 16, maxWidth: 560, margin: '0 auto 24px', color: 'var(--critical)', textAlign: 'center' }}>{error}</div>}

        {/* Appointment card */}
        {appt && (
          <div style={{ ...card, padding: 28, marginBottom: 20 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#E7F6EC', color: 'var(--success)', padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700, marginBottom: 24 }}>
              <CircleDot size={16} /> CONFIRMED
            </span>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, marginBottom: 24 }}>
              {field(<Truck size={20} color="var(--brand-600)" />, 'Truck ID', appt.reference)}
              {field(<MapPin size={20} color="var(--brand-600)" />, 'Gate', 'Assigned on arrival')}
              {field(<Calendar size={20} color="var(--brand-600)" />, 'RDV date', prettyDate(date))}
              {field(<FileText size={20} color="var(--brand-600)" />, 'Dock', `D${String(appt.dock_number).padStart(2, '0')}`)}
              {field(<Clock size={20} color="var(--brand-600)" />, 'Arrival window', `${hhmm(appt.window_start_min)} – ${hhmm(appt.window_end_min)}`, true, 'var(--brand-600)')}
              {field(<Package size={20} color="var(--brand-600)" />, 'Operation', opLabel(appt.operation_type))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 20, marginBottom: 20, display: 'flex', gap: 12 }}>
              <FileText size={20} color="var(--text-secondary)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Driver instructions</div>
                <div style={{ fontSize: 14, marginTop: 2 }}>Arrive within the indicated time window and present your Truck ID at the gate.</div>
              </div>
            </div>

            {/* ACDC process status — only if there's an ACDC task */}
            {hasAcdc && (
              <div style={{ background: 'var(--brand-50)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14 }}>Process Status</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ACDC_STEPS.map((s, i) => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: i <= acdcIdx ? 'var(--brand-700)' : 'var(--text-secondary)', fontWeight: i <= acdcIdx ? 600 : 400 }}>
                      <div style={{ width: 14, height: 14, borderRadius: '50%', background: i <= acdcIdx ? 'var(--brand-600)' : 'var(--border)' }} />
                      {ACDC_LABEL[s]}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report delay */}
            {appt.delay_reported || delayMsg ? (
              <div style={{ background: '#FEF3E2', color: '#B45309', borderRadius: 12, padding: 16, textAlign: 'center', fontWeight: 600 }}>
                {delayMsg || `Delay of ${delayText(appt.delay_minutes)} reported.`}
              </div>
            ) : !showDelay ? (
              <button onClick={() => setShowDelay(true)} style={{ width: '100%', background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 12, padding: '16px', fontSize: 16, fontWeight: 700, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={20} /> Report Delay</span>
                <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.9 }}>Let us know if you will be late</span>
              </button>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 18 }}>
                <div style={{ fontWeight: 700, marginBottom: 12 }}>How late will you be?</div>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Hours</label>
                    <input type="number" min="0" value={delayH} onChange={(e) => setDelayH(e.target.value)} style={{ display: 'block', width: 90, height: 44, border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', marginTop: 4 }} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Minutes</label>
                    <input type="number" min="0" max="59" value={delayM} onChange={(e) => setDelayM(e.target.value)} style={{ display: 'block', width: 90, height: 44, border: '1px solid var(--border)', borderRadius: 10, padding: '0 12px', marginTop: 4 }} />
                  </div>
                  <button onClick={submitDelay} disabled={busy} style={{ height: 44, padding: '0 20px', background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 600 }}>Submit</button>
                  <button onClick={() => setShowDelay(false)} style={{ height: 44, padding: '0 16px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 10 }}>Cancel</button>
                </div>
                {delayMsg && <div style={{ color: 'var(--critical)', fontSize: 13, marginTop: 10 }}>{delayMsg}</div>}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {appt && (
          <div style={{ ...card, padding: 20, display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={20} color="var(--brand-600)" />
              <div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Site</div><div style={{ fontWeight: 700 }}>Numilog Bouira</div></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Headphones size={20} color="var(--brand-600)" />
              <div><div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Contact support</div><div style={{ fontWeight: 700, color: 'var(--brand-600)' }}>+213 26 123 45 67</div></div>
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <ShieldCheck size={16} /> Your safety is our priority. Please follow site rules and instructions at all times.
        </p>
      </div>
    </div>
  );
}