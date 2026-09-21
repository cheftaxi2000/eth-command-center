import type { Course } from '../types';
import { buildItems } from './data';
import { KIND_LABEL, occurrencesOn } from './schedule';
import type { SyncedState } from './state';
import { addDays, startOfDay, toLocalDate } from './time';

/**
 * Timetable + open deadlines as an iCalendar file (RFC 5545) – import into the iPad, Outlook or
 * Google calendar. Deadlines and exams carry reminders, so the phone's own calendar notifies you:
 * the only way to get real notifications without running a server.
 *
 * Times are written in UTC ("…Z"), which every calendar converts back to local time correctly,
 * including across the switch to winter time. UIDs are stable, so importing again updates events
 * instead of duplicating them (in calendars that honour UIDs).
 */

const CRLF = '\r\n';

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const dateOnly = (d: Date) => toLocalDate(d).replace(/-/g, '');

/** RFC 5545 text escaping. */
export const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets are folded (CRLF + space) – counted in UTF-8 bytes, not characters. */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74; // continuation lines start with a space
    if (bytes + n > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  parts.push(cur);
  return parts.join(`${CRLF} `);
}

interface Event {
  uid: string;
  summary: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  location?: string;
  description?: string;
  /** e.g. ['-P1D', '-PT2H'] */
  alarms?: string[];
}

function vevent(e: Event, stamp: string): string[] {
  const lines = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${stamp}`];
  if (e.allDay) lines.push(`DTSTART;VALUE=DATE:${dateOnly(e.start)}`, `DTEND;VALUE=DATE:${dateOnly(e.end)}`);
  else lines.push(`DTSTART:${utc(e.start)}`, `DTEND:${utc(e.end)}`);
  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  for (const trigger of e.alarms ?? []) {
    lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escapeText(e.summary)}`, `TRIGGER:${trigger}`, 'END:VALARM');
  }
  lines.push('END:VEVENT');
  return lines;
}

export interface IcsOptions {
  now: Date;
  /** How many weeks of timetable, starting with the current week. */
  weeks?: number;
  courses: Course[];
  synced: SyncedState;
}

export function buildIcs({ now, weeks = 8, courses, synced }: IcsOptions): string {
  const events: Event[] = [];
  const from = startOfDay(now);

  for (let d = 0; d < weeks * 7; d++) {
    const day = addDays(from, d);
    for (const o of occurrencesOn(day, courses, synced.prefs)) {
      events.push({
        uid: `${o.key}@eth-study-command-center`,
        summary: `${o.course.shortName} – ${KIND_LABEL[o.session.kind]}`,
        start: o.start,
        end: o.end,
        location: o.session.room,
        description: [o.course.name, o.flag ? 'Nicht sicher, ob dieser Termin für dich gilt – in der App festlegen.' : ''].filter(Boolean).join('\n'),
      });
    }
  }

  const courseName = (id: string) => courses.find((c) => c.id === id)?.shortName ?? 'Allgemein';
  for (const item of buildItems(synced, now)) {
    if (item.done || !item.due) continue;
    if (item.kind === 'exam') {
      events.push({
        uid: `${item.id}@eth-study-command-center`,
        summary: `Prüfung: ${item.title} (${courseName(item.courseId)})`,
        start: item.due,
        end: new Date(+item.due + 2 * 3_600_000),
        location: item.location,
        alarms: ['-P7D', '-P1D'],
      });
    } else if (item.allDay) {
      const day = startOfDay(item.due);
      events.push({
        uid: `${item.id}@eth-study-command-center`,
        summary: `Fällig: ${item.title} (${courseName(item.courseId)})`,
        start: day,
        end: addDays(day, 1),
        allDay: true,
        alarms: ['-PT6H'], // 18:00 the evening before (the event starts at midnight)
      });
    } else {
      events.push({
        uid: `${item.id}@eth-study-command-center`,
        summary: `Abgabe: ${item.title} (${courseName(item.courseId)})`,
        start: new Date(+item.due - 30 * 60_000),
        end: item.due,
        alarms: ['-P1D', '-PT2H'],
      });
    }
  }

  const stamp = utc(now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ETH Study Command Center//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Studium',
    'X-WR-TIMEZONE:Europe/Zurich',
    ...events.flatMap((e) => vevent(e, stamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** Hands the file to the browser – on the iPad this opens "Zum Kalender hinzufügen". */
export function downloadIcs(content: string, name = 'studium.ics') {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
