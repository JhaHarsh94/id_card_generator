import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Pencil, Download, FileText, Printer, RefreshCw,
  Ban, ShieldAlert, UserRound, Copy, Check, ExternalLink,
} from 'lucide-react';
import CardStage from '../components/CardStage';
import StatusBadge from '../components/StatusBadge';
import { getMember, renewMember, revokeMember, getOrganization } from '../services/localStore';
import { deriveStatus, STATUS } from '../utils/status';
import { addMonths, formatDate, formatDateLong, describeValidity, toISODate, today } from '../utils/date';
import { downloadCardPdf, downloadCardPng, printCard } from '../utils/cardExport';

/**
 * MemberDetails
 * ---------------------------------------------------------------------------
 * Shows the issued card plus the full record and the actions available on it:
 * download, print, renew and revoke.
 *
 * The rendered card node is captured with a ref so PNG/PDF/print all capture
 * the identical element rather than re-rendering it.
 */
export default function MemberDetails() {
  const { memberId } = useParams();
  const cardRef = useRef(null);

  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);

  const organization = getOrganization();
  const lookedUp = decodeURIComponent(memberId ?? '');

  useEffect(() => {
    let alive = true;

    getMember(lookedUp)
      .then((row) => {
        if (!alive) return;
        if (row) {
          setMember(row);
          setNotFound(false);
        } else {
          setMember(null);
          setNotFound(true);
        }
      })
      .catch(() => {
        if (!alive) return;
        setMember(null);
        setNotFound(true);
      })
      .finally(() => alive && setLoading(false));

    return () => { alive = false; };
  }, [lookedUp]);

  const status = member ? deriveStatus(member) : null;
  const verifyUrl = `${window.location.origin}/verify/${encodeURIComponent(memberId)}`;

  async function runExport(kind) {
    if (!cardRef.current || busy) return;
    setBusy(kind);
    try {
      if (kind === 'png') await downloadCardPng(cardRef.current, member);
      else if (kind === 'pdf') await downloadCardPdf(cardRef.current, member);
      else if (kind === 'print') await printCard(cardRef.current, member, { organization });
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy('');
    }
  }

  async function handleRenew() {
    if (busy || !window.confirm(
      `Renew this ID?\n\nThe current expiry is ${formatDate(member.validUntil)}.\n`
      + `A new ${organization.defaultValidityMonths ?? 12}-month validity will be issued.`,
    )) return;

    setBusy('renew');
    try {
      const next = addMonths(
        // Renew from today when already lapsed, otherwise from the current expiry.
        String(member.validUntil) < toISODate(today())
          ? today()
          : member.validUntil,
        organization.defaultValidityMonths ?? 12,
      );
      await renewMember(member.id, next);
      setMember(await getMember(member.memberId));
    } catch {
      window.alert('The ID could not be renewed. Please try again.');
    } finally {
      setBusy('');
    }
  }

  async function handleRevoke() {
    const reason = window.prompt(
      'Are you sure you want to revoke this ID?\n\n'
      + 'The QR code will keep working but will report this ID as REVOKED.\n\n'
      + 'Reason (optional):',
      '',
    );
    if (reason === null || busy) return;

    setBusy('revoke');
    try {
      await revokeMember(member.id, reason.trim() || null);
      setMember(await getMember(member.memberId));
    } catch {
      window.alert('The ID could not be revoked. Please try again.');
    } finally {
      setBusy('');
    }
  }

  async function copyVerifyUrl() {
    try {
      await navigator.clipboard.writeText(verifyUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(verifyUrl);
    }
  }

  /* ---- states ---------------------------------------------------------- */

  if (loading) {
    return (
      <div className="page">
        <div className="skeleton" style={{ height: 40, width: 240 }} />
        <div className="skeleton" style={{ height: 300 }} />
      </div>
    );
  }

  if (notFound || !member) {
    return (
      <div className="page">
        <div className="error-state">
          <span className="icon-ring"><ShieldAlert size={24} /></span>
          <p className="h3">ID not found</p>
          <p className="text-muted text-sm">
            No member holds the ID number {decodeURIComponent(memberId ?? '')}.
          </p>
          <Link to="/members" className="btn btn-primary">Back to members</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <Link to="/members" className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 6 }}>
            <ArrowLeft size={15} /> Back to members
          </Link>
          <div className="row gap-3">
            <h1 className="h1">{member.fullName}</h1>
            <StatusBadge status={status} size="lg" />
          </div>
          <p className="page-sub">
            {member.designation} · {member.state}
            {member.district ? ` · ${member.district}` : ''}
          </p>
        </div>

        <div className="page-head__actions">
          <Link to={`/members/${encodeURIComponent(member.memberId)}/edit`} className="btn btn-secondary">
            <Pencil size={15} /> Edit
          </Link>
          <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={handleRenew}>
            {busy === 'renew' ? <span className="spinner" /> : <RefreshCw size={15} />} Renew
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!!busy || status === STATUS.REVOKED}
            onClick={handleRevoke}
            style={{ color: status === STATUS.REVOKED ? undefined : 'var(--danger)' }}
          >
            {busy === 'revoke' ? <span className="spinner" /> : <Ban size={15} />} Revoke
          </button>
        </div>
      </div>

      <div className="details-grid">
        {/* ---- the card ---- */}
        <div className="card">
          <div className="card-head">
            <h2 className="h3">ID card</h2>
            <span className="badge badge-neutral">Fixed template</span>
          </div>
          <div className="card-body">
            <div className="details-card">
              <CardStage
                organization={organization}
                cardRef={cardRef}
                showDemoFlag={false}
                member={{
                  name: member.fullName,
                  designation: member.designation,
                  state: member.state,
                  memberId: member.memberId,
                  validUntil: member.validUntil,
                  photoUrl: member.photoUrl,
                }}
              />
            </div>

            <div className="row gap-2 wrap" style={{ marginTop: 20 }}>
              <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => runExport('png')}>
                {busy === 'png' ? <span className="spinner" /> : <Download size={16} />} Download PNG
              </button>
              <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => runExport('pdf')}>
                {busy === 'pdf' ? <span className="spinner" /> : <FileText size={16} />} Download PDF
              </button>
              <button type="button" className="btn btn-secondary" disabled={!!busy} onClick={() => runExport('print')}>
                {busy === 'print' ? <span className="spinner" /> : <Printer size={16} />} Print
              </button>
            </div>
            <p className="field-hint" style={{ marginTop: 10 }}>
              PNG exports at 2140px wide (≈635 DPI). PDF is a true CR80 page at
              85.60 × 53.98 mm. Only the card is exported — never the dashboard.
            </p>
          </div>
        </div>

        {/* ---- record ---- */}
        <div className="stack gap-4">
          <div className="card">
            <div className="card-head"><h2 className="h3">Record</h2></div>
            <div className="card-body">
              <div className="row gap-4" style={{ marginBottom: 16 }}>
                {member.photoUrl ? (
                  <img className="avatar" style={{ width: 64, height: 64 }} src={member.photoUrl} alt="" />
                ) : (
                  <span className="avatar avatar-placeholder" style={{ width: 64, height: 64 }}>
                    <UserRound size={26} />
                  </span>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{member.fullName}</div>
                  <div className="text-muted text-sm">{member.designation}</div>
                </div>
              </div>

              <dl className="detail-list">
                <div><dt>ID number</dt><dd className="text-mono">{member.memberId}</dd></div>
                <div><dt>State</dt><dd>{member.state}</dd></div>
                <div><dt>District</dt><dd>{member.district || '—'}</dd></div>
                <div><dt>Valid from</dt><dd className="text-mono">{formatDate(member.validFrom)}</dd></div>
                <div>
                  <dt>Valid up to</dt>
                  <dd className="text-mono">{formatDate(member.validUntil)}</dd>
                </div>
                <div><dt>Status</dt><dd><StatusBadge status={status} /></dd></div>
                <div><dt>Created</dt><dd>{formatDateLong(member.createdAt)}</dd></div>
                <div><dt>Updated</dt><dd>{formatDateLong(member.updatedAt)}</dd></div>
                {member.revocationReason ? (
                  <div><dt>Revocation reason</dt><dd>{member.revocationReason}</dd></div>
                ) : null}
              </dl>

              <p className="field-hint" style={{ marginTop: 12 }}>
                {describeValidity(member.validUntil)}
              </p>
            </div>
          </div>

          {/* ---- verification link ---- */}
          <div className="card">
            <div className="card-head"><h2 className="h3">Verification</h2></div>
            <div className="card-body">
              <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
                This is the address encoded in the card&rsquo;s QR code. It contains
                no personal data.
              </p>
              <div className="row gap-2">
                <input className="input text-mono text-sm" readOnly value={verifyUrl} />
                <button
                  type="button"
                  className="btn btn-secondary btn-icon"
                  onClick={copyVerifyUrl}
                  aria-label="Copy verification link"
                >
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <a
                  className="btn btn-secondary btn-icon"
                  href={verifyUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Open verification page"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}