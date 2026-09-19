import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seed } from '../data/seed';
import { COURSES, targetOf } from '../lib/data';
import { createSearch, detectCourse, groupHits, type SearchHit, type SearchType } from '../lib/search';
import { usePersonal } from '../lib/store';
import { CourseDot, Icon, cx, type IconName } from './ui';
import { useUI } from './ui-context';

const TYPE_ICON: Record<SearchType, IconName> = {
  course: 'courses', todo: 'tasks', deadline: 'flag', exam: 'flag', session: 'week', note: 'note',
  topic: 'note', instructor: 'person', link: 'external', action: 'plus',
};

export function SearchOverlay() {
  const ui = useUI();
  const nav = useNavigate();
  const { synced } = usePersonal();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const index = useMemo(
    () => createSearch({ ...seed, todos: Object.values(synced.todos), exams: Object.values(synced.exams) }),
    [synced.todos, synced.exams],
  );
  const query = q.trim();
  const groups = useMemo(() => groupHits(query ? index.search(query) : index.browse(), query ? 5 : 20), [query, index]);

  // Quick capture: whatever you typed can become a to-do (course guessed from the text)
  const capture: SearchHit | null = query
    ? { id: 'capture', type: 'action', title: `„${query}“ als To-do speichern`, subtitle: targetOf(detectCourse(query, COURSES) ?? 'allgemein').name, target: { kind: 'action', action: 'add-todo' } }
    : null;
  const flat = useMemo(() => [...groups.flatMap((g) => g.items), ...(capture ? [capture] : [])], [groups, capture?.title]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ui.searchOpen) return;
    setQ('');
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [ui.searchOpen]);
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!ui.searchOpen) return null;

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    ui.closeSearch();
    const t = hit.target;
    if (hit.id === 'capture') ui.openEditor({ mode: 'new', kind: 'todo', text: query, courseId: detectCourse(query, COURSES) ?? undefined });
    else if (t.kind === 'route') nav(t.to);
    else if (t.kind === 'external') window.open(t.url, '_blank', 'noopener,noreferrer');
    else if (t.kind === 'todo' || t.kind === 'exam') ui.openEditor({ mode: 'edit', kind: t.kind, id: t.id });
    else ui.openEditor({ mode: 'new', kind: t.action === 'add-exam' ? 'exam' : 'todo' });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') ui.closeSearch();
  };

  let n = -1;
  const renderHit = (hit: SearchHit) => {
    n += 1;
    const i = n;
    const course = hit.courseId ? targetOf(hit.courseId) : undefined;
    return (
      <li key={hit.id} role="option" aria-selected={i === active}>
        <button type="button" className={cx('hit', i === active && 'is-active')} onClick={() => choose(hit)} onMouseMove={() => i !== active && setActive(i)}>
          <span className="hit__lead">
            {hit.type === 'course' && course ? <CourseDot color={course.color} /> : <Icon name={TYPE_ICON[hit.type]} size={18} />}
          </span>
          <span className="hit__main">
            <span className="hit__title">{hit.title}</span>
            <span className="hit__sub">{hit.subtitle}</span>
          </span>
          {hit.target.kind === 'external' && <Icon name="external" size={15} />}
        </button>
      </li>
    );
  };

  return (
    <div className="backdrop backdrop--search" onMouseDown={(e) => e.target === e.currentTarget && ui.closeSearch()}>
      <div className="search" role="dialog" aria-modal="true" aria-label="Suche">
        <div className="search__bar">
          <Icon name="search" size={20} />
          <input
            autoFocus
            type="search"
            className="search__input"
            placeholder="Kurs, Raum, To-do, Dozent, Link …"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="Suchbegriff"
          />
          <button type="button" className="btn btn--quiet" onClick={ui.closeSearch}>Schließen</button>
        </div>

        <div className="search__results">
          {query && groups.length === 0 && (
            <p className="search__none">
              Nichts gefunden für „{query}“. Durchsucht werden Kurse, Termine und Räume, To-dos, Abgaben, Notizen, Dozenten und Links –
              Vorlesungsthemen stehen nicht in Notion.
            </p>
          )}
          <ul ref={listRef} role="listbox" aria-label="Ergebnisse">
            {groups.map((g) => (
              <li key={g.type} role="presentation" className="search__group">
                <p className="search__label">{g.label}</p>
                <ul role="presentation">{g.items.map(renderHit)}</ul>
              </li>
            ))}
            {capture && (
              <li role="presentation" className="search__group">
                <ul role="presentation">{renderHit(capture)}</ul>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
