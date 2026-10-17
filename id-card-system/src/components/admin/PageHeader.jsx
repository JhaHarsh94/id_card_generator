import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * PageHeader
 * ---------------------------------------------------------------------------
 * One consistent top-of-page block for every admin screen: a breadcrumb trail,
 * a title, an optional one-line description, and a slot for actions on the
 * right.
 *
 * Having it in one place is what makes the admin read as a single application
 * rather than eight pages that each happen to start with an <h1>. The
 * breadcrumb also gives a second, always-visible way back - which matters
 * because the sidebar's "Members" entry sits in a scrolled sub-list on a phone.
 *
 * `trail` is the full chain including the current page, so the last crumb is
 * rendered as plain text (you cannot navigate to where you already are):
 *
 *   <PageHeader title="Members" trail={[{label: 'Members'}]} />
 *   <PageHeader title={member.fullName} trail={[{label:'Members', to:'/admin/members'}, {label: member.memberId}]} />
 */
export default function PageHeader({ title, sub = null, trail = [], children = null }) {
  return (
    <header className="pagehead">
      {trail.length ? (
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/admin" className="crumbs__link">Dashboard</Link>
          {trail.map((crumb, i) => {
            const last = i === trail.length - 1;
            return (
              <span className="crumbs__item" key={`${crumb.label}-${i}`}>
                <ChevronRight size={13} className="crumbs__sep" aria-hidden="true" />
                {last || !crumb.to ? (
                  <span className="crumbs__current" aria-current="page">{crumb.label}</span>
                ) : (
                  <Link to={crumb.to} className="crumbs__link">{crumb.label}</Link>
                )}
              </span>
            );
          })}
        </nav>
      ) : null}

      <div className="pagehead__row">
        <div className="pagehead__text">
          <h1 className="h1">{title}</h1>
          {sub ? <p className="page-sub">{sub}</p> : null}
        </div>
        {children ? <div className="pagehead__actions">{children}</div> : null}
      </div>
    </header>
  );
}
