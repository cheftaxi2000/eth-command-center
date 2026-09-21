import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SessionRow, flagText } from '../components/rows';
import { Chip, Icon, cvar, cx } from '../components/ui';
import { useUI } from '../components/ui-context';
import { COURSES, targetOf, useItems, type Item } from '../lib/data';
import { isTypingTarget, useMediaQuery, useSwipe, useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';
import { KIND_LABEL, occurrencesInWeek, type Occurrence } from '../lib/schedule';
import { usePersonal } from '../lib/store';
import { DAY_SHORT, addDays, daysBetween, fmtDayMonth, fmtTime, isSameDay, isoWeek, minutesOf, startOfDay, startOfWeek } from '../lib/time';

const START = 8 * 60;
const END = 18 * 60;
const HOURS = Array.from({ length: (END - START) / 60 }, (_, i) => 8 + i);

function weekLabel(rel: number) {
  if (rel === 0) return 'Diese Woche';
  if (rel === 1) return 'Nächste Woche';
  if (rel === -1) return 'Letzte Woche';
  return rel > 0 ? `In ${rel} Wochen` : `Vor ${-rel} Wochen`;
}

export function WeekPage() {
  useTitle('Woche');
  const now = useNow();
  const ui = useUI();
  const { synced } = usePersonal();
  const items = useItems().filter((i) => !i.done && i.due);
  const narrow = useMediaQuery('(max-width: 639px)');

  // On weekends "current" means the coming week
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const anchor = addDays(startOfWeek(now), weekend ? 7 : 0);
  const [offset, setOffset] = useState(0);
  const weekStart = addDays(anchor, offset * 7);
  const days = [0, 1, 2, 3, 4].map((i) => addDays(weekStart, i));
  const week = occurrencesInWeek(weekStart, COURSES, synced.prefs);
  const rel = Math.round(daysBetween(startOfWeek(now), weekStart) / 7);

  const flags = new Set(week.flat().map((o) => o.flag).filter(Boolean));
  const unclear = [flags.has('biweekly') && '2-wöchentliche Vorlesung', flags.has('choice') && 'Übungsgruppe'].filter(Boolean).join(' und ');

  const swipe = useSwipe((dir) => setOffset((o) => o + (dir === 'left' ? 1 : -1)));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ui.searchOpen || ui.editor || ui.helpOpen || isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'ArrowLeft') setOffset((o) => o - 1);
      else if (e.key === 'ArrowRight') setOffset((o) => o + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui.searchOpen, ui.editor, ui.helpOpen]);

  return (
    <div {...swipe}>
      <header className="page-head">
        <div>
          <p className="eyebrow">{weekLabel(rel)}</p>
          <h1>KW {isoWeek(weekStart)} <span className="h1-sub">{fmtDayMonth(days[0])} – {fmtDayMonth(days[4])}</span></h1>
        </div>
        <div className="stepper">
          <button type="button" className="icon-btn" onClick={() => setOffset((o) => o - 1)} aria-label="Vorherige Woche"><Icon name="chevron-left" /></button>
          <button type="button" className="btn" onClick={() => setOffset(0)} disabled={offset === 0}>Aktuell</button>
          <button type="button" className="icon-btn" onClick={() => setOffset((o) => o + 1)} aria-label="Nächste Woche"><Icon name="chevron-right" /></button>
        </div>
      </header>

      {unclear && (
        <p className="notice">
          Noch nicht eindeutig: {unclear}. <Link to="/settings">Festlegen</Link>
        </p>
      )}

      {narrow ? <Agenda days={days} week={week} items={items} now={now} /> : <Timetable days={days} week={week} items={items} now={now} />}
    </div>
  );
}

function DueLine({ item, compact }: { item: Item; compact?: boolean }) {
  const t = targetOf(item.courseId);
  return (
    <span className={cx('due-line', item.kind === 'todo' && 'due-line--todo')}>
      <Icon name={item.kind === 'todo' ? 'tasks' : 'flag'} size={13} />
      <span>
        {item.title}{!item.allDay && ` · ${fmtTime(item.due!)}`}
        {!compact && <em>{t.shortName}</em>}
      </span>
    </span>
  );
}

function Agenda({ days, week, items, now }: { days: Date[]; week: Occurrence[][]; items: Item[]; now: Date }) {
  return (
    <div className="agenda">
      {days.map((day, i) => {
        const dl = items.filter((d) => isSameDay(d.due!, day));
        const isToday = isSameDay(day, now);
        return (
          <section key={i} className={cx('agenda__day', isToday && 'is-today')}>
            <h2 className="agenda__head">{DAY_SHORT[day.getDay()]}, {fmtDayMonth(day)}{isToday && ' · Heute'}</h2>
            {week[i].length === 0 && dl.length === 0 ? (
              <p className="empty">Frei</p>
            ) : (
              <ul className="panel list">
                {week[i].map((o) => <SessionRow key={o.key} occ={o} now={now} />)}
                {dl.map((d) => <li key={d.id} className="row row--due"><DueLine item={d} /></li>)}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Timetable({ days, week, items, now }: { days: Date[]; week: Occurrence[][]; items: Item[]; now: Date }) {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Which open items for a course fall due somewhere in the displayed week – shown right on its Übung block,
  // since the deadline (e.g. "Serie 1") is usually a different weekday than the exercise session itself.
  const dueThisWeek = (courseId: string) => items.filter((i) => i.courseId === courseId && days.some((day) => isSameDay(i.due!, day)));
  return (
    <div className="tt">
      <div className="tt__head">
        <div />
        {days.map((day, i) => {
          const dl = items.filter((d) => isSameDay(d.due!, day));
          const isToday = isSameDay(day, now);
          return (
            <div key={i} className={cx('tt__dayhead', isToday && 'is-today', +startOfDay(day) < +startOfDay(now) && 'is-past')}>
              <span className="tt__dow">{DAY_SHORT[day.getDay()]}</span>
              <span className="tt__dom">{day.getDate()}.</span>
              {dl.slice(0, 3).map((d) => <DueLine key={d.id} item={d} />)}
              {dl.length > 3 && <span className="due-line">+{dl.length - 3} weitere</span>}
            </div>
          );
        })}
      </div>

      <div className="tt__body" style={{ height: END - START }}>
        <div className="tt__axis">
          {HOURS.map((h) => <span key={h} style={{ top: h * 60 - START }}>{String(h).padStart(2, '0')}:00</span>)}
        </div>
        {days.map((day, i) => (
          <div key={i} className={cx('tt__col', isSameDay(day, now) && 'is-today')}>
            {isSameDay(day, now) && nowMin >= START && nowMin <= END && <div className="tt__now" style={{ top: nowMin - START }} />}
            {week[i].map((o) => {
              const top = minutesOf(o.session.start) - START;
              // Fills its slot exactly: a 10:15–12:00 lecture covers 10:15–12:00 of the grid, no inset.
              const height = minutesOf(o.session.end) - minutesOf(o.session.start);
              const flag = flagText(o, true);
              const due = o.session.kind === 'exercise' ? dueThisWeek(o.course.id) : [];
              return (
                <Link key={o.key} to={`/courses/${o.course.id}`}
                  className={cx('block', `block--${o.session.kind}`, o.flag && 'block--uncertain', +now >= +o.end && 'is-past')}
                  style={{ ...cvar(o.course.color), top, height }}>
                  <span className="block__name">{o.course.shortName}</span>
                  <span className="block__meta">
                    {/* Lecture vs. exercise is carried by the label and (for exercises) a hatch
                        pattern – never by a second colour, so one course stays one colour. */}
                    <span className="block__kind">{KIND_LABEL[o.session.kind]}</span> {o.session.room}
                  </span>
                  {height >= 90 && <span className="block__meta">{o.session.start}–{o.session.end}</span>}
                  {flag && height >= 60 && <Chip tone="warn">{flag}</Chip>}
                  {height >= 60 && due.slice(0, 2).map((d) => (
                    <Chip key={d.id} tone="accent">{d.title} · {DAY_SHORT[d.due!.getDay()]} {!d.allDay && fmtTime(d.due!)}</Chip>
                  ))}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
