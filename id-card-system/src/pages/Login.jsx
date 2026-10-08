import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  ShieldCheck, AlertCircle, CheckCircle2,
  Eye, EyeOff, LogIn, IdCard, QrCode, Printer,
} from 'lucide-react';
import { useAuth } from '../context/auth-context';
import { getOrganization } from '../services/localStore';
import { demoCredential, usingSupabase } from '../services/auth';
import '../styles/auth.css';

/**
 * Login
 * ---------------------------------------------------------------------------
 * If a session already exists the user is sent straight on, so a signed-in
 * admin never sees this screen. The originally requested path is restored
 * after login.
 */
export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const organization = getOrganization();
  const demo = demoCredential();

  const [email, setEmail] = useState(demo?.email ?? '');
  const [password, setPassword] = useState(demo?.password ?? '');
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  if (!isLoading && isAuthenticated) {
    return <Navigate to={location.state?.from ?? '/'} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return; // block duplicate submissions

    setError('');
    setNotice('');
    setBusy(true);
    try {
      const result = await login(email, password);
      if (result.ok) {
        navigate(location.state?.from ?? '/', { replace: true });
      } else {
        setError(result.error);
      }
    } catch {
      setError('Something went wrong while signing in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      {/* ---- brand panel ---- */}
      <aside className="auth__aside">
        <div className="auth__aside-brand">
          {organization.logoUrl ? (
            <img className="auth__aside-logo" src={organization.logoUrl} alt="" />
          ) : null}
          <span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{organization.name}</span>
            <br />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,.6)' }}>
              Digital ID Card Management
            </span>
          </span>
        </div>

        <div className="auth__aside-title">
          <h2>Issue, verify and renew member ID cards.</h2>
          <p>
            One locked card design for the whole organisation. Member details are
            entered once and the card, its QR code and its verification page are
            generated automatically.
          </p>

          <ul className="auth__aside-list">
            <li><IdCard size={17} /> Fixed organisation template — no per-card redesign</li>
            <li><QrCode size={17} /> Every card carries a scannable verification QR</li>
            <li><ShieldCheck size={17} /> Live status: valid, expired or revoked</li>
            <li><Printer size={17} /> Print-ready PDF and high-resolution PNG</li>
          </ul>
        </div>

        <p className="auth__aside-foot">
          Authorised access only. All activity is recorded.
        </p>
      </aside>

      {/* ---- form panel ---- */}
      <main className="auth__panel">
        <div className="auth__form">
          <div className="auth__mobile-brand">
            {organization.logoUrl ? (
              <img src={organization.logoUrl} alt="" />
            ) : null}
            <span>
              <span style={{ display: 'block', fontWeight: 700 }}>{organization.name}</span>
              <span className="text-muted text-sm">Digital ID Card Management</span>
            </span>
          </div>

          <h1 className="auth__title">Sign in</h1>
          <p className="auth__sub">
            Use the administrator account issued to you.
          </p>

          {error ? (
            <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          ) : null}

          {notice ? (
            <div className="banner banner-ok" role="status" style={{ marginBottom: 16 }}>
              <CheckCircle2 size={17} />
              <span>{notice}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="auth__fields" noValidate>
            <div className="field">
              <label className="label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@organisation.org"
                autoComplete="username"
                required
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label" htmlFor="password">Password</label>
              <div className="password-field">
                <input
                  id="password"
                  type={reveal ? 'text' : 'password'}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={busy}
                />
                <button
                  type="button"
                  className="password-field__toggle"
                  onClick={() => setReveal((v) => !v)}
                  aria-label={reveal ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {reveal ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="auth__row-between">
              <label className="check">
                <input type="checkbox" name="remember" />
                Keep me signed in
              </label>
              <Link to="/forgot-password" className="auth__forgot">Forgot password?</Link>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-block auth__submit" disabled={busy}>
              {busy
                ? <><span className="spinner" /> Signing in&hellip;</>
                : <><LogIn size={17} /> Sign in</>}
            </button>
          </form>

          {demo ? (
            <div className="auth__demo">
              <strong>Demo mode.</strong> Supabase is not connected yet, so
              authentication is running locally. Use
              {' '}<code>{demo.email}</code> / <code>{demo.password}</code>.
              {usingSupabase() ? null : (
                <>
                  <br />
                  This is development-only and must be replaced by Supabase Auth
                  before go-live.
                </>
              )}
            </div>
          ) : null}

          <p className="text-muted text-sm" style={{ marginTop: 20 }}>
            <Link to="/verify/0095030">Open the public verification page</Link>
          </p>
        </div>
      </main>
    </div>
  );
}
