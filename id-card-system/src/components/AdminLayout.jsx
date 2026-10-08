import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShieldCheck,
  Clock,
  ShieldAlert,
  ScanLine,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { summarise, STATUS } from '../utils/status';
import { getOrganization, listMembers } from '../services/localStore';
import { useAuth } from '../context/auth-context';
import '../styles/dashboard.css';

/**
 * AdminLayout
 * ---------------------------------------------------------------------------
 * Sidebar + sticky header shell. Navigation counts are derived live so the
 * Active/Expired/Revoked figures always match the members table.
 *
 * Auth is intentionally NOT wired yet - that is Phase 4. Until then this shell
 * renders for anyone who reaches it, which is expected at this stage of the
 * build and must not ship.
 */
const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  // `end` matters: without it /members/new would also highlight "Members".
  { to: '/members', label: 'Members / ID Cards', icon: Users, end: true },
  { to: '/members/new', label: 'Add New Member', icon: UserPlus, end: true },
];

const STATUS_NAV = [
  { key: STATUS.ACTIVE, label: 'Active IDs', icon: ShieldCheck, to: '/members?status=active' },
  { key: STATUS.EXPIRED, label: 'Expired IDs', icon: Clock, to: '/members?status=expired' },
  { key: STATUS.REVOKED, label: 'Revoked IDs', icon: ShieldAlert, to: '/members?status=revoked' },
];

const NAV_BOTTOM = [
  { to: '/verification', label: 'Verification', icon: ScanLine },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();
  const organization = getOrganization();
  const { user, logout } = useAuth();

  // The mobile drawer is dismissed on link activation rather than in an effect
  // on location, which would cause an extra render pass on every navigation.
  const closeDrawer = () => setOpen(false);

  // Counts are cheap to recompute on navigation; no store yet to subscribe to.
  useEffect(() => {
    let alive = true;
    listMembers()
      .then((rows) => alive && setCounts(summarise(rows)))
      .catch(() => {});
    return () => { alive = false; };
  }, [location.pathname, location.search]);

  const initial = (user?.name ?? organization.name ?? 'A')?.[0]?.toUpperCase() ?? 'A';

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
          <button
            type="button"
            className="btn btn-ghost btn-icon sidebar-toggle"
            onClick={() => setOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <span className="admin__header-title">
            {organization.name}
          </span>
        </header>

        <main className="admin__content">
          <Outlet />
        </main>

        <footer className="admin__footer">
          Digital ID Card Management System · Card design is fixed by the
          organisation and cannot be altered per member.
        </footer>
      </div>
    </div>
  );
}
