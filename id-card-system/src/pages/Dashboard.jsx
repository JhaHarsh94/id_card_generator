import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ShieldCheck,
  Clock,
  ShieldAlert,
  Plus,
  IdCard,
  UserRound,
  ArrowRight,
  Sparkles,
  CalendarClock,
  TrendingUp,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/admin/PageHeader';
import StatusDonut from '../components/charts/StatusDonut';
import TrendBars from '../components/charts/TrendBars';
import BreakdownList from '../components/charts/BreakdownList';
import useCountUp from '../hooks/useCountUp';
import { listMembers } from '../services/members';
import { deriveStatus, summarise, STATUS } from '../utils/status';
import { formatDate, describeValidity } from '../utils/date';
import { recentMonths, tally, monthlyIssuance } from '../utils/aggregate';

/**
 * Dashboard
 * ---------------------------------------------------------------------------
 * The register at a glance: how many cards exist and in what state, how
 * issuance is trending, where the members are, and the two lists that need
 * action (just added, about to lapse).
 *
 * Charts are drawn from the same `listMembers()` result the tables use, so
 * every number on this screen is consistent with every other number on it -
 * there is no second, pre-aggregated source that can drift.
 */

const MONTHS_BACK = 6;

export default function Dashboard() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    listMembers()
      .then((rows) => alive && setMembers(rows))
      .catch(() => alive && setError('Dashboard data could not be loaded.'));
    return () => { alive = false; };
  }, []);

  const rows = members ?? [];
  const counts = useMemo(() => summarise(rows), [members]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Now" is captured once per data load. Reading `new Date()` inside each memo
  // would recompute the trend window on every render and make the chart jitter
  // across a month boundary while the page is open.
  const now = useMemo(() => new Date(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const thisMonth = useMemo(() => {
    return rows.filter((row) => {
      const d = new Date(row.createdAt);
      return !Number.isNaN(d.getTime())
        && d.getFullYear() === now.getFullYear()
        && d.getMonth() === now.getMonth();
    }).length;
  }, [rows, now]);

  /** Cards issued per month over the trend window. */
  const trend = useMemo(
    () => monthlyIssuance(rows, recentMonths(MONTHS_BACK, now)),
    [rows, now],
  );

  /** Active IDs whose validity ends within 30 days - the renewal queue. */
  const lapsing = useMemo(() => {
    const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
    return rows
      .filter((m) => deriveStatus(m) === STATUS.ACTIVE)
      .filter((m) => {
        const d = new Date(`${m.validUntil}T00:00:00`);
        return !Number.isNaN(d.getTime()) && d <= limit;
      })
      .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil)));
  }, [rows, now]);

  const recent = useMemo(
    () => rows.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 6),
    [rows],
  );

  const expiring = useMemo(
    () => rows
      .filter((m) => deriveStatus(m) === STATUS.ACTIVE)
      .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil)))
      .slice(0, 5),
    [rows],
  );

  const byState = useMemo(
    () => tally(rows, (m) => m.state).map((r) => ({
      ...r,
      to: `/admin/members?q=${encodeURIComponent(r.label)}`,
    })),
    [rows],
  );

  const byDistrict = useMemo(
    () => tally(rows, (m) => m.district).map((r) => ({
      ...r,
      to: `/admin/members?q=${encodeURIComponent(r.label)}`,
    })),
    [rows],
  );

  const activeShare = counts.total ? Math.round((counts.active / counts.total) * 100) : 0;

  const totalCount = useCountUp(counts.total);
  const activeCount = useCountUp(counts.active);
  const thisMonthCount = useCountUp(thisMonth);
  const lapsingCount = useCountUp(lapsing.length);

  const KPIS = [
    {
      label: 'Active IDs',
      value: counts.active,
      icon: ShieldCheck,
      accent: 'var(--success)',
      bg: 'var(--success-bg)',
      foot: counts.total ? `${activeShare}% of register` : '—',
      tone: 'up',
    },
    {
      label: 'Expired IDs',
      value: counts.expired,
      icon: Clock,
      accent: 'var(--warning)',
      bg: 'var(--warning-bg)',
      foot: counts.expired ? 'need renewal' : 'none to renew',
      tone: counts.expired ? 'warn' : '',
    },
    {
      label: 'Revoked IDs',
      value: counts.revoked,
      icon: ShieldAlert,
      accent: 'var(--danger)',
      bg: 'var(--danger-bg)',
      foot: counts.revoked ? 'withdrawn' : 'none withdrawn',
      tone: counts.revoked ? 'bad' : '',
    },
    {
      label: 'Issued this month',
      value: thisMonth,
      icon: Sparkles,
      accent: 'var(--brand-red)',
      bg: 'var(--brand-red-100)',
      foot: now.toLocaleString('en-IN', { month: 'long' }),
    },
    {
      label: 'Lapsing in 30 days',
      value: lapsing.length,
      icon: CalendarClock,
      accent: '#7c3aed',
      bg: '#f3e8ff',
      foot: lapsing.length ? 'renew now' : 'all in date',
      tone: lapsing.length ? 'warn' : '',
    },
  ];

  const donut = [
    { key: STATUS.ACTIVE, label: 'Active', value: counts.active, color: 'var(--success)' },
    { key: STATUS.EXPIRED, label: 'Expired', value: counts.expired, color: 'var(--warning)' },
    { key: STATUS.REVOKED, label: 'Revoked', value: counts.revoked, color: 'var(--danger)' },
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

  const loading = members === null;

  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        sub="Members, ID cards and validity at a glance."
      >
        <Link to="/admin/members/new" className="btn btn-primary">
          <Plus size={16} /> Add member
        </Link>
      </PageHeader>

      {/* ---- headline ------------------------------------------------------ */}
      {loading ? (
        <div className="skeleton" style={{ height: 176, marginBottom: 'var(--sp-5)' }} />
      ) : (
        <section className="dash-hero">
          <div className="dash-hero__main">
            <p className="dash-hero__label">Total members on the register</p>
            <p className="dash-hero__value">{totalCount}</p>
            <p className="dash-hero__sub">
              {counts.total === 0
                ? 'No members yet - add the first one to get started.'
                : `${activeShare}% of them hold an active ID card.`}
            </p>
            <div className="dash-hero__bar" aria-hidden="true">
              <span
                className="dash-hero__fill"
                style={{ width: `${counts.total ? activeShare : 0}%` }}
              />
            </div>
          </div>

          <div className="dash-hero__stats">
            <Link to="/admin/members?status=active" className="dash-stat">
              <span className="dash-stat__icon"><ShieldCheck size={16} /></span>
              <span className="dash-stat__value">{activeCount}</span>
              <span className="dash-stat__label">Active</span>
            </Link>
            <Link to="/admin/members" className="dash-stat">
              <span className="dash-stat__icon"><Sparkles size={16} /></span>
              <span className="dash-stat__value">{thisMonthCount}</span>
              <span className="dash-stat__label">This month</span>
            </Link>
            <Link to="/admin/members?status=active" className="dash-stat">
              <span className="dash-stat__icon"><CalendarClock size={16} /></span>
              <span className="dash-stat__value">{lapsingCount}</span>
              <span className="dash-stat__label">Renew soon</span>
            </Link>
            <Link to="/admin/reports" className="dash-stat dash-stat--action">
              <span className="dash-stat__icon"><TrendingUp size={16} /></span>
              <span className="dash-stat__label">View reports</span>
              <ArrowRight size={15} className="dash-stat__arrow" />
            </Link>
          </div>
        </section>
      )}

      {/* ---- KPI rail ------------------------------------------------------ */}
      <div className="kpi-grid">
        {loading
          ? [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 118 }} />)
          : KPIS.map(({ label, value, icon: Icon, accent, bg, foot, tone }) => (
            <div
              key={label}
              className="kpi"
              style={{ '--kpi-accent': accent, '--kpi-bg': bg }}
            >
              <div className="kpi__top">
                <span className="kpi__icon"><Icon size={19} /></span>
                <span className="kpi__label">{label}</span>
              </div>
              <span className="kpi__value">{value}</span>
              <span className={`kpi__foot ${tone ? `kpi__foot--${tone}` : ''}`}>{foot}</span>
            </div>
          ))}
      </div>

      {/* ---- charts -------------------------------------------------------- */}
      <div className="chart-cols">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">Status breakdown</h2>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 168 }} />
              : <StatusDonut segments={donut} total={counts.total} centerLabel="Cards" />}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">Issuance trend</h2>
            <span className="text-muted text-sm">Last {MONTHS_BACK} months</span>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 190 }} />
              : <TrendBars data={trend} color="var(--brand-blue)" />}
          </div>
        </section>
      </div>

      {/* ---- geography ----------------------------------------------------- */}
      <div className="chart-cols chart-cols--halves">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">By state</h2>
            <Link to="/admin/reports" className="btn btn-ghost btn-sm">
              Reports <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 150 }} />
              : <BreakdownList rows={byState} emptyLabel="No states recorded yet" />}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">By district</h2>
            <Link to="/admin/reports" className="btn btn-ghost btn-sm">
              Reports <ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 150 }} />
              : <BreakdownList rows={byDistrict} color="var(--brand-red)" emptyLabel="No districts recorded yet" />}
          </div>
        </section>
      </div>

      {/* ---- action lists -------------------------------------------------- */}
      <div className="dash-cols">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">Recently created</h2>
            <Link to="/admin/members" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="card-body stack gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
            </div>
          ) : recent.length === 0 ? (
            <div className="empty-state">
              <span className="icon-ring"><Users size={22} /></span>
              <p className="h3">No members yet</p>
              <Link to="/admin/members/new" className="btn btn-primary btn-sm">
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
                        <Link to={`/admin/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
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
            <Link to="/admin/members?status=active" className="btn btn-ghost btn-sm">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          {loading ? (
            <div className="card-body stack gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
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
                  <Link to={`/admin/members/${encodeURIComponent(m.memberId)}`} className="expiry-row">
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

      {/* ---- quick actions ------------------------------------------------- */}
      <section className="card" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="card-head">
          <h2 className="h3">Quick actions</h2>
        </div>
        <div className="card-body">
          <div className="row gap-3 wrap">
            <Link to="/admin/members/new" className="btn btn-primary">
              <Plus size={16} /> Add member
            </Link>
            <Link to="/admin/members?status=active" className="btn btn-secondary">
              <IdCard size={16} /> Active IDs
            </Link>
            <Link to="/admin/reports" className="btn btn-secondary">
              <ArrowRight size={16} /> Reports
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
