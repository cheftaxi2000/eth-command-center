import { Link } from 'react-router-dom';
import { StudyWeek } from '../components/StudyTimer';
import { ItemRow, SessionRow, TodoComposer } from '../components/rows';
import { Empty, Icon, RoomLink, SectionHead } from '../components/ui';
import { seed } from '../data/seed';
import { COURSES, useItems } from '../lib/data';
import { useLingerDone, useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
import { roomUrl } from '../lib/rooms';
import { KIND_LABEL, focusOfDay, nextOccurrence, occurrencesOn } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import { daysBetween, dueInfo, fmtDayLong, fmtRelDay, fmtTime, isoWeek } from '../lib/time';

/** How many rows a home-page list shows before "Alle anzeigen" – the rest is one tap away. */
const SHOW = 5;

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 5 ? 'Hallo' : h < 11 ? 'Guten Morgen' : h < 18 ? 'Hallo' : 'Guten Abend';
}

export function TodayPage() {
  useTitle('Heute');
  const now = useNow();
  const { synced } = usePersonal();
  const items = useItems();
  // Keeps a just-checked item visible for a beat (green check) instead of an instant teleport
  const { items: openish, lingering } = useLingerDone(items);

  const today = occurrencesOn(now, COURSES, synced.prefs);
  const focus = focusOfDay(now, today);
  const next = focus ? null : nextOccurrence(now, COURSES, synced.prefs);
  const due = openish.filter((i) => i.due && daysBetween(now, i.due) <= 7);
  const overdue = due.filter((i) => !i.done && dueInfo(i.due!, now, i.allDay).tone === 'overdue').length;
  const later = due.length === 0 ? items.find((i) => !i.done && i.due && +i.due > +now) : undefined;
  // Exams are usually months away – keep them in view without cluttering the list
  const nextExam = items.find((i) => i.kind === 'exam' && !i.done && i.due && !due.some((d) => d.id === i.id));
  const todos = openish.filter((i) => i.kind === 'todo' && (!i.due || daysBetween(now, i.due) > 7));
  const left = today.filter((o) => +o.end > +now).length;

  // One calm sentence instead of three counters
  const summary = [
    today.length === 0 ? 'Heute keine Vorlesungen' : left === 0 ? 'Für heute durch' : `Noch ${left} ${left === 1 ? 'Termin' : 'Termine'} heute`,
    due.length > 0 ? `${due.length} fällig in 7 Tagen` : 'diese Woche nichts fällig',
  ];

  return (
    <>
      <header className="hero">
        <p className="eyebrow">{fmtDayLong(now)} · KW {isoWeek(now)}<span className="only-wide"> · {seed.meta.semester}</span></p>
        <h1>{greeting(now)}</h1>
        <p className="hero__summary">
          {summary.join(' · ')}
          {overdue > 0 && <> · <Link to="/tasks" className="hero__alert">{overdue} überfällig</Link></>}
        </p>
      </header>

      <div className="dash">
        <section className="dash__today" aria-labelledby="h-today">
          <SectionHead id="h-today" title="Stundenplan" action={today.length > 0 ? <span className="count">{today.length} {today.length === 1 ? 'Termin' : 'Termine'}</span> : undefined} />
          {today.length > 0 && (
            <ul className="panel list">
              {today.map((o) => <SessionRow key={o.key} occ={o} now={now} focus={focus?.occ.key === o.key} />)}
            </ul>
          )}
          {!focus && next && (
            <p className="nextup">
              <span className="nextup__label">Als Nächstes</span>
              <strong>{fmtRelDay(next.start, now)} {fmtTime(next.start)}</strong>
              <Link to={`/courses/${next.course.id}`}>{next.course.shortName}</Link>
              <span className="muted">{KIND_LABEL[next.session.kind]}</span>
              <RoomLink room={next.session.room} url={roomUrl(next.session.room)} />
            </p>
          )}
        </section>

        <section className="dash__due" aria-labelledby="h-due">
          <SectionHead id="h-due" title="Fällig" action={<Link className="more" to="/tasks">Alle<Icon name="chevron-right" size={16} /></Link>} />
          {due.length > 0 ? (
            <ul className="panel list">
              {due.slice(0, SHOW).map((i) => <ItemRow key={i.id} item={i} now={now} linger={lingering.has(i.id)} />)}
              {due.length > SHOW && (
                <li><Link className="more more--row" to="/tasks">{due.length - SHOW} weitere<Icon name="chevron-right" size={16} /></Link></li>
              )}
            </ul>
          ) : (
            <Empty>
              Nichts fällig in den nächsten 7 Tagen.
              {later?.due && <> Als Nächstes: <strong>{later.title}</strong> ({fmtRelDay(later.due, now)}).</>}
            </Empty>
          )}
          {nextExam?.due && (
            <Link className="nextexam" to="/tasks">
              <Icon name="flag" size={16} />
              <span>Nächste Prüfung: <strong>{nextExam.title}</strong> · {dueInfo(nextExam.due, now).label}</span>
            </Link>
          )}
        </section>

        <section className="dash__todos" aria-labelledby="h-todos">
          <SectionHead id="h-todos" title="Meine To-dos" action={todos.length > 0 ? <span className="count">{todos.length} offen</span> : undefined} />
          <div className="panel">
            <TodoComposer />
            {todos.length > 0 && (
              <ul className="list list--top">
                {todos.slice(0, SHOW).map((i) => <ItemRow key={i.id} item={i} now={now} linger={lingering.has(i.id)} />)}
                {todos.length > SHOW && (
                  <li><Link className="more more--row" to="/tasks">Alle {todos.length} anzeigen<Icon name="chevron-right" size={16} /></Link></li>
                )}
              </ul>
            )}
          </div>
          {todos.length === 0 && <p className="hint hint--block">Tippen, Enter – fertig. Mit dem Kalender-Knopf wählst du Datum, Art und ob es wichtig ist.</p>}
        </section>

        <StudyWeek />
      </div>
    </>
  );
}
