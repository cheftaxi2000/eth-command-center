import { useState } from 'react';
import { taskCountLabel } from '../components/Nav';
import { ItemRow } from '../components/rows';
import { toast } from '../components/toast';
import { Accordion, Empty, Icon, SectionHead, cvar, cx } from '../components/ui';
import { CATEGORY_FILTER_LABEL, TARGETS, openWork, targetOf, useItems, type Item } from '../lib/data';
import { matchesCategory } from '../lib/exercises';
import { useLingerDone, useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
import { CATEGORIES, type TodoCategory } from '../lib/state';
import { actions } from '../lib/store';
import { daysBetween } from '../lib/time';

/** An item's day: its deadline, or – for an exercise the course only dates by week – that Monday. */
const at = (i: Item) => i.due ?? i.exercise?.weekStart;
const isOverdue = (i: Item, now: Date) =>
  i.due ? (i.allDay ? daysBetween(now, i.due) < 0 : +i.due < +now)
    : !!i.exercise?.weekStart && daysBetween(now, i.exercise.weekStart) < -6;

/**
 * `open` may include just-checked items lingering for a beat – `done` excludes those on purpose.
 * Official exercises whose date is not public yet land in `planned`, not in `undated`: they are
 * structure ("Bonusaufgabe 7"), not something you could do today.
 */
export function groupItems(open: Item[], done: Item[], now: Date) {
  const dated = open.filter((i) => at(i));
  return {
    overdue: dated.filter((i) => isOverdue(i, now)),
    soon: dated.filter((i) => !isOverdue(i, now) && daysBetween(now, at(i)!) <= 7),
    later: dated.filter((i) => !isOverdue(i, now) && daysBetween(now, at(i)!) > 7),
    undated: open.filter((i) => !at(i) && i.kind !== 'exercise'),
    planned: open.filter((i) => !at(i) && i.kind === 'exercise'),
    done: [...done].reverse(),
  };
}

export function TasksPage() {
  useTitle('Aufgaben');
  const now = useNow();
  const all = useItems();
  const [course, setCourse] = useState<string | null>(null);
  const [cat, setCat] = useState<TodoCategory | null>(null);
  const inCourse = all.filter((i) => !course || i.courseId === course);
  const list = inCourse.filter((i) => matchesCategory(i, cat));
  const { items: openish, lingering } = useLingerDone(list);
  const done = list.filter((i) => i.done && !lingering.has(i.id));
  const g = groupItems(openish, done, now);
  // The honest total: every open item that has a date plus own undated to-dos – the menu badge's number.
  const openCount = openWork(list).length;
  const shownCount = g.overdue.length + g.soon.length + g.later.length + g.undated.length + g.planned.length;
  const ownDone = g.done.filter((i) => i.kind === 'todo').length;
  const countOf = (c: TodoCategory | null) => openWork(inCourse.filter((i) => matchesCategory(i, c))).length;
  const picked = course ? targetOf(course) : null;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{openCount === 0 ? 'Alles erledigt' : `${taskCountLabel(openCount)}${cat || course ? ' in dieser Auswahl' : ''}`}</p>
          <h1>Aufgaben</h1>
        </div>
      </header>

      <div className="toolbar" data-noswipe>
        <div className="catseg" role="radiogroup" aria-label="Art">
          {[null, ...CATEGORIES].map((c) => (
            <button key={c ?? 'all'} type="button" role="radio" aria-checked={cat === c}
              className={cx('catseg__btn', c && `catseg__btn--${c}`, cat === c && 'is-on')} onClick={() => setCat(c)}>
              {c ? CATEGORY_FILTER_LABEL[c] : 'Alle'}
              <span className="catseg__n">{countOf(c)}</span>
            </button>
          ))}
        </div>
        <label className={cx('select-pill', picked && 'is-set')} style={picked ? cvar(picked.color) : undefined}>
          {picked && <span className="dot" aria-hidden="true" />}
          <select value={course ?? ''} onChange={(e) => setCourse(e.target.value || null)} aria-label="Nach Fach filtern">
            <option value="">Alle Fächer</option>
            {TARGETS.map((t) => <option key={t.id} value={t.id}>{t.shortName}</option>)}
          </select>
          <Icon name="chevron-down" size={14} />
        </label>
      </div>

      {shownCount === 0 && <Empty>Nichts offen{cat ? ` bei ${CATEGORY_FILTER_LABEL[cat]}` : ''}{course ? ' in diesem Fach' : ''}. 🎉</Empty>}

      <Group title="Überfällig" items={g.overdue} now={now} lingering={lingering} danger />
      <Group title="Nächste 7 Tage" items={g.soon} now={now} lingering={lingering} />
      <Group title="Später" items={g.later} now={now} lingering={lingering} />
      <Group title="Ohne Datum" items={g.undated} now={now} lingering={lingering} />

      {g.planned.length > 0 && (
        <Accordion title={`Termin noch nicht öffentlich (${g.planned.length})`}>
          <ul className="panel list">{g.planned.map((i) => <ItemRow key={i.id} item={i} now={now} detailed />)}</ul>
          <p className="hint">Kursübungen, deren Datum der Kurs noch nicht genannt hat – sie zählen nicht in die Zahl oben.</p>
        </Accordion>
      )}

      {g.done.length > 0 && (
        <Accordion title={`Erledigt (${g.done.length})`}>
          <ul className="panel list">{g.done.map((i) => <ItemRow key={i.id} item={i} now={now} />)}</ul>
          {ownDone > 0 && (
            <button type="button" className="text-btn" onClick={() => {
              const n = actions.clearDoneTodos(course ?? undefined);
              toast({ text: `${n} erledigte To-dos entfernt` }, 2500);
            }}>
              Erledigte To-dos entfernen
            </button>
          )}
        </Accordion>
      )}
    </>
  );
}

function Group({ title, items, now, danger, lingering }: { title: string; items: Item[]; now: Date; danger?: boolean; lingering: Set<string> }) {
  if (items.length === 0) return null;
  return (
    <section className={cx('group', danger && 'group--danger')}>
      <SectionHead title={title} action={<span className="count">{items.length}</span>} />
      <ul className="panel list">{items.map((i) => <ItemRow key={i.id} item={i} now={now} linger={lingering.has(i.id)} />)}</ul>
    </section>
  );
}
