/**
 * Reminders for to-dos marked "wichtig": one the day before and one an hour before the deadline.
 *
 * Deliberately pure and free of imports: the very same file runs in the browser (reminders while the
 * app is open) and in the GitHub Action that sends Web Push while it is closed – Node runs it with
 * its built-in type stripping. So both sides always agree on WHAT is due and WHEN.
 */

export interface ReminderTodo {
  id: string;
  text: string;
  courseId: string;
  /** "YYYY-MM-DD" (all day) or "YYYY-MM-DDTHH:mm", wall-clock time */
  due?: string;
  done: boolean;
  important?: boolean;
  createdAt: number;
}

/** 'day' = the day before, 'hour' = shortly before (for an all-day to-do: that morning) */
export type ReminderKind = 'day' | 'hour';

export interface Reminder {
  /** Per to-do, kind AND deadline – moving the deadline re-arms both reminders */
  key: string;
  todoId: string;
  kind: ReminderKind;
  /** When it should go out (epoch ms) */
  at: number;
  /** The deadline itself (epoch ms) */
  due: number;
  /** Keys this one stands in for (itself plus an earlier reminder that was missed) */
  covers: string[];
}

const HOUR = 3_600_000;
/** A reminder whose moment had passed before the to-do even existed is not sent – you just wrote it. */
const GRACE = 5 * 60_000;
/** An all-day to-do: the evening before, and in the morning of that day. */
const EVENING = 18;
const MORNING = 8;

const DUE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;

/** Wall-clock time in `zone` (e.g. "Europe/Zurich") – or the device's own zone – as epoch ms. */
export function zonedTime(y: number, mo: number, d: number, h: number, mi: number, zone?: string): number {
  if (!zone) return new Date(y, mo - 1, d, h, mi).getTime();
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = guess - offsetMs(guess, zone);
  // Second pass: right at a DST switch the offset at the result differs from the one at the guess
  return guess - offsetMs(first, zone);
}

function offsetMs(t: number, zone: string): number {
  const p = zoneParts(t, zone);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
}

function zoneParts(t: number, zone?: string) {
  if (!zone) {
    const d = new Date(t);
    return { y: d.getFullYear(), mo: d.getMonth() + 1, d: d.getDate(), h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), wd: d.getDay() };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, hourCycle: 'h23', weekday: 'short',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(t));
  const get = (type: string) => parts.find((x) => x.type === type)?.value ?? '0';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { y: +get('year'), mo: +get('month'), d: +get('day'), h: +get('hour') % 24, mi: +get('minute'), s: +get('second'), wd };
}

/** Both reminders of one to-do – empty unless it is important, open and has a deadline. */
export function reminderSchedule(todo: ReminderTodo, zone?: string): Reminder[] {
  if (!todo.important || todo.done || !todo.due) return [];
  const m = DUE_RE.exec(todo.due);
  if (!m) return [];
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const timed = m[4] !== undefined;
  const make = (kind: ReminderKind, at: number, due: number): Reminder => {
    const key = `${todo.id}|${kind}|${todo.due}`;
    return { key, todoId: todo.id, kind, at, due, covers: [key] };
  };
  if (timed) {
    const due = zonedTime(y, mo, d, +m[4], +m[5], zone);
    return [make('day', due - 24 * HOUR, due), make('hour', due - HOUR, due)];
  }
  const due = zonedTime(y, mo, d, 23, 59, zone);
  const prev = new Date(Date.UTC(y, mo - 1, d - 1));
  return [
    make('day', zonedTime(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), EVENING, 0, zone), due),
    make('hour', zonedTime(y, mo, d, MORNING, 0, zone), due),
  ];
}

/**
 * What has to go out right now. Never after the deadline, never for a moment that passed before the
 * to-do existed, never twice (`sent`). If both are due at once (e.g. the service was down), only the
 * later one is sent – it `covers` the missed one, so that one is never sent afterwards either.
 */
export function dueReminders(todos: ReminderTodo[], now: number, sent: (key: string) => boolean, zone?: string): Reminder[] {
  const out: Reminder[] = [];
  for (const todo of todos) {
    const ready = reminderSchedule(todo, zone).filter(
      (r) => r.at <= now && now < r.due && r.at >= todo.createdAt - GRACE && !sent(r.key),
    );
    if (ready.length === 0) continue;
    const last = ready[ready.length - 1];
    out.push({ ...last, covers: ready.map((r) => r.key) });
  }
  return out;
}

const WEEKDAY = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

/** Notification text: the to-do as the title, "Morgen 10:00 fällig · Analysis I" below it. */
export function reminderText(r: Reminder, todo: ReminderTodo, courseName: string, now: number, zone?: string): { title: string; body: string } {
  const m = DUE_RE.exec(todo.due ?? '');
  const time = m && m[4] !== undefined ? `${m[4]}:${m[5]}` : '';
  const a = zoneParts(now, zone);
  const b = zoneParts(r.due, zone);
  const days = Math.round((Date.UTC(b.y, b.mo - 1, b.d) - Date.UTC(a.y, a.mo - 1, a.d)) / 86_400_000);
  const mins = Math.max(1, Math.round((r.due - now) / 60_000));
  const when =
    time && mins <= 90 ? (mins >= 55 ? 'In 1 Stunde fällig' : `In ${mins} Min fällig`)
    : days <= 0 ? `Heute${time ? ` ${time}` : ''} fällig`
    : days === 1 ? `Morgen${time ? ` ${time}` : ''} fällig`
    : `${WEEKDAY[b.wd]}${time ? ` ${time}` : ''} fällig`;
  return { title: todo.text, body: courseName ? `${when} · ${courseName}` : when };
}

/** The notification tag: the same reminder from the app and from Web Push replaces itself silently. */
export const reminderTag = (r: Reminder) => `reminder:${r.key}`;
