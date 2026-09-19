import { Link } from 'react-router-dom';
import { CourseRow, LinkChip } from '../components/course';
import { DeadlineRow, SessionRow } from '../components/rows';
import { Empty, Icon, SectionHead, cvar, cx } from '../components/ui';
import { seed } from '../data/seed';
import { COURSES, courseById, useDeadlines } from '../lib/data';
import { useNow } from '../lib/now';
import { nextOccurrence, occurrencesInWeek, occurrencesOn } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import {
  DAY_SHORT, addDays, fmtDayLong, fmtTime, isSameDay, isoWeek, startOfDay, startOfWeek,
} from '../lib/time';
import { KIND_LABEL } from '../lib/schedule';
import { useUI } from '../components/ui-context';

export function TodayPage() {
  const now = useNow();
  const p = usePersonal();
  const ui = useUI();
  const deadlines = useDeadlines();

  const today = occurrencesOn(now, COURSES, p.prefs);
  const next = nextOccurrence(now, COURSES, p.prefs);
  const open = deadlines.filter((d) => !d.done);

  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const weekStart = weekend ? addDays(startOfWeek(now), 7) : startOfWeek(now);
  const week = occurrencesInWeek(weekStart, COURSES, p.prefs);

  const allLinks = [
    ...COURSES.flatMap((c) => c.links.map((l) => ({ l, c }))),
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">KW {isoWeek(now)} · {seed.meta.semester}</p>
          <h1>{fmtDayLong(now)}</h1>
        </div>
        <button type="button" className="icon-btn" onClick={ui.openSearch} aria-label="Suchen">
          <Icon name="search" />
        </button>
      </header>

      <div className="dash">
        <section className="dash__today" aria-label="Heute">
          <SectionHead
            primary
            title="Heute"
            action={today.length > 0 ? <span className="count">{today.length} {today.length === 1 ? 'Termin' : 'Termine'}</span> : undefined}
          />
          {today.length > 0 ? (
            <ul className="panel list">
              {today.map((o) => <SessionRow key={o.key} occ={o} now={now} />)}
            </ul>
          ) : (
            <div className="panel panel--pad">
              <p className="lead">Heute stehen keine Vorlesungen oder Übungen an.</p>
              {next && (
                <p className="next">
                  Als Nächstes: <Link to={`/courses/${next.course.id}`}><strong>{next.course.shortName}</strong></Link>
                  {' · '}{KIND_LABEL[next.session.kind]} · {DAY_SHORT[next.start.getDay()]} {fmtTime(next.start)} · {next.session.room}
                </p>
              )}
            </div>
          )}
        </section>

        <section className="dash__deadlines" aria-label="Fällig">
          <SectionHead title="Fällig" action={<Link className="more" to="/tasks">Alle<Icon name="chevron-right" size={16} /></Link>} />
          {open.length > 0 ? (
            <ul className="panel list">
              {open.slice(0, 5).map((d) => <DeadlineRow key={d.id} d={d} now={now} />)}
            </ul>
          ) : (
            <Empty>Keine offenen Aufgaben. 🎉</Empty>
          )}
        </section>

        <section className="dash__week" aria-label="Wochenübersicht">
          <SectionHead title={weekend ? 'Nächste Woche' : 'Diese Woche'} action={<Link className="more" to="/week">Wochenplan<Icon name="chevron-right" size={16} /></Link>} />
          <div className="strip">
            {[0, 1, 2, 3, 4].map((i) => {
              const day = addDays(weekStart, i);
              const occs = week[i];
              const dl = open.filter((d) => isSameDay(d.when, day));
              const isToday = isSameDay(day, now);
              const isPast = +startOfDay(day) < +startOfDay(now);
              return (
                <div key={i} className={cx('strip__day', isToday && 'is-today', isPast && 'is-past')}>
                  <div className="strip__head">
                    <span>{DAY_SHORT[day.getDay()]}</span>
                    <span className="strip__date">{day.getDate()}.</span>
                  </div>
                  <ul>
                    {occs.map((o) => (
                      <li key={o.key}>
                        <Link to={`/courses/${o.course.id}`} className="strip__item" style={cvar(o.course.color)}>
                          <span className="strip__time">{fmtTime(o.start)} · {KIND_LABEL[o.session.kind]}</span>
                          <span className="strip__name">{o.course.shortName}</span>
                        </Link>
                      </li>
                    ))}
                    {dl.map((d) => (
                      <li key={d.id} className="strip__due">
                        <Icon name="flag" size={13} />
                        <span>{d.title} · {fmtTime(d.when)}<em>{courseById(d.courseId)?.shortName}</em></span>
                      </li>
                    ))}
                  </ul>
                  {occs.length === 0 && dl.length === 0 && <p className="strip__none">frei</p>}
                </div>
              );
            })}
          </div>
        </section>

        <section className="dash__courses" aria-label="Meine Kurse">
          <SectionHead title="Meine Kurse" action={<Link className="more" to="/courses">Alle<Icon name="chevron-right" size={16} /></Link>} />
          <ul className="panel list">
            {COURSES.map((c) => <CourseRow key={c.id} course={c} deadlines={deadlines} now={now} />)}
          </ul>
        </section>

        <section className="dash__quick" aria-label="Schnellzugriff">
          <SectionHead title="Schnellzugriff" action={<Link className="more" to="/links">Alle<Icon name="chevron-right" size={16} /></Link>} />
          <div className="chips">
            {allLinks.map(({ l, c }) => <LinkChip key={`${c.id}-${l.url}`} link={l} course={c} />)}
            {seed.adminLinks.map((l) => (
              <a key={l.url} className="linkchip" href={l.url} target="_blank" rel="noopener noreferrer">
                <span>{l.label}</span><Icon name="external" size={14} />
              </a>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
