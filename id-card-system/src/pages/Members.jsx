import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Search,
  UserRound,
  Plus,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  X,
  Download,
  Eye,
  Pencil,
  Ban,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import PageHeader from '../components/admin/PageHeader';
import Pagination from '../components/admin/Pagination';
import { listMembers, revokeMember } from '../services/members';
import { deriveStatus, summarise, statusShortLabel, STATUS } from '../utils/status';
import { formatDate } from '../utils/date';
import { toCsv, downloadCsv, stamp } from '../utils/csv';

/**
 * Members
 * ---------------------------------------------------------------------------
 * The register: search, filter, sort, page and export the member list.
 *
 * All view state lives in the URL (?q=&status=&sort=&dir=&page=&size=) rather
 * than in component state. That is what lets the toolbar search on any admin
 * screen jump straight into a filtered list, lets a "By district" click on the
 * dashboard become a real query, and makes the browser Back button undo a
 * filter instead of leaving the page.
 *
 * Status is never stored - it is derived from today's date at render time, so
 * a row can never show a stale badge.
 */

const PAGE_SIZES = [10, 25, 50, 100];
const DEFAULT_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/** Columns offered in the CSV export, in order. */
const EXPORT_COLUMNS = [
  { key: 'memberId', label: 'ID Number' },
  { key: 'fullName', label: 'Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'state', label: 'State' },
  { key: 'district', label: 'District' },
  { key: 'validFrom', label: 'Valid from', value: (m) => formatDate(m.validFrom) },
  { key: 'validUntil', label: 'Valid until', value: (m) => formatDate(m.validUntil) },
  { key: 'status', label: 'Status', value: (m) => statusShortLabel(deriveStatus(m)) },
  { key: 'createdAt', label: 'Created', value: (m) => formatDate(m.createdAt) },
];

export default function Members() {
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const statusParam = params.get('status') ?? 'all';
  const sortKey = params.get('sort') ?? 'createdAt';
  const sortDir = params.get('dir') === 'asc' ? 'asc' : 'desc';
  const rawSize = Number.parseInt(params.get('size') ?? '', 10);
  const pageSize = PAGE_SIZES.includes(rawSize) ? rawSize : DEFAULT_SIZE;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState(0);
  const [term, setTerm] = useState(q);
  const [selected, setSelected] = useState(() => new Set());
  const headCheck = useRef(null);

  /**
   * Merge keys into the query string. A null/empty value removes the key, which
   * keeps the URL free of `status=all&q=` noise and makes "is this filtered?"
   * a simple presence check.
   */
  function patch(next) {
    setParams((prev) => {
      const p = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === undefined || value === '') p.delete(key);
        else p.set(key, String(value));
      }
      return p;
    }, { replace: true });
  }

  useEffect(() => {
    let alive = true;
    setError('');
    listMembers()
      .then((rows) => alive && setMembers(rows))
      .catch(() => alive && setError('The member list could not be loaded.'));
    return () => { alive = false; };
  }, [token]);

  // A term arriving from elsewhere (the toolbar search) must replace whatever is
  // in the box. Typing does not trigger this, because the term only changes here
  // once it has already been committed to the URL.
  useEffect(() => { setTerm(q); }, [q]);

  // Typing is debounced before it reaches the URL: pushing a history entry per
  // keystroke would fill the Back stack and re-filter on every character.
  useEffect(() => {
    const id = setTimeout(() => {
      const next = term.trim();
      if (next === q) return;
      setParams((prev) => {
        const p = new URLSearchParams(prev);
        if (next) p.set('q', next); else p.delete('q');
        p.delete('page');
        return p;
      }, { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
  }, [term, q, setParams]);

  // A changed result set invalidates a row selection carried over from the
  // previous filter.
  useEffect(() => { setSelected(new Set()); }, [q, statusParam]);

  const counts = useMemo(() => summarise(members ?? []), [members]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const needle = q.trim().toLowerCase();

    const rows = members.filter((m) => {
      if (statusParam !== 'all' && deriveStatus(m) !== statusParam) return false;
      if (!needle) return true;
      return (
        String(m.fullName ?? '').toLowerCase().includes(needle)
        || String(m.memberId ?? '').toLowerCase().includes(needle)
        || String(m.designation ?? '').toLowerCase().includes(needle)
        || String(m.state ?? '').toLowerCase().includes(needle)
        || String(m.district ?? '').toLowerCase().includes(needle)
      );
    });

    const dir = sortDir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const pick = (row) => {
        switch (sortKey) {
          case 'fullName': return String(row.fullName ?? '').toLowerCase();
          case 'memberId': return String(row.memberId ?? '');
          case 'designation': return String(row.designation ?? '').toLowerCase();
          case 'state': return String(row.state ?? '').toLowerCase();
          case 'district': return String(row.district ?? '').toLowerCase();
          case 'validUntil': return String(row.validUntil ?? '');
          default: return String(row.createdAt ?? '');
        }
      };
      const av = pick(a);
      const bv = pick(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [members, q, statusParam, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const allOnPage = pageRows.length > 0 && pageRows.every((m) => selected.has(m.id));
  const someSelected = selected.size > 0;

  // The native checkbox has no attribute for the "some but not all" state; it
  // has to be assigned imperatively.
  useEffect(() => {
    if (headCheck.current) headCheck.current.indeterminate = someSelected && !allOnPage;
  }, [someSelected, allOnPage]);

  function toggleSort(key) {
    if (sortKey === key) {
      patch({ sort: key, dir: sortDir === 'asc' ? 'desc' : 'asc', page: null });
    } else {
      patch({ sort: key, dir: 'asc', page: null });
    }
  }

  const sortMark = (key) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  function toggleRow(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPage) pageRows.forEach((m) => next.delete(m.id));
      else pageRows.forEach((m) => next.add(m.id));
      return next;
    });
  }

  function exportRows(rows, filename) {
    if (!rows.length) return;
    downloadCsv(`${filename}-${stamp()}.csv`, toCsv(rows, EXPORT_COLUMNS));
  }

  async function bulkRevoke() {
    const chosen = filtered.filter((m) => selected.has(m.id));
    if (!chosen.length) return;
    const ok = window.confirm(
      `Revoke ${chosen.length} ID card${chosen.length === 1 ? '' : 's'}?\n\n`
      + 'The card stops verifying immediately. This can be undone by editing the member.',
    );
    if (!ok) return;

    setBusy(true);
    try {
      await Promise.all(chosen.map((m) => revokeMember(m.id, 'Bulk revocation from the members list')));
      setSelected(new Set());
      setToken((t) => t + 1);
    } catch {
      setError('Some cards could not be revoked. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const FILTERS = [
    { key: 'all', label: 'All', count: counts.total, icon: Users },
    { key: STATUS.ACTIVE, label: 'Active', count: counts.active, icon: ShieldCheck },
    { key: STATUS.EXPIRED, label: 'Expired', count: counts.expired, icon: Clock },
    { key: STATUS.REVOKED, label: 'Revoked', count: counts.revoked, icon: ShieldAlert },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Members &amp; ID cards"
        sub={members ? `${counts.total} member${counts.total === 1 ? '' : 's'} on record.` : 'Loading…'}
        trail={[{ label: 'Members' }]}
      >
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => exportRows(filtered, 'members')}
          disabled={!filtered.length}
        >
          <Download size={16} /> Export CSV
        </button>
        <Link to="/admin/members/new" className="btn btn-primary">
          <Plus size={16} /> Add new member
        </Link>
      </PageHeader>

      <div className="card">
        {/* ---- controls ---------------------------------------------------- */}
        <div className="toolbar">
          <div className="search-input toolbar__grow">
            <Search size={16} />
            <input
              type="search"
              className="search-input__field"
              placeholder="Search name, ID, designation, state or district…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              aria-label="Search members"
            />
            {term ? (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setTerm('')}
                aria-label="Clear search"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          <div className="toolbar__right">
            <label className="pager__size">
              <span>Sort</span>
              <select
                className="select select-sm"
                value={`${sortKey}:${sortDir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(':');
                  patch({ sort: key, dir, page: null });
                }}
                aria-label="Sort members"
              >
                <option value="createdAt:desc">Newest first</option>
                <option value="createdAt:asc">Oldest first</option>
                <option value="fullName:asc">Name A–Z</option>
                <option value="fullName:desc">Name Z–A</option>
                <option value="memberId:asc">ID ascending</option>
                <option value="memberId:desc">ID descending</option>
                <option value="validUntil:asc">Expiring soonest</option>
                <option value="validUntil:desc">Expiring latest</option>
              </select>
            </label>
          </div>
        </div>

        <div className="toolbar">
          {FILTERS.map(({ key, label, count, icon: Icon }) => (
            <button
              key={key}
              type="button"
              className={`filter-chip ${statusParam === key ? 'active' : ''}`}
              onClick={() => patch({ status: key === 'all' ? null : key, page: null })}
            >
              <Icon size={15} />
              {label}
              <span className="filter-chip__count">{count ?? 0}</span>
            </button>
          ))}
          <div className="toolbar__right">
            <span className="text-muted text-sm">
              {q || statusParam !== 'all'
                ? `${filtered.length} matching`
                : `${filtered.length} total`}
            </span>
          </div>
        </div>

        {/* ---- selection actions ------------------------------------------- */}
        {someSelected ? (
          <div className="bulkbar">
            <span className="bulkbar__count">{selected.size}</span> selected
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => exportRows(filtered.filter((m) => selected.has(m.id)), 'members-selected')}
            >
              <Download size={15} /> Export
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={bulkRevoke}
              disabled={busy}
            >
              <Ban size={15} /> Revoke
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        ) : null}

        {/* ---- table ------------------------------------------------------- */}
        {error ? (
          <div className="error-state">
            <span className="icon-ring"><ShieldAlert size={24} /></span>
            <p className="h3">{error}</p>
            <button type="button" className="btn btn-primary" onClick={() => setToken((t) => t + 1)}>
              <RotateCcw size={16} /> Try again
            </button>
          </div>
        ) : members === null ? (
          <div className="card-body stack gap-3">
            {[...Array(5)].map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="icon-ring"><Users size={24} /></span>
            <p className="h3">No members found</p>
            <p className="text-muted text-sm">
              {q || statusParam !== 'all'
                ? 'Try a different search or filter.'
                : 'Add your first member to generate an ID card.'}
            </p>
            {!q && statusParam === 'all' ? (
              <Link to="/admin/members/new" className="btn btn-primary">
                <Plus size={16} /> Add new member
              </Link>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => patch({ q: null, status: null, page: null })}
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="col-check">
                      <input
                        ref={headCheck}
                        type="checkbox"
                        checked={allOnPage}
                        onChange={togglePage}
                        aria-label="Select all rows on this page"
                      />
                    </th>
                    <th style={{ width: 56 }}>Photo</th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('memberId')}>
                        ID Number{sortMark('memberId')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('fullName')}>
                        Name{sortMark('fullName')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('designation')}>
                        Designation{sortMark('designation')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('state')}>
                        State{sortMark('state')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('district')}>
                        District{sortMark('district')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="th-sort" onClick={() => toggleSort('validUntil')}>
                        Valid until{sortMark('validUntil')}
                      </button>
                    </th>
                    <th style={{ width: 108 }}>Status</th>
                    <th className="col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((m) => (
                    <tr key={m.id} className={selected.has(m.id) ? 'is-selected' : ''}>
                      <td className="col-check">
                        <input
                          type="checkbox"
                          checked={selected.has(m.id)}
                          onChange={() => toggleRow(m.id)}
                          aria-label={`Select ${m.fullName}`}
                        />
                      </td>
                      <td>
                        {m.photoUrl ? (
                          <img className="avatar" src={m.photoUrl} alt="" />
                        ) : (
                          <span className="avatar avatar-placeholder"><UserRound size={18} /></span>
                        )}
                      </td>
                      <td className="text-mono">
                        <Link to={`/admin/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
                      </td>
                      <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                      <td>{m.designation}</td>
                      <td>{m.state}</td>
                      <td>{m.district || <span className="text-muted">—</span>}</td>
                      <td className="text-mono">{formatDate(m.validUntil)}</td>
                      <td><StatusBadge status={deriveStatus(m)} /></td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <Link
                            to={`/admin/members/${encodeURIComponent(m.memberId)}`}
                            className="btn btn-ghost btn-icon btn-sm"
                            title="View card"
                            aria-label={`View ${m.fullName}`}
                          >
                            <Eye size={15} />
                          </Link>
                          <Link
                            to={`/admin/members/${encodeURIComponent(m.memberId)}/edit`}
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Edit member"
                            aria-label={`Edit ${m.fullName}`}
                          >
                            <Pencil size={15} />
                          </Link>
                          <a
                            href={`/verify/${encodeURIComponent(m.memberId)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost btn-icon btn-sm"
                            title="Open public verification"
                            aria-label={`Verify ${m.fullName}`}
                          >
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              page={safePage}
              pageCount={pageCount}
              pageSize={pageSize}
              total={filtered.length}
              onPage={(p) => patch({ page: p })}
              onPageSize={(n) => patch({ size: n, page: null })}
              pageSizes={PAGE_SIZES}
            />
          </>
        )}
      </div>
    </div>
  );
}
