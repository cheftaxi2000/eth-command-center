import { useState } from 'react';
import { DeadlineRow } from '../components/rows';
import { Accordion, CourseDot, Empty, Icon, SectionHead, cvar, cx } from '../components/ui';
import { useUI } from '../components/ui-context';
import { COURSES, useDeadlines } from '../lib/data';
import { useNow } from '../lib/now';
import { daysBetween } from '../lib/time';
import type { Deadline } from '../types';

export function groupDeadlines(list: Deadline[], now: Date) {
  const open = list.filter((d) => !d.done);
  return {
    overdue: open.filter((d) => +d.when < +now),
    soon: open.filter((d) => +d.when >= +now && daysBetween(now, d.when) <= 7),
    later: open.filter((d) => daysBetween(now, d.when) > 7),
    done: list.filter((d) => d.done).reverse(),
  };
}

export function TasksPage() {
  const now = useNow();
  const ui = useUI();
  const all = useDeadlines();
  const [courseId, setCourseId] = useState<string | null>(null);
  const list = courseId ? all.filter((d) => d.courseId === courseId) : all;
  const g = groupDeadlines(list, now);
  const nothingOpen = g.overdue.length + g.soon.length + g.later.length === 0;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Deadlines, Abgaben, Prüfungen</p>
          <h1>Aufgaben</h1>
        </div>
        <div className="stepper">
          <button type="button" className="btn" onClick={() => ui.openAdd('exam', courseId ?? undefined)}><Icon name="flag" size={18} />Prüfung</button>
          <button type="button" className="btn btn--primary" onClick={() => ui.openAdd('task', courseId ?? undefined)}><Icon name="plus" size={18} />Aufgabe</button>
        </div>
      </header>

      <div className="filters" role="group" aria-label="Nach Kurs filtern">
        <button type="button" className={cx('filter', !courseId && 'is-on')} onClick={() => setCourseId(null)}>Alle</button>
        {COURSES.map((c) => (
          <button key={c.id} type="button" className={cx('filter', courseId === c.id && 'is-on')} style={cvar(c.color)} onClick={() => setCourseId(courseId === c.id ? null : c.id)}>
            <CourseDot color={c.color} />{c.shortName}
          </button>
        ))}
      </div>

      {nothingOpen && <Empty>Keine offenen Aufgaben{courseId ? ' in diesem Kurs' : ''}.</Empty>}

      {g.overdue.length > 0 && <Group title="Überfällig" items={g.overdue} now={now} tone="danger" />}
      {g.soon.length > 0 && <Group title="Nächste 7 Tage" items={g.soon} now={now} />}
      {g.later.length > 0 && <Group title="Später" items={g.later} now={now} />}

      {!all.some((d) => d.kind === 'exam') && (
        <p className="hint hint--block">
          Prüfungstermine stehen nicht in Notion. <button type="button" className="text-btn" onClick={() => ui.openAdd('exam', courseId ?? undefined)}>Prüfung eintragen</button>
        </p>
      )}

      {g.done.length > 0 && (
        <Accordion title={`Erledigt (${g.done.length})`}>
          <ul className="panel list">{g.done.map((d) => <DeadlineRow key={d.id} d={d} now={now} />)}</ul>
        </Accordion>
      )}
    </>
  );
}

function Group({ title, items, now, tone }: { title: string; items: Deadline[]; now: Date; tone?: 'danger' }) {
  return (
    <section className={cx('group', tone && `group--${tone}`)}>
      <SectionHead title={title} action={<span className="count">{items.length}</span>} />
      <ul className="panel list">{items.map((d) => <DeadlineRow key={d.id} d={d} now={now} />)}</ul>
    </section>
  );
}
