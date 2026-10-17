import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Download,
  ShieldAlert,
  Users,
  ShieldCheck,
  Clock,
  CalendarClock,
  FileBarChart,
  RotateCcw,
} from 'lucide-react';
import PageHeader from '../components/admin/PageHeader';
import StatusDonut from '../components/charts/StatusDonut';
import TrendBars from '../components/charts/TrendBars';
import BreakdownList from '../components/charts/BreakdownList';
import { getOrganization, listMembers } from '../services/members';
import { deriveStatus, summarise, statusLabel, STATUS } from '../utils/status';
import { formatDate, today } from '../utils/date';
import { recentMonths, tally, monthlyIssuance, daysUntil } from '../utils/aggregate';
import { toCsv, downloadCsv, stamp } from '../utils/csv';

/**
 * Reports
 * ---------------------------------------------------------------------------
 * The register as a set of figures that can be printed and filed: how many
 * cards are valid, where the members are, what has lapsed, and what is about
 * to. Every table is also downloadable as CSV with a UTF-8 BOM, so the
 * Devanagari names open correctly in Excel.
 *
 * Printing is a first-class action here rather than an afterthought - the
 * layout deliberately drops the navigation and the toolbar on paper (see the
 * @media print block in erp.css), and a letterhead with the organisation's own
 * name and registration number is printed above the first table.
 */

const TREND_MONTHS = 12;
const LAPSE_WINDOW_DAYS = 90;

export default function Reports() {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState(0);
  const organization = getOrganization();

  useEffect(() => {
    let alive = true;
    setError('');
    listMembers()
      .then((rows) => alive && setMembers(rows))
      .catch(() => alive && setError('The register could not be loaded.'));
    return () => { alive = false; };
  }, [token]);

  const rows = useMemo(() => members ?? [], [members]);
  const counts = useMemo(() => summarise(rows), [rows]);

  const byState = useMemo(() => tally(rows, (m) => m.state), [rows]);
  const byDistrict = useMemo(() => tally(rows, (m) => m.district), [rows]);
  const byDesignation = useMemo(() => tally(rows, (m) => m.designation), [rows]);

  const trend = useMemo(
    () => monthlyIssuance(rows, recentMonths(TREND_MONTHS)),
    [rows],
  );

  /** Every non-active card, and the active ones falling due inside the window. */
  const lapsed = useMemo(
    () => rows
      .filter((m) => deriveStatus(m) === STATUS.EXPIRED)
      .sort((a, b) => String(a.validUntil).localeCompare(String(b.validUntil))),
    [rows],
  );

  const revocations = useMemo(
    () => rows.filter((m) => deriveStatus(m) === STATUS.REVOKED),
    [rows],
  );

  const lapsing = useMemo(
    () => rows
      .filter((m) => deriveStatus(m) === STATUS.ACTIVE)
      .map((m) => ({ member: m, days: daysUntil(m.validUntil) }))
      .filter(({ days }) => days !== null && days <= LAPSE_WINDOW_DAYS)
      .sort((a, b) => a.days - b.days),
    [rows],
  );

  const share = (value) => (counts.total ? `${Math.round((value / counts.total) * 100)}%` : '—');

  const EXPORT_COLUMNS = [
    { key: 'memberId', label: 'ID Number' },
    { key: 'fullName', label: 'Name' },
    { key: 'designation', label: 'Designation' },
    { key: 'state', label: 'State' },
    { key: 'district', label: 'District' },
    { key: 'validUntil', label: 'Valid until', value: (m) => formatDate(m.validUntil) },
    { key: 'status', label: 'Status', value: (m) => statusLabel(deriveStatus(m)) },
  ];

  const exportPair = (label, list) => {
    const csv = toCsv(list, EXPORT_COLUMNS);
    downloadCsv(`${label}-${stamp()}.csv`, csv);
  };

  const SUMMARY = [
    { label: 'Total members', value: counts.total, icon: Users, accent: 'var(--brand-blue)', bg: 'var(--brand-blue-100)', foot: 'on the register' },
    { label: 'Valid now', value: counts.active, icon: ShieldCheck, accent: 'var(--success)', bg: 'var(--success-bg)', foot: share(counts.active) },
    { label: 'Expired', value: counts.expired, icon: Clock, accent: 'var(--warning)', bg: 'var(--warning-bg)', foot: share(counts.expired) },
    { label: 'Revoked', value: counts.revoked, icon: ShieldAlert, accent: 'var(--danger)', bg: 'var(--danger-bg)', foot: share(counts.revoked) },
    { label: `Due in ${LAPSE_WINDOW_DAYS} days`, value: lapsing.length, icon: CalendarClock, accent: '#7c3aed', bg: '#f3e8ff', foot: 'renewal queue' },
  ];

  const donut = [
    { key: STATUS.ACTIVE, label: 'Valid', value: counts.active, color: 'var(--success)' },
    { key: STATUS.EXPIRED, label: 'Expired', value: counts.expired, color: 'var(--warning)' },
    { key: STATUS.REVOKED, label: 'Revoked', value: counts.revoked, color: 'var(--danger)' },
  ];

  const loading = members === null;

  if (error) {
    return (
      <div className="page">
        <div className="error-state">
          <span className="icon-ring"><ShieldAlert size={24} /></span>
          <p className="h3">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => setToken((t) => t + 1)}>
            <RotateCcw size={16} /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Printed letterhead: on screen the page header already names the page,
          so this is hidden until it reaches paper. */}
      <div className="report-letterhead">
        <p className="report-letterhead__org">{organization.name}</p>
        <p className="report-letterhead__meta">
          {organization.trustNameEn} · Registration {organization.registrationValue}
        </p>
        <p className="report-letterhead__meta">
          Register report generated {formatDate(today())}
        </p>
      </div>

      <PageHeader
        title="Reports"
        sub="Register figures, geographic spread and the renewal queue."
        trail={[{ label: 'Reports' }]}
      >
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={16} /> Print
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => exportPair('register-all', rows)}
          disabled={!rows.length}
        >
          <Download size={16} /> Export register
        </button>
      </PageHeader>

      {/* ---- headline figures ---------------------------------------------- */}
      <div className="kpi-grid">
        {loading
          ? [...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 118 }} />)
          : SUMMARY.map(({ label, value, icon: Icon, accent, bg, foot }) => (
            <div key={label} className="kpi" style={{ '--kpi-accent': accent, '--kpi-bg': bg }}>
              <div className="kpi__top">
                <span className="kpi__icon"><Icon size={19} /></span>
                <span className="kpi__label">{label}</span>
              </div>
              <span className="kpi__value">{value}</span>
              <span className="kpi__foot">{foot}</span>
            </div>
          ))}
      </div>

      {/* ---- status + trend ------------------------------------------------ */}
      <div className="chart-cols">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">Validity summary</h2>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 168 }} />
              : (
                <>
                  <StatusDonut segments={donut} total={counts.total} centerLabel="Cards" />
                  <table className="table report-table" style={{ marginTop: 'var(--sp-5)' }}>
                    <thead>
                      <tr><th>Status</th><th style={{ width: 90 }}>Cards</th><th style={{ width: 80 }}>Share</th></tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Valid', value: counts.active, to: '/admin/members?status=active' },
                        { label: 'Expired', value: counts.expired, to: '/admin/members?status=expired' },
                        { label: 'Revoked', value: counts.revoked, to: '/admin/members?status=revoked' },
                      ].map((r) => (
                        <tr key={r.label}>
                          <td><Link to={r.to}>{r.label}</Link></td>
                          <td className="text-mono">{r.value}</td>
                          <td className="text-muted">{share(r.value)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ fontWeight: 700 }}>Total</td>
                        <td className="text-mono" style={{ fontWeight: 700 }}>{counts.total}</td>
                        <td className="text-muted">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </>
              )}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">Issuance over {TREND_MONTHS} months</h2>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 190 }} />
              : <TrendBars data={trend} color="var(--brand-blue)" />}
          </div>
        </section>
      </div>

      {/* ---- distribution -------------------------------------------------- */}
      <div className="report-grid">
        <section className="card">
          <div className="card-head">
            <h2 className="h3">By state</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm no-print"
              onClick={() => exportPair('by-state', rows)}
              disabled={!rows.length}
            >
              <Download size={14} /> CSV
            </button>
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
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 150 }} />
              : <BreakdownList rows={byDistrict} color="var(--brand-red)" limit={12} emptyLabel="No districts recorded yet" />}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">By designation</h2>
          </div>
          <div className="card-body">
            {loading
              ? <div className="skeleton" style={{ height: 150 }} />
              : <BreakdownList rows={byDesignation} color="var(--ink-700)" emptyLabel="No designations recorded yet" />}
          </div>
        </section>
      </div>

      {/* ---- renewal queue -------------------------------------------------- */}
      <section className="card" style={{ marginTop: 'var(--sp-5)' }}>
        <div className="card-head">
          <h2 className="h3">Renewal queue — due within {LAPSE_WINDOW_DAYS} days</h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm no-print"
            onClick={() => exportPair('renewal-queue', lapsing.map((l) => l.member))}
            disabled={!lapsing.length}
          >
            <Download size={14} /> CSV
          </button>
        </div>
        {loading ? (
          <div className="card-body stack gap-3">
            {[...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: 40 }} />)}
          </div>
        ) : lapsing.length === 0 ? (
          <div className="empty-state">
            <span className="icon-ring"><ShieldCheck size={22} /></span>
            <p className="h3">Nothing due</p>
            <p className="text-muted text-sm">No valid card lapses in the next {LAPSE_WINDOW_DAYS} days.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID Number</th>
                  <th>Name</th>
                  <th>District</th>
                  <th>Valid until</th>
                  <th style={{ width: 120 }}>Days left</th>
                </tr>
              </thead>
              <tbody>
                {lapsing.map(({ member, days }) => (
                  <tr key={member.id}>
                    <td className="text-mono">
                      <Link to={`/admin/members/${encodeURIComponent(member.memberId)}`}>{member.memberId}</Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{member.fullName}</td>
                    <td>{member.district || <span className="text-muted">—</span>}</td>
                    <td className="text-mono">{formatDate(member.validUntil)}</td>
                    <td>
                      <span className={`pill ${days <= 15 ? 'pill--bad' : days <= 45 ? 'pill--warn' : ''}`}>
                        {days} day{days === 1 ? '' : 's'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---- lapsed + revoked ---------------------------------------------- */}
      <div className="report-grid" style={{ marginTop: 'var(--sp-5)' }}>
        <section className="card">
          <div className="card-head">
            <h2 className="h3">Expired cards</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm no-print"
              onClick={() => exportPair('expired', lapsed)}
              disabled={!lapsed.length}
            >
              <Download size={14} /> CSV
            </button>
          </div>
          {loading ? (
            <div className="card-body"><div className="skeleton" style={{ height: 120 }} /></div>
          ) : lapsed.length === 0 ? (
            <div className="empty-state">
              <span className="icon-ring"><ShieldCheck size={22} /></span>
              <p className="h3">None expired</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>ID Number</th><th>Name</th><th>Expired on</th></tr>
                </thead>
                <tbody>
                  {lapsed.slice(0, 12).map((m) => (
                    <tr key={m.id}>
                      <td className="text-mono">
                        <Link to={`/admin/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                      <td className="text-mono">{formatDate(m.validUntil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && lapsed.length > 12 ? (
            <p className="text-muted text-sm card-body">Showing 12 of {lapsed.length}. Export for the full list.</p>
          ) : null}
        </section>

        <section className="card">
          <div className="card-head">
            <h2 className="h3">Revoked cards</h2>
            <button
              type="button"
              className="btn btn-ghost btn-sm no-print"
              onClick={() => exportPair('revoked', revocations)}
              disabled={!revocations.length}
            >
              <Download size={14} /> CSV
            </button>
          </div>
          {loading ? (
            <div className="card-body"><div className="skeleton" style={{ height: 120 }} /></div>
          ) : revocations.length === 0 ? (
            <div className="empty-state">
              <span className="icon-ring"><FileBarChart size={22} /></span>
              <p className="h3">None revoked</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>ID Number</th><th>Name</th><th>District</th></tr>
                </thead>
                <tbody>
                  {revocations.slice(0, 12).map((m) => (
                    <tr key={m.id}>
                      <td className="text-mono">
                        <Link to={`/admin/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                      <td>{m.district || <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
