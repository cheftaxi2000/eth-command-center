import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { seed } from '../data/seed';
import { courseById } from '../lib/data';
import { usePersonal } from '../lib/store';
import { createSearch, groupHits, type SearchHit, type SearchType } from '../lib/search';
import { CourseDot, Icon, cx, type IconName } from './ui';
import { useUI } from './ui-context';

const TYPE_ICON: Record<SearchType, IconName> = {
  course: 'courses', deadline: 'tasks', exam: 'flag', session: 'week', note: 'note',
  topic: 'note', instructor: 'today', link: 'external', action: 'plus',
};

const TYPE_TAG: Record<SearchType, string> = {
  course: 'Kurs', deadline: 'Aufgabe', exam: 'Prüfung', session: 'Termin', note: 'Notiz',
  topic: 'Thema', instructor: 'Dozent', link: 'Link', action: 'Aktion',
};

export function SearchOverlay() {
  const ui = useUI();
  const nav = useNavigate();
  const p = usePersonal();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const index = useMemo(
    () => createSearch({ ...seed, tasks: [...seed.tasks, ...p.localTasks], exams: p.exams }),
    [p.localTasks, p.exams],
  );
  const groups = useMemo(() => {
    const hits = q.trim() ? index.search(q) : index.browse();
    return groupHits(hits, q.trim() ? 5 : 20);
  }, [q, index]);
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  useEffect(() => {
    if (ui.searchOpen) {
      setQ('');
      setActive(0);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [ui.searchOpen]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!ui.searchOpen) return null;

  const choose = (hit: SearchHit | undefined) => {
    if (!hit) return;
    ui.closeSearch();
    const t = hit.target;
    if (t.kind === 'route') nav(t.to);
    else if (t.kind === 'external') window.open(t.url, '_blank', 'noopener,noreferrer');
    else ui.openAdd(t.action === 'add-exam' ? 'exam' : 'task');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(flat[active]); }
    else if (e.key === 'Escape') { ui.closeSearch(); }
  };

  let n = -1;
  return (
    <div className="backdrop backdrop--search" onMouseDown={(e) => e.target === e.currentTarget && ui.closeSearch()}>
      <div className="search" role="dialog" aria-modal="true" aria-label="Suche">
        <div className="search__bar">
          <Icon name="search" size={20} />
          <input
            autoFocus
            type="search"
            className="search__input"
            placeholder="Kurs, Thema, Deadline, Dozent, Link …"
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
          {q.trim() && flat.length === 0 && (
            <div className="search__none">
              <p><strong>Keine Treffer für „{q.trim()}“.</strong></p>
              <p>Durchsucht werden Kurse, Termine, Aufgaben, Notizen samt Themen, Dozenten und Links. Vorlesungsthemen sind in Notion nicht hinterlegt.</p>
            </div>
          )}
          <ul ref={listRef} role="listbox" aria-label="Ergebnisse">
            {groups.map((g) => (
              <li key={g.type} role="presentation" className="search__group">
                <p className="h-section">{g.label}</p>
                <ul role="presentation">
                  {g.items.map((hit) => {
                    n += 1;
                    const i = n;
                    const course = hit.courseId ? courseById(hit.courseId) : undefined;
                    return (
                      <li key={hit.id} role="option" aria-selected={i === active}>
                        <button
                          type="button"
                          className={cx('hit', i === active && 'is-active')}
                          onClick={() => choose(hit)}
                          onMouseMove={() => i !== active && setActive(i)}
                        >
                          <span className="hit__lead">
                            {hit.type === 'course' && course ? <CourseDot color={course.color} /> : <Icon name={TYPE_ICON[hit.type]} size={18} />}
                          </span>
                          <span className="hit__main">
                            <span className="hit__title">{hit.title}</span>
                            <span className="hit__sub">{hit.subtitle}</span>
                          </span>
                          <span className="hit__tag">{TYPE_TAG[hit.type]}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
