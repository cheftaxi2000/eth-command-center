import { useState } from 'react';
import { ItemRow } from '../components/rows';
import { toast } from '../components/toast';
import { Accordion, CourseDot, Empty, Icon, SectionHead, cx } from '../components/ui';
import { useUI } from '../components/ui-context';
import { TARGETS, useItems, type Item } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
import { actions } from '../lib/store';
import { daysBetween } from '../lib/time';

export function groupItems(list: Item[], now: Date) {
  const open = list.filter((i) => !i.done);
  return {
    overdue: open.filter((i) => i.due && (i.allDay ? daysBetween(now, i.due) < 0 : +i.due < +now)),
    soon: open.filter((i) => i.due && !(i.allDay ? daysBetween(now, i.due) < 0 : +i.due < +now) && daysBetween(now, i.due) <= 7),
    later: open.filter((i) => i.due && daysBetween(now, i.due) > 7),
    undated: open.filter((i) => !i.due),
    done: list.filter((i) => i.done).reverse(),
  };
}

export function TasksPage() {
  useTitle('Aufgaben');
  const now = useNow();
  const ui = useUI();
  const all = useItems();
  const [filter, setFilter] = useState<string | null>(null);
  const list = filter ? all.filter((i) => i.courseId === filter) : all;
  const g = groupItems(list, now);
  const openCount = g.overdue.length + g.soon.length + g.later.length + g.undated.length;
  const ownDone = g.done.filter((i) => i.kind === 'todo').length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">To-dos, Abgaben, Prüfungen</p>
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

      {openCount === 0 && <Empty>Alles erledigt{filter ? ' in diesem Fach' : ''}. 🎉</Empty>}

      <Group title="Überfällig" items={g.overdue} now={now} danger />
      <Group title="Nächste 7 Tage" items={g.soon} now={now} />
      <Group title="Später" items={g.later} now={now} />
      <Group title="Ohne Datum" items={g.undated} now={now} />

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

function Group({ title, items, now, danger }: { title: string; items: Item[]; now: Date; danger?: boolean }) {
  if (items.length === 0) return null;
  return (
    <section className={cx('group', danger && 'group--danger')}>
      <SectionHead title={title} action={<span className="count">{items.length}</span>} />
      <ul className="panel list">{items.map((i) => <ItemRow key={i.id} item={i} now={now} />)}</ul>
    </section>
  );
}
