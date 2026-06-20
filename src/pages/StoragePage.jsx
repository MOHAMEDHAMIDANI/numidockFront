import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Boxes, CheckCircle2, ChevronDown,
  ChevronLeft, ChevronRight, Download, Grid3X3, Layers3, Lock, LockOpen,
  MapPinned, Package, PackageCheck, PackagePlus, Printer, RefreshCw, Search,
  SlidersHorizontal, Table2, Truck, Upload, Warehouse, X, Bell,
} from 'lucide-react';
import {
  getStorageKpis, listPallets, createPallet, updatePallet, deletePallet,
  getStorageZones, getStorageWarehouses, importStorage, exportStorage,
  getStorageMatrix, getZonesList, updateZoneStatus, storageTransfer,
  moveToPrepZone, allocatePallet,
} from '../api';

// ─── helpers ──────────────────────────────────────────────────────────────────
function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const m = { Available: 'ok', Reserved: 'warn', 'On Hold': 'hold' };
  return <span className={`st-status ${m[status] || 'hold'}`}>{status}</span>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, ok, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, []);
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 3000, background: ok ? '#dcfce7' : '#fee2e2', border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`, color: ok ? '#15803d' : '#b91c1c', borderRadius: 10, padding: '10px 16px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 12px rgba(0,0,0,.15)', maxWidth: 380 }}>
      {ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />} {msg}
      <button onClick={onDone} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', marginLeft: 4, padding: 0, display: 'flex' }}><X size={13} /></button>
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children, maxW = 560 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, width: '100%', maxWidth: maxW, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  );
}

const inp = { height: 34, border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', padding: '0 10px', fontSize: 13, width: '100%', boxSizing: 'border-box' };
const sel = { ...inp, appearance: 'none', cursor: 'pointer' };
const Lbl = ({ children }) => <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>{children}</label>;
const G2 = ({ children }) => <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
const Err = ({ msg }) => msg ? <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', color: '#b91c1c', fontSize: 12, marginBottom: 12 }}>{msg}</div> : null;

// ─── Field row helper ─────────────────────────────────────────────────────────
function Field({ label, children }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}><Lbl>{label}</Lbl>{children}</div>;
}

// ─── SelectBox filter ─────────────────────────────────────────────────────────
function SelectBox({ label, value, onChange, options = [] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ position: 'relative' }}>
        <select value={value} onChange={e => onChange(e.target.value)} style={sel}>
          <option value="">All</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
      </div>
    </label>
  );
}

// ─── Pallet form modal (New + Edit) ──────────────────────────────────────────
const BLANK = { item_code: '', description: '', sku: '', warehouse: 'WH1 - Central', zone: 'Z02 - Storage', location: '', pallet_id: '', pallet_type: 'EUR', quantity: 0, base_unit: 'PCS', status: 'Available', max_weight_kg: '', product_type: '', compatibility_group: '', max_slots: 1 };

function PalletModal({ title, initial, zones, warehouses, onSave, onClose }) {
  const [form, setForm] = useState({ ...BLANK, ...initial });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.item_code.trim()) { setErr('Item code is required'); return; }
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Err msg={err} />
        <G2>
          <Field label="Item Code *"><input style={inp} value={form.item_code} onChange={e => set('item_code', e.target.value)} /></Field>
          <Field label="SKU"><input style={inp} value={form.sku} onChange={e => set('sku', e.target.value)} /></Field>
        </G2>
        <Field label="Description"><input style={inp} value={form.description} onChange={e => set('description', e.target.value)} /></Field>
        <G2>
          <Field label="Warehouse">
            <div style={{ position: 'relative' }}><select style={sel} value={form.warehouse} onChange={e => set('warehouse', e.target.value)}>
              {(warehouses.length ? warehouses : ['WH1 - Central','WH2 - North','WH3 - South']).map(w => <option key={w}>{w}</option>)}
            </select><ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} /></div>
          </Field>
          <Field label="Zone">
            <div style={{ position: 'relative' }}><select style={sel} value={form.zone} onChange={e => set('zone', e.target.value)}>
              {(zones.length ? zones : ['Z01 - Receiving','Z02 - Storage','Z03 - Bulk','Z04 - Picking','Z05 - Chemical']).map(z => <option key={z}>{z}</option>)}
            </select><ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} /></div>
          </Field>
        </G2>
        <G2>
          <Field label="Location"><input style={inp} value={form.location} onChange={e => set('location', e.target.value)} /></Field>
          <Field label="Pallet ID"><input style={inp} value={form.pallet_id} onChange={e => set('pallet_id', e.target.value)} /></Field>
        </G2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          <Field label="Pallet Type">
            <div style={{ position: 'relative' }}><select style={sel} value={form.pallet_type} onChange={e => set('pallet_type', e.target.value)}>{['EUR','IND','ISO'].map(t => <option key={t}>{t}</option>)}</select><ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} /></div>
          </Field>
          <Field label="Quantity"><input style={inp} type="number" min="0" value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value)||0)} /></Field>
          <Field label="Unit">
            <div style={{ position: 'relative' }}><select style={sel} value={form.base_unit} onChange={e => set('base_unit', e.target.value)}>{['PCS','KG','L','BOX','CTN'].map(u => <option key={u}>{u}</option>)}</select><ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} /></div>
          </Field>
          <Field label="Status">
            <div style={{ position: 'relative' }}><select style={sel} value={form.status} onChange={e => set('status', e.target.value)}>{['Available','Reserved','On Hold'].map(s => <option key={s}>{s}</option>)}</select><ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} /></div>
          </Field>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.05em' }}>Stock Constraints</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
            <Field label="Max Weight (kg)"><input style={inp} type="number" min="0" value={form.max_weight_kg} onChange={e => set('max_weight_kg', e.target.value)} /></Field>
            <Field label="Max Slots"><input style={inp} type="number" min="1" value={form.max_slots} onChange={e => set('max_slots', parseInt(e.target.value)||1)} /></Field>
            <Field label="Product Type"><input style={inp} value={form.product_type} onChange={e => set('product_type', e.target.value)} placeholder="e.g. Chemical" /></Field>
            <Field label="Compat. Group"><input style={inp} value={form.compatibility_group} onChange={e => set('compatibility_group', e.target.value)} placeholder="e.g. GRP-A" /></Field>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Adjust Stock modal (constraints only) ────────────────────────────────────
function AdjustStockModal({ pallet, onSave, onClose }) {
  const [form, setForm] = useState({ max_weight_kg: pallet.max_weight_kg || '', max_slots: pallet.max_slots || 1, product_type: pallet.product_type || '', compatibility_group: pallet.compatibility_group || '', status: pallet.status });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try { await onSave(form); onClose(); } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <Modal title={`Adjust Stock Constraints — ${pallet.item_code}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Err msg={err} />
        <div style={{ padding: '10px 14px', background: 'var(--app-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text)' }}>{pallet.item_code}</strong> · {pallet.description} · {pallet.zone}
        </div>
        <G2>
          <Field label="Max admissible slots">
            <input style={inp} type="number" min="1" value={form.max_slots} onChange={e => set('max_slots', parseInt(e.target.value)||1)} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Max pallets this product can occupy</span>
          </Field>
          <Field label="Max weight per pallet (kg)">
            <input style={inp} type="number" min="0" value={form.max_weight_kg} onChange={e => set('max_weight_kg', e.target.value)} />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>0 = no limit</span>
          </Field>
        </G2>
        <G2>
          <Field label="Product type">
            <input style={inp} value={form.product_type} onChange={e => set('product_type', e.target.value)} placeholder="e.g. Chemical, Food, Electronics" />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Used to enforce compatibility rules</span>
          </Field>
          <Field label="Compatibility group">
            <input style={inp} value={form.compatibility_group} onChange={e => set('compatibility_group', e.target.value)} placeholder="e.g. GRP-A, GRP-B" />
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Products in the same group can coexist</span>
          </Field>
        </G2>
        <Field label="Current status">
          <div style={{ position: 'relative' }}>
            <select style={sel} value={form.status} onChange={e => set('status', e.target.value)}>{['Available','Reserved','On Hold'].map(s => <option key={s}>{s}</option>)}</select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Saving…' : 'Apply Constraints'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Transfer modal ───────────────────────────────────────────────────────────
function TransferModal({ pallet, pallets, zones, onSave, onClose }) {
  const [type, setType] = useState('relocate');
  const [newZone, setNewZone] = useState('');
  const [newLoc, setNewLoc] = useState('');
  const [swapId, setSwapId] = useState('');
  const [method, setMethod] = useState('MANUAL');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      await onSave({ type, pallet_id: pallet.id, new_zone: newZone, new_location: newLoc, swap_with_id: parseInt(swapId)||null, method });
      onClose();
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <Modal title={`Transfer — ${pallet.item_code}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Err msg={err} />
        <div style={{ padding: '10px 14px', background: 'var(--app-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text)' }}>{pallet.item_code}</strong> · {pallet.description}<br />
          Current location: <strong style={{ color: 'var(--text)' }}>{pallet.zone} {pallet.location ? `· ${pallet.location}` : ''}</strong>
        </div>

        {/* Transfer type */}
        <div>
          <Lbl>Transfer type</Lbl>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[['relocate','Relocate','Change zone/address'],['swap','Swap','Exchange with another pallet'],['dispatch','Dispatch','Send to client']].map(([k,label,sub]) => (
              <button key={k} type="button" onClick={() => setType(k)}
                style={{ padding: '10px 8px', border: `2px solid ${type===k ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 8, background: type===k ? '#EAF6FA' : 'var(--surface)', cursor: 'pointer', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: type===k ? 'var(--brand-600)' : 'var(--text)' }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>
              </button>
            ))}
          </div>
        </div>

        {type === 'relocate' && (
          <>
            <Field label="Destination zone *">
              <div style={{ position: 'relative' }}>
                <select style={sel} value={newZone} onChange={e => setNewZone(e.target.value)}>
                  <option value="">Select zone</option>
                  {zones.map(z => <option key={z} value={z}>{z}</option>)}
                </select>
                <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
              </div>
            </Field>
            <Field label="New location (optional)">
              <input style={inp} value={newLoc} onChange={e => setNewLoc(e.target.value)} placeholder="e.g. Z02-A01-L01" />
            </Field>
          </>
        )}

        {type === 'swap' && (
          <Field label="Swap with pallet *">
            <div style={{ position: 'relative' }}>
              <select style={sel} value={swapId} onChange={e => setSwapId(e.target.value)}>
                <option value="">Select pallet to swap with</option>
                {pallets.filter(p => p.id !== pallet.id).map(p => (
                  <option key={p.id} value={p.id}>{p.item_code} — {p.zone} {p.location ? `· ${p.location}` : ''}</option>
                ))}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </Field>
        )}

        {type === 'dispatch' && (
          <>
            <div>
              <Lbl>Dispatch method</Lbl>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['FIFO','FIFO (First In, First Out)','Automatically select the oldest available pallet with the same item code'],['MANUAL','Manual','Dispatch this specific pallet']].map(([k,label,sub]) => (
                  <button key={k} type="button" onClick={() => setMethod(k)}
                    style={{ padding: '10px 12px', border: `2px solid ${method===k ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 8, background: method===k ? '#EAF6FA' : 'var(--surface)', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: method===k ? 'var(--brand-600)' : 'var(--text)' }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
              <AlertTriangle size={13} style={{ marginRight: 6, display: 'inline' }} />
              Dispatching will change status to <strong>On Hold</strong> (reserved for client delivery).
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving || (type==='relocate' && !newZone) || (type==='swap' && !swapId)}
            style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (saving||(type==='relocate'&&!newZone)||(type==='swap'&&!swapId)) ? .5 : 1 }}>
            {saving ? 'Processing…' : 'Execute Transfer'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Zones modal ──────────────────────────────────────────────────────────────
function ZonesModal({ onClose, onUpdated }) {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => { getZonesList().then(setZones).catch(e => setErr(e.message)).finally(() => setLoading(false)); }, []);

  async function toggle(zone) {
    const newStatus = zone.status === 'OPEN' ? 'CLOSED' : 'OPEN';
    setBusy(zone.id); setErr('');
    try {
      await updateZoneStatus(zone.id, newStatus);
      setZones(prev => prev.map(z => z.id === zone.id ? { ...z, status: newStatus } : z));
      onUpdated();
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  return (
    <Modal title="Zone Management" onClose={onClose} maxW={640}>
      {err && <Err msg={err} />}
      {loading ? <div style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>Loading zones…</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Open zones accept new pallets. Closing a zone relocates all pallets out first.
          </div>
          {zones.map(z => (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 9, background: z.status === 'CLOSED' ? '#fafafa' : 'var(--surface)', opacity: z.status === 'CLOSED' ? 0.75 : 1 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                  {z.name}
                  {z.is_prep_zone && <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 5, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>PREP</span>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{z.warehouse} · {z.pallet_count} pallets / {z.capacity_pallets} capacity</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 5, background: z.status === 'OPEN' ? '#dcfce7' : '#fee2e2', color: z.status === 'OPEN' ? '#15803d' : '#b91c1c' }}>{z.status}</span>
                <button onClick={() => toggle(z)} disabled={busy === z.id}
                  style={{ height: 30, padding: '0 12px', border: `1px solid ${z.status==='OPEN' ? '#fecaca' : '#bbf7d0'}`, borderRadius: 7, background: z.status==='OPEN' ? '#fee2e2' : '#dcfce7', color: z.status==='OPEN' ? '#b91c1c' : '#15803d', fontSize: 12, fontWeight: 700, cursor: busy===z.id ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {z.status === 'OPEN' ? <><Lock size={12} /> Close</> : <><LockOpen size={12} /> Open</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <button onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Close</button>
      </div>
    </Modal>
  );
}

// ─── Pallet Allocation modal ──────────────────────────────────────────────────
function AllocateModal({ warehouses, onSave, onClose }) {
  const [form, setForm] = useState({ item_code: '', quantity: 1, pallet_type: 'EUR', preferred_warehouse: '', product_type: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function submit(e) {
    e.preventDefault();
    if (!form.item_code.trim()) { setErr('Item code is required'); return; }
    setSaving(true); setErr('');
    try {
      const r = await onSave(form);
      setResult(r);
    } catch (e) { setErr(e.message); setSaving(false); }
  }

  if (result) return (
    <Modal title="Pallet Allocated" onClose={onClose}>
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <CheckCircle2 size={40} color="#15803d" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Pallet successfully allocated</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          <strong>{result.pallet.item_code}</strong> → {result.allocated_zone}<br />
          {result.warehouse} · Zone usage: {result.zone_used} / {result.zone_capacity}
        </div>
        {result.alternatives?.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Alternative zones: {result.alternatives.map(a => `${a.name} (${a.available} free)`).join(', ')}
          </div>
        )}
        <button onClick={onClose} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
      </div>
    </Modal>
  );

  return (
    <Modal title="Allocate New Pallet" onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Err msg={err} />
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
          The system will find the best open zone with available capacity, respecting warehouse constraints.
        </div>
        <Field label="Item Code *"><input style={inp} value={form.item_code} onChange={e => set('item_code', e.target.value)} placeholder="e.g. ITM-10001" /></Field>
        <G2>
          <Field label="Quantity"><input style={inp} type="number" min="1" value={form.quantity} onChange={e => set('quantity', parseInt(e.target.value)||1)} /></Field>
          <Field label="Pallet Type">
            <div style={{ position: 'relative' }}>
              <select style={sel} value={form.pallet_type} onChange={e => set('pallet_type', e.target.value)}>{['EUR','IND','ISO'].map(t => <option key={t}>{t}</option>)}</select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </Field>
        </G2>
        <G2>
          <Field label="Preferred Warehouse (optional)">
            <div style={{ position: 'relative' }}>
              <select style={sel} value={form.preferred_warehouse} onChange={e => set('preferred_warehouse', e.target.value)}>
                <option value="">Any warehouse</option>
                {warehouses.map(w => <option key={w}>{w}</option>)}
              </select>
              <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
            </div>
          </Field>
          <Field label="Product Type (optional)"><input style={inp} value={form.product_type} onChange={e => set('product_type', e.target.value)} placeholder="e.g. Chemical" /></Field>
        </G2>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Allocating…' : 'Allocate Pallet'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Move to Prep Zone modal ──────────────────────────────────────────────────
function MoveToPrepModal({ pallet, onSave, onClose }) {
  const [prepZone, setPrepZone] = useState('');
  const [prepLoc, setPrepLoc] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [prepZones, setPrepZones] = useState([]);

  useEffect(() => {
    getZonesList().then(z => setPrepZones(z.filter(z => z.is_prep_zone && z.status === 'OPEN'))).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setSaving(true); setErr('');
    try { await onSave(pallet.id, { prep_zone: prepZone || undefined, prep_location: prepLoc || undefined }); onClose(); }
    catch (e) { setErr(e.message); setSaving(false); }
  }

  return (
    <Modal title={`Move to Prep Zone — ${pallet.item_code}`} onClose={onClose}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Err msg={err} />
        <div style={{ padding: '10px 14px', background: 'var(--app-bg)', borderRadius: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Moving this pallet to a preparation zone will mark it as <strong>Reserved</strong> and position it ready for truck loading.
        </div>
        <div style={{ padding: '8px 12px', background: '#ede9fe', borderRadius: 8, fontSize: 12, color: '#6d28d9' }}>
          Current: <strong>{pallet.zone}</strong>{pallet.location ? ` · ${pallet.location}` : ''} · Status: {pallet.status}
        </div>
        <Field label="Destination prep zone">
          <div style={{ position: 'relative' }}>
            <select style={sel} value={prepZone} onChange={e => setPrepZone(e.target.value)}>
              <option value="">Auto-select best available prep zone</option>
              {prepZones.map(z => <option key={z.name} value={z.name}>{z.name} ({z.capacity_pallets - z.pallet_count} free)</option>)}
            </select>
            <ChevronDown size={12} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-secondary)' }} />
          </div>
          {prepZones.length === 0 && <span style={{ fontSize: 11, color: 'var(--critical)' }}>No open prep zones available.</span>}
        </Field>
        <Field label="Prep location slot (optional)">
          <input style={inp} value={prepLoc} onChange={e => setPrepLoc(e.target.value)} placeholder="e.g. Z04-P01-L03" />
        </Field>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={saving} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: '#6d28d9', color: '#fff', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Moving…' : 'Move to Prep Zone'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Import modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onImported }) {
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy]       = useState(false);
  const [result, setResult]   = useState(null);
  const [err, setErr]         = useState('');
  const fileRef = useRef();

  async function handleImport() {
    if (!file) { setErr('Select an Excel file first.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await importStorage(file);
      setResult(r);
      if (r.inserted > 0) onImported();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  if (result) return (
    <Modal title="Import Result" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: result.inserted > 0 ? '#dcfce7' : '#fee2e2', borderRadius: 9 }}>
          {result.inserted > 0 ? <CheckCircle2 size={20} color="#15803d" /> : <AlertCircle size={20} color="#b91c1c" />}
          <span style={{ fontWeight: 700, fontSize: 14, color: result.inserted > 0 ? '#15803d' : '#b91c1c' }}>{result.message}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          {[['Total rows', result.total_rows], ['Imported', result.inserted], ['Skipped', result.skipped]].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 12px', background: 'var(--app-bg)', borderRadius: 8, textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>{v}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>{k}</div>
            </div>
          ))}
        </div>
        {result.errors?.length > 0 && (
          <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: 'var(--app-bg)' }}><th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Line</th><th style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600 }}>Error</th></tr></thead>
              <tbody>{result.errors.map((e, i) => <tr key={i} style={{ borderTop: '1px solid var(--border)' }}><td style={{ padding: '5px 10px', color: 'var(--critical)', fontWeight: 600 }}>{e.line}</td><td style={{ padding: '5px 10px', color: 'var(--text)' }}>{e.error}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button onClick={onClose} style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button></div>
      </div>
    </Modal>
  );

  return (
    <Modal title="Import Stock from Excel" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Err msg={err} />
        <div style={{ padding: '12px 14px', background: 'var(--app-bg)', borderRadius: 9, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--text)' }}>Expected columns:</strong><br />
          <code>item_code</code> (required), <code>description</code>, <code>sku</code>, <code>warehouse</code>, <code>zone</code>, <code>location</code>, <code>pallet_id</code>, <code>pallet_type</code> (EUR/IND/ISO), <code>quantity</code>, <code>base_unit</code>, <code>status</code> (Available/Reserved/On Hold), <code>product_type</code>, <code>compatibility_group</code>, <code>max_weight_kg</code>
        </div>
        <div
          onClick={() => fileRef.current?.click()}
          style={{ border: `2px dashed ${file ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: file ? '#EAF6FA' : 'var(--app-bg)', transition: 'all .15s' }}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f?.name.endsWith('.xlsx')) setFile(f); else setErr('Only .xlsx files are supported.'); }}>
          <Upload size={28} color={file ? 'var(--brand-600)' : 'var(--text-secondary)'} style={{ marginBottom: 8 }} />
          {file ? (
            <div><div style={{ fontWeight: 700, color: 'var(--brand-600)', fontSize: 14 }}>{file.name}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div></div>
          ) : (
            <div><div style={{ fontWeight: 600, color: 'var(--text)', fontSize: 14 }}>Drop your Excel file here</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>or click to browse · .xlsx only · max 10 MB</div></div>
          )}
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) setFile(e.target.files[0]); }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
          <button onClick={handleImport} disabled={!file || busy}
            style={{ height: 34, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!file||busy) ? 'not-allowed' : 'pointer', opacity: (!file||busy) ? .6 : 1 }}>
            {busy ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete confirm ───────────────────────────────────────────────────────────
function DeleteModal({ pallet, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Delete Pallet" onClose={onClose} maxW={380}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <AlertCircle size={20} color="var(--critical)" />
        <span style={{ fontWeight: 700, fontSize: 14 }}>Permanently delete this pallet?</span>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-secondary)' }}>
        <strong>{pallet.item_code}</strong> — {pallet.description} · {pallet.zone} will be removed. This action cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ height: 34, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', color: 'var(--text)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={async () => { setBusy(true); await onConfirm(); }} disabled={busy} style={{ height: 34, padding: '0 16px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .7 : 1 }}>{busy ? 'Deleting…' : 'Delete'}</button>
      </div>
    </Modal>
  );
}

// ─── Matrix view ──────────────────────────────────────────────────────────────
function MatrixView({ data, loading }) {
  if (loading) return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>Loading matrix…</div>;
  if (!data) return <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>No matrix data available.</div>;

  const { zones, docks, total_docks, active_dock_count } = data;
  const warehouses = [...new Set(zones.map(z => z.warehouse))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Dock grid */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Truck size={15} color="var(--brand-600)" />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Dock Status</span>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)' }}>{active_dock_count} / {total_docks} active</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 6 }}>
          {docks.map(d => (
            <div key={d.dock_number} title={d.truck ? `${d.truck} · ${d.state}` : 'Idle'}
              style={{ padding: '8px 4px', borderRadius: 7, border: `1px solid ${d.active ? 'var(--brand-600)' : 'var(--border)'}`, background: d.active ? '#EAF6FA' : 'var(--app-bg)', textAlign: 'center' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: d.active ? 'var(--brand-600)' : 'var(--text-secondary)' }}>D{String(d.dock_number).padStart(2,'0')}</div>
              <div style={{ fontSize: 9, color: d.active ? 'var(--brand-600)' : 'var(--text-secondary)', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.active ? (d.state || 'ACTIVE') : 'IDLE'}</div>
              {d.truck && <div style={{ fontSize: 9, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.truck}</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Zone grid per warehouse */}
      {warehouses.map(wh => (
        <div key={wh}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>{wh}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {zones.filter(z => z.warehouse === wh).map(z => (
              <div key={z.name} style={{ border: `1px solid ${z.status==='CLOSED' ? '#fecaca' : 'var(--border)'}`, borderRadius: 10, padding: 12, background: z.status==='CLOSED' ? '#fff5f5' : 'var(--surface)', opacity: z.status==='CLOSED' ? 0.8 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{z.name}</span>
                  {z.is_prep_zone && <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '1px 5px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>PREP</span>}
                  <span style={{ background: z.status==='OPEN' ? '#dcfce7' : '#fee2e2', color: z.status==='OPEN' ? '#15803d' : '#b91c1c', borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{z.status}</span>
                </div>
                {/* Occupancy bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 3 }}>
                    <span>{z.total_pallets} pallets</span><span>{z.occupancy_pct}% full</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${z.occupancy_pct}%`, background: z.occupancy_pct > 85 ? '#dc2626' : z.occupancy_pct > 60 ? '#d97706' : '#22c55e', borderRadius: 3, transition: 'width .3s' }} />
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>Capacity: {z.capacity} pallets</div>
                </div>
                {/* Pallet breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
                  {[['Available', z.available, '#15803d', '#dcfce7'], ['Reserved', z.reserved, '#b45309', '#fef3c7'], ['On Hold', z.on_hold, '#b91c1c', '#fee2e2']].map(([lbl, v, c, bg]) => (
                    <div key={lbl} style={{ background: bg, borderRadius: 6, padding: '4px 6px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: c }}>{v}</div>
                      <div style={{ fontSize: 9, color: c, opacity: .8 }}>{lbl}</div>
                    </div>
                  ))}
                </div>
                {/* Prep zone indicator */}
                {z.is_prep_zone && (
                  <div style={{ marginTop: 8, padding: '4px 8px', background: z.prep_active ? '#ede9fe' : '#f1f5f9', borderRadius: 6, fontSize: 11, color: z.prep_active ? '#6d28d9' : '#64748b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: z.prep_active ? '#6d28d9' : '#94a3b8' }} />
                    Prep zone {z.prep_active ? 'ACTIVE' : 'INACTIVE'}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// StoragePage
// ═══════════════════════════════════════════════════════════════════════════════
export default function StoragePage() {
  // view
  const [view, setView] = useState('table'); // 'table' | 'matrix'

  // table data
  const [kpis,       setKpis]       = useState(null);
  const [pallets,    setPallets]    = useState([]);
  const [total,      setTotal]      = useState(0);
  const [pages,      setPages]      = useState(1);
  const [zones,      setZones]      = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [apiError,   setApiError]   = useState('');

  // matrix data
  const [matrixData,    setMatrixData]    = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(false);

  // filters
  const [search,    setSearch]    = useState('');
  const [zone,      setZone]      = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [status,    setStatus]    = useState('');
  const [page,      setPage]      = useState(1);

  // modals
  const [modal,      setModal]      = useState(null);
  const [target,     setTarget]     = useState(null);
  const [toast,      setToast]      = useState(null);
  const [notifOpen,  setNotifOpen]  = useState(false);
  const notifRef = useRef(null);

  const searchTimer = useRef(null);

  function showToast(msg, ok = true) { setToast({ msg, ok }); }
  function closeModal() { setModal(null); }

  // load zones/warehouses
  useEffect(() => {
    Promise.allSettled([getStorageZones(), getStorageWarehouses()]).then(([z, w]) => {
      if (z.status === 'fulfilled') setZones(z.value);
      if (w.status === 'fulfilled') setWarehouses(w.value);
    });
  }, []);

  // load table data
  const loadTable = useCallback(async (params = {}) => {
    setLoading(true);
    setApiError('');
    try {
      const [pRes, kRes] = await Promise.all([
        listPallets({ search, zone, warehouse, status, page, limit: 15, ...params }),
        getStorageKpis(),
      ]);
      setPallets(pRes.pallets || []);
      setTotal(pRes.total || 0);
      setPages(pRes.pages || 1);
      setKpis(kRes);
      setLastRefresh(new Date());
    } catch (e) { setApiError(e.message); showToast(e.message, false); }
    finally { setLoading(false); }
  }, [search, zone, warehouse, status, page]);

  useEffect(() => { if (view === 'table') loadTable(); }, [loadTable, view]);

  // close notification on outside click
  useEffect(() => {
    if (!notifOpen) return;
    function h(e) { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [notifOpen]);

  // load matrix
  const loadMatrix = useCallback(async () => {
    setMatrixLoading(true);
    try { setMatrixData(await getStorageMatrix()); }
    catch (e) { showToast(e.message, false); }
    finally { setMatrixLoading(false); }
  }, []);

  useEffect(() => { if (view === 'matrix') loadMatrix(); }, [view, loadMatrix]);

  function handleSearch(v) {
    setSearch(v); setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => loadTable({ search: v, page: 1 }), 400);
  }

  // Reload helpers after mutations
  function reloadAll() {
    loadTable();
    Promise.allSettled([getStorageZones(), getStorageWarehouses()]).then(([z, w]) => {
      if (z.status === 'fulfilled') setZones(z.value);
      if (w.status === 'fulfilled') setWarehouses(w.value);
    });
  }

  // ── mutations ──────────────────────────────────────────────────────────────
  async function handleAdd(form)          { await createPallet(form);             showToast('Pallet created');  reloadAll(); }
  async function handleEdit(form)         { await updatePallet(target.id, form);   showToast('Pallet updated');  loadTable(); }
  async function handleAdjust(form)       { await updatePallet(target.id, form);   showToast('Constraints applied'); loadTable(); }
  async function handleTransfer(body)     { await storageTransfer(body);           showToast('Transfer complete'); loadTable(); if (view==='matrix') loadMatrix(); }
  async function handleMoveToPrepFn(id, body) { await moveToPrepZone(id, body);   showToast('Moved to prep zone'); loadTable(); if (view==='matrix') loadMatrix(); }
  async function handleAllocate(form)     { const r = await allocatePallet(form); loadTable(); return r; }
  async function handleDelete()           { await deletePallet(target.id); setModal(null); setTarget(null); showToast('Pallet deleted'); loadTable(); }

  // ── export ─────────────────────────────────────────────────────────────────
  async function handleExport() {
    if (view !== 'table') { showToast('Switch to Table view to export the current data.', false); return; }
    if (total === 0)      { showToast('No data to export with the current filters.', false); return; }
    try { await exportStorage({ search, zone, warehouse, status }); showToast(`Exported ${total} rows`); }
    catch (e) { showToast(e.message, false); }
  }

  // ── print ─────────────────────────────────────────────────────────────────
  function handlePrint() {
    if (view !== 'table' || pallets.length === 0) { showToast('Switch to Table view with data to print.', false); return; }
    window.print();
  }

  // ── ribbon ─────────────────────────────────────────────────────────────────
  const ribbonGroups = [
    {
      title: 'Data',
      items: [
        {
          label: 'Refresh', icon: RefreshCw,
          action: async () => {
            setRefreshing(true);
            const t0 = Date.now();
            if (view === 'matrix') await loadMatrix(); else await loadTable();
            const elapsed = Date.now() - t0;
            if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed));
            setRefreshing(false);
          },
          spin: refreshing,
        },
        { label: 'Import',  icon: Upload,      action: () => setModal('import') },
        { label: 'Export',  icon: Download,    action: handleExport },
        { label: 'Print',   icon: Printer,     action: handlePrint },
      ],
    },
    {
      title: 'View',
      items: [
        { label: 'Table',  icon: Table2,   active: view==='table',  action: () => setView('table') },
        { label: 'Matrix', icon: Grid3X3,  active: view==='matrix', action: () => setView('matrix') },
      ],
    },
    {
      title: 'Manage Stock',
      items: [
        { label: 'New Stock',     icon: PackagePlus,      action: () => { setTarget(null); setModal('add'); } },
        { label: 'Adjust Stock',  icon: SlidersHorizontal, action: () => { if (!target) { showToast('Select a pallet row first.', false); return; } setModal('adjust'); } },
        { label: 'Transfer',      icon: ArrowLeftRight,   action: () => { if (!target) { showToast('Select a pallet row first.', false); return; } setModal('transfer'); } },
      ],
    },
    {
      title: 'Zones & Pallets',
      items: [
        { label: 'Zones',   icon: Layers3,   action: () => setModal('zones') },
        { label: 'Pallets', icon: Package,   action: () => setModal('allocate') },
        { label: 'Move',    icon: Truck,     action: () => { if (!target) { showToast('Select a pallet row first.', false); return; } setModal('move-prep'); } },
      ],
    },
  ];

  const kpiList = kpis ? [
    { label: 'Total SKUs',         value: kpis.total_skus,                      icon: Boxes },
    { label: 'Total Pallets',      value: kpis.total_pallets,                   icon: Package },
    { label: 'Total Units',        value: kpis.total_units?.toLocaleString(),   icon: PackageCheck },
    { label: 'Occupied Locations', value: kpis.occupied_locations,              icon: MapPinned },
    { label: 'Available Pallets',  value: kpis.available_count,                 icon: Warehouse },
  ] : [];

  // pagination window
  const pageNums = (() => {
    const arr = [];
    const s = Math.max(1, page - 2), e = Math.min(pages, page + 2);
    for (let i = s; i <= e; i++) arr.push(i);
    return arr;
  })();

  return (
    <div className="st-page">
      {/* ── Topline ── */}
      <div className="st-topline">
        <div>
          <h1>Storage</h1>
          <p>Pallet management · Zone control · Warehouse visibility</p>
        </div>
        <div className="st-search">
          <Search size={15} color="var(--text-secondary)" />
          <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search item code, description, SKU…" />
          {search && <button onClick={() => handleSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0, display: 'flex' }}><X size={13} /></button>}
        </div>
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button className="st-icon-btn" onClick={() => setNotifOpen(o => !o)} style={{ border: notifOpen ? '1px solid var(--brand-600)' : undefined, background: notifOpen ? '#EAF6FA' : undefined, color: notifOpen ? 'var(--brand-600)' : undefined }}>
            <Bell size={16} />
            {kpis && (kpis.total_pallets - kpis.available_count) / (kpis.total_pallets || 1) > 0.8 && (
              <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: 'var(--critical)' }} />
            )}
          </button>
          {notifOpen && (
            <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 500, marginTop: 6, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.18)', width: 300, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>Storage Notifications</span>
                <button onClick={() => setNotifOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={14} /></button>
              </div>
              <div style={{ padding: '8px 0' }}>
                {kpis ? (
                  <>
                    {(kpis.total_pallets - kpis.available_count) / (kpis.total_pallets || 1) > 0.8 && (
                      <div style={{ padding: '8px 14px', display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#b91c1c', marginTop: 4, flexShrink: 0 }} />
                        <div style={{ fontSize: 12 }}><strong>Capacity alert:</strong> Warehouse is over 80% full ({kpis.occupied_locations}/{kpis.total_pallets} pallets).</div>
                      </div>
                    )}
                    <div style={{ padding: '8px 14px', display: 'flex', gap: 8 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#1d4ed8', marginTop: 4, flexShrink: 0 }} />
                      <div style={{ fontSize: 12 }}>Storage: <strong>{kpis.available_count}</strong> pallets available across {kpis.total_skus} SKUs.</div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 12 }}>No storage alerts</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Ribbon ── */}
      <div className="st-ribbon">
        {ribbonGroups.map(group => (
          <section key={group.title}>
            <h2>{group.title}</h2>
            <div>
              {group.items.map(({ label, icon: Icon, action, active, spin }) => (
                <button key={label} type="button" onClick={action} className={active ? 'active' : ''}>
                  <Icon size={18} style={spin ? { animation: 'spin 0.8s linear infinite' } : undefined} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* ── API error ── */}
      {apiError && (
        <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 10, fontSize: 13, color: '#b91c1c', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {apiError}
          <button onClick={() => setApiError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex' }}><X size={14} /></button>
        </div>
      )}

      {/* ── KPIs ── */}
      {kpis && view === 'table' && (
        <div className="st-kpis">
          {kpiList.map(({ label, value, icon: Icon }) => (
            <article key={label}>
              <div><span>{label}</span><strong>{value ?? '—'}</strong></div>
              <Icon size={22} />
            </article>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      {view === 'matrix' ? (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Warehouse Matrix View</span>
            <button onClick={async () => {
              setRefreshing(true);
              const t0 = Date.now();
              await loadMatrix();
              const elapsed = Date.now() - t0;
              if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed));
              setRefreshing(false);
            }} style={{ height: 30, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> Refresh
            </button>
          </div>
          <MatrixView data={matrixData} loading={matrixLoading} />
        </div>
      ) : (
        <div className="st-content">
          <main className="st-table-card">
            <div className="st-table-head">
              <h2>Stock Details {total > 0 && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 6 }}>{total} records</span>}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {lastRefresh && (
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                <button onClick={() => { setTarget(null); setModal('add'); }} style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 7, background: 'var(--brand-600)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <PackagePlus size={13} /> New Stock
                </button>
                <button className="st-icon-btn" onClick={async () => {
                  setRefreshing(true);
                  const t0 = Date.now();
                  await loadTable();
                  const elapsed = Date.now() - t0;
                  if (elapsed < 600) await new Promise(r => setTimeout(r, 600 - elapsed));
                  setRefreshing(false);
                }} title="Refresh"><RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /></button>
              </div>
            </div>

            {/* Filters */}
            <div className="st-filter-bar">
              <SelectBox label="Warehouse" value={warehouse} onChange={v => { setWarehouse(v); setPage(1); }} options={warehouses} />
              <SelectBox label="Zone"      value={zone}      onChange={v => { setZone(v); setPage(1); }}      options={zones} />
              <SelectBox label="Status"    value={status}    onChange={v => { setStatus(v); setPage(1); }}    options={['Available','Reserved','On Hold']} />
              {(search || zone || warehouse || status) && (
                <button onClick={() => { setSearch(''); setZone(''); setWarehouse(''); setStatus(''); setPage(1); }}
                  style={{ height: 34, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', alignSelf: 'flex-end' }}>
                  Clear filters
                </button>
              )}
            </div>

            {/* Table */}
            <div className="st-table-scroll">
              <table>
                <thead>
                  <tr>{['Item Code','Description','SKU','Warehouse','Zone','Location','Pallet ID','Type','Qty','Unit','Status','Updated','Actions'].map(h => <th key={h}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {loading && !pallets.length
                    ? <tr><td colSpan={13} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>Loading…</td></tr>
                    : !pallets.length
                      ? <tr><td colSpan={13} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>No results found</td></tr>
                      : pallets.map(row => (
                        <tr key={row.id} onClick={() => setTarget(t => t?.id === row.id ? null : row)}
                          style={{ background: target?.id === row.id ? 'rgba(31,127,161,.07)' : 'transparent', cursor: 'pointer' }}>
                          <td><button className="st-link">{row.item_code}</button></td>
                          <td>{row.description}</td>
                          <td>{row.sku || '—'}</td>
                          <td>{row.warehouse}</td>
                          <td>{row.zone}</td>
                          <td>{row.location || '—'}</td>
                          <td>{row.pallet_id || '—'}</td>
                          <td>{row.pallet_type}</td>
                          <td>{row.quantity}</td>
                          <td>{row.base_unit}</td>
                          <td><StatusPill status={row.status} /></td>
                          <td>{fmtDateTime(row.updated_at)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button title="Edit" onClick={e => { e.stopPropagation(); setTarget(row); setModal('edit'); }} style={{ height: 24, padding: '0 7px', border: '1px solid var(--border)', borderRadius: 5, background: 'var(--surface)', color: 'var(--brand-600)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                              <button title="Delete" onClick={e => { e.stopPropagation(); setTarget(row); setModal('delete'); }} style={{ height: 24, padding: '0 7px', border: '1px solid #fecaca', borderRadius: 5, background: '#fee2e2', color: '#b91c1c', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))
                  }
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="st-pagination">
              <span>Showing {pallets.length} of {total} (page {page} / {pages})</span>
              <div>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}><ChevronLeft size={12} /></button>
                {page > 3 && <><button onClick={() => setPage(1)}>1</button><span style={{ padding: '0 4px' }}>…</span></>}
                {pageNums.map(n => <button key={n} onClick={() => setPage(n)} style={{ background: n===page ? 'var(--brand-600)' : '', color: n===page ? '#fff' : '' }}>{n}</button>)}
                {page < pages-2 && <><span style={{ padding: '0 4px' }}>…</span><button onClick={() => setPage(pages)}>{pages}</button></>}
                <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page===pages}><ChevronRight size={12} /></button>
              </div>
            </div>
          </main>

          {/* Side panel */}
          <aside className="st-side">
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 10 }}>Quick Filters</div>
            <div className="st-search" style={{ marginBottom: 10 }}>
              <Search size={13} color="var(--text-secondary)" />
              <input value={search} onChange={e => handleSearch(e.target.value)} placeholder="Search…" />
            </div>
            <SelectBox label="Warehouse" value={warehouse} onChange={v => { setWarehouse(v); setPage(1); }} options={warehouses} />
            <div style={{ marginTop: 8 }} />
            <SelectBox label="Zone"      value={zone}      onChange={v => { setZone(v); setPage(1); }}      options={zones} />
            <div style={{ marginTop: 8 }} />
            <SelectBox label="Status"    value={status}    onChange={v => { setStatus(v); setPage(1); }}    options={['Available','Reserved','On Hold']} />
            <button onClick={() => loadTable()} style={{ marginTop: 10, height: 32, width: '100%', border: 'none', borderRadius: 7, background: 'var(--brand-600)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Apply</button>
            <button onClick={() => { setSearch(''); setZone(''); setWarehouse(''); setStatus(''); setPage(1); }} style={{ marginTop: 6, height: 32, width: '100%', border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text)', fontSize: 12, cursor: 'pointer' }}>Reset</button>

            {target && (
              <div style={{ marginTop: 14, padding: 12, background: 'var(--app-bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.04em' }}>Selected Pallet</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>{target.item_code}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>{target.description}</div>
                <StatusPill status={target.status} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>
                  <button onClick={() => setModal('edit')} style={{ height: 28, border: 'none', borderRadius: 6, background: 'var(--brand-600)', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => setModal('adjust')} style={{ height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}>Adjust</button>
                  <button onClick={() => setModal('transfer')} style={{ height: 28, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}>Transfer</button>
                  <button onClick={() => setModal('move-prep')} style={{ height: 28, border: '1px solid #c4b5fd', borderRadius: 6, background: '#ede9fe', color: '#6d28d9', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>→ Prep</button>
                  <button onClick={() => setModal('delete')} style={{ gridColumn: 'span 2', height: 28, border: '1px solid #fecaca', borderRadius: 6, background: '#fee2e2', color: '#b91c1c', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ── Modals ── */}
      {modal === 'add'      && <PalletModal    title="New Stock Entry" initial={BLANK} zones={zones} warehouses={warehouses} onSave={handleAdd}  onClose={closeModal} />}
      {modal === 'edit'     && target && <PalletModal title={`Edit — ${target.item_code}`} initial={target} zones={zones} warehouses={warehouses} onSave={handleEdit} onClose={closeModal} />}
      {modal === 'adjust'   && target && <AdjustStockModal pallet={target} onSave={handleAdjust} onClose={closeModal} />}
      {modal === 'transfer' && target && <TransferModal pallet={target} pallets={pallets} zones={zones} onSave={handleTransfer} onClose={closeModal} />}
      {modal === 'move-prep'&& target && <MoveToPrepModal pallet={target} onSave={handleMoveToPrepFn} onClose={closeModal} />}
      {modal === 'zones'    && <ZonesModal onClose={closeModal} onUpdated={() => { loadTable(); if (view==='matrix') loadMatrix(); }} />}
      {modal === 'allocate' && <AllocateModal warehouses={warehouses} onSave={handleAllocate} onClose={closeModal} />}
      {modal === 'import'   && <ImportModal onClose={closeModal} onImported={() => { loadTable(); Promise.allSettled([getStorageZones(), getStorageWarehouses()]).then(([z,w]) => { if(z.status==='fulfilled') setZones(z.value); if(w.status==='fulfilled') setWarehouses(w.value); }); }} />}
      {modal === 'delete'   && target && <DeleteModal pallet={target} onConfirm={handleDelete} onClose={closeModal} />}

      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .st-page { width: 100%; max-width: 1520px; color: var(--text); }
        .st-topline { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
        .st-topline > div h1 { margin: 0; color: var(--brand-900); font-size: 20px; line-height: 1.15; }
        .st-topline > div p  { margin: 3px 0 0; color: var(--text-secondary); font-size: 12px; }
        .st-search { display: flex; align-items: center; gap: 7px; height: 34px; padding: 0 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); min-width: 0; }
        .st-search input { border: 0; outline: 0; min-width: 0; width: 100%; background: transparent; color: var(--text); font-size: 13px; }
        .st-topline > .st-search { margin-left: auto; width: min(340px,100%); }
        .st-icon-btn { width: 34px; height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--text-secondary); display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
        .st-ribbon { display: grid; grid-template-columns: 1.4fr 0.8fr 1.5fr 1.2fr; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 14px; overflow: hidden; }
        .st-ribbon section { padding: 10px; border-right: 1px solid var(--border); }
        .st-ribbon section:last-child { border-right: none; }
        .st-ribbon h2 { margin: 0 0 7px; font-size: 10px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .05em; }
        .st-ribbon section > div { display: grid; grid-template-columns: repeat(auto-fit, minmax(46px,1fr)); gap: 4px; }
        .st-ribbon button { width: 100%; min-height: 52px; border: 1px solid transparent; border-radius: 7px; background: transparent; color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 10px; line-height: 1.2; cursor: pointer; }
        .st-ribbon button:hover { background: rgba(31,127,161,.1); color: var(--brand-600); }
        .st-ribbon button.active { background: rgba(31,127,161,.12); color: var(--brand-600); border-color: var(--brand-600); font-weight: 700; }
        .st-kpis { display: grid; grid-template-columns: repeat(5, minmax(140px,1fr)); gap: 10px; margin-bottom: 12px; }
        .st-kpis article { display: flex; justify-content: space-between; gap: 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 12px; min-width: 0; }
        .st-kpis article svg { color: var(--brand-600); flex: 0 0 auto; margin-top: 12px; }
        .st-kpis span { display: block; color: var(--text-secondary); font-size: 11px; font-weight: 600; }
        .st-kpis strong { display: block; margin-top: 6px; color: var(--text); font-size: 20px; font-weight: 700; line-height: 1.1; }
        .st-content { display: grid; grid-template-columns: minmax(0,1fr) 220px; gap: 12px; align-items: start; }
        .st-table-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; min-width: 0; }
        .st-table-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
        .st-table-head h2 { margin: 0; font-size: 14px; color: var(--brand-900); }
        .st-filter-bar { display: flex; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--border); flex-wrap: wrap; align-items: flex-end; }
        .st-filter-bar > * { flex: 1 1 140px; min-width: 120px; max-width: 220px; }
        .st-table-scroll { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; }
        .st-table-scroll table { width: 100%; min-width: 1080px; border-collapse: collapse; }
        .st-table-scroll th { padding: 8px 10px; color: var(--text-secondary); background: var(--app-bg); border-bottom: 1px solid var(--border); font-size: 11px; font-weight: 700; text-align: left; white-space: nowrap; }
        .st-table-scroll td { padding: 7px 10px; border-bottom: 1px solid var(--border); font-size: 12px; white-space: nowrap; }
        .st-table-scroll tr:hover td { background: rgba(31,127,161,.04); }
        .st-link { border: 0; background: transparent; color: var(--brand-600); font-weight: 700; padding: 0; cursor: pointer; font-size: 12px; }
        .st-status { display: inline-flex; justify-content: center; min-width: 70px; border-radius: 5px; padding: 2px 7px; font-size: 11px; font-weight: 700; }
        .st-status.ok   { background: #dcfce7; color: #15803d; }
        .st-status.warn { background: #fef3c7; color: #b45309; }
        .st-status.hold { background: #fee2e2; color: #b91c1c; }
        .st-pagination { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; color: var(--text-secondary); font-size: 12px; }
        .st-pagination div { display: flex; align-items: center; gap: 4px; }
        .st-pagination button { min-width: 28px; height: 28px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .st-pagination button:disabled { opacity: .4; cursor: not-allowed; }
        .st-side { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 0; }
        @media (max-width: 1200px) {
          .st-ribbon { grid-template-columns: repeat(2,1fr); }
          .st-ribbon section:nth-child(2n) { border-right: none; }
          .st-ribbon section:nth-child(n+3) { border-top: 1px solid var(--border); }
          .st-kpis { grid-template-columns: repeat(3,minmax(130px,1fr)); }
        }
        @media (max-width: 980px) {
          .st-content { grid-template-columns: 1fr; }
          .st-side { order: -1; }
          .st-filter-bar > * { max-width: none; }
        }
        @media (max-width: 760px) {
          .st-topline > .st-search { order: 3; margin-left: 0; width: 100%; }
          .st-ribbon { grid-template-columns: 1fr; }
          .st-ribbon section { border-right: none; border-top: 1px solid var(--border); }
          .st-ribbon section:first-child { border-top: none; }
          .st-kpis { grid-template-columns: 1fr 1fr; }
        }
        @media print {
          .st-topline, .st-ribbon, .st-kpis, .st-filter-bar, .st-pagination, .st-side, .st-table-head button { display: none !important; }
          .st-content { grid-template-columns: 1fr !important; }
          .st-table-scroll { overflow: visible !important; }
          .st-table-scroll table { min-width: 0 !important; }
        }
      `}</style>
    </div>
  );
}
