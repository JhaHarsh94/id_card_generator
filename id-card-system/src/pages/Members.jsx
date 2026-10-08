import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search,
  UserRound,
  Plus,
  Users,
  ShieldCheck,
  ShieldAlert,
  Clock,
  X,
  ChevronRight,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { listMembers } from '../services/localStore';
import { deriveStatus, summarise, STATUS } from '../utils/status';
import { formatDate, formatDateLong } from '../utils/date';

/**
 * Members
 * ---------------------------------------------------------------------------
 * Search, filter and sort the full member list. Status is always derived at
 * render time from the current date, so the list can never show a stale badge.
 */
export default function Members({ statusFilter = 'all' }) {
  const [members, setMembers] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState(statusFilter);
  const [sort, setSort] = useState({ key: 'createdAt', dir: 'desc' });

  useEffect(() => {
    let alive = true;
    listMembers()
      .then((data) => alive && setMembers(data))
      .catch(() => alive && setError('The member list could not be loaded.'));
    return () => { alive = false; };
  }, []);

  const counts = useMemo(() => summarise(members ?? []), [members]);

  const filtered = useMemo(() => {
    if (!members) return [];
    const q = query.trim().toLowerCase();

    const rows = members.filter((m) => {
      if (filter !== 'all' && deriveStatus(m) !== filter) return false;
      if (!q) return true;
      return (
        String(m.fullName ?? '').toLowerCase().includes(q)
        || String(m.memberId ?? '').toLowerCase().includes(q)
        || String(m.designation ?? '').toLowerCase().includes(q)
        || String(m.state ?? '').toLowerCase().includes(q)
      );
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    return rows.sort((a, b) => {
      const pick = (row) => {
        switch (sort.key) {
          case 'fullName': return String(row.fullName ?? '').toLowerCase();
          case 'memberId': return String(row.memberId ?? '');
          case 'designation': return String(row.designation ?? '').toLowerCase();
          case 'state': return String(row.state ?? '').toLowerCase();
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
  }, [members, query, filter, sort]);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );
  }

  const sortMark = (key) =>
    sort.key === key ? (sort.dir === 'asc' ? '▲' : '▼') : '';

  const FILTERS = [
    { key: 'all', label: 'All', count: counts.total, icon: Users },
    { key: STATUS.ACTIVE, label: 'Active', count: counts.active, icon: ShieldCheck },
    { key: STATUS.EXPIRED, label: 'Expired', count: counts.expired, icon: Clock },
    { key: STATUS.REVOKED, label: 'Revoked', count: counts.revoked, icon: ShieldAlert },
  ];

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Members &amp; ID cards</h1>
          <p className="page-sub">
            {members ? `${counts.total} member${counts.total === 1 ? '' : 's'} on record.` : 'Loading…'}
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/members/new" className="btn btn-primary">
            <Plus size={16} />
            Add new member
          </Link>
        </div>
      </div>

      {/* ---- filters + search ---- */}
      <div className="card">
        <div className="card-body" style={{ paddingBottom: 'var(--sp-4)' }}>
          <div className="row gap-3 wrap" style={{ marginBottom: 'var(--sp-4)' }}>
            {FILTERS.map(({ key, label, count, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`filter-chip ${filter === key ? 'active' : ''}`}
                onClick={() => setFilter(key)}
              >
                <Icon size={15} />
                {label}
                <span className="filter-chip__count">{count ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="row gap-3 wrap">
            <div className="search-input grow">
              <Search size={16} />
              <input
                type="search"
                className="search-input__field"
                placeholder="Search by name, ID number, designation or state…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search members"
              />
              {query ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>

            <select
              className="select"
              style={{ width: 'auto', minWidth: 168 }}
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setSort({ key, dir });
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
          </div>
        </div>
      </div>

      {/* ---- table ---- */}
      <div className="card">
        {error ? (
          <div className="error-state">
            <span className="icon-ring"><ShieldAlert size={24} /></span>
            <p className="h3">{error}</p>
          </div>
        ) : members === null ? (
          <div className="card-body stack gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 44 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="icon-ring"><Users size={24} /></span>
            <p className="h3">No members found</p>
            <p className="text-muted text-sm">
              {query || filter !== 'all'
                ? 'Try a different search or filter.'
                : 'Add your first member to generate an ID card.'}
            </p>
            {!query && filter === 'all' ? (
              <Link to="/members/new" className="btn btn-primary">
                <Plus size={16} /> Add new member
              </Link>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Photo</th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('memberId')}>
                      ID Number {sortMark('memberId')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('fullName')}>
                      Name {sortMark('fullName')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('designation')}>
                      Designation {sortMark('designation')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('state')}>
                      State {sortMark('state')}
                    </button>
                  </th>
                  <th>
                    <button type="button" className="th-sort" onClick={() => toggleSort('validUntil')}>
                      Valid until {sortMark('validUntil')}
                    </button>
                  </th>
                  <th style={{ width: 108 }}>Status</th>
                  <th style={{ width: 118 }}>Created</th>
                  <th style={{ width: 52 }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.photoUrl ? (
                        <img className="avatar" src={m.photoUrl} alt="" />
                      ) : (
                        <span className="avatar avatar-placeholder">
                          <UserRound size={18} />
                        </span>
                      )}
                    </td>
                    <td className="text-mono">
                      <Link to={`/members/${encodeURIComponent(m.memberId)}`}>
                        {m.memberId}
                      </Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                    <td>{m.designation}</td>
                    <td>{m.state}</td>
                    <td className="text-mono">{formatDate(m.validUntil)}</td>
                    <td><StatusBadge status={deriveStatus(m)} /></td>
                    <td className="text-muted text-sm">{formatDateLong(m.createdAt)}</td>
                    <td>
                      <Link
                        to={`/members/${encodeURIComponent(m.memberId)}`}
                        className="btn btn-ghost btn-icon btn-sm"
                        aria-label={`Open ${m.fullName}`}
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}