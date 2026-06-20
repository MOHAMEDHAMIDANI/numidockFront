import { useState, useEffect } from 'react';
import { login, getToken, clearToken, request } from './api';
import Shell from './components/Shell';
import DashboardPage from './pages/DashboardPage';
import DriverPage from './pages/DriverPage';
import GatePage from './pages/GatePage';
import AcdcPage from './pages/AcdcPage';
import { Mail, Lock, Eye, EyeOff, Globe, ChevronDown } from 'lucide-react';
import loginBg from './assets/login-bg.png';
import ParametersPage from './pages/ParametersPage';
import WorkspacePage from './pages/WorkspacePage';
import StoragePage from './pages/StoragePage';
import AccountsPage from './pages/AccountsPage';
function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('admin@numidock.dz');
  const [password, setPassword] = useState('admin');
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetPopup, setResetPopup] = useState(false);

  async function handleSubmit() {
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputWrap = {
    display: 'flex', alignItems: 'center', gap: 10, height: 52,
    padding: '0 14px', border: '1px solid var(--border)', borderRadius: 12,
    background: 'var(--surface)', transition: 'border-color .15s',
  };
  const inputEl = {
    border: 'none', outline: 'none', flex: 1, fontSize: 15,
    background: 'transparent', color: 'var(--text)', fontFamily: 'inherit',
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh', display: 'flex', background: 'var(--app-bg)',
    }}>
      {/* LEFT PANEL */}
      <div className="login-left" style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 64px', color: '#fff',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${loginBg})`, backgroundSize: 'cover', backgroundPosition: 'center',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(31,127,161,0.92), rgba(15,52,66,0.82))',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 64, fontWeight: 700, letterSpacing: '-1px', lineHeight: 1 }}>NumiDock</h1>
          <p className="login-subtitle" style={{ 
            fontSize: 22, fontWeight: 400, marginTop: 20, lineHeight: 1.4, maxWidth: 440 
          }}>
            Smart Dock Appointment<br />and Capacity Management System
          </p>
          <div style={{ width: 56, height: 4, background: 'var(--brand-200)', borderRadius: 2, marginTop: 24 }} />
        </div>
        <div className="login-logo" style={{
          position: 'absolute', bottom: 40, left: 64, zIndex: 1,
          display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 700, letterSpacing: '2px',
        }}>
          <div style={{
            width: 48, height: 48, border: '2px solid #fff', borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>N</div>
          NUMILOG
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="login-right" style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center', padding: 40, position: 'relative',
      }}>
        {/* language selector desktop */}
        <div className="login-lang-desktop" style={{
          position: 'absolute', top: 32, right: 40,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 12,
          fontSize: 14, color: 'var(--text)', cursor: 'pointer',
        }}>
          <Globe size={16} /> English <ChevronDown size={16} />
        </div>

        <div style={{ width: '100%', maxWidth: 400 }}>
          <h2 style={{ fontSize: 30, fontWeight: 700, color: 'var(--text)' }}>Welcome back</h2>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, marginBottom: 32, fontSize: 16 }}>
            Sign in to your account
          </p>

          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Email</label>
          <div style={{ ...inputWrap, marginTop: 8, marginBottom: 20 }}>
            <Mail size={18} color="var(--text-secondary)" />
            <input
              style={inputEl} value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
            />
          </div>

          <label style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Password</label>
          <div style={{ ...inputWrap, marginTop: 8, marginBottom: 16 }}>
            <Lock size={18} color="var(--text-secondary)" />
            <input
              style={inputEl} type={showPw ? 'text' : 'password'}
              value={password} onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="Enter your password"
            />
            <button onClick={() => setShowPw(!showPw)} style={{ background: 'none', border: 'none', display: 'flex', color: 'var(--text-secondary)' }}>
              {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16 }} />
              Remember me
            </label>
            <span onClick={() => setResetPopup(true)} style={{ fontSize: 14, color: 'var(--brand-600)', fontWeight: 500, cursor: 'pointer' }}>Forgot password?</span>
          </div>

          {error && (
            <div style={{ color: 'var(--critical)', fontSize: 14, marginBottom: 16 }}>{error}</div>
          )}

          <button
            onClick={handleSubmit} disabled={loading}
            style={{
              width: '100%', height: 52, background: 'var(--brand-600)', color: '#fff',
              border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 600,
              opacity: loading ? 0.6 : 1, transition: 'background .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-700)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brand-600)')}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {/* mobile language selector */}
          <div className="login-lang-mobile" style={{
            display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content',
            padding: '10px 16px', border: '1px solid var(--border)', borderRadius: 12,
            fontSize: 14, color: 'var(--text)', cursor: 'pointer', marginTop: 24,
          }}>
            <Globe size={16} /> English <ChevronDown size={16} />
          </div>

          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13, marginTop: 40 }}>
            © 2026 NumiDock v1.0.0
          </p>
        </div>
      </div>

      {/* Reset password popup */}
      {resetPopup && (
        <div onClick={() => setResetPopup(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(15,52,66,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 24, maxWidth: 520, width: '100%', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            {/* Colored header band */}
            <div style={{ background: 'linear-gradient(135deg, var(--brand-700), var(--brand-900))', padding: '40px 48px 36px', textAlign: 'center', position: 'relative' }}>
              {/* close button */}
              <button onClick={() => setResetPopup(false)} style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
                ✕
              </button>
              {/* Icon ring */}
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', border: '2px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Lock size={36} color="#fff" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Forgot your password?</h2>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 8, margin: '8px 0 0' }}>Account access recovery</p>
            </div>

            {/* Body */}
            <div style={{ padding: '36px 48px 40px', textAlign: 'center' }}>
              <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 28 }}>
                Password resets are handled by your system administrator. Please reach out to your <strong style={{ color: 'var(--text)', fontWeight: 700 }}>supervisor</strong> and provide your registered email address — they will reset your access.
              </p>

              {/* Info box */}
              <div style={{ background: 'var(--brand-50)', border: '1px solid var(--brand-100)', borderRadius: 12, padding: '14px 20px', marginBottom: 32, display: 'flex', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--brand-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <Mail size={16} color="var(--brand-600)" />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand-700)', marginBottom: 3 }}>What to tell your supervisor</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Your registered email: <strong style={{ color: 'var(--text)' }}>{email || 'your email address'}</strong></div>
                </div>
              </div>

              <button onClick={() => setResetPopup(false)} style={{ width: '100%', height: 52, background: 'linear-gradient(135deg, var(--brand-600), var(--brand-700))', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 14px rgba(31,127,161,0.35)' }}>
                Got it, I'll contact my supervisor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState('dashboard');

  useEffect(() => {
    if (getToken()) {
      request('/auth/me')
        .then((data) => setUser(data.user))
        .catch(() => clearToken())
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
  }

const path = window.location.pathname;
  if (path.startsWith('/driver')) {
    return <DriverPage />;
  }

  
  if (checking) return <div style={{ padding: 32 }}>Loading…</div>;
  if (!user) return <LoginPage onLogin={setUser} />;

  // Gate agents get the gate portal only (no supervisor shell)
  if (user.role === 'gate') {
    return <GatePage user={user} onLogout={handleLogout} />;
  }

  // ACDC users get the ACDC portal only
  if (user.role === 'acdc') {
    return <AcdcPage user={user} onLogout={handleLogout} />;
  }

  return (
    <Shell user={user} onLogout={handleLogout} current={page} onNavigate={setPage}>
      {page === 'dashboard'  && <DashboardPage onNavigate={setPage} />}
      {page === 'workspace'  && <WorkspacePage />}
      {page === 'gate'       && <GatePage user={user} onLogout={handleLogout} />}
      {page === 'acdc'       && <AcdcPage user={user} onLogout={handleLogout} />}
      {page === 'storage'    && <StoragePage />}
      {page === 'parameters' && <ParametersPage />}
      {page === 'accounts'   && <AccountsPage currentUser={user} />}
    </Shell>
  );
}
