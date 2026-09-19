import type { Course, Prefs, Session } from '../types';
import { addDays, isoWeek, startOfDay, toLocalISO, withTime } from './time';

export const KIND_LABEL = { lecture: 'Vorlesung', exercise: 'Übung' } as const;

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
export function occurrencesOn(date: Date, courses: Course[], prefs: Prefs): Occurrence[] {
  const dow = date.getDay();
  const week = isoWeek(date);
  const out: Occurrence[] = [];

  for (const course of courses) {
    for (const session of course.sessions) {
      if (session.day !== dow) continue;
      let flag: Occurrence['flag'];

      if (session.biweekly) {
        if (prefs.biweeklyParity) {
          const wanted = prefs.biweeklyParity === 'odd' ? 1 : 0;
          if (week % 2 !== wanted) continue;
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
        key: `${session.id}@${toLocalISO(date).slice(0, 10)}`,
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
export function occurrencesInWeek(weekStart: Date, courses: Course[], prefs: Prefs): Occurrence[][] {
  return [0, 1, 2, 3, 4].map((i) => occurrencesOn(addDays(weekStart, i), courses, prefs));
}

/** First session that has not ended yet (an ongoing one counts). */
export function nextOccurrence(from: Date, courses: Course[], prefs: Prefs, horizonDays = 21): Occurrence | null {
  for (let i = 0; i <= horizonDays; i++) {
    const day = addDays(startOfDay(from), i);
    const hit = occurrencesOn(day, courses, prefs).find((o) => +o.end > +from);
    if (hit) return hit;
  }
  return null;
}

export const roomLabel = (s: Session) => s.room;
