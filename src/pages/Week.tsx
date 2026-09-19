import { useState } from 'react';
import { Link } from 'react-router-dom';
import { flagText, SessionRow } from '../components/rows';
import { Chip, Icon, cvar, cx } from '../components/ui';
import { COURSES, courseById, useDeadlines } from '../lib/data';
import { useMediaQuery } from '../lib/hooks';
import { useNow } from '../lib/now';
import { KIND_LABEL, occurrencesInWeek, type Occurrence } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import {
  DAY_SHORT, addDays, fmtDayMonth, fmtTime, isSameDay, isoWeek, minutesOf, startOfDay, startOfWeek,
} from '../lib/time';
import type { Deadline } from '../types';

const START = 8 * 60;
const END = 18 * 60;
const HOURS = Array.from({ length: (END - START) / 60 }, (_, i) => 8 + i);

export function WeekPage() {
  const now = useNow();
  const p = usePersonal();
  const deadlines = useDeadlines().filter((d) => !d.done);
  const narrow = useMediaQuery('(max-width: 639px)');

  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const [offset, setOffset] = useState(weekend ? 1 : 0);
  const base = startOfWeek(now);
  const weekStart = addDays(base, offset * 7);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
  const week = occurrencesInWeek(weekStart, COURSES, p.prefs);
  const flags = new Set(week.flat().map((o) => o.flag).filter(Boolean));
  const unclear = [flags.has('biweekly') && '2-wöchentliche Vorlesung', flags.has('choice') && 'Übungsgruppe'].filter(Boolean).join(' / ');

  const label = offset === 0 ? 'Diese Woche' : offset === 1 ? 'Nächste Woche' : offset === -1 ? 'Letzte Woche' : '';

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{label || 'Woche'}</p>
          <h1>KW {isoWeek(weekStart)} <span className="h1-sub">{fmtDayMonth(days[0])} – {fmtDayMonth(days[4])}</span></h1>
        </div>
        <div className="stepper">
          <button type="button" className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Vorherige Woche"><Icon name="chevron-left" /></button>
          <button type="button" className="btn" onClick={() => setOffset(0)} disabled={offset === 0}>Heute</button>
          <button type="button" className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="Nächste Woche"><Icon name="chevron-right" /></button>
        </div>
      </header>

      {unclear && (
        <p className="notice">
          Noch nicht eindeutig: {unclear}. <Link to="/settings">In den Einstellungen festlegen</Link>
        </p>
      )}

      {narrow ? (
        <Agenda days={days} week={week} deadlines={deadlines} now={now} />
      ) : (
        <Timetable days={days} week={week} deadlines={deadlines} now={now} />
      )}
    </>
  );
}

function Agenda({ days, week, deadlines, now }: { days: Date[]; week: Occurrence[][]; deadlines: Deadline[]; now: Date }) {
  return (
    <div className="agenda">
      {days.map((day, i) => {
        const dl = deadlines.filter((d) => isSameDay(d.when, day));
        const isToday = isSameDay(day, now);
        return (
          <section key={i} className={cx('agenda__day', isToday && 'is-today')}>
            <h2 className="h-section">{DAY_SHORT[day.getDay()]}, {fmtDayMonth(day)}{isToday && ' · Heute'}</h2>
            {week[i].length === 0 && dl.length === 0 ? (
              <p className="empty">Frei</p>
            ) : (
              <ul className="panel list">
                {week[i].map((o) => <SessionRow key={o.key} occ={o} now={now} />)}
                {dl.map((d) => (
                  <li key={d.id} className="row row--deadline">
                    <Icon name="flag" size={18} />
                    <div className="row__main"><div className="row__title">{d.title}</div><div className="row__meta">{courseById(d.courseId)?.shortName} · fällig {fmtTime(d.when)}</div></div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Timetable({ days, week, deadlines, now }: { days: Date[]; week: Occurrence[][]; deadlines: Deadline[]; now: Date }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return (
    <div className="tt">
      <div className="tt__head">
        <div />
        {days.map((day, i) => {
          const dl = deadlines.filter((d) => isSameDay(d.when, day));
          const isToday = isSameDay(day, now);
          return (
            <div key={i} className={cx('tt__dayhead', isToday && 'is-today', +startOfDay(day) < +startOfDay(now) && 'is-past')}>
              <span className="tt__dow">{DAY_SHORT[day.getDay()]}</span>
              <span className="tt__dom">{day.getDate()}</span>
              {dl.map((d) => (
                <span key={d.id} className="tt__due" title={`${d.title} · fällig ${fmtTime(d.when)}`}>
                  <Icon name="flag" size={12} />
                  <span>{d.title} · {fmtTime(d.when)}<em>{courseById(d.courseId)?.shortName}</em></span>
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="tt__body" style={{ height: END - START }}>
        <div className="tt__axis">
          {HOURS.map((h) => <span key={h} style={{ top: (h * 60 - START) }}>{String(h).padStart(2, '0')}:00</span>)}
        </div>
        {days.map((day, i) => (
          <div key={i} className={cx('tt__col', isSameDay(day, now) && 'is-today')}>
            {isSameDay(day, now) && nowMin >= START && nowMin <= END && <div className="tt__now" style={{ top: nowMin - START }} />}
            {week[i].map((o) => {
              const top = minutesOf(o.session.start) - START;
              const height = minutesOf(o.session.end) - minutesOf(o.session.start);
              const flag = flagText(o, true);
              return (
                <Link
                  key={o.key}
                  to={`/courses/${o.course.id}`}
                  className={cx('block', o.session.kind === 'exercise' && 'block--ex', o.flag && 'block--uncertain', +now >= +o.end && 'is-past')}
                  style={{ ...cvar(o.course.color), top, height: height - 2 }}
                >
                  <span className="block__name">{o.course.shortName}</span>
                  <span className="block__meta">{KIND_LABEL[o.session.kind]} · {o.session.room}</span>
                  {height >= 90 && <span className="block__meta">{o.session.start}–{o.session.end}</span>}
                  {flag && height >= 60 && <Chip tone="warn">{flag}</Chip>}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
