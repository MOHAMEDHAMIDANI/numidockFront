import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, UserPlus, Search, Download, Upload,
  MoreVertical, Edit2, Key, Trash2, ToggleLeft, ToggleRight,
  Shield, Truck, Package,
  ChevronLeft, ChevronRight, X, Eye, EyeOff,
  AlertTriangle, CheckCircle2, UserCheck,
} from 'lucide-react';
import { listUsers, createUser, updateUser, changeUserPassword, deleteUser } from '../api';

// ── constants ──────────────────────────────────────────────────────────────

const ROLES = [
  { value: 'supervisor', label: 'Supervisor',  bg: '#dbeafe', color: '#1d4ed8' },
  { value: 'gate',       label: 'Gate Worker', bg: '#dcfce7', color: '#15803d' },
  { value: 'acdc',       label: 'ACDC Agent',  bg: '#ede9fe', color: '#6d28d9' },
];
const ROLE_MAP = Object.fromEntries(ROLES.map((r) => [r.value, r]));

const TABS = [
  { key: 'all',        label: 'All Users' },
  { key: 'supervisor', label: 'Supervisors' },
  { key: 'gate',       label: 'Gate Workers' },
  { key: 'acdc',       label: 'ACDC Agents' },
];

const DEPARTMENTS = ['General','Operations','Gate','ACDC','IT','Planning','Logistics'];
const LIMIT = 10;

// ── small utilities ────────────────────────────────────────────────────────

function formatLogin(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return `${Math.round(diffMs / 60000)} min ago`;
  if (diffH < 24) return `Today, ${d.toTimeString().slice(0,5)}`;
  if (diffH < 48) return `Yesterday, ${d.toTimeString().slice(0,5)}`;
  const days = Math.floor(diffH / 24);
  return `${days} days ago`;
}

function avatarBg(role) {
  const map = { supervisor: '#dbeafe', gate: '#dcfce7', acdc: '#ede9fe' };
  return map[role] || '#f1f5f9';
}
function avatarColor(role) {
  const map = { supervisor: '#1d4ed8', gate: '#15803d', acdc: '#6d28d9' };
  return map[role] || '#64748b';
}
function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── shared input style ─────────────────────────────────────────────────────
const inp = {
  height: 36, border: '1px solid var(--border)', borderRadius: 8,
  padding: '0 10px', fontSize: 13, width: '100%', outline: 'none',
  fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text)',
};

// ── sub-components ─────────────────────────────────────────────────────────

function RoleBadge({ role }) {
  const r = ROLE_MAP[role] || { label: role, bg: '#f1f5f9', color: '#64748b' };
  return (
    <span style={{ background: r.bg, color: r.color, borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {r.label}
    </span>
  );
}

function StatusDot({ active }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: active ? '#22c55e' : '#dc2626', flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: active ? '#15803d' : '#dc2626', fontWeight: 600 }}>{active ? 'Active' : 'Inactive'}</span>
    </span>
  );
}

function KpiCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

// ── Modal overlay wrapper ──────────────────────────────────────────────────

function Modal({ title, onClose, children, width = 520 }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: width, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  );
}

// ── UserForm (Add / Edit) ──────────────────────────────────────────────────

function UserForm({ initial = {}, isEdit = false, onSave, onClose, saving, error }) {
  const [form, setForm] = useState({
    name: initial.name || '',
    email: initial.email || '',
    password: '',
    confirmPassword: '',
    role: initial.role || 'gate',
    department: initial.department || 'General',
    employee_id: initial.employee_id || '',
  });
  const [showPw, setShowPw] = useState(false);

  function set(k, v) {
    setForm((p) => {
      const next = { ...p, [k]: v };
      return next;
    });
  }

  function submit() {
    if (!form.name.trim() || !form.email.trim()) return;
    if (!isEdit && (!form.password || form.password !== form.confirmPassword)) return;
    onSave(form);
  }

  const pwMismatch = !isEdit && form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Full name *</label>
          <input style={inp} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Gate Agent 1" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Email address *</label>
          <input style={inp} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="user@numilog.dz" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Role *</label>
          <select style={{ ...inp }} value={form.role} onChange={(e) => set('role', e.target.value)}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Department</label>
          <select style={{ ...inp }} value={form.department} onChange={(e) => set('department', e.target.value)}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Employee ID</label>
          <input style={inp} value={form.employee_id} onChange={(e) => set('employee_id', e.target.value)} placeholder="EMP-001" />
        </div>
      </div>

      {!isEdit && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px', marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>Password *</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inp, paddingRight: 36 }} type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 characters" />
              <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: pwMismatch ? 'var(--critical)' : 'var(--text)', marginBottom: 4, display: 'block' }}>Confirm password *</label>
            <input style={{ ...inp, borderColor: pwMismatch ? 'var(--critical)' : undefined }} type={showPw ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => set('confirmPassword', e.target.value)} placeholder="Repeat password" />
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--critical)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={submit} disabled={saving || pwMismatch} style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 8, background: 'var(--brand-600)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </>
  );
}

// ── ChangePassword modal ───────────────────────────────────────────────────

function ChangePasswordModal({ user, onSave, onClose, saving, error }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const mismatch = confirm && password !== confirm;
  const weak = password && password.length < 6;

  return (
    <Modal title="Change password" onClose={onClose} width={420}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--brand-50)', borderRadius: 9, marginBottom: 18 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatarBg(user.role), color: avatarColor(user.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{initials(user.name)}</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{user.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4, display: 'block' }}>New password</label>
        <div style={{ position: 'relative' }}>
          <input style={{ ...inp, paddingRight: 36, borderColor: weak ? 'var(--warning)' : undefined }} type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" autoFocus />
          <button onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {weak && <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 3 }}>Password must be at least 6 characters</div>}
      </div>

      <div style={{ marginBottom: 18 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: mismatch ? 'var(--critical)' : 'var(--text)', marginBottom: 4, display: 'block' }}>Confirm new password</label>
        <input style={{ ...inp, borderColor: mismatch ? 'var(--critical)' : undefined }} type={showPw ? 'text' : 'password'} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat password" />
        {mismatch && <div style={{ fontSize: 11, color: 'var(--critical)', marginTop: 3 }}>Passwords do not match</div>}
      </div>

      {/* strength bar */}
      {password && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
            Strength: <strong style={{ color: password.length >= 12 ? '#15803d' : password.length >= 8 ? '#d97706' : '#dc2626' }}>
              {password.length >= 12 ? 'Strong' : password.length >= 8 ? 'Medium' : 'Weak'}
            </strong>
          </div>
          <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 2, width: password.length >= 12 ? '100%' : password.length >= 8 ? '66%' : '33%', background: password.length >= 12 ? '#22c55e' : password.length >= 8 ? '#f59e0b' : '#dc2626', transition: 'width .2s' }} />
          </div>
        </div>
      )}

      {error && <div style={{ color: 'var(--critical)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => onSave(password)} disabled={saving || mismatch || weak || !password} style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 8, background: '#1d4ed8', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: (saving || mismatch || weak || !password) ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Key size={13} /> {saving ? 'Changing…' : 'Change password'}
        </button>
      </div>
    </Modal>
  );
}

// ── DeleteConfirm modal ────────────────────────────────────────────────────

function DeleteModal({ user, onDelete, onClose, saving, error }) {
  const [permanent, setPermanent] = useState(false);

  return (
    <Modal title="Delete account" onClose={onClose} width={400}>
      <div style={{ textAlign: 'center', padding: '10px 0 18px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={26} color="#dc2626" />
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Delete {user.name}?</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 18 }}>{user.email}</div>

        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 9, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', marginBottom: 8 }}>
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#b91c1c' }}>Permanently delete</div>
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Removes the account and all associated data. This cannot be undone.</div>
          </div>
        </label>
        {!permanent && <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'left' }}>Without this option, the account will be <strong>deactivated</strong> — the user cannot log in but data is preserved.</div>}
      </div>

      {error && <div style={{ color: 'var(--critical)', fontSize: 12, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ height: 36, padding: '0 16px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => onDelete(permanent)} disabled={saving} style={{ height: 36, padding: '0 20px', border: 'none', borderRadius: 8, background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Trash2 size={13} /> {saving ? 'Deleting…' : permanent ? 'Permanently delete' : 'Deactivate'}
        </button>
      </div>
    </Modal>
  );
}

// ── Action menu ────────────────────────────────────────────────────────────

function ActionMenu({ user, currentUserId, position, onEdit, onPassword, onDelete, onToggle, onClose }) {
  const ref = useRef();
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const close = () => onClose();
    document.addEventListener('mousedown', h);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('mousedown', h);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [onClose]);

  const items = [
    { label: 'Edit user', icon: Edit2, action: onEdit },
    { label: 'Change password', icon: Key, action: onPassword },
    null,
    {
      label: user.is_active ? 'Deactivate account' : 'Activate account',
      icon: user.is_active ? ToggleLeft : ToggleRight,
      action: onToggle,
      disabled: user.id === currentUserId,
    },
    {
      label: 'Delete account',
      icon: Trash2,
      action: onDelete,
      danger: true,
      disabled: user.id === currentUserId,
    },
  ];

  return (
    <div ref={ref} style={{ position: 'fixed', left: position.left, top: position.top, zIndex: 500, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 12px 32px rgba(15,52,66,0.18)', width: 220, overflow: 'hidden' }}>
      {items.map((item, i) =>
        item === null ? (
          <div key={i} style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
        ) : (
          <button
            key={item.label}
            onClick={() => { if (!item.disabled) { item.action(); onClose(); } }}
            disabled={item.disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '10px 14px',
              border: 'none', background: 'none', cursor: item.disabled ? 'default' : 'pointer',
              color: item.danger ? '#dc2626' : item.disabled ? 'var(--border)' : 'var(--text)',
              fontSize: 13, textAlign: 'left',
            }}
            onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = item.danger ? '#fef2f2' : 'var(--app-bg)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────

function Toast({ msg, type = 'success', onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: type === 'success' ? '#15803d' : '#dc2626', color: '#fff', borderRadius: 10, padding: '12px 18px', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', maxWidth: 340 }}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
      {msg}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AccountsPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');

  const [page, setPage] = useState(1);
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: '', department: '' });

  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'password' | 'delete'
  const [target, setTarget] = useState(null);
  const [menu, setMenu] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [toast, setToast] = useState(null);

  // ── export CSV helper ─────────────────────────────────────────────────────
  async function handleExportCsv() {
    try {
      const data = await listUsers({ limit: 1000 });
      const rows = data.users || [];
      const header = ['Name', 'Email', 'Role', 'Department', 'Status', 'Last Login'];
      const csv = [header, ...rows.map(u => [
        u.name, u.email, u.role, u.department || '', u.is_active ? 'Active' : 'Inactive',
        u.last_login ? new Date(u.last_login).toISOString() : '',
      ])].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `users-${new Date().toISOString().slice(0,10)}.csv`; a.click();
      URL.revokeObjectURL(url);
      setToast({ msg: `Exported ${rows.length} users`, type: 'success' });
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  // ── load ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setApiError('');
    try {
      const params = { page, limit: LIMIT };
      if (tab !== 'all') params.role = tab;
      if (search) params.search = search;
      if (filters.status) params.status = filters.status;
      if (filters.department) params.department = filters.department;
      const data = await listUsers(params);
      setUsers(data.users || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (e) {
      setApiError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, tab, search, filters]);

  useEffect(() => { load(); }, [load]);

  // reset page on filter change
  useEffect(() => { setPage(1); }, [tab, search, filters]);

  // ── KPI counts from full list (we'll compute from the total + current users for now)
  const kpiByRole = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const kpiInactive = users.filter((u) => !u.is_active).length;

  // ── mutations ────────────────────────────────────────────────────────────
  function openModal(name, user = null) {
    setTarget(user);
    setModalError('');
    setModal(name);
  }
  function closeModal() { setModal(null); setTarget(null); setModalError(''); setSaving(false); }

  function toggleActionMenu(e, user) {
    if (menu?.id === user.id) {
      setMenu(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = user.id === currentUser?.id ? 136 : 184;
    const gap = 6;
    const left = Math.max(8, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8));
    const opensUp = rect.bottom + gap + menuHeight > window.innerHeight;
    const top = opensUp
      ? Math.max(8, rect.top - menuHeight - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - menuHeight - 8);
    setMenu({ id: user.id, left, top });
  }

  async function handleCreate(form) {
    setSaving(true); setModalError('');
    try {
      await createUser({ name: form.name, email: form.email, password: form.password, role: form.role, department: form.department, employee_id: form.employee_id });
      closeModal();
      setToast({ msg: 'User created successfully', type: 'success' });
      load();
    } catch (e) { setModalError(e.message); setSaving(false); }
  }

  async function handleEdit(form) {
    setSaving(true); setModalError('');
    try {
      await updateUser(target.id, { name: form.name, email: form.email, role: form.role, department: form.department, employee_id: form.employee_id });
      closeModal();
      setToast({ msg: 'User updated successfully', type: 'success' });
      load();
    } catch (e) { setModalError(e.message); setSaving(false); }
  }

  async function handlePassword(password) {
    setSaving(true); setModalError('');
    try {
      await changeUserPassword(target.id, password);
      closeModal();
      setToast({ msg: `Password changed for ${target.name}`, type: 'success' });
    } catch (e) { setModalError(e.message); setSaving(false); }
  }

  async function handleDelete(permanent) {
    setSaving(true); setModalError('');
    try {
      await deleteUser(target.id, permanent);
      closeModal();
      setToast({ msg: permanent ? 'Account permanently deleted' : 'Account deactivated', type: 'success' });
      load();
    } catch (e) { setModalError(e.message); setSaving(false); }
  }

  async function handleToggle(user) {
    try {
      await updateUser(user.id, { is_active: !user.is_active });
      setToast({ msg: `${user.name} ${user.is_active ? 'deactivated' : 'activated'}`, type: 'success' });
      load();
    } catch (e) { setToast({ msg: e.message, type: 'error' }); }
  }

  // ── filter panel state ────────────────────────────────────────────────────
  const displayed = users;

  // ── kpi data ─────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total Users',    value: total,                       icon: Users,      color: '#1F7FA1', bg: '#EAF6FA' },
    { label: 'Supervisors',    value: kpiByRole.supervisor ?? '-', icon: UserCheck,  color: '#1d4ed8', bg: '#dbeafe' },
    { label: 'Gate Workers',   value: kpiByRole.gate ?? '-',       icon: Truck,      color: '#15803d', bg: '#dcfce7' },
    { label: 'ACDC Agents',    value: kpiByRole.acdc ?? '-',       icon: Package,    color: '#6d28d9', bg: '#ede9fe' },
    { label: 'Inactive Users', value: kpiInactive,                 icon: ToggleLeft, color: '#64748b', bg: '#f1f5f9' },
  ];

  return (
    <div style={{ maxWidth: 1400, width: '100%' }}>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--brand-900)', margin: 0 }}>Supervisor Control Center</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Manage users and assign one of the three operational roles.</p>
        </div>
        <button onClick={() => openModal('add')} style={{ display: 'flex', alignItems: 'center', gap: 7, height: 36, padding: '0 16px', background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <UserPlus size={15} /> Add User
        </button>
      </div>

      {/* ── KPI cards ── */}
      <div className="ac-kpis">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* ── Main layout ── */}
      <div className="ac-layout">
        {/* LEFT: table area */}
        <div style={{ minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', marginBottom: 14, overflowX: 'auto' }}>
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? 'var(--brand-600)' : 'var(--text-secondary)', borderBottom: tab === t.key ? '2px solid var(--brand-600)' : '2px solid transparent',
                whiteSpace: 'nowrap', marginBottom: -1,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Toolbar */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input style={{ ...inp, paddingLeft: 32 }} placeholder="Search by name, email or employee ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <button onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
              <Download size={13} /> Export
            </button>
          </div>

          {/* Error / loading */}
          {apiError && (
            <div style={{ padding: '12px 16px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 9, color: '#b91c1c', fontSize: 13, marginBottom: 12 }}>
              {apiError} — <button onClick={load} style={{ background: 'none', border: 'none', color: '#b91c1c', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Retry</button>
            </div>
          )}

          {/* Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr style={{ background: 'var(--app-bg)' }}>
                    {['User', 'Role', 'Department', 'Status', 'Last Login', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}><td colSpan={6} style={{ padding: '14px', textAlign: 'center' }}>
                        <div style={{ height: 16, background: 'var(--border)', borderRadius: 4, opacity: 0.5 + i * 0.1 }} />
                      </td></tr>
                    ))
                  ) : displayed.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                      No users found
                    </td></tr>
                  ) : (
                    displayed.map((user) => (
                      <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--app-bg)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                        {/* User */}
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: avatarBg(user.role), color: avatarColor(user.role), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{initials(user.name)}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 14px' }}><RoleBadge role={user.role} /></td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)' }}>{user.department || '—'}</td>
                        <td style={{ padding: '12px 14px' }}><StatusDot active={user.is_active} /></td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatLogin(user.last_login)}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'inline-block' }}>
                            <button onClick={(e) => toggleActionMenu(e, user)} style={{ width: 30, height: 30, borderRadius: 7, border: '1px solid var(--border)', background: menu?.id === user.id ? 'var(--brand-50)' : 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: menu?.id === user.id ? 'var(--brand-600)' : 'var(--text-secondary)' }}>
                              <MoreVertical size={15} />
                            </button>
                            {menu?.id === user.id && (
                              <ActionMenu
                                user={user}
                                currentUserId={currentUser?.id}
                                position={menu}
                                onEdit={() => openModal('edit', user)}
                                onPassword={() => openModal('password', user)}
                                onDelete={() => openModal('delete', user)}
                                onToggle={() => handleToggle(user)}
                                onClose={() => setMenu(null)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Showing {(page - 1) * LIMIT + 1} to {Math.min(page * LIMIT, total)} of {total} users
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: page === 1 ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === 1 ? 0.4 : 1 }}>
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(pages, 9) }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, border: `1px solid ${page === n ? 'var(--brand-600)' : 'var(--border)'}`, borderRadius: 6, background: page === n ? 'var(--brand-600)' : 'var(--surface)', color: page === n ? '#fff' : 'var(--text)', cursor: 'pointer', fontSize: 12, fontWeight: page === n ? 700 : 400 }}>
                      {n}
                    </button>
                  ))}
                  {pages > 9 && <span style={{ padding: '0 4px', fontSize: 12, alignSelf: 'center' }}>…</span>}
                  <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} style={{ width: 30, height: 30, border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', cursor: page === pages ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: page === pages ? 0.4 : 1 }}>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: filter panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Filters */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>Filters</span>
              <button onClick={() => { setFilters({ status: '', department: '' }); }} style={{ background: 'none', border: 'none', color: 'var(--brand-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Clear all</button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em' }}>Role</label>
              <select style={{ ...inp }} value={tab === 'all' ? '' : tab} onChange={(e) => setTab(e.target.value || 'all')}>
                <option value="">All Roles</option>
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em' }}>Department</label>
              <select style={{ ...inp }} value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}>
                <option value="">All Departments</option>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: '.04em' }}>Status</label>
              <select style={{ ...inp }} value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

          </div>

          {/* Role Management */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Shield size={14} color="var(--brand-600)" />
              <span style={{ fontWeight: 700, fontSize: 13 }}>Role Management</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>View the fixed access for each role</p>
            <button onClick={() => openModal('roles')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--app-bg)', fontSize: 12, cursor: 'pointer', color: 'var(--text)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Shield size={13} color="var(--brand-600)" /> Manage Roles</span>
              <ChevronRight size={13} color="var(--text-secondary)" />
            </button>
          </div>

          {/* Bulk Actions */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>Bulk Actions</div>
            <button onClick={handleExportCsv} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--app-bg)', fontSize: 12, cursor: 'pointer', color: 'var(--text)', marginBottom: 6 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Download size={13} /> Export Users</span>
              <ChevronRight size={13} color="var(--text-secondary)" />
            </button>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '9px 12px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--app-bg)', fontSize: 12, cursor: 'pointer', color: 'var(--text)', boxSizing: 'border-box' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}><Upload size={13} /> Import Users</span>
              <ChevronRight size={13} color="var(--text-secondary)" />
              <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={(e) => {
                if (e.target.files[0]) setToast({ msg: 'User import via CSV/Excel coming soon', type: 'success' });
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modal === 'add' && (
        <Modal title="Add new user" onClose={closeModal} width={580}>
          <UserForm isEdit={false} onSave={handleCreate} onClose={closeModal} saving={saving} error={modalError} />
        </Modal>
      )}
      {modal === 'edit' && target && (
        <Modal title="Edit user" onClose={closeModal} width={580}>
          <UserForm initial={target} isEdit={true} onSave={handleEdit} onClose={closeModal} saving={saving} error={modalError} />
        </Modal>
      )}
      {modal === 'password' && target && (
        <ChangePasswordModal user={target} onSave={handlePassword} onClose={closeModal} saving={saving} error={modalError} />
      )}
      {modal === 'delete' && target && (
        <DeleteModal user={target} onDelete={handleDelete} onClose={closeModal} saving={saving} error={modalError} />
      )}

      {modal === 'roles' && (
        <Modal title="Role Management" onClose={closeModal} width={500}>
          <div style={{ padding: '16px 20px' }}>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              Roles control what each user can see and do in NumiDock. Access is fixed by role.
            </p>
            {ROLES.map(r => (
              <div key={r.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ background: r.bg, color: r.color, borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{r.label}</span>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {r.value === 'supervisor' && 'Dashboard, scheduling, storage, parameters, and accounts and roles.'}
                  {r.value === 'gate' && 'Gate portal — check in trucks, record arrivals, advance gate states.'}
                  {r.value === 'acdc' && 'ACDC portal — manage collection tasks, advance task lifecycle.'}
                </div>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={closeModal} style={{ height: 36, padding: '0 20px', background: 'var(--brand-600)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}

      <style>{`
        .ac-kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; margin-bottom: 14px; }
        .ac-layout { display: grid; grid-template-columns: 1fr 260px; gap: 14px; align-items: start; }
        @media (max-width: 1100px) {
          .ac-kpis { grid-template-columns: repeat(3, 1fr); }
          .ac-layout { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .ac-kpis { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
