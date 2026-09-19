import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { COURSES } from '../lib/data';
import { MOD_KEY, isTypingTarget } from '../lib/hooks';
import { useCurrentCourseId } from './Nav';
import { Sheet } from './ui';
import { useUI } from './ui-context';

/** Previous / next course (wraps around) */
export function neighbourCourse(id: string, dir: 1 | -1): string {
  const i = COURSES.findIndex((c) => c.id === id);
  return COURSES[(i + dir + COURSES.length) % COURSES.length].id;
}

const PAGES: Record<string, string> = { h: '/', w: '/week', a: '/tasks', k: '/courses', l: '/links', e: '/settings' };

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
      if (ui.searchOpen || ui.editor || ui.helpOpen || isTypingTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if (key === '/') ui.openSearch();
      else if (key === 'n') ui.openEditor({ mode: 'new', kind: 'todo', courseId });
      else if (key === '?') ui.setHelpOpen(true);
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

const LIST: [string, string][] = [
  [`${MOD_KEY} K  oder  /`, 'Suche'],
  ['N', 'Neues To-do (im aktuellen Kurs)'],
  ['1 – 6', 'Kurs direkt öffnen'],
  ['← →', 'Vorheriger / nächster Kurs bzw. Woche'],
  ['H · W · A · K', 'Heute · Woche · Aufgaben · Kurse'],
  ['L · E', 'Links & Admin · Einstellungen'],
  ['?', 'Diese Übersicht'],
];

export function ShortcutsSheet() {
  const ui = useUI();
  return (
    <Sheet open={ui.helpOpen} onClose={() => ui.setHelpOpen(false)} title="Tastenkürzel">
      <dl className="shortcuts">
        {LIST.map(([k, v]) => (
          <div key={k}>
            <dt><kbd>{k}</kbd></dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Auf dem iPad: Kurs wechseln per Wischen nach links/rechts auf der Kursseite, Wochen ebenso im Wochenplan.</p>
    </Sheet>
  );
}
