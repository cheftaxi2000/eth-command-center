/**
 * The app's OWN data model (never stored in or sent to Notion) and pure helpers:
 * defaults, v1 migration, validation and the conflict-free merge used by the sync.
 */

export const GENERAL_ID = 'allgemein';

export interface Todo {
  id: string;
  /** Course id or GENERAL_ID */
  courseId: string;
  text: string;
  /** "YYYY-MM-DD" (all day) or "YYYY-MM-DDTHH:mm" */
  due?: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Exam {
  id: string;
  courseId: string;
  title: string;
  when: string; // "YYYY-MM-DDTHH:mm"
  location?: string;
  updatedAt: number;
}

/** A free-form personal note (not from Notion), optionally filed under a course */
export interface Memo {
  id: string;
  /** Course id or GENERAL_ID */
  courseId: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

/** One finished focus session from the study timer (only finished ones are stored and synced). */
export interface StudySession {
  id: string;
  courseId: string;
  /** ms timestamp when it started */
  start: number;
  minutes: number;
  updatedAt: number;
}

/** Local check-off of a (read-only) Notion task */
export interface Override {
  done: boolean;
  updatedAt: number;
}

export interface Prefs {
  /** ISO calendar-week parity in which 2-weekly lectures take place; null = not chosen yet */
  biweeklyParity: 'odd' | 'even' | null;
  /** choiceGroup -> chosen session id */
  choices: Record<string, string>;
  updatedAt: number;
}

/** Everything that is synchronised between devices */
export interface SyncedState {
  v: 2;
  todos: Record<string, Todo>;
  exams: Record<string, Exam>;
  memos: Record<string, Memo>;
  study: Record<string, StudySession>;
  taskDone: Record<string, Override>;
  prefs: Prefs;
  /** id -> deletion time, so a deletion is not undone by another device's older copy */
  tombstones: Record<string, number>;
}

/** Device-specific settings (not synchronised) */
export interface LocalState {
  theme: 'system' | 'light' | 'dark';
  recent: string[];
  lastCourse?: string;
}

/**
 * Timetable details the student confirmed about their own schedule. Not in Notion and NOT guessed:
 * the Mechanik exercise attended is the Thursday 08:15 group (LEE D 105). Stored as a default so
 * the app never has to ask again, and still changeable in Settings.
 */
export const DEFAULT_CHOICES: Readonly<Record<string, string>> = { 'mechanik-uebung': 'mech-u-do1' };

export const emptySynced = (): SyncedState => ({
  v: 2,
  todos: {},
  exams: {},
  memos: {},
  study: {},
  taskDone: {},
  // The Analysis I Monday lecture is confirmed to run on even ISO weeks – not a Notion fact,
  // but a real schedule detail the student told us; still overridable in Settings.
  prefs: { biweeklyParity: 'even', choices: { ...DEFAULT_CHOICES }, updatedAt: 0 },
  tombstones: {},
});

export const defaultLocal = (): LocalState => ({ theme: 'system', recent: [] });

const TOMBSTONE_TTL = 90 * 86_400_000;

function mergeRecords<T extends { updatedAt: number }>(
  a: Record<string, T>,
  b: Record<string, T>,
  tombstones: Record<string, number>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id];
    const y = b[id];
    const win = !x ? y : !y ? x : y.updatedAt > x.updatedAt ? y : x;
    const deletedAt = tombstones[id];
    if (win && !(deletedAt !== undefined && deletedAt >= win.updatedAt)) out[id] = win;
  }
  return out;
}

/** Last-writer-wins per item; deletions win over older edits. Commutative, so devices converge. */
export function mergeSynced(a: SyncedState, b: SyncedState, now = Date.now()): SyncedState {
  const tombstones: Record<string, number> = {};
  for (const [id, t] of [...Object.entries(a.tombstones), ...Object.entries(b.tombstones)]) {
    if (now - t > TOMBSTONE_TTL) continue;
    tombstones[id] = Math.max(tombstones[id] ?? 0, t);
  }
  return {
    v: 2,
    todos: mergeRecords(a.todos, b.todos, tombstones),
    exams: mergeRecords(a.exams, b.exams, tombstones),
    memos: mergeRecords(a.memos, b.memos, tombstones),
    study: mergeRecords(a.study, b.study, tombstones),
    taskDone: mergeRecords(a.taskDone, b.taskDone, {}),
    prefs: b.prefs.updatedAt > a.prefs.updatedAt ? b.prefs : a.prefs,
    tombstones,
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

function pick<T>(raw: unknown, valid: (x: Record<string, unknown>) => boolean): Record<string, T> {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => isObj(v) && valid(v))) as Record<string, T>;
}

/** Defensive parse of synced/imported data – drops anything malformed instead of crashing. */
export function normalizeSynced(raw: unknown): SyncedState {
  const base = emptySynced();
  if (!isObj(raw)) return base;
  const prefs = isObj(raw.prefs) ? raw.prefs : {};
  return {
    v: 2,
    todos: pick<Todo>(raw.todos, (t) => typeof t.id === 'string' && typeof t.text === 'string' && typeof t.updatedAt === 'number'),
    exams: pick<Exam>(raw.exams, (e) => typeof e.id === 'string' && typeof e.when === 'string' && typeof e.updatedAt === 'number'),
    memos: pick<Memo>(raw.memos, (m) => typeof m.id === 'string' && typeof m.body === 'string' && typeof m.updatedAt === 'number'),
    study: pick<StudySession>(raw.study, (x) => typeof x.id === 'string' && typeof x.courseId === 'string' && typeof x.start === 'number' && typeof x.minutes === 'number' && x.minutes > 0 && typeof x.updatedAt === 'number'),
    taskDone: pick<Override>(raw.taskDone, (o) => typeof o.done === 'boolean' && typeof o.updatedAt === 'number'),
    prefs: {
      biweeklyParity: prefs.biweeklyParity === 'odd' || prefs.biweeklyParity === 'even' ? prefs.biweeklyParity : base.prefs.biweeklyParity,
      // Defaults first: an install from before a choice was known must not keep asking for it.
      choices: { ...DEFAULT_CHOICES, ...(isObj(prefs.choices) ? (prefs.choices as Record<string, string>) : {}) },
      updatedAt: typeof prefs.updatedAt === 'number' ? prefs.updatedAt : 0,
    },
    tombstones: isObj(raw.tombstones)
      ? (Object.fromEntries(Object.entries(raw.tombstones).filter(([, t]) => typeof t === 'number')) as Record<string, number>)
      : {},
  };
}

/** Shape of the first app version's localStorage ("eth-cc:v1") */
interface V1 {
  taskDone?: Record<string, boolean>;
  localTasks?: { id: string; courseId: string; title: string; due: string; status: string }[];
  exams?: { id: string; courseId: string; title: string; when: string; location?: string }[];
  prefs?: { biweeklyParity?: 'odd' | 'even' | null; choices?: Record<string, string> };
  theme?: LocalState['theme'];
  recent?: string[];
}

export function migrateV1(v1: V1, now = Date.now()): { synced: SyncedState; local: LocalState } {
  const synced = emptySynced();
  for (const t of v1.localTasks ?? []) {
    synced.todos[t.id] = { id: t.id, courseId: t.courseId, text: t.title, due: t.due, done: t.status === 'done', createdAt: now, updatedAt: now };
  }
  for (const e of v1.exams ?? []) synced.exams[e.id] = { ...e, updatedAt: now };
  for (const [id, done] of Object.entries(v1.taskDone ?? {})) synced.taskDone[id] = { done, updatedAt: now };
  if (v1.prefs) {
    synced.prefs = {
      biweeklyParity: v1.prefs.biweeklyParity ?? synced.prefs.biweeklyParity,
      choices: { ...synced.prefs.choices, ...v1.prefs.choices },
      updatedAt: now,
    };
  }
  return { synced, local: { ...defaultLocal(), theme: v1.theme ?? 'system', recent: v1.recent ?? [] } };
}

/** JSON with sorted keys: stable file contents and cheap equality checks */
export function canonical(value: unknown, indent?: number): string {
  return JSON.stringify(
    value,
    (_k, v) =>
      isObj(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : v,
    indent,
  );
}

export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
