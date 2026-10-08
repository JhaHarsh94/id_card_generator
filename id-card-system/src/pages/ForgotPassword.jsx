import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { requestPasswordReset } from '../services/auth';
import { getOrganization } from '../services/localStore';
import '../styles/auth.css';

/**
 * ForgotPassword
 * ---------------------------------------------------------------------------
 * Always shows the same confirmation, whether or not the address is
 * registered. Revealing that an address is unknown would let anyone test which
 * administrators hold accounts.
 */
export default function ForgotPassword() {
  const organization = getOrganization();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    setError('');
    setBusy(true);
    try {
      const result = await requestPasswordReset(email);
      if (result.ok) setSent(true);
      else setError(result.error);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <aside className="auth__aside">
        <div className="auth__aside-brand">
          {organization.logoUrl ? (
            <img className="auth__aside-logo" src={organization.logoUrl} alt="" />
          ) : null}
          <span style={{ fontWeight: 700, fontSize: 15 }}>{organization.name}</span>
        </div>
        <div className="auth__aside-title">
          <h2>Reset your password</h2>
          <p>
            Enter the email address on your administrator account and we will send
            a link to set a new password.
          </p>
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__form">
          <Link to="/login" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
            <ArrowLeft size={15} /> Back to sign in
          </Link>

          <h1 className="auth__title" style={{ marginTop: 16 }}>Forgot password</h1>
          <p className="auth__sub">
            We will email you a link to choose a new password.
          </p>

          {sent ? (
            <div className="banner banner-ok" role="status">
              <CheckCircle2 size={17} />
              <span>
                If an administrator account exists for that address, a reset link is
                on its way. Check your inbox.
              </span>
            </div>
          ) : (
            <>
              {error ? (
                <div className="banner banner-error" role="alert" style={{ marginBottom: 16 }}>
                  <AlertCircle size={17} />
                  <span>{error}</span>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="auth__fields" noValidate>
                <div className="field">
                  <label className="label" htmlFor="reset-email">Email address</label>
                  <input
                    id="reset-email"
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

                <button
                  type="submit"
                  className="btn btn-primary btn-lg btn-block auth__submit"
                  disabled={busy}
                >
                  {busy
                    ? <><span className="spinner" /> Sending&hellip;</>
                    : <><Send size={17} /> Send reset link</>}
                </button>
              </form>
            </>
          )}

          <p className="text-muted text-sm row gap-2" style={{ marginTop: 20 }}>
            <Mail size={14} />
            Contact your administrator if you no longer have access to this mailbox.
          </p>
        </div>
      </main>
    </div>
  );
}