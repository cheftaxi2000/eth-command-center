import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { COURSES } from '../lib/data';
import { MOD_KEY, isTypingTarget } from '../lib/hooks';
import { syncNow } from '../lib/sync';
import { useCurrentCourseId } from './Nav';
import { toast } from './toast';
import { Sheet } from './ui';
import { useUI } from './ui-context';

/** Previous / next course (wraps around) */
export function neighbourCourse(id: string, dir: 1 | -1): string {
  const i = COURSES.findIndex((c) => c.id === id);
  return COURSES[(i + dir + COURSES.length) % COURSES.length].id;
}

/**
 * Single-letter jumps, chosen by German initial where the letter was free:
 * Heute, Woche, Aufgaben, Kurse, NotiZen, Links, Einstellungen.
 * All are bare letters – browsers and Windows/macOS only claim combinations with a modifier,
 * so nothing here collides. The one modifier shortcut, Strg/⌘ K, is the established "open search".
 */
const PAGES: Record<string, string> = { h: '/', w: '/week', a: '/tasks', k: '/courses', z: '/notes', l: '/links', e: '/settings' };

/** Keyboard shortcuts for the laptop (and iPad with keyboard). Never fire while typing. */
export function useGlobalShortcuts() {
  const ui = useUI();
  const nav = useNavigate();
  const courseId = useCurrentCourseId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (ui.searchOpen) ui.closeSearch();
        else ui.openSearch();
        return;
      }
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (ui.searchOpen || ui.editor || ui.memoEditor || ui.helpOpen || ui.assistantOpen || isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === '/') ui.openSearch();
      else if (key === 'n') ui.openEditor({ mode: 'new', kind: 'todo', courseId });
      else if (key === 'm') ui.openMemoEditor({ mode: 'new', courseId });
      else if (key === 'p') ui.openEditor({ mode: 'new', kind: 'exam', courseId });
      else if (key === 'c') ui.setAssistantOpen(true);
      else if (key === 's') {
        void syncNow();
        toast({ text: 'Synchronisiere …' }, 1500);
      } else if (key === '?') ui.setHelpOpen(true);
      else if (PAGES[key]) nav(PAGES[key]);
      else if (/^[1-9]$/.test(key) && COURSES[Number(key) - 1]) nav(`/courses/${COURSES[Number(key) - 1].id}`);
      else if (courseId && (key === 'arrowleft' || key === 'arrowright')) {
        const dir = key === 'arrowright' ? 1 : -1;
        nav(`/courses/${neighbourCourse(courseId, dir)}`, { state: { slide: dir === 1 ? 'left' : 'right' } });
      } else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui, nav, courseId]);
}

const GROUPS: { title: string; list: [string, string][] }[] = [
  {
    title: 'Öffnen',
    list: [
      ['H · W · A', 'Heute · Woche · Aufgaben'],
      ['K · Z', 'Kurse · Notizen'],
      ['L · E', 'Links & Admin · Einstellungen'],
      ['1 – 6', 'Kurs direkt öffnen'],
    ],
  },
  {
    title: 'Erfassen',
    list: [
      ['N', 'Neues To-do (im aktuellen Kurs)'],
      ['M', 'Neue Notiz (im aktuellen Kurs)'],
      ['P', 'Neue Prüfung'],
      ['C', 'Assistent (Chat)'],
    ],
  },
  {
    title: 'Sonst',
    list: [
      [`${MOD_KEY} K  oder  /`, 'Suche'],
      ['S', 'Jetzt synchronisieren'],
      ['← →', 'Vorheriger / nächster Kurs bzw. Woche'],
      ['Esc', 'Sheet oder Suche schließen'],
      ['?', 'Diese Übersicht'],
    ],
  },
];

export function ShortcutsSheet() {
  const ui = useUI();
  return (
    <Sheet open={ui.helpOpen} onClose={() => ui.setHelpOpen(false)} title="Tastenkürzel">
      {GROUPS.map((g) => (
        <section key={g.title}>
          <h3 className="shortcuts__head">{g.title}</h3>
          <dl className="shortcuts">
            {g.list.map(([k, v]) => (
              <div key={k}>
                <dt><kbd>{k}</kbd></dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="hint">
        Eine Aufgabe abhaken: mit <kbd>Tab</kbd> zum Kästchen und <kbd>Leertaste</kbd> – dafür braucht es kein eigenes Kürzel.
        Auf dem iPad: Kurs wechseln per Wischen nach links/rechts auf der Kursseite, Wochen ebenso im Wochenplan.
      </p>
    </Sheet>
  );
}
