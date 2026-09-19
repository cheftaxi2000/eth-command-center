import { Link } from 'react-router-dom';
import { CourseSwitcher } from '../components/course';
import { ItemRow, SessionRow, TodoComposer, TodoGroups } from '../components/rows';
import { Empty, Icon, RoomLink, SectionHead } from '../components/ui';
import { seed } from '../data/seed';
import { COURSES, backlog, dueWithin, useItems } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
import { roomUrl } from '../lib/rooms';
import { KIND_LABEL, focusOfDay, nextOccurrence, occurrencesOn } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import { fmtDayLong, fmtRelDay, fmtTime, isoWeek } from '../lib/time';

export function TodayPage() {
  useTitle('Heute');
  const now = useNow();
  const { synced } = usePersonal();
  const items = useItems();

  const today = occurrencesOn(now, COURSES, synced.prefs);
  const focus = focusOfDay(now, today);
  const next = focus ? null : nextOccurrence(now, COURSES, synced.prefs);
  const due = dueWithin(items, now, 7);
  const later = due.length === 0 ? items.find((i) => !i.done && i.due && +i.due > +now) : undefined;
  const todos = backlog(items, now, 7);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">KW {isoWeek(now)} · {seed.meta.semester}</p>
          <h1>{fmtDayLong(now)}</h1>
        </div>
      </header>

      <CourseSwitcher />

      <div className="dash">
        <section className="dash__today" aria-labelledby="h-today">
          <SectionHead id="h-today" title="Heute" action={today.length > 0 ? <span className="count">{today.length} {today.length === 1 ? 'Termin' : 'Termine'}</span> : undefined} />
          {today.length > 0 && (
            <ul className="panel list">
              {today.map((o) => <SessionRow key={o.key} occ={o} now={now} focus={focus?.occ.key === o.key} />)}
            </ul>
          )}
          {!focus && (
            <div className="panel panel--pad nextup">
              <p className="nextup__lead">{today.length > 0 ? 'Für heute bist du durch.' : 'Heute keine Vorlesungen oder Übungen.'}</p>
              {next && (
                <p className="nextup__line">
                  Als Nächstes: <strong>{fmtRelDay(next.start, now)} {fmtTime(next.start)}</strong>
                  {' · '}<Link to={`/courses/${next.course.id}`}>{next.course.shortName}</Link>
                  {' · '}{KIND_LABEL[next.session.kind]}{' · '}
                  <RoomLink room={next.session.room} url={roomUrl(next.session.room)} />
                </p>
              )}
            </div>
          )}
        </section>

        <section className="dash__due" aria-labelledby="h-due">
          <SectionHead id="h-due" title="Fällig" action={<Link className="more" to="/tasks">Alle<Icon name="chevron-right" size={16} /></Link>} />
          {due.length > 0 ? (
            <ul className="panel list">{due.map((i) => <ItemRow key={i.id} item={i} now={now} />)}</ul>
          ) : (
            <Empty>
              Nichts fällig in den nächsten 7 Tagen.
              {later?.due && <> Als Nächstes: <strong>{later.title}</strong> ({fmtRelDay(later.due, now)}).</>}
            </Empty>
          )}
        </section>

        <section className="dash__todos" aria-labelledby="h-todos">
          <SectionHead id="h-todos" title="To-dos" action={todos.length > 0 ? <span className="count">{todos.length} offen</span> : undefined} />
          <div className="panel"><TodoComposer /></div>
          {todos.length > 0 ? (
            <TodoGroups items={todos} now={now} />
          ) : (
            <Empty>Noch keine offenen To-dos. Schreib oben rein, was du nicht vergessen willst – z. B. „Skript Kapitel 2 nachlesen“.</Empty>
          )}
        </section>
      </div>
    </>
  );
}
