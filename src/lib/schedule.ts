import type { Course, Session, SessionKind } from '../types';
import type { Prefs } from './state';
import { addDays, isoWeek, startOfDay, toLocalDate, withTime } from './time';

export const KIND_LABEL = { lecture: 'Vorlesung', exercise: 'Übung' } as const;

type SchedulePrefs = Pick<Prefs, 'biweeklyParity' | 'choices'>;

export interface Occurrence {
  key: string;
  course: Course;
  session: Session;
  start: Date;
  end: Date;
  /** Why the app is not sure this session applies to the student */
  flag?: 'biweekly' | 'choice';
}

/** All sessions taking place on `date`, honouring the student's week-parity / group choices. */
export function occurrencesOn(date: Date, courses: Course[], prefs: SchedulePrefs): Occurrence[] {
  const dow = date.getDay();
  const week = isoWeek(date);
  const out: Occurrence[] = [];

  for (const course of courses) {
    for (const session of course.sessions) {
      if (session.day !== dow) continue;
      let flag: Occurrence['flag'];

      if (session.biweekly) {
        if (prefs.biweeklyParity) {
          if (week % 2 !== (prefs.biweeklyParity === 'odd' ? 1 : 0)) continue;
        } else {
          flag = 'biweekly';
        }
      }
      if (session.choiceGroup) {
        const chosen = prefs.choices[session.choiceGroup];
        if (chosen) {
          if (chosen !== session.id) continue;
        } else {
          flag = flag ?? 'choice';
        }
      }

      out.push({
        key: `${session.id}@${toLocalDate(date)}`,
        course,
        session,
        start: withTime(date, session.start),
        end: withTime(date, session.end),
        flag,
      });
    }
  }
  return out.sort((a, b) => +a.start - +b.start);
}

/** Monday–Friday of the week starting at `weekStart` */
export function occurrencesInWeek(weekStart: Date, courses: Course[], prefs: SchedulePrefs): Occurrence[][] {
  return [0, 1, 2, 3, 4].map((i) => occurrencesOn(addDays(weekStart, i), courses, prefs));
}

/** First session that has not ended yet (an ongoing one counts), optionally of one kind. */
export function nextOccurrence(
  from: Date,
  courses: Course[],
  prefs: SchedulePrefs,
  kind?: SessionKind,
  horizonDays = 21,
): Occurrence | null {
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(startOfDay(from), i);
    const hit = occurrencesOn(day, courses, prefs).find((o) => +o.end > +from && (!kind || o.session.kind === kind));
    if (hit) return hit;
  }
  return null;
}

/** The session happening right now, or the next one that starts later today */
export function focusOfDay(now: Date, today: Occurrence[]): { occ: Occurrence; live: boolean } | null {
  const live = today.find((o) => +now >= +o.start && +now < +o.end);
  if (live) return { occ: live, live: true };
  const next = today.find((o) => +o.start > +now);
  return next ? { occ: next, live: false } : null;
}

/**
 * Best guess which course a new to-do is about: the session running now, one that ended
 * within the last 90 minutes, otherwise the course used last.
 */
export function suggestCourse(now: Date, courses: Course[], prefs: SchedulePrefs, fallback: string): string {
  const today = occurrencesOn(now, courses, prefs);
  const live = today.find((o) => +now >= +o.start && +now < +o.end);
  if (live) return live.course.id;
  const recent = [...today].reverse().find((o) => +o.end <= +now && +now - +o.end < 90 * 60_000);
  return recent?.course.id ?? fallback;
}
