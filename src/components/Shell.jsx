import { useState } from 'react';
import { LayoutDashboard, Archive, Settings, X, LogOut, LayoutGrid, MoreHorizontal, Bell, ChevronDown, Users } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'dashboard',   label: 'Dashboard',             icon: LayoutDashboard },
  { key: 'workspace',   label: 'Scheduling',             icon: LayoutGrid },
  { key: 'storage',     label: 'Storage',               icon: Archive },
  { key: 'parameters',  label: 'Parameters',            icon: Settings },
];

const ADMIN_ITEMS = [
  { key: 'accounts', label: 'Accounts & Roles', icon: Users },
];

const BOTTOM_NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'workspace', label: 'Workspace', icon: LayoutGrid },
  { key: 'storage', label: 'Storage', icon: Archive },
  { key: '__more', label: 'More', icon: MoreHorizontal },
];

export default function Shell({ user, onLogout, current, onNavigate, children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const initials = (user?.name || 'A').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const supervisorPages = ['dashboard', 'workspace', 'storage', 'parameters', 'accounts'];
  const canAccess = (key) => user?.role === 'supervisor' && supervisorPages.includes(key);
  const visibleNavItems = NAV_ITEMS.filter((item) => canAccess(item.key));
  const visibleAdminItems = ADMIN_ITEMS.filter((item) => canAccess(item.key));
  const visibleBottomNav = BOTTOM_NAV.filter((item) => item.key === '__more' || canAccess(item.key));

  function nav(key) {
    if (key === '__more') { setDrawerOpen(true); return; }
    onNavigate(key);
    setDrawerOpen(false);
  }

  const SidebarContent = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '22px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20, border: '1.5px solid rgba(255,255,255,0.3)' }}>N</div>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>NumiDock</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Dock Scheduling</div>
        </div>
      </div>

      <nav style={{ padding: 14, flex: 1, overflowY: 'auto' }}>
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button key={item.key} onClick={() => nav(item.key)} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '13px 16px', marginBottom: 6, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: active ? 'linear-gradient(135deg, var(--brand-600), var(--brand-700))' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.75)',
              fontSize: 14, fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 4px 14px rgba(31,127,161,0.4)' : 'none',
              transition: 'background .15s, color .15s',
            }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={20} /> {item.label}
            </button>
          );
        })}

        {/* Administration section */}
        {visibleAdminItems.length > 0 && (
          <div style={{ padding: '14px 16px 6px', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 8 }}>
            Administration
          </div>
        )}
        {visibleAdminItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.key;
          return (
            <button key={item.key} onClick={() => nav(item.key)} style={{
              display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left',
              padding: '13px 16px', marginBottom: 6, borderRadius: 11, border: 'none', cursor: 'pointer',
              background: active ? 'linear-gradient(135deg, var(--brand-600), var(--brand-700))' : 'transparent',
              color: active ? '#fff' : 'rgba(255,255,255,0.75)',
              fontSize: 14, fontWeight: active ? 600 : 500,
              boxShadow: active ? '0 4px 14px rgba(31,127,161,0.4)' : 'none',
              transition: 'background .15s, color .15s',
            }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <Icon size={20} /> {item.label}
            </button>
          );
        })}
      </nav>

      <div style={{ padding: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13 }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{user?.role}</div>
        </div>
        <button onClick={onLogout} title="Sign out" style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer' }}>
          <LogOut size={17} />
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ── Desktop sidebar ── */}
      <aside className="shell-sidebar" style={{
        width: 256, background: 'linear-gradient(180deg, var(--brand-900), #0a2530)',
        display: 'flex', flexDirection: 'column', flexShrink: 0, position: 'sticky', top: 0, height: '100vh',
      }}>
        {SidebarContent}
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <>
          <div onClick={() => setDrawerOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
          <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 260, background: 'linear-gradient(180deg, var(--brand-900), #0a2530)', display: 'flex', flexDirection: 'column', zIndex: 50 }}>
            <button onClick={() => setDrawerOpen(false)} style={{ position: 'absolute', top: 18, right: 14, background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}><X size={22} /></button>
            {SidebarContent}
          </aside>
        </>
      )}

      {/* ── Main column ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Mobile branded topbar */}
        <header className="shell-mobile-topbar" style={{
          background: 'linear-gradient(135deg, var(--brand-900), #0c2d3f)',
          padding: '0 16px', height: 56, display: 'none', alignItems: 'center', justifyContent: 'space-between',
          position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 17 }}>N</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>NumiDock</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Dock Scheduling</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={{ position: 'relative', width: 36, height: 36, borderRadius: 8, border: 'none', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}>
              <Bell size={18} />
              <span style={{ position: 'absolute', top: -3, right: -3, width: 16, height: 16, borderRadius: '50%', background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</span>
            </button>
            <button onClick={() => setDrawerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 8px', border: 'none', borderRadius: 8, background: 'rgba(255,255,255,0.08)', cursor: 'pointer', color: '#fff', fontSize: 13 }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--brand-600)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initials}</div>
              <ChevronDown size={14} />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="shell-main" style={{ flex: 1, padding: 32, overflow: 'auto' }}>
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="shell-bottom-nav" style={{
          display: 'none', position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 30,
          background: 'var(--surface)', borderTop: '1px solid var(--border)',
          height: 60,
        }}>
          {visibleBottomNav.map(({ key, label, icon: Icon }) => {
            const active = current === key;
            return (
              <button key={key} onClick={() => nav(key)} style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 3, border: 'none', background: 'none', cursor: 'pointer', padding: '6px 4px',
                color: active ? 'var(--brand-600)' : 'var(--text-secondary)',
                borderTop: active ? '2px solid var(--brand-600)' : '2px solid transparent',
              }}>
                <Icon size={20} />
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, lineHeight: 1 }}>{label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .shell-sidebar { display: none !important; }
          .shell-mobile-topbar { display: flex !important; }
          .shell-bottom-nav { display: flex !important; }
          .shell-main { padding: 16px 16px 76px !important; }
        }
        @media (max-width: 520px) {
          .shell-main { padding: 12px 12px 76px !important; }
        }
      `}</style>
    </div>
  );
}
