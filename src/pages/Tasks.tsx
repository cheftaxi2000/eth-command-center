import { useState } from 'react';
import { taskCountLabel } from '../components/Nav';
import { ItemRow } from '../components/rows';
import { toast } from '../components/toast';
import { Accordion, CourseDot, Empty, Icon, SectionHead, cx } from '../components/ui';
import { useUI } from '../components/ui-context';
import { TARGETS, openWork, useItems, type Item } from '../lib/data';
import { matchesTypeFilter, roleLabel, rolesInUse } from '../lib/exercises';
import { useLingerDone, useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
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

/** Course exercises, own to-dos and the rest – the filter row above the list. */
const typeFilters = () => [
  ...rolesInUse().map((r) => ({ id: `role:${r}`, label: roleLabel(r) })),
  { id: 'todo', label: 'Meine To-dos' },
  { id: 'other', label: 'Abgaben & Prüfungen' },
];

export function TasksPage() {
  useTitle('Aufgaben');
  const now = useNow();
  const ui = useUI();
  const all = useItems();
  const [filter, setFilter] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const list = all.filter((i) => (!filter || i.courseId === filter) && matchesTypeFilter(i, type));
  const { items: openish, lingering } = useLingerDone(list);
  const done = list.filter((i) => i.done && !lingering.has(i.id));
  const g = groupItems(openish, done, now);
  // The honest total: every open item that has a date plus own undated to-dos – the nav badge's number.
  const openCount = openWork(list).length;
  const shownCount = g.overdue.length + g.soon.length + g.later.length + g.undated.length + g.planned.length;
  const ownDone = g.done.filter((i) => i.kind === 'todo').length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">
            {openCount === 0 ? 'To-dos, Abgaben, Prüfungen' : `Du hast ${taskCountLabel(openCount)} zu erledigen`}
          </p>
          <h1>Aufgaben</h1>
        </div>
        <div className="stepper">
          <button type="button" className="btn" onClick={() => ui.openEditor({ mode: 'new', kind: 'exam', courseId: filter ?? undefined })}>
            <Icon name="flag" size={18} />Prüfung
          </button>
          <button type="button" className="btn btn--primary" onClick={() => ui.openEditor({ mode: 'new', kind: 'todo', courseId: filter ?? undefined })}>
            <Icon name="plus" size={18} />To-do
          </button>
        </div>
      </header>

      <div className="filters" data-noswipe role="group" aria-label="Nach Fach filtern">
        <button type="button" className={cx('filter', !filter && 'is-on')} onClick={() => setFilter(null)}>Alle</button>
        {TARGETS.map((t) => (
          <button key={t.id} type="button" className={cx('filter', filter === t.id && 'is-on')} onClick={() => setFilter(filter === t.id ? null : t.id)}>
            <CourseDot color={t.color} />{t.shortName}
          </button>
        ))}
      </div>

      {typeFilters().length > 1 && (
        <div className="filters filters--type" data-noswipe role="group" aria-label="Nach Art filtern">
          <button type="button" className={cx('filter', !type && 'is-on')} onClick={() => setType(null)}>Alles</button>
          {typeFilters().map((t) => (
            <button key={t.id} type="button" className={cx('filter', type === t.id && 'is-on')} onClick={() => setType(type === t.id ? null : t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {shownCount === 0 && <Empty>Alles erledigt{filter ? ' in diesem Fach' : ''}. 🎉</Empty>}

      <Group title="Überfällig" items={g.overdue} now={now} lingering={lingering} danger />
      <Group title="Nächste 7 Tage" items={g.soon} now={now} lingering={lingering} />
      <Group title="Später" items={g.later} now={now} lingering={lingering} />
      <Group title="Ohne Datum" items={g.undated} now={now} lingering={lingering} />

      {g.planned.length > 0 && (
        <Accordion title={`Übungen, deren Termin noch nicht öffentlich ist (${g.planned.length})`}>
          <ul className="panel list">{g.planned.map((i) => <ItemRow key={i.id} item={i} now={now} detailed />)}</ul>
          <p className="hint">Sie zählen nicht in die Zahl oben – die Termine stehen auf Moodle bzw. Code Expert.</p>
        </Accordion>
      )}

      {!all.some((i) => i.kind === 'exam') && (
        <p className="hint hint--block">
          Prüfungstermine stehen nicht in Notion.{' '}
          <button type="button" className="text-btn" onClick={() => ui.openEditor({ mode: 'new', kind: 'exam', courseId: filter ?? undefined })}>Prüfung eintragen</button>
        </p>
      )}

      {g.done.length > 0 && (
        <Accordion title={`Erledigt (${g.done.length})`}>
          <ul className="panel list">{g.done.map((i) => <ItemRow key={i.id} item={i} now={now} />)}</ul>
          {ownDone > 0 && (
            <button type="button" className="text-btn" onClick={() => {
              const n = actions.clearDoneTodos(filter ?? undefined);
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
