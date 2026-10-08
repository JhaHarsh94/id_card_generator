import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Clock,
  ShieldAlert,
  Plus,
  Upload,
  IdCard,
  UserRound,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { listMembers } from '../services/localStore';
import { deriveStatus, summarise } from '../utils/status';
import { formatDate, describeValidity } from '../utils/date';

/**
 * Dashboard
 * ---------------------------------------------------------------------------
 * Headline counts, quick actions and the two most useful lists (recently
 * created, and what is about to expire). Charts are deliberately omitted - with
 * four numbers and a table they would be decoration, not information.
 */
export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  // `new Date()` is impure, so the "this month" boundary is captured once when
  // the data arrives rather than being recomputed during every render.
  useEffect(() => {
    let alive = true;
    listMembers()
      .then((rows) => {
        if (!alive) return;
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        setData({
          members: rows,
          createdThisMonth: rows.filter((row) => {
            const d = new Date(row.createdAt);
            return !Number.isNaN(d.getTime())
              && d.getFullYear() === year
              && d.getMonth() === month;
          }).length,
        });
      })
      .catch(() => alive && setError('Dashboard data could not be loaded.'));
    return () => { alive = false; };
  }, []);

  const members = data?.members ?? null;
  const counts = useMemo(() => summarise(members ?? []), [members]);
  const thisMonth = data?.createdThisMonth ?? 0;

  const recent = useMemo(
    () => (members ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6),
    [members],
  );

  const expiring = useMemo(
    () => (members ?? [])
      .filter((m) => deriveStatus(m) === 'active')
      .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil)))
      .slice(0, 5),
    [members],
  );

  const STATS = [
    { label: 'Total members', value: counts.total, icon: Users, accent: 'var(--brand-blue)', bg: 'var(--brand-blue-100)' },
    { label: 'Active IDs', value: counts.active, icon: ShieldCheck, accent: 'var(--success)', bg: 'var(--success-bg)' },
    { label: 'Expired IDs', value: counts.expired, icon: Clock, accent: 'var(--warning)', bg: 'var(--warning-bg)' },
    { label: 'Revoked IDs', value: counts.revoked, icon: ShieldAlert, accent: 'var(--danger)', bg: 'var(--danger-bg)' },
    { label: 'Created this month', value: thisMonth, icon: Sparkles, accent: 'var(--brand-red)', bg: 'var(--brand-red-100)' },
  ];

  if (error) {
    return (
      <div className="page">
        <div className="error-state">
          <span className="icon-ring"><ShieldAlert size={24} /></span>
          <p className="h3">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Dashboard</h1>
          <p className="page-sub">
            Manage members, generate ID cards and keep track of validity.
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/members/new" className="btn btn-primary">
            <Plus size={16} /> Add member
          </Link>
        </div>
      </div>

      {/* ---- stat cards ---- */}
      {members === null ? (
        <div className="stat-grid">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 88 }} />
          ))}
        </div>
      ) : (
        <div className="stat-grid">
          {STATS.map(({ label, value, icon: Icon, accent, bg }) => (
            <div
              key={label}
              className="stat"
              style={{ '--stat-accent': accent, '--stat-icon-bg': bg }}
            >
              <span className="stat__icon"><Icon size={20} /></span>
              <span>
                <span className="stat__label">{label}</span>
                <span className="stat__value">{value}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ---- quick actions ---- */}
      <section className="card">
        <div className="card-head">
          <h2 className="h3">Quick actions</h2>
        </div>
        <div className="card-body">
          <div className="row gap-3 wrap">
            <Link to="/members/new" className="btn btn-primary">
              <Plus size={16} /> Add member
            </Link>
            <Link to="/members?import=1" className="btn btn-secondary">
              <Upload size={16} /> Import members
            </Link>
            <Link to="/members?status=active" className="btn btn-secondary">
              <IdCard size={16} /> Generate IDs
            </Link>
          </div>
          <p className="field-hint" style={{ marginTop: 12 }}>
            Bulk CSV/XLSX import and bulk generation arrive in Phases 13&ndash;14.
          </p>
        </div>
      </section>

      {/* ---- tables ---- */}
      <div className="dash-cols">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">Recently created</h2>
            <Link to="/members" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {members === null ? (
            <div className="card-body stack gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40 }} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="empty-state">
              <span className="icon-ring"><Users size={22} /></span>
              <p className="h3">No members yet</p>
              <Link to="/members/new" className="btn btn-primary btn-sm">
                <Plus size={15} /> Add your first member
              </Link>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>ID</th>
                    <th>Valid until</th>
                    <th style={{ width: 100 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <div className="row gap-3">
                          {m.photoUrl ? (
                            <img className="avatar" src={m.photoUrl} alt="" />
                          ) : (
                            <span className="avatar avatar-placeholder"><UserRound size={17} /></span>
                          )}
                          <span className="grow">
                            <span style={{ fontWeight: 600, display: 'block' }}>{m.fullName}</span>
                            <span className="text-muted text-sm">{m.designation}</span>
                          </span>
                        </div>
                      </td>
                      <td className="text-mono">
                        <Link to={`/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
                      </td>
                      <td className="text-mono text-sm">{formatDate(m.validUntil)}</td>
                      <td><StatusBadge status={deriveStatus(m)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">Expiring soonest</h2>
            <Link to="/members?status=active" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {members === null ? (
            <div className="card-body stack gap-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 40 }} />
              ))}
            </div>
          ) : expiring.length === 0 ? (
            <div className="empty-state">
              <span className="icon-ring"><ShieldCheck size={22} /></span>
              <p className="h3">Nothing expiring</p>
              <p className="text-muted text-sm">All active IDs are comfortably in date.</p>
            </div>
          ) : (
            <ul className="expiry-list">
              {expiring.map((m) => (
                <li key={m.id}>
                  <Link to={`/members/${encodeURIComponent(m.memberId)}`} className="expiry-row">
                    <span className="grow">
                      <span style={{ fontWeight: 600, display: 'block' }}>{m.fullName}</span>
                      <span className="text-muted text-sm">
                        {m.memberId} · {m.state}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="text-mono" style={{ display: 'block', fontWeight: 600 }}>
                        {formatDate(m.validUntil)}
                      </span>
                      <span className="text-muted text-sm">
                        {describeValidity(m.validUntil)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}