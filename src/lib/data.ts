import { useMemo } from 'react';
import { seed } from '../data/seed';
import type { Course, ExerciseRole } from '../types';
import { exerciseEntries, exerciseStatus, isKeyRole } from './exercises';
import { useNow } from './now';
import { GENERAL_ID, type SyncedState } from './state';
import { usePersonal } from './store';
import { daysBetween, dueMoment, isAllDay, parseLocal } from './time';

export const COURSES = seed.courses;
export const courseById = (id: string): Course | undefined => COURSES.find((c) => c.id === id);
export const notesOf = (courseId: string) => seed.notes.filter((n) => n.courseId === courseId);

/** Own links of a course (or of "Allgemein") in the order they were added. */
export const ownLinksOf = (s: SyncedState, courseId: string) =>
  Object.values(s.links).filter((l) => l.courseId === courseId).sort((a, b) => a.createdAt - b.createdAt);

/** Anything a to-do can belong to: the courses plus "Allgemein" (admin stuff, no course) */
export interface Target {
  id: string;
  name: string;
  shortName: string;
  color: string;
}
export const GENERAL: Target = { id: GENERAL_ID, name: 'Allgemein', shortName: 'Allgemein', color: '#8b8e95' };
export const TARGETS: Target[] = [...COURSES.map(({ id, name, shortName, color }) => ({ id, name, shortName, color })), GENERAL];
export const targetOf = (id: string): Target => TARGETS.find((t) => t.id === id) ?? GENERAL;

/** What an official course exercise adds to an item – the course's own wording included. */
export interface ExerciseMeta {
  typeId: string;
  typeLabel: string;
  typeShort: string;
  role: ExerciseRole;
  /** Counts towards this course's bonus or graded performance */
  bonus: boolean;
  compulsory: boolean;
  /** This type tracks "correct/passed" separately from "handed in" */
  tracksCorrect: boolean;
  correct: boolean;
  /** Monday of the week, when the source names a week but no day */
  weekStart?: Date;
  /** What the source says instead of a date */
  dateNote?: string;
  detail?: string;
  where?: string;
  url?: string;
  /** Set when the student added the link themselves (then it is editable) */
  ownUrl?: string;
  /** Decides the grade – bonus task, quiz, midterm. These are the ones marked in red. */
  key: boolean;
}

/** One row in any to-do/deadline list: a Notion task, an own to-do, an exam or an official exercise */
export interface Item {
  id: string;
  kind: 'notion' | 'todo' | 'exam' | 'exercise';
  courseId: string;
  title: string;
  /** The moment it is due (end of day for all-day to-dos) */
  due?: Date;
  allDay: boolean;
  done: boolean;
  inProgress: boolean;
  location?: string;
  createdAt: number;
  /** Set exactly for kind === 'exercise' (src/data/exercises.ts + the user's progress) */
  exercise?: ExerciseMeta;
}

/** Dated items first (by date), then undated ones in creation order */
export const byDue = (a: Item, b: Item) => {
  if (a.due && b.due) return +a.due - +b.due;
  if (a.due) return -1;
  if (b.due) return 1;
  return a.createdAt - b.createdAt;
};

function rawItems(s: SyncedState, now: Date): Item[] {
  const notion: Item[] = seed.tasks.map((t) => {
    const done = s.taskDone[t.id]?.done ?? t.status === 'done';
    return { id: t.id, kind: 'notion', courseId: t.courseId, title: t.title, due: parseLocal(t.due), allDay: false, done, inProgress: !done && t.status === 'in-progress', createdAt: 0 };
  });
  const todos: Item[] = Object.values(s.todos).map((t) => ({
    id: t.id,
    kind: 'todo',
    courseId: t.courseId,
    title: t.text,
    due: t.due ? dueMoment(t.due) : undefined,
    allDay: t.due ? isAllDay(t.due) : false,
    done: t.done,
    inProgress: false,
    createdAt: t.createdAt,
  }));
  const exams: Item[] = Object.values(s.exams).map((e) => {
    const when = parseLocal(e.when);
    return { id: e.id, kind: 'exam', courseId: e.courseId, title: e.title, due: when, allDay: false, done: +when < +now, inProgress: false, location: e.location, createdAt: 0 };
  });
  // Official course exercises: read-only definitions joined with the student's own progress.
  const exercises: Item[] = exerciseEntries().map((e, i) => {
    const st = exerciseStatus(s, e.exercise.id);
    return {
      id: e.exercise.id,
      kind: 'exercise' as const,
      courseId: e.courseId,
      title: e.exercise.title,
      due: e.due,
      allDay: e.allDay,
      done: st.done,
      inProgress: false,
      createdAt: 2_000_000 + i,
      exercise: {
        typeId: e.type.id,
        typeLabel: e.type.label,
        typeShort: e.type.short,
        role: e.type.role,
        bonus: e.type.bonusRelevant,
        compulsory: e.type.compulsory,
        tracksCorrect: !!e.type.tracksCorrect,
        correct: st.correct,
        weekStart: e.weekStart,
        dateNote: e.exercise.dateNote,
        detail: e.exercise.detail,
        where: e.type.where,
        // the student's own link wins – it is the one they picked for this exercise
        url: st.url ?? e.exercise.url,
        ownUrl: st.url,
        key: isKeyRole(e.type.role),
      },
    };
  });
  return [...notion, ...todos, ...exams, ...exercises].sort(byDue);
}

/**
 * Everything the student can act on, minus anything they hid. Hiding is the only way to make a
 * read-only item (Notion task, course exercise) disappear – the source itself is untouched, so this
 * is the one place that filters it out, and every view (Tasks, Week, Course page, AI context, …)
 * goes through here and therefore agrees.
 */
export function buildItems(s: SyncedState, now: Date): Item[] {
  return rawItems(s, now).filter((i) => !s.hidden[i.id]?.hidden);
}

/** The hidden items themselves – so Settings can list them and offer "Einblenden" (undo). */
export function hiddenItems(s: SyncedState, now: Date): Item[] {
  return rawItems(s, now).filter((i) => !!s.hidden[i.id]?.hidden);
}

export function useItems(): Item[] {
  const { synced } = usePersonal();
  const now = useNow();
  const minute = Math.floor(+now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildItems(synced, now), [synced, minute]);
}

/**
 * Open items that count as "to do" in the badge and the headline: everything dated, plus undated
 * personal to-dos. An official exercise whose date is not public yet (e.g. "Bonusaufgabe 7") is a
 * placeholder, not work you could do today – it would only inflate the number.
 */
export const openWork = (items: Item[]) => items.filter((i) => !i.done && (i.kind !== 'exercise' || !!i.due || !!i.exercise?.weekStart));

/** Official exercises without any date yet – shown apart, never counted */
export const undatedExercises = (items: Item[]) => items.filter((i) => i.kind === 'exercise' && !i.done && !i.due && !i.exercise?.weekStart);

/** Open dated items that are overdue or due within `days` calendar days */
export const dueWithin = (items: Item[], now: Date, days: number) =>
  items.filter((i) => !i.done && i.due && daysBetween(now, i.due) <= days);

/** Open to-dos that are NOT time-critical (no date, or due later than `days`) */
export const backlog = (items: Item[], now: Date, days: number) =>
  items.filter((i) => i.kind === 'todo' && !i.done && (!i.due || daysBetween(now, i.due) > days));
