export const DAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const;
export const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const;
const MONTH_LONG = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTH_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

const pad = (n: number) => String(n).padStart(2, '0');

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());

export const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Monday 00:00 of the week containing d */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  return addDays(s, -((s.getDay() + 6) % 7));
}

/** ISO 8601 calendar week number */
export function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((+t - yearStart) / 86_400_000 + 1) / 7);
}

/** "YYYY-MM-DDTHH:mm" (local wall-clock time) -> Date */
export function parseLocal(s: string): Date {
  const [date, time = '00:00'] = s.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export function withTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
}

/** Whole calendar days from a to b (DST-safe) */
export const daysBetween = (a: Date, b: Date) => Math.round((+startOfDay(b) - +startOfDay(a)) / 86_400_000);

export const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const fmtDayLong = (d: Date) => `${DAY_LONG[d.getDay()]}, ${d.getDate()}. ${MONTH_LONG[d.getMonth()]}`;
export const fmtDateShort = (d: Date) => `${DAY_SHORT[d.getDay()]}, ${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;
export const fmtDayMonth = (d: Date) => `${d.getDate()}. ${MONTH_SHORT[d.getMonth()]}`;

export type DueTone = 'overdue' | 'today' | 'soon' | 'later';

/** Human, glanceable countdown for a deadline. */
export function dueInfo(due: Date, now: Date): { label: string; detail: string; tone: DueTone } {
  const detail = `${fmtDateShort(due)} · ${fmtTime(due)}`;
  if (+due < +now) return { label: 'Überfällig', detail, tone: 'overdue' };
  const days = daysBetween(now, due);
  if (days === 0) return { label: `Heute, ${fmtTime(due)}`, detail, tone: 'today' };
  if (days === 1) return { label: `Morgen, ${fmtTime(due)}`, detail, tone: 'soon' };
  if (days <= 7) return { label: `in ${days} Tagen`, detail, tone: 'soon' };
  return { label: `in ${days} Tagen`, detail, tone: 'later' };
}
