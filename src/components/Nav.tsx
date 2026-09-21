import { NavLink, useLocation } from 'react-router-dom';
import { COURSES, useItems } from '../lib/data';
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
  return useItems().filter((i) => !i.done).length;
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

/** ≥ 1024 px (desktop, iPad landscape): sidebar with all courses. Below: tab bar + "+" button. */
export function SideNav() {
  const ui = useUI();
  const openTasks = useOpenTaskCount();
  const notes = useNoteCount();
  const courseId = useCurrentCourseId();
  return (
    <aside className="side" aria-label="Navigation">
      <div className="side__brand">
        <span className="brand-mark" aria-hidden="true" />
        <span>Studium</span>
      </div>

      <button type="button" className="side__btn" onClick={ui.openSearch}>
        <Icon name="search" size={20} />
        <span className="side__btn-label">Suchen</span>
        <kbd className="kbd-hint">{MOD_KEY} K</kbd>
      </button>
      <button type="button" className="side__btn side__btn--add" onClick={() => ui.openEditor({ mode: 'new', kind: 'todo', courseId })}>
        <Icon name="plus" size={20} />
        <span className="side__btn-label">Neues To-do</span>
        <kbd className="kbd-hint">N</kbd>
      </button>
      <button type="button" className="side__btn" onClick={() => ui.setAssistantOpen(true)}>
        <Icon name="spark" size={20} />
        <span className="side__btn-label">Assistent</span>
        <kbd className="kbd-hint">C</kbd>
      </button>

      <nav className="side__nav">
        {MAIN.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={navClass}>
            <Icon name={n.icon} />
            <span className="nav-item__label">{n.label}</span>
            {n.to === '/tasks' && openTasks > 0 && <span className="badge" aria-label={taskCountLabel(openTasks)}>{openTasks}</span>}
          </NavLink>
        ))}
        {/* Not in MAIN/TabBar (no room for a 6th tab) – reachable on iPad/phone via the "Kurse" page instead. */}
        <NavLink to="/notes" className={navClass}>
          <Icon name="note" />
          <span className="nav-item__label">Notizen</span>
          {notes > 0 && <span className="badge badge--quiet" aria-label={noteCountLabel(notes)}>{notes}</span>}
        </NavLink>
      </nav>

      <div className="side__courses">
        <NavLink to="/courses" end className="side__heading">Kurse</NavLink>
        {COURSES.map((c, i) => (
          <NavLink key={c.id} to={`/courses/${c.id}`} className={navClass}>
            <CourseDot color={c.color} />
            <span className="nav-item__label">{c.shortName}</span>
            <kbd className="kbd-hint kbd-hint--quiet">{i + 1}</kbd>
          </NavLink>
        ))}
      </div>

      <div className="side__foot">
        <NavLink to="/links" className={navClass}><Icon name="link" /><span className="nav-item__label">Links & Admin</span></NavLink>
        <NavLink to="/settings" className={navClass}><Icon name="settings" /><span className="nav-item__label">Einstellungen</span></NavLink>
        <SyncBadge />
      </div>
    </aside>
  );
}

export function TabBar() {
  const ui = useUI();
  const openTasks = useOpenTaskCount();
  const tabs = [...MAIN, { to: '/courses', label: 'Kurse', icon: 'courses' as const, end: false, key: 'K' }];
  return (
    <nav className="tabbar" aria-label="Hauptnavigation">
      {tabs.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx('tab', isActive && 'is-active')}>
          <span className="tab__icon">
            <Icon name={n.icon} />
            {n.to === '/tasks' && openTasks > 0 && <span className="badge badge--dot" aria-label={taskCountLabel(openTasks)}>{openTasks}</span>}
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

/** Floating "+" (iPad portrait / phone): new to-do from anywhere, for the course you are looking at */
export function Fab() {
  const ui = useUI();
  const courseId = useCurrentCourseId();
  return (
    <button type="button" className="fab" aria-label="Neues To-do" onClick={() => ui.openEditor({ mode: 'new', kind: 'todo', courseId })}>
      <Icon name="plus" size={26} />
    </button>
  );
}

/** Floating assistant button above the "+" (iPad portrait / phone), where there is no sidebar. */
export function AiFab() {
  const ui = useUI();
  return (
    <button type="button" className="fab fab--ai" aria-label="Assistent öffnen" onClick={() => ui.setAssistantOpen(true)}>
      <Icon name="spark" size={22} />
    </button>
  );
}
