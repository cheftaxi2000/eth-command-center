import { NavLink } from 'react-router-dom';
import { COURSES, useDeadlines } from '../lib/data';
import { useNow } from '../lib/now';
import { daysBetween } from '../lib/time';
import { CourseDot, Icon, cx, type IconName } from './ui';
import { useUI } from './ui-context';

const MAIN: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Heute', icon: 'today', end: true },
  { to: '/week', label: 'Woche', icon: 'week' },
  { to: '/tasks', label: 'Aufgaben', icon: 'tasks' },
  { to: '/courses', label: 'Kurse', icon: 'courses' },
];

/** Open deadlines that are overdue or due within a week – shown as a quiet count. */
function useUrgentCount(): number {
  const now = useNow();
  return useDeadlines().filter((d) => !d.done && daysBetween(now, d.when) <= 7).length;
}

const navClass = ({ isActive }: { isActive: boolean }) => cx('nav-item', isActive && 'is-active');

/**
 * Desktop (≥1200px): full sidebar. iPad landscape (900–1199px): the same element collapses to an
 * icon rail via CSS. Below 900px (iPad portrait, phone): bottom tab bar (`TabBar`).
 */
export function SideNav() {
  const ui = useUI();
  const urgent = useUrgentCount();
  return (
    <aside className="side" aria-label="Navigation">
      <div className="side__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span className="side__label brand-text">Studium</span>
      </div>

      <button type="button" className="side__search" onClick={ui.openSearch}>
        <Icon name="search" size={20} />
        <span className="side__label">Suchen</span>
        <kbd className="side__label">Strg K</kbd>
      </button>

      <nav className="side__nav">
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
            <Icon name={n.icon} />
            <span className="nav-item__label">{n.label}</span>
            {n.to === '/tasks' && urgent > 0 && <span className="badge" aria-label={`${urgent} dringend`}>{urgent}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="side__courses">
        <p className="h-section">Meine Kurse</p>
        {COURSES.map((c) => (
          <NavLink key={c.id} to={`/courses/${c.id}`} className={navClass}>
            <CourseDot color={c.color} />
            <span className="nav-item__label">{c.shortName}</span>
          </NavLink>
        ))}
      </div>

      <div className="side__foot">
        <NavLink to="/links" className={navClass}><Icon name="link" /><span className="nav-item__label">Links & Admin</span></NavLink>
        <NavLink to="/settings" className={navClass}><Icon name="settings" /><span className="nav-item__label">Einstellungen</span></NavLink>
      </div>
    </aside>
  );
}

export function TabBar() {
  const ui = useUI();
  const urgent = useUrgentCount();
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {MAIN.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('tab', isActive && 'is-active')}>
          <span className="tab__icon">
            <Icon name={n.icon} />
            {n.to === '/tasks' && urgent > 0 && <span className="badge badge--dot">{urgent}</span>}
          </span>
          <span className="tab__label">{n.label}</span>
        </NavLink>
      ))}
      <button type="button" className="tab" onClick={ui.openSearch}>
        <span className="tab__icon"><Icon name="search" /></span>
        <span className="tab__label">Suche</span>
      </button>
    </nav>
  );
}
