import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShieldCheck,
  Clock,
  ShieldAlert,
  ScanLine,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { summarise, STATUS } from '../utils/status';
import { getOrganization, listMembers } from '../services/members';
import { useAuth } from '../context/auth-context';
import '../styles/dashboard.css';
import '../styles/erp.css';

/**
 * AdminLayout
 * ---------------------------------------------------------------------------
 * The application shell: a fixed sidebar of modules, a toolbar across the top,
 * and the routed page in between.
 *
 * Every path here is absolute under /admin. They used to be written as bare
 * /members, /settings, /verification and relied on redirects to reach the real
 * route - which meant the "Dashboard" entry, which pointed at "/", opened the
 * public card form once the landing page took over the root, and the status
 * links lost their ?status= filter because a <Navigate> rewrite drops the
 * query string. Linking to the real path removes both failures.
 *
 * Counts are derived live from the member list so the badge beside "Active IDs"
 * cannot disagree with the table it links to.
 */

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/members', label: 'Members', icon: Users, end: true },
  { to: '/admin/members/new', label: 'Add member', icon: UserPlus, end: true },
];

const STATUS_NAV = [
  { key: STATUS.ACTIVE, label: 'Active IDs', icon: ShieldCheck, to: '/admin/members?status=active' },
  { key: STATUS.EXPIRED, label: 'Expired IDs', icon: Clock, to: '/admin/members?status=expired' },
  { key: STATUS.REVOKED, label: 'Revoked IDs', icon: ShieldAlert, to: '/admin/members?status=revoked' },
];

const NAV_BOTTOM = [
  { to: '/admin/verification', label: 'Verification', icon: ScanLine },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

/**
 * A human label for the page currently on screen, used by the toolbar
 * breadcrumb and the dropdown. Long dynamic segments (a member uuid, an ID
 * number) fall back to a generic word rather than being printed raw.
 */
function crumbFor(pathname) {
  if (pathname === '/admin') return [];
  if (pathname === '/admin/members') return [{ label: 'Members' }];
  if (pathname === '/admin/members/new') {
    return [{ label: 'Members', to: '/admin/members' }, { label: 'Add member' }];
  }
  if (pathname.startsWith('/admin/members/') && pathname.endsWith('/edit')) {
    return [{ label: 'Members', to: '/admin/members' }, { label: 'Edit member' }];
  }
  if (pathname.startsWith('/admin/members/')) {
    return [{ label: 'Members', to: '/admin/members' }, { label: 'Member card' }];
  }
  if (pathname === '/admin/verification') return [{ label: 'Verification' }];
  if (pathname === '/admin/reports') return [{ label: 'Reports' }];
  if (pathname === '/admin/settings') return [{ label: 'Settings' }];
  return [];
}

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const [menu, setMenu] = useState(false);
  const [term, setTerm] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const organization = getOrganization();
  const { user, logout } = useAuth();
  const menuRef = useRef(null);

  const crumb = crumbFor(location.pathname);
  const pageLabel = crumb.length ? crumb[crumb.length - 1].label : 'Dashboard';

  // The mobile drawer is dismissed on link activation rather than in an effect
  // on location, which would cause an extra render pass on every navigation.
  const closeDrawer = () => setOpen(false);

  useEffect(() => {
    let alive = true;
    listMembers()
      .then((rows) => alive && setCounts(summarise(rows)))
      .catch(() => {});
    return () => { alive = false; };
  }, [location.pathname, location.search]);

  // Close the user menu on an outside click or Escape. Listening only while the
  // menu is open keeps two global listeners off the page for its whole life.
  useEffect(() => {
    if (!menu) return undefined;
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target)) setMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  const initial = (user?.name ?? organization.name ?? 'A')?.[0]?.toUpperCase() ?? 'A';

  /**
   * The toolbar search is a jump-to-the-register box, not a results list: it
   * hands the term to the members page through the URL, so the result set is
   * linkable and the back button behaves.
   */
  function submitSearch(event) {
    event.preventDefault();
    const q = term.trim();
    navigate(q ? `/admin/members?q=${encodeURIComponent(q)}` : '/admin/members');
    setTerm('');
    setOpen(false);
  }

  return (
    <div className="admin">
      {/* ---- mobile scrim ---- */}
      <div
        className={`sidebar__scrim ${open ? 'open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* ---- sidebar ---- */}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar__brand">
          {organization.logoUrl ? (
            <img className="sidebar__logo" src={organization.logoUrl} alt="" />
          ) : (
            <span className="sidebar__logo" />
          )}
          <span className="sidebar__org">
            <span className="sidebar__org-name">{organization.name}</span>
            <span className="sidebar__org-sub">ID Card System</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon sidebar-toggle"
            style={{ marginLeft: 'auto', color: '#fff' }}
            onClick={() => setOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          <span className="sidebar__group-label">Main</span>
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="navlink" onClick={closeDrawer}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}

          <span className="sidebar__group-label">ID Status</span>
          {STATUS_NAV.map(({ key, label, icon: Icon, to }) => (
            <NavLink key={key} to={to} className="navlink" onClick={closeDrawer}>
              <Icon size={17} />
              {label}
              {counts ? <span className="navlink__count">{counts[key]}</span> : null}
            </NavLink>
          ))}

          <span className="sidebar__group-label">System</span>
          {NAV_BOTTOM.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="navlink" onClick={closeDrawer}>
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <span className="sidebar__user-avatar">{initial}</span>
            <span className="sidebar__org grow">
              <span className="sidebar__org-name">{user?.name ?? 'Administrator'}</span>
              <span className="sidebar__org-sub">{user?.email ?? ''}</span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-icon"
              style={{ color: 'rgba(255,255,255,.75)' }}
              aria-label="Log out"
              title="Log out"
              onClick={async () => {
                await logout();
                navigate('/login', { replace: true });
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {/* ---- main ---- */}
      <div className="admin__main">
        <header className="admin__header">
          <div className="admin__header-main">
            <button
              type="button"
              className="btn btn-ghost btn-icon sidebar-toggle"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>

            <nav className="crumbs" aria-label="Breadcrumb">
              <NavLink to="/admin" className="crumbs__link" end>Dashboard</NavLink>
              {crumb.map((c, i) => {
                const last = i === crumb.length - 1;
                return (
                  <span className="crumbs__item" key={`${c.label}-${i}`}>
                    <span className="crumbs__sep" aria-hidden="true">/</span>
                    {last || !c.to ? (
                      <span className="crumbs__current" aria-current="page">{c.label}</span>
                    ) : (
                      <NavLink to={c.to} className="crumbs__link">{c.label}</NavLink>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          <div className="admin__header-tools">
            <form className="admin-search" onSubmit={submitSearch} role="search">
              <Search size={15} className="admin-search__icon" aria-hidden="true" />
              <input
                type="search"
                className="admin-search__field"
                placeholder="Search members…"
                aria-label="Search members"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
              />
            </form>

            <a
              className="admin__site-link"
              href="/"
              target="_blank"
              rel="noreferrer"
              title="Open the public site"
            >
              <ExternalLink size={14} />
              <span>Public site</span>
            </a>

            <div className="usermenu" ref={menuRef}>
              <button
                type="button"
                className="usermenu__trigger"
                onClick={() => setMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={menu}
              >
                <span className="usermenu__avatar">{initial}</span>
                <span className="usermenu__name">{user?.name ?? 'Administrator'}</span>
                <ChevronDown size={14} />
              </button>

              {menu ? (
                <div className="usermenu__panel" role="menu">
                  <div className="usermenu__head">
                    <span className="usermenu__head-name">{user?.name ?? 'Administrator'}</span>
                    <span className="usermenu__head-mail">{user?.email ?? '—'}</span>
                  </div>
                  <NavLink
                    to="/admin/settings"
                    className="usermenu__item"
                    role="menuitem"
                    onClick={() => setMenu(false)}
                  >
                    <Settings size={16} /> Organisation settings
                  </NavLink>
                  <a
                    className="usermenu__item"
                    href="/"
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    onClick={() => setMenu(false)}
                  >
                    <ExternalLink size={16} /> Open public site
                  </a>
                  <button
                    type="button"
                    className="usermenu__item usermenu__item--danger"
                    role="menuitem"
                    onClick={async () => {
                      setMenu(false);
                      await logout();
                      navigate('/login', { replace: true });
                    }}
                  >
                    <LogOut size={16} /> Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="admin__content">
          <Outlet />
        </main>

        <footer className="admin__footer">
          Digital ID Card Management System · Card design is fixed by the
          organisation and cannot be altered per member.
          <span className="text-muted"> · {pageLabel}</span>
        </footer>
      </div>
    </div>
  );
}
