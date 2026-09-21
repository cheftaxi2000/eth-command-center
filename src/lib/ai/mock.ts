import { buildItems } from '../data';
import { getNow } from '../now';
import { getPersonal } from '../store';
import { DAY_LONG, addDays, daysBetween, startOfDay, toLocalDate } from '../time';
import { resolveSubject, type ActionCall } from './actions';
import type { AIProvider, AIReply } from './provider';

/**
 * A provider that answers from rules instead of a model – no network, no key, deterministic.
 *
 * Its job is NOT to be clever. It exists so the whole chain (Sprache → Intent → Parameter →
 * Validierung → Action → Store → UI) can be exercised and unit-tested today, before a real model
 * is connected. When one is, this file is replaced by httpProvider() and nothing else changes.
 */

const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];

interface WhenMatch {
  date: string;
  time?: string;
  /** The words that expressed the date, so they can be cut out of the title. */
  phrase: string;
}

function parseWhen(text: string, now: Date): WhenMatch | null {
  const t = text.toLowerCase();
  let date: Date | null = null;
  let phrase = '';

  const rel = t.match(/\bin\s+(\d{1,2})\s+tagen?\b/);
  const explicit = t.match(/\b(\d{1,2})\.\s?(\d{1,2})\.(\d{4})?/) ?? t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const weekday = t.match(new RegExp(`\\b(${WEEKDAYS.join('|')})\\b`));

  if (/\bübermorgen\b/.test(t)) {
    date = addDays(now, 2);
    phrase = 'übermorgen';
  } else if (/\bmorgen\b/.test(t)) {
    date = addDays(now, 1);
    phrase = 'morgen';
  } else if (/\bheute\b/.test(t)) {
    date = startOfDay(now);
    phrase = 'heute';
  } else if (rel) {
    date = addDays(now, Number(rel[1]));
    phrase = rel[0];
  } else if (explicit) {
    date = explicit[0].includes('-')
      ? new Date(Number(explicit[1]), Number(explicit[2]) - 1, Number(explicit[3]))
      : new Date(Number(explicit[3] ?? now.getFullYear()), Number(explicit[2]) - 1, Number(explicit[1]));
    phrase = explicit[0];
  } else if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    // "am Freitag" said on a Friday means the next one, not today.
    date = addDays(startOfDay(now), (target - now.getDay() + 7) % 7 || 7);
    phrase = weekday[0];
  }
  if (!date) return null;

  const time = t.match(/\b(\d{1,2})[:.](\d{2})\b/) ?? t.match(/\bum\s+(\d{1,2})\s*uhr\b/);
  const hhmm = time ? `${String(Number(time[1])).padStart(2, '0')}:${time[2] ?? '00'}` : undefined;
  return { date: toLocalDate(date), time: hhmm, phrase: `${phrase}${time ? ` ${time[0]}` : ''}` };
}

const FILLER =
  /^(bitte\s+)?(füge?|mache?|erstelle?|trage?|leg(e)?|schreib(e)?|notiere?|setze?)\s*(mir|mal)?\s*(eine[nm]?|ein|die|der|das|meine[nm]?)?\s*(neue[nsr]?)?\s*(aufgabe|to-?do|notiz|eintrag|termin|prüfung)?\s*(hinzu|an|ein|auf)?\s*[:,-]?\s*/i;

function cleanTitle(raw: string, cut: string[]): string {
  let s = raw.trim();
  for (const c of cut) if (c) s = s.replace(new RegExp(`\\b(bis|am|auf|für|fuer)?\\s*${escapeRe(c)}\\b`, 'ig'), ' ');
  s = s.replace(FILLER, '');
  return s.replace(/\s{2,}/g, ' ').replace(/^[\s:,-]+|[\s.,;:]+$/g, '').trim();
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** What is left of a command once the command words are gone: "lösch die aufgabe kapitel 3" → "kapitel 3". */
const fragment = (t: string) =>
  t
    .replace(/[.!?]+$/, '')
    .replace(/\b(bitte|lösche?|loesche?|entferne|verschieb\w*|schieb\w*|hake?|ab|ist|sind|erledigt|fertig|die|der|das|den|meine[nm]?|aufgabe|to-?do|notiz|auf|nach|bis)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Open items whose title (or subject) the sentence mentions – how "die Analysis-Aufgabe" resolves. */
function findTasks(text: string, subjectId: string | null) {
  const t = text.toLowerCase();
  const open = buildItems(getPersonal().synced, getNow()).filter((i) => !i.done);
  const byTitle = open.filter((i) => i.title.length > 2 && t.includes(i.title.toLowerCase()));
  if (byTitle.length > 0) return byTitle;
  // "Lösch die Aufgabe Kapitel 3" → a title that merely starts with / contains "kapitel 3"
  const rest = fragment(t);
  if (rest.length > 2) {
    const partial = open.filter((i) => i.kind !== 'notion' && i.title.toLowerCase().includes(rest));
    if (partial.length > 0) return partial;
  }
  return subjectId ? open.filter((i) => i.courseId === subjectId) : [];
}

function findNotes(text: string, subjectId: string | null) {
  const t = text.toLowerCase();
  const all = Object.values(getPersonal().synced.memos);
  const byTitle = all.filter((m) => m.title.length > 2 && t.includes(m.title.toLowerCase()));
  if (byTitle.length > 0) return byTitle;
  const rest = fragment(t);
  if (rest.length > 2) {
    const partial = all.filter((m) => m.title.toLowerCase().includes(rest));
    if (partial.length > 0) return partial;
  }
  return subjectId ? all.filter((m) => m.courseId === subjectId) : [];
}

/** Which subject the sentence is about, found via the course aliases in data/seed.ts. */
function detectSubject(text: string): string | null {
  const words = text.toLowerCase().replace(/[.,;:!?]/g, ' ').split(/[\s-]+/);
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const hit = resolveSubject(words.slice(i, i + n).join(' '));
      if (hit) return hit;
    }
  }
  return null;
}

export interface MockIntent {
  reply: string;
  calls: ActionCall[];
}

/** Sentence → structured call(s). Exported so tests can assert the intent without running it. */
export function parseIntent(text: string, now: Date = getNow()): MockIntent {
  const t = text.toLowerCase();
  const subject = detectSubject(text);
  const when = parseWhen(text, now);
  const afterColon = text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : null;
  const deadline = when ? (when.time ? `${when.date}T${when.time}` : when.date) : undefined;

  // --- delete (destructive: the action layer will ask before doing it) ---
  if (/\b(lösch|loesch|entferne|weg damit)/.test(t)) {
    if (/notiz/.test(t)) {
      const hit = findNotes(text, subject)[0];
      return hit
        ? { reply: `Ich lösche die Notiz „${hit.title}".`, calls: [{ action: 'delete_note', params: { id: hit.id } }] }
        : { reply: 'Ich finde keine passende Notiz.', calls: [] };
    }
    const hit = findTasks(text, subject)[0];
    return hit
      ? { reply: `Ich lösche die Aufgabe „${hit.title}".`, calls: [{ action: 'delete_task', params: { id: hit.id } }] }
      : { reply: 'Ich finde keine passende Aufgabe.', calls: [] };
  }

  // --- complete ---
  if (/\b(abgehakt|erledigt|fertig|abhaken|hab ich gemacht)\b/.test(t) && !/was |welche /.test(t)) {
    const hit = findTasks(text, subject)[0];
    return hit
      ? { reply: `„${hit.title}" ist erledigt.`, calls: [{ action: 'complete_task', params: { id: hit.id } }] }
      : { reply: 'Ich finde keine passende offene Aufgabe.', calls: [] };
  }

  // --- move / change a deadline ---
  if (/\b(verschieb|schieb|ändere|aendere|verleg)/.test(t)) {
    const hit = findTasks(text, subject)[0];
    if (!hit) return { reply: 'Ich finde keine passende Aufgabe.', calls: [] };
    if (!deadline) return { reply: 'Auf welches Datum soll ich sie verschieben?', calls: [] };
    return {
      reply: `Ich verschiebe „${hit.title}" auf ${deadline}.`,
      calls: [{ action: 'update_task', params: { id: hit.id, deadline } }],
    };
  }

  // --- create a note ---
  if (/\bnotiz(en)?\b/.test(t) && /\b(schreib|notier|füge|fuege|mach|erstell|neue)/.test(t)) {
    const body = afterColon ?? cleanTitle(text, [when?.phrase ?? '']);
    const title = body.split(/[.!?]/)[0].split(/\s+/).slice(0, 7).join(' ') || 'Notiz';
    return {
      reply: `Ich lege die Notiz „${title}" an.`,
      calls: [{ action: 'create_note', params: { title, body, ...(subject ? { subject } : {}) } }],
    };
  }

  // --- create a task ---
  if (/\b(aufgabe|to-?do|serie|blatt|übung|uebung|problem set|abgabe)\b/.test(t) && /\b(füge|fuege|mach|erstell|neue|trag|leg|hinzu)/.test(t)) {
    const title = cleanTitle(afterColon ?? text, [when?.phrase ?? '']) || 'Neue Aufgabe';
    return {
      reply: `Ich lege „${title}" an${deadline ? `, fällig ${deadline}` : ''}.`,
      calls: [{ action: 'create_task', params: { title, ...(subject ? { subject } : {}), ...(deadline ? { deadline } : {}) } }],
    };
  }

  // --- questions about the timetable ---
  if (/\b(stundenplan|vorlesung|übung|uebung|termin|wann)\b/.test(t) || /\bwas (habe|hab) ich\b/.test(t)) {
    const days = when ? Math.max(1, daysBetween(now, new Date(`${when.date}T12:00`)) + 1) : 7;
    return {
      reply: when ? `Dein Plan für ${when.phrase}:` : 'Dein Plan für die nächsten Tage:',
      calls: [{ action: 'get_schedule', params: { days } }],
    };
  }

  // --- questions about notes ---
  if (/\bnotiz(en)?\b/.test(t)) {
    return { reply: 'Deine Notizen:', calls: [{ action: 'get_notes', params: subject ? { subject } : {} }] };
  }

  // --- questions about tasks ---
  if (/\b(was|welche|wie viel|wieviel)\b/.test(t) || /\b(offen|machen|erledigen|to-?do|aufgabe)/.test(t)) {
    const week = /\bdiese woche\b/.test(t);
    // Days left until Sunday: Monday → 6, Sunday → 0.
    const untilSunday = 6 - ((now.getDay() + 6) % 7);
    const withinDays = week ? untilSunday : when ? Math.max(0, daysBetween(now, new Date(`${when.date}T12:00`))) : undefined;
    return {
      reply: week ? 'Das steht diese Woche noch an:' : 'Das ist offen:',
      calls: [{ action: 'get_tasks', params: { status: 'open', ...(subject ? { subject } : {}), ...(withinDays !== undefined ? { withinDays } : {}) } }],
    };
  }

  return {
    reply: 'Das habe ich nicht verstanden. Ich kann Aufgaben und Notizen anlegen, ändern, löschen und deinen Stundenplan vorlesen.',
    calls: [],
  };
}

export function mockProvider(now?: () => Date): AIProvider {
  return {
    id: 'mock',
    label: 'Regelbasierter Test-Assistent (ohne Modell)',
    complete(req): Promise<AIReply> {
      const last = [...req.messages].reverse().find((m) => m.role === 'user');
      const intent = parseIntent(last?.content ?? '', now?.() ?? getNow());
      return Promise.resolve({ text: intent.reply, calls: intent.calls });
    },
  };
}

export const weekdayName = (d: Date) => DAY_LONG[d.getDay()];
