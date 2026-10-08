import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  CheckCircle2, AlertTriangle, XCircle, ShieldQuestion,
  UserRound, MapPin, CalendarDays, IdCard as IdCardIcon, LogIn,
} from 'lucide-react';
import { getMember, getOrganization } from '../services/localStore';
import { deriveStatus, STATUS } from '../utils/status';
import { formatDate, describeValidity } from '../utils/date';
import '../styles/verify.css';

/**
 * Verify - PUBLIC page. No login required.
 * ---------------------------------------------------------------------------
 * This is the destination encoded in every card's QR code.
 *
 * Privacy rules enforced here:
 *   - only fields the organisation intends to publish are shown
 *   - revocation_reason is NEVER exposed
 *   - photo is not published (it is a stored file, not a public field)
 *   - no row ids, no admin details, no database internals
 *
 * It always re-reads the record and re-derives status, so what a scanner sees
 * reflects the current state of the database, never a cached value.
 */
export default function Verify() {
  const { memberId } = useParams();
  const organization = getOrganization();
  const lookedUp = decodeURIComponent(memberId ?? '');

  const [state, setState] = useState({
    phase: 'loading',
    member: null,
    status: null,
    // Captured when the lookup completes; `new Date()` is impure and must not
    // be called during render.
    checkedOn: null,
  });
  const [lastLookup, setLastLookup] = useState(lookedUp);

  // Reset during render when the scanned ID changes, rather than synchronously
  // inside the effect, which would cause a cascading extra render.
  if (lastLookup !== lookedUp) {
    setLastLookup(lookedUp);
    setState({ phase: 'loading', member: null, status: null, checkedOn: null });
  }

  useEffect(() => {
    let alive = true;

    getMember(lookedUp)
      .then((member) => {
        if (!alive) return;
        setState({
          phase: member ? 'found' : 'missing',
          member,
          status: member ? deriveStatus(member) : null,
          checkedOn: new Date().toISOString(),
        });
      })
      .catch(() => {
        if (alive) {
          setState({
            phase: 'missing',
            member: null,
            status: null,
            checkedOn: new Date().toISOString(),
          });
        }
      });

    return () => { alive = false; };
  }, [lookedUp]);

  const { phase, member, status, checkedOn } = state;

  const PRESENTATION = {
    [STATUS.ACTIVE]: {
      cls: 'ok',
      Icon: CheckCircle2,
      headline: 'VALID ID',
      note: 'This ID card is active and has not expired.',
    },
    [STATUS.EXPIRED]: {
      cls: 'warn',
      Icon: AlertTriangle,
      headline: 'EXPIRED',
      note: 'This ID card is past its validity date and is no longer active.',
    },
    [STATUS.REVOKED]: {
      cls: 'bad',
      Icon: XCircle,
      headline: 'REVOKED',
      note: 'This ID card has been revoked by the organisation and must not be accepted.',
    },
  };

  const view = member ? PRESENTATION[status] : null;
  const { Icon } = view ?? { Icon: ShieldQuestion };

  return (
    <div className="verify">
      <header className="verify__top">
        <div className="verify__brand">
          {organization.logoUrl ? (
            <img className="verify__logo" src={organization.logoUrl} alt="" />
          ) : null}
          <span>
            <span className="verify__org">{organization.name}</span>
            <span className="verify__org-sub">
              {organization.nameHi || 'ID Verification'}
            </span>
          </span>
        </div>
        <Link to="/login" className="btn btn-ghost btn-sm">
          <LogIn size={15} /> Admin sign in
        </Link>
      </header>

      <main className="verify__main">
        <div className="verify__card">
          <div className="verify__card-head">
            <IdCardIcon size={17} />
            ID Verification
          </div>

          {phase === 'loading' ? (
            <div className="verify__loading">
              <span className="spinner spinner-lg" style={{ color: 'var(--brand-blue)' }} />
              <p className="text-muted text-sm">Checking this ID…</p>
            </div>
          ) : (
            <>
              {/* ---- status ---- */}
              <div className={`verify__status verify__status--${view?.cls ?? 'none'}`}>
                <Icon size={40} strokeWidth={2.2} />
                <div>
                  <div className="verify__headline">{view?.headline ?? 'NOT FOUND'}</div>
                  <div className="verify__note">
                    {phase === 'missing'
                      ? 'No ID card with this number is on record with the organisation.'
                      : view?.note}
                  </div>
                </div>
              </div>

              {/* ---- details ---- */}
              {member ? (
                <dl className="verify__fields">
                  <div>
                    <dt><UserRound size={14} /> Name</dt>
                    <dd>{member.fullName}</dd>
                  </div>
                  <div>
                    <dt><UserRound size={14} /> Designation</dt>
                    <dd>{member.designation}</dd>
                  </div>
                  <div>
                    <dt><MapPin size={14} /> State</dt>
                    <dd>{member.state}</dd>
                  </div>
                  <div>
                    <dt><IdCardIcon size={14} /> ID Number</dt>
                    <dd className="text-mono">{member.memberId}</dd>
                  </div>
                  <div>
                    <dt><CalendarDays size={14} /> Valid up to</dt>
                    <dd className="text-mono">{formatDate(member.validUntil)}</dd>
                  </div>
                  <div>
                    <dt>Organisation</dt>
                    <dd>{organization.name}</dd>
                  </div>
                </dl>
              ) : null}

              {member ? (
                <p className="verify__footer-note">
                  {/* A revoked card has no meaningful expiry countdown - saying
                      "expires in 14 months" on a REVOKED page is contradictory. */}
                  {status === STATUS.REVOKED
                    ? 'This ID is no longer valid, regardless of its expiry date.'
                    : `${describeValidity(member.validUntil)}.`}
                  {checkedOn ? ` Verified against live records on ${formatDate(checkedOn)}.` : ''}
                </p>
              ) : null}
            </>
          )}
        </div>

        {organization.isDemo ? (
          <p className="verify__demo">
            Demo environment — these records are sample data, not a real credential.
          </p>
        ) : null}
      </main>

      <footer className="verify__foot">
        {organization.registrationText || organization.name}
      </footer>
    </div>
  );
}