import { Link } from 'react-router-dom';
import { ArrowLeft, KeyRound, ShieldCheck } from 'lucide-react';
import { getOrganization } from '../services/members';
import '../styles/auth.css';

/**
 * ForgotPassword
 * ---------------------------------------------------------------------------
 * There is no mail service wired to this deployment, so a self-service reset
 * would be a promise the system cannot keep - the operator would wait for an
 * email that never arrives.
 *
 * Rather than show a form that quietly does nothing, the page states the actual
 * procedure: the administrator resets the password from the server. That is
 * also the safer arrangement for a register of identity documents, where
 * account recovery should pass a human, not an inbox.
 */
export default function ForgotPassword() {
  const organization = getOrganization();

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
          <h2>Account recovery</h2>
          <p>
            For security, passwords for this register are reset by the
            administrator rather than by email.
          </p>
        </div>
      </aside>

      <main className="auth__panel">
        <div className="auth__form">
          <Link to="/login" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}>
            <ArrowLeft size={15} /> Back to sign in
          </Link>

          <h1 className="auth__title" style={{ marginTop: 16 }}>Forgot your password?</h1>
          <p className="auth__sub">
            Ask the system administrator to issue a new one. They will set it from
            the server and tell you the new password directly.
          </p>

          <div className="banner" role="status" style={{ alignItems: 'flex-start' }}>
            <KeyRound size={17} style={{ marginTop: 2 }} />
            <span>
              Administrators can change their own password at any time from
              <strong> Settings &rarr; Security</strong> once signed in.
            </span>
          </div>

          <div className="banner" style={{ alignItems: 'flex-start', marginTop: 12 }}>
            <ShieldCheck size={17} style={{ marginTop: 2 }} />
            <span>
              Nobody at {organization.name || 'the organisation'} will ever ask you
              for your password. Do not share it with anyone.
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
