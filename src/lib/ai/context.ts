import { COURSES, buildItems, targetOf } from '../data';
import { getNow } from '../now';
import { KIND_LABEL, occurrencesOn } from '../schedule';
import { GENERAL_ID } from '../state';
import { getPersonal } from '../store';
import { DAY_LONG, addDays, daysBetween, isoWeek, toLocalDate, toLocalISO } from '../time';

/**
 * A structured snapshot of the whole app for an AI assistant.
 *
 * Two rules this file exists to enforce:
 *  1. ONE source of truth. Everything here is derived from the same store the UI renders from
 *     (lib/store.ts) and the same read-only Notion snapshot (data/seed.ts). There is no second
 *     data model for the AI, and nothing here is persisted – it is a projection, built on demand.
 *  2. NEVER stale. buildAIContext() reads getPersonal() at the moment it is called. Callers must
 *     call it per request, not once at startup; AIService does exactly that (see service.ts).
 *
 * The split into `permanent` and `dynamic` exists so a caller can send only what a question needs:
 * "Welche Fächer habe ich?" needs the permanent half, "Was ist noch offen?" the dynamic half.
 */

export interface AIContextOptions {
  now?: Date;
  /** How many days of timetable and deadlines the dynamic half covers. */
  horizonDays?: number;
  /** Upper bound per list, so a long history cannot blow up the prompt. */
  maxItems?: number;
  /** Note bodies can be long and personal – opt in explicitly. */
  includeNoteBodies?: boolean;
}

export interface AISubject {
  id: string;
  name: string;
  shortName: string;
  code: string;
  instructor: string;
  aliases: string[];
  sessions: { id: string; kind: string; weekday: string; start: string; end: string; room: string; biweekly?: true; alternativeGroup?: string }[];
}

export interface AITask {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  /** 'notion' items come from the read-only snapshot; only 'todo' and 'exam' are editable. */
  origin: 'notion' | 'todo' | 'exam';
  deadline: string | null;
  status: 'open' | 'done';
  overdue: boolean;
  daysLeft: number | null;
  editable: boolean;
}

export interface AINote {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  body?: string;
  updatedAt: string;
}

export interface AIScheduleDay {
  date: string;
  weekday: string;
  isoWeek: number;
  sessions: { subject: string; subjectId: string; kind: string; start: string; end: string; room: string; uncertain?: string }[];
}

export interface AIPermanentContext {
  app: { name: string; purpose: string; semester: string; locale: string; timezone: string };
  subjects: AISubject[];
  preferences: {
    biweeklyLectureWeeks: 'odd' | 'even' | 'unknown';
    exerciseGroups: Record<string, string>;
    theme: string;
  };
  /** What the assistant is structurally unable to change – stated, not discovered by trial. */
  constraints: string[];
}

export interface AIDynamicContext {
  today: { date: string; weekday: string; time: string; isoWeek: number };
  counts: { openTasks: number; overdue: number; dueWithinHorizon: number; notes: number };
  tasks: AITask[];
  notes: AINote[];
  schedule: AIScheduleDay[];
}

export interface AIContext {
  generatedAt: string;
  permanent: AIPermanentContext;
  dynamic: AIDynamicContext;
}

const CONSTRAINTS = [
  'Der Stundenplan (Vorlesungen und Übungen) stammt aus einem nur lesbaren Notion-Snapshot und kann nicht geändert werden.',
  'Aufgaben aus Notion können abgehakt, aber nicht bearbeitet oder gelöscht werden.',
  'Eigene To-dos, eigene Notizen und eigene Prüfungstermine können angelegt, geändert und gelöscht werden.',
  'Löschen wird nie ohne ausdrückliche Bestätigung ausgeführt.',
];

export function buildAIPermanentContext(): AIPermanentContext {
  const { synced, local } = getPersonal();
  return {
    app: {
      name: 'ETH Study Command Center',
      purpose: 'Persönliche Studienübersicht: Stundenplan, Aufgaben, Fristen, Notizen.',
      semester: COURSES[0]?.semester ?? '',
      locale: 'de-CH',
      timezone: 'Europe/Zurich',
    },
    subjects: COURSES.map((c) => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName,
      code: c.code,
      instructor: c.instructor,
      aliases: c.aliases,
      sessions: c.sessions.map((s) => ({
        id: s.id,
        kind: KIND_LABEL[s.kind],
        weekday: DAY_LONG[s.day],
        start: s.start,
        end: s.end,
        room: s.room,
        ...(s.biweekly ? { biweekly: true as const } : {}),
        ...(s.choiceGroup ? { alternativeGroup: s.choiceGroup } : {}),
      })),
    })),
    preferences: {
      biweeklyLectureWeeks: synced.prefs.biweeklyParity ?? 'unknown',
      exerciseGroups: { ...synced.prefs.choices },
      theme: local.theme,
    },
    constraints: CONSTRAINTS,
  };
}

export function buildAIDynamicContext(opts: AIContextOptions = {}): AIDynamicContext {
  const now = opts.now ?? getNow();
  const horizon = opts.horizonDays ?? 14;
  const max = opts.maxItems ?? 60;
  const { synced } = getPersonal();
  const items = buildItems(synced, now);

  const tasks: AITask[] = items.slice(0, max).map((i) => {
    const days = i.due ? daysBetween(now, i.due) : null;
    return {
      id: i.id,
      title: i.title,
      subject: targetOf(i.courseId).name,
      subjectId: i.courseId,
      origin: i.kind,
      deadline: i.due ? toLocalISO(i.due) : null,
      status: i.done ? 'done' : 'open',
      overdue: !i.done && days !== null && days < 0,
      daysLeft: days,
      editable: i.kind !== 'notion',
    };
  });

  const notes: AINote[] = Object.values(synced.memos)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, max)
    .map((m) => ({
      id: m.id,
      title: m.title,
      subject: targetOf(m.courseId).name,
      subjectId: m.courseId,
      ...(opts.includeNoteBodies ? { body: m.body } : {}),
      updatedAt: toLocalDate(new Date(m.updatedAt)),
    }));

  const schedule: AIScheduleDay[] = Array.from({ length: horizon }, (_, d) => addDays(now, d))
    .filter((day) => day.getDay() >= 1 && day.getDay() <= 5)
    .map((day) => ({
      date: toLocalDate(day),
      weekday: DAY_LONG[day.getDay()],
      isoWeek: isoWeek(day),
      sessions: occurrencesOn(day, COURSES, synced.prefs).map((o) => ({
        subject: o.course.name,
        subjectId: o.course.id,
        kind: KIND_LABEL[o.session.kind],
        start: o.session.start,
        end: o.session.end,
        room: o.session.room,
        ...(o.flag ? { uncertain: o.flag } : {}),
      })),
    }));

  const open = tasks.filter((t) => t.status === 'open');
  return {
    today: { date: toLocalDate(now), weekday: DAY_LONG[now.getDay()], time: toLocalISO(now).slice(11), isoWeek: isoWeek(now) },
    counts: {
      openTasks: open.length,
      overdue: open.filter((t) => t.overdue).length,
      dueWithinHorizon: open.filter((t) => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= horizon).length,
      notes: Object.keys(synced.memos).length,
    },
    tasks,
    notes,
    schedule,
  };
}

/** The whole picture. Built fresh on every call – see the note at the top of this file. */
export function buildAIContext(opts: AIContextOptions = {}): AIContext {
  return {
    generatedAt: toLocalISO(opts.now ?? getNow()),
    permanent: buildAIPermanentContext(),
    dynamic: buildAIDynamicContext(opts),
  };
}

/** Compact, human-readable rendering for a system prompt – far cheaper than raw JSON. */
export function formatAIContext(ctx: AIContext): string {
  const { permanent: p, dynamic: d } = ctx;
  const lines: string[] = [];

  lines.push(`# ${p.app.name}`, p.app.purpose, `Heute: ${d.today.weekday}, ${d.today.date}, ${d.today.time} (KW ${d.today.isoWeek}, ${p.app.timezone})`, '');

  lines.push('## Fächer');
  for (const s of p.subjects) {
    const when = s.sessions.map((x) => `${x.kind} ${x.weekday} ${x.start}–${x.end} ${x.room}${x.biweekly ? ' (2-wöchentlich)' : ''}`).join('; ');
    lines.push(`- ${s.name} [${s.id}] · ${s.instructor} · ${when}`);
  }

  lines.push('', `## Aufgaben (${d.counts.openTasks} offen, davon ${d.counts.overdue} überfällig)`);
  const open = d.tasks.filter((t) => t.status === 'open');
  if (open.length === 0) lines.push('- keine offenen Aufgaben');
  for (const t of open) {
    const when = t.deadline ? `fällig ${t.deadline}${t.overdue ? ' (ÜBERFÄLLIG)' : ''}` : 'ohne Frist';
    lines.push(`- [${t.id}] ${t.title} · ${t.subject} · ${when}${t.editable ? '' : ' · aus Notion, nur abhakbar'}`);
  }

  lines.push('', `## Eigene Notizen (${d.counts.notes})`);
  if (d.notes.length === 0) lines.push('- keine');
  for (const n of d.notes) lines.push(`- [${n.id}] ${n.title} · ${n.subject}${n.body ? ` · ${n.body.replace(/\s+/g, ' ').slice(0, 200)}` : ''}`);

  lines.push('', '## Stundenplan');
  for (const day of d.schedule) {
    if (day.sessions.length === 0) continue;
    lines.push(`- ${day.weekday} ${day.date}: ${day.sessions.map((s) => `${s.start}–${s.end} ${s.subject} (${s.kind}, ${s.room})`).join(' | ')}`);
  }

  lines.push('', '## Grenzen');
  for (const c of p.constraints) lines.push(`- ${c}`);

  return lines.join('\n');
}

export { GENERAL_ID };
