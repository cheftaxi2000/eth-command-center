import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { COURSES, openWork, useItems } from '../lib/data';
import { MOD_KEY } from '../lib/hooks';
import { useNow } from '../lib/now';
import { usePersonal } from '../lib/store';
import { useSyncStatus } from '../lib/sync';
import { CourseDot, Icon, cx, type IconName } from './ui';
import { useUI } from './ui-context';

const MAIN: { to: string; label: string; icon: IconName; end?: boolean; key: string }[] = [
  { to: '/', label: 'Heute', icon: 'today', end: true, key: 'H' },
  { to: '/week', label: 'Woche', icon: 'week', key: 'W' },
  { to: '/tasks', label: 'Aufgaben', icon: 'tasks', key: 'A' },
];

/**
 * EVERY open item on the Aufgaben page – Notion tasks, own to-dos and upcoming exams alike.
 * Deliberately not "due within 7 days" (what it used to be): that silently hid undated to-dos
 * and anything further out, so the badge said 3 while the page listed 4. Derived straight from
 * useItems(), so ticking something off updates it in the same render – it can never go stale.
 */
export function useOpenTaskCount(): number {
  // Everything open that has a date, plus own undated to-dos. Official exercises whose date the
  // course has not published yet are structure, not work for today – see openWork().
  return openWork(useItems()).length;
}

/** How many personal notes exist – same treatment as the task count. */
export function useNoteCount(): number {
  return Object.keys(usePersonal().synced.memos).length;
}

export const taskCountLabel = (n: number) => `${n} offene ${n === 1 ? 'Aufgabe' : 'Aufgaben'}`;
export const noteCountLabel = (n: number) => `${n} ${n === 1 ? 'Notiz' : 'Notizen'}`;

/** Course the user is looking at (for "Neues To-do" defaults) */
export function useCurrentCourseId(): string | undefined {
  const { pathname } = useLocation();
  return pathname.match(/^\/courses\/([^/]+)/)?.[1];
}

const navClass = ({ isActive }: { isActive: boolean }) => cx('nav-item', isActive && 'is-active');

export function SyncBadge() {
  const s = useSyncStatus();
  const now = useNow();
  const map = {
    idle: { icon: 'cloud', text: s.lastSyncAt ? `Synchronisiert${+now - s.lastSyncAt < 90_000 ? '' : ` · ${new Date(s.lastSyncAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}`}` : 'Sync bereit', tone: 'ok' },
    syncing: { icon: 'cloud', text: 'Synchronisiere …', tone: 'ok' },
    offline: { icon: 'cloud-off', text: 'Offline – synct später', tone: 'muted' },
    error: { icon: 'alert', text: 'Sync-Problem', tone: 'error' },
  } as const;
  const m = map[s.phase];
  return (
    <NavLink to="/settings#sync" className={cx('sync-badge', `sync-badge--${m.tone}`)} title={s.error}>
      <Icon name={m.icon} size={18} />
      <span>{m.text}</span>
    </NavLink>
  );
}

/**
 * The one bar on every page and every screen size: ☰ on the left opens the navigation, on the right
 * search, the assistant and "Neues To-do". Replaces the old sidebar, tab bar and the two round
 * floating buttons – one calm strip instead of four places that all offered navigation.
 */
export function TopBar() {
  const ui = useUI();
  const courseId = useCurrentCourseId();
  const openTasks = useOpenTaskCount();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={cx('topbar', scrolled && 'is-scrolled')}>
      <button type="button" id="menu-button" className="topbar__btn topbar__menu" aria-label="Menü öffnen"
        aria-expanded={ui.menuOpen} aria-controls="nav-drawer" onClick={() => ui.setMenuOpen(true)}>
        <Icon name="menu" size={24} />
        {openTasks > 0 && <span className="topbar__dot" aria-hidden="true" />}
      </button>
      <Link to="/" className="topbar__brand" aria-label="Heute">
        <span className="brand-mark" aria-hidden="true" />
        <span>Studium</span>
      </Link>
      <div className="topbar__actions">
        <button type="button" className="topbar__btn" onClick={ui.openSearch} aria-label="Suchen" title={`Suchen (${MOD_KEY} K)`}>
          <Icon name="search" size={21} />
        </button>
        <button type="button" className="topbar__btn" onClick={() => ui.setAssistantOpen(true)} aria-label="Assistent" title="Assistent (C)">
          <Icon name="spark" size={21} />
        </button>
        <button type="button" className="topbar__add" onClick={() => ui.openEditor({ mode: 'new', kind: 'todo', courseId })} aria-label="Neues To-do" title="Neues To-do (N)">
          <Icon name="plus" size={20} />
          <span className="topbar__add-label">Neues To-do</span>
        </button>
      </div>
    </header>
  );
}

/** Everything you can go to, behind ☰. Closes on navigation, Esc or a tap next to it. */
export function NavDrawer() {
  const ui = useUI();
  const { pathname } = useLocation();
  const openTasks = useOpenTaskCount();
  const notes = useNoteCount();
  const panel = useRef<HTMLElement>(null);
  const { menuOpen, setMenuOpen } = ui;

  // Picking a page closes the menu (also when the page is changed with a keyboard shortcut)
  useEffect(() => setMenuOpen(false), [pathname, setMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('.is-active, a')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      document.getElementById('menu-button')?.focus({ preventScroll: true });
    };
  }, [menuOpen, setMenuOpen]);

  return (
    <div className={cx('drawer', menuOpen && 'is-open')} inert={!menuOpen}>
      <div className="drawer__scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />
      {/* Any tap on an entry closes the menu – also the one for the page you are already on */}
      <nav id="nav-drawer" className="drawer__panel" aria-label="Navigation" ref={panel}
        onClick={(e) => (e.target as HTMLElement).closest('a') && setMenuOpen(false)}>
        <div className="drawer__head">
          <span className="drawer__brand"><span className="brand-mark" aria-hidden="true" />Studium</span>
          <button type="button" className="topbar__btn" onClick={() => setMenuOpen(false)} aria-label="Menü schließen">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__group">
          {MAIN.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
              <Icon name={n.icon} />
              <span className="nav-item__label">{n.label}</span>
              {n.to === '/tasks' && openTasks > 0 && <span className="badge" aria-label={taskCountLabel(openTasks)}>{openTasks}</span>}
            </NavLink>
          ))}
          <NavLink to="/notes" className={navClass}>
            <Icon name="note" />
            <span className="nav-item__label">Notizen</span>
            {notes > 0 && <span className="badge badge--quiet" aria-label={noteCountLabel(notes)}>{notes}</span>}
          </NavLink>
        </div>

        <div className="drawer__group">
          <NavLink to="/courses" end className="drawer__heading">Kurse</NavLink>
          {COURSES.map((c, i) => (
            <NavLink key={c.id} to={`/courses/${c.id}`} className={navClass}>
              <CourseDot color={c.color} />
              <span className="nav-item__label">{c.shortName}</span>
              <kbd className="kbd-hint">{i + 1}</kbd>
            </NavLink>
          ))}
        </div>

        <div className="drawer__group drawer__foot">
          <NavLink to="/bonus" className={navClass}><Icon name="trophy" /><span className="nav-item__label">Bonus & Leistung</span></NavLink>
          <NavLink to="/links" className={navClass}><Icon name="link" /><span className="nav-item__label">Links & Admin</span></NavLink>
          <NavLink to="/settings" className={navClass}><Icon name="settings" /><span className="nav-item__label">Einstellungen</span></NavLink>
          <SyncBadge />
        </div>
      </nav>
    </div>
  );
}
