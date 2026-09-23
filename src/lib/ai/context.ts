import { COURSE_EXERCISES } from '../../data/exercises';
import { seed } from '../../data/seed';
import { COURSES, buildItems, targetOf } from '../data';
import { bonusFromFormula, goalProgress } from '../exercises';
import { getNow } from '../now';
import { KIND_LABEL, freeSlots, occurrencesOn } from '../schedule';
import { GENERAL_ID } from '../state';
import { getPersonal } from '../store';
import { endsAt, getTimer, weekStats } from '../timer';
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

/** One official course exercise with the student's progress – same source as the UI. */
export interface AIExercise {
  id: string;
  title: string;
  subject: string;
  subjectId: string;
  /** The course's own wording, e.g. "Bonusaufgabe", "Quiz (10 Minuten)" */
  type: string;
  /** Cross-course role for filtering: normal | bonus | quiz | assessment | project | admin */
  role: string;
  bonusRelevant: boolean;
  deadline: string | null;
  /** Monday of the week, when the course only names a week */
  weekOf?: string;
  /** What the course says instead of a date */
  dateNote?: string;
  status: 'open' | 'done';
  correct?: boolean;
  overdue: boolean;
  daysLeft: number | null;
  where?: string;
  url?: string;
}

/** A course's bonus rule and how far the student has come with it. */
export interface AIBonus {
  subject: string;
  subjectId: string;
  kind: string;
  headline: string;
  max?: string;
  /** The rule in the course's own words */
  quote?: string;
  source?: string;
  facts: { q: string; a: string }[];
  progress: { label: string; have: number; required?: number; of?: number; reached: boolean }[];
  currentBonus?: string;
  rhythm?: string;
  /** What is NOT public – the assistant must not fill these gaps with guesses */
  unverified: string[];
}

/** A link the student can open – Notion's (read-only) or an own one (has an id, editable). */
export interface AILink {
  id?: string;
  label: string;
  url: string;
  subject: string;
  subjectId: string;
  own: boolean;
}

export interface AIScheduleDay {
  date: string;
  weekday: string;
  isoWeek: number;
  sessions: { subject: string; subjectId: string; kind: string; start: string; end: string; room: string; uncertain?: string }[];
  /** Gaps of 45+ minutes between 08:00 and 18:00 (for today: from now on) – where studying fits. */
  free: string[];
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
  links: AILink[];
  /** Official course exercises (read-only definitions + own progress) */
  exercises: AIExercise[];
  /** One entry per course that has a bonus / graded-performance rule */
  bonus: AIBonus[];
  schedule: AIScheduleDay[];
  /** Focus-timer time studied this ISO week, and a block running right now (if any). */
  study: { weekMinutes: number; bySubject: { subject: string; minutes: number }[]; running: { subject: string; endsAt: string } | null };
}

export interface AIContext {
  generatedAt: string;
  permanent: AIPermanentContext;
  dynamic: AIDynamicContext;
}

const CONSTRAINTS = [
  'Der Stundenplan (Vorlesungen und Übungen) stammt aus einem nur lesbaren Notion-Snapshot und kann nicht geändert werden.',
  'Aufgaben aus Notion können abgehakt oder ausgeblendet, aber nicht bearbeitet werden. Ausblenden entfernt sie nur aus der Ansicht – Notion selbst bleibt unverändert.',
  'Eigene To-dos, eigene Notizen, eigene Links und eigene Prüfungstermine können angelegt, geändert und wirklich gelöscht werden.',
  'Links aus Notion sind nur lesbar. Links werden nur mit http(s)-Adresse gespeichert.',
  'Löschen bzw. Ausblenden wird nie ohne ausdrückliche Bestätigung ausgeführt (delete_task fragt immer erst nach).',
  'Offizielle Kursübungen (Serien, Bonusaufgaben, Quiz) sind nur abhakbar oder ausblendbar, nicht bearbeitbar und nicht wirklich löschbar.',
  'Termine, die unter "dateNote" stehen, sind nicht öffentlich bekannt – solche Termine nie erfinden, sondern sagen, wo sie stehen.',
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

  // Official course exercises have their own list below – here only Notion tasks, own to-dos, exams.
  const tasks: AITask[] = items.filter((i) => i.kind !== 'exercise').slice(0, max).map((i) => {
    const days = i.due ? daysBetween(now, i.due) : null;
    return {
      id: i.id,
      title: i.title,
      subject: targetOf(i.courseId).name,
      subjectId: i.courseId,
      origin: i.kind as AITask['origin'],
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

  const links: AILink[] = [
    ...seed.adminLinks.map((l) => ({ label: l.label, url: l.url, subject: 'Allgemein', subjectId: GENERAL_ID, own: false })),
    ...COURSES.flatMap((c) => c.links.map((l) => ({ label: l.label, url: l.url, subject: c.name, subjectId: c.id, own: false }))),
    ...Object.values(synced.links)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(0, max)
      .map((l) => ({ id: l.id, label: l.label, url: l.url, subject: targetOf(l.courseId).name, subjectId: l.courseId, own: true })),
  ];

  // Weekends included: no lectures, but that is exactly when a lot of studying happens.
  const schedule: AIScheduleDay[] = Array.from({ length: horizon }, (_, d) => addDays(now, d))
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
      free: freeSlots(day, COURSES, synced.prefs, { notBefore: now }).map((f) => `${f.start}–${f.end}`),
    }));

  const exercises: AIExercise[] = items
    .filter((i) => i.kind === 'exercise')
    .map((i) => {
      const days = i.due ? daysBetween(now, i.due) : null;
      return {
        id: i.id,
        title: i.title,
        subject: targetOf(i.courseId).name,
        subjectId: i.courseId,
        type: i.exercise!.typeLabel,
        role: i.exercise!.role,
        bonusRelevant: i.exercise!.bonus,
        deadline: i.due ? toLocalISO(i.due) : null,
        ...(i.exercise!.weekStart ? { weekOf: toLocalDate(i.exercise!.weekStart) } : {}),
        ...(i.exercise!.dateNote ? { dateNote: i.exercise!.dateNote } : {}),
        status: i.done ? ('done' as const) : ('open' as const),
        ...(i.exercise!.tracksCorrect ? { correct: i.exercise!.correct } : {}),
        overdue: !i.done && days !== null && days < 0,
        daysLeft: days,
        ...(i.exercise!.where ? { where: i.exercise!.where } : {}),
        ...(i.exercise!.url ? { url: i.exercise!.url } : {}),
      };
    });

  const bonus: AIBonus[] = Object.values(COURSE_EXERCISES).map((cfg) => {
    const value = bonusFromFormula(cfg.courseId, synced);
    return {
      subject: targetOf(cfg.courseId).name,
      subjectId: cfg.courseId,
      kind: cfg.bonus.kind,
      headline: cfg.bonus.headline,
      ...(cfg.bonus.max ? { max: cfg.bonus.max } : {}),
      ...(cfg.bonus.quote ? { quote: cfg.bonus.quote } : {}),
      ...(cfg.bonus.quoteSource ? { source: cfg.bonus.quoteSource.url } : {}),
      facts: cfg.bonus.facts,
      progress: goalProgress(cfg.courseId, synced).map((g) => ({
        label: g.label,
        have: g.have,
        ...(g.required !== undefined ? { required: g.required } : {}),
        ...(g.of !== undefined ? { of: g.of } : {}),
        reached: g.reached,
      })),
      ...(value ? { currentBonus: value.text } : {}),
      ...(cfg.rhythm ? { rhythm: cfg.rhythm } : {}),
      unverified: cfg.unverified,
    };
  });

  const stats = weekStats(Object.values(synced.study), now);
  const running = getTimer();
  const study = {
    weekMinutes: stats.total,
    bySubject: stats.byCourse.map((c) => ({ subject: targetOf(c.courseId).name, minutes: c.minutes })),
    running: running ? { subject: targetOf(running.courseId).name, endsAt: toLocalISO(new Date(endsAt(running))).slice(11) } : null,
  };

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
    links,
    exercises,
    bonus,
    schedule,
    study,
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

  lines.push('', `## Übungen des Kurses (${d.exercises.filter((e) => e.status === 'open').length} offen)`);
  if (d.exercises.length === 0) lines.push('- keine hinterlegt');
  for (const e of d.exercises) {
    const when = e.deadline ? `fällig ${e.deadline}${e.overdue ? ' (ÜBERFÄLLIG)' : ''}` : e.weekOf ? `in der Woche vom ${e.weekOf}` : (e.dateNote ?? 'ohne Termin');
    const state = e.status === 'done' ? (e.correct === true ? 'erledigt, korrekt' : 'erledigt') : 'offen';
    lines.push(`- [${e.id}] ${e.title} · ${e.subject} · ${e.type}${e.bonusRelevant ? ' (bonusrelevant)' : ''} · ${when} · ${state}`);
  }

  lines.push('', '## Bonus / Leistung pro Fach');
  for (const b of d.bonus) {
    lines.push(`- ${b.subject}: ${b.headline}${b.max ? ` (max. ${b.max})` : ''}`);
    for (const p of b.progress) lines.push(`  · ${p.label}: ${p.have}${p.required !== undefined ? ` von ${p.required}` : ''}${p.reached ? ' ✓' : ''}`);
    if (b.currentBonus) lines.push(`  · aktuell: ${b.currentBonus}`);
    for (const f of b.facts) lines.push(`  · ${f.q} ${f.a}`);
    if (b.unverified.length) lines.push(`  · nicht öffentlich bekannt: ${b.unverified.join('; ')}`);
  }

  lines.push('', '## Links');
  for (const l of d.links) lines.push(`- ${l.own ? `[${l.id}] ` : ''}${l.label} · ${l.subject} · ${l.url}${l.own ? '' : ' · aus Notion, nur lesbar'}`);

  lines.push('', '## Stundenplan');
  for (const day of d.schedule) {
    const busy = day.sessions.length ? day.sessions.map((s) => `${s.start}–${s.end} ${s.subject} (${s.kind}, ${s.room})`).join(' | ') : 'keine Veranstaltungen';
    lines.push(`- ${day.weekday} ${day.date}: ${busy}${day.free.length ? ` · frei: ${day.free.join(', ')}` : ''}`);
  }

  lines.push('', `## Lernzeit diese Woche: ${d.study.weekMinutes} min`);
  for (const s of d.study.bySubject) lines.push(`- ${s.subject}: ${s.minutes} min`);
  if (d.study.running) lines.push(`- Läuft gerade: Lernblock ${d.study.running.subject} bis ${d.study.running.endsAt}`);

  lines.push('', '## Grenzen');
  for (const c of p.constraints) lines.push(`- ${c}`);

  return lines.join('\n');
}

export { GENERAL_ID };
