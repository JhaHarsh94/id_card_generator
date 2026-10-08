import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ScanLine, Search, ExternalLink, ShieldCheck } from 'lucide-react';
import { getMember, listMembers, getOrganization } from '../services/localStore';
import { deriveStatus } from '../utils/status';
import { formatDate } from '../utils/date';
import StatusBadge from '../components/StatusBadge';

/**
 * Verification (admin-side helper)
 * ---------------------------------------------------------------------------
 * A convenience lookup for staff who need to check an ID quickly. It does not
 * grant any access the public /verify/:id page does not - the public page is the
 * authoritative answer, since anyone can reach it by scanning the card.
 */
export default function Verification() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState(null);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState([]);
  const organization = getOrganization();

  // Initial load must be an effect, not a lazy state initializer.
  useEffect(() => {
    let alive = true;
    listMembers().then((rows) => alive && setRecent(rows)).catch(() => {});
    return () => { alive = false; };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    const id = query.trim();
    if (!id || busy) return;

    setBusy(true);
    try {
      const member = await getMember(id);
      setResult(member);
      setSearched(true);
    } finally {
      setBusy(false);
    }
  }

  const status = result ? deriveStatus(result) : null;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="h1">Verification</h1>
          <p className="page-sub">
            Look up any ID number to see its live status. The same information is
            public at <code>/verify/&lt;id&gt;</code>.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit} className="verify-lookup">
            <div className="field grow">
              <label className="label" htmlFor="lookup">ID number</label>
              <input
                id="lookup"
                className="input text-mono"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setResult(null); setSearched(false); }}
                placeholder="e.g. 0095030"
                autoComplete="off"
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy || !query.trim()} style={{ marginTop: 22 }}>
              {busy ? <span className="spinner" /> : <Search size={16} />} Check
            </button>
          </form>

          {searched && !result ? (
            <div className="banner banner-warn" style={{ marginTop: 16 }}>
              <ScanLine size={17} />
              <span>No ID card with that number is on record.</span>
            </div>
          ) : null}

          {result ? (
            <div className="lookup-result">
              <div className="row gap-3 wrap" style={{ marginBottom: 14 }}>
                <StatusBadge status={status} size="lg" />
                <span style={{ fontWeight: 700, fontSize: 17 }}>{result.fullName}</span>
                <span className="text-muted">{result.designation}</span>
              </div>
              <dl className="detail-list">
                <div><dt>ID number</dt><dd className="text-mono">{result.memberId}</dd></div>
                <div><dt>State</dt><dd>{result.state}</dd></div>
                <div><dt>Valid up to</dt><dd className="text-mono">{formatDate(result.validUntil)}</dd></div>
              </dl>
              <div className="row gap-2" style={{ marginTop: 14 }}>
                <Link to={`/members/${encodeURIComponent(result.memberId)}`} className="btn btn-secondary btn-sm">
                  <ShieldCheck size={15} /> Open member record
                </Link>
                <a
                  className="btn btn-secondary btn-sm"
                  href={`/verify/${encodeURIComponent(result.memberId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={15} /> View public page
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {recent.length ? (
        <div className="card">
          <div className="card-head"><h2 className="h3">All IDs</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Designation</th>
                  <th>Valid up to</th><th style={{ width: 110 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td className="text-mono">
                      <Link to={`/members/${encodeURIComponent(m.memberId)}`}>{m.memberId}</Link>
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.fullName}</td>
                    <td>{m.designation}</td>
                    <td className="text-mono text-sm">{formatDate(m.validUntil)}</td>
                    <td><StatusBadge status={deriveStatus(m)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="text-muted text-sm">
        Organisation: {organization.name}.{' '}
        <Link to="/verify/0095030">Open the public verification page</Link>
      </p>
    </div>
  );
}