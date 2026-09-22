import { useMemo } from 'react';
import { seed } from '../data/seed';
import type { Course } from '../types';
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

/** One row in any to-do/deadline list: a Notion task, an own to-do or an exam */
export interface Item {
  id: string;
  kind: 'notion' | 'todo' | 'exam';
  courseId: string;
  title: string;
  /** The moment it is due (end of day for all-day to-dos) */
  due?: Date;
  allDay: boolean;
  done: boolean;
  inProgress: boolean;
  location?: string;
  createdAt: number;
}

/** Dated items first (by date), then undated ones in creation order */
export const byDue = (a: Item, b: Item) => {
  if (a.due && b.due) return +a.due - +b.due;
  if (a.due) return -1;
  if (b.due) return 1;
  return a.createdAt - b.createdAt;
};

export function buildItems(s: SyncedState, now: Date): Item[] {
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
  return [...notion, ...todos, ...exams].sort(byDue);
}

export function useItems(): Item[] {
  const { synced } = usePersonal();
  const now = useNow();
  const minute = Math.floor(+now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildItems(synced, now), [synced, minute]);
}

/** Open dated items that are overdue or due within `days` calendar days */
export const dueWithin = (items: Item[], now: Date, days: number) =>
  items.filter((i) => !i.done && i.due && daysBetween(now, i.due) <= days);

/** Open to-dos that are NOT time-critical (no date, or due later than `days`) */
export const backlog = (items: Item[], now: Date, days: number) =>
  items.filter((i) => i.kind === 'todo' && !i.done && (!i.due || daysBetween(now, i.due) > days));
