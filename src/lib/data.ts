import { useMemo } from 'react';
import { seed } from '../data/seed';
import type { Course, Deadline } from '../types';
import { useNow } from './now';
import { parseLocal } from './time';
import { usePersonal, type PersonalState } from './store';

export const COURSES = seed.courses;
export const courseById = (id: string): Course | undefined => COURSES.find((c) => c.id === id);
export const notesOf = (courseId: string) => seed.notes.filter((n) => n.courseId === courseId);

/** Notion tasks (with local check-off overrides) + local tasks + user-entered exams, sorted by date. */
export function buildDeadlines(p: PersonalState, now: Date): Deadline[] {
  const notion: Deadline[] = seed.tasks.map((t) => {
    const done = p.taskDone[t.id] ?? t.status === 'done';
    return {
      id: t.id,
      kind: 'task',
      courseId: t.courseId,
      title: t.title,
      when: parseLocal(t.due),
      done,
      inProgress: !done && t.status === 'in-progress',
      local: false,
      meta: t.category,
    };
  });
  const local: Deadline[] = p.localTasks.map((t) => ({
    id: t.id,
    kind: 'task',
    courseId: t.courseId,
    title: t.title,
    when: parseLocal(t.due),
    done: t.status === 'done',
    inProgress: false,
    local: true,
    meta: t.category,
  }));
  const exams: Deadline[] = p.exams.map((e) => ({
    id: e.id,
    kind: 'exam',
    courseId: e.courseId,
    title: e.title,
    when: parseLocal(e.when),
    done: +parseLocal(e.when) < +now,
    inProgress: false,
    local: true,
    meta: e.location,
  }));
  return [...notion, ...local, ...exams].sort((a, b) => +a.when - +b.when);
}

export function useDeadlines(): Deadline[] {
  const p = usePersonal();
  const now = useNow();
  const minute = Math.floor(+now / 60_000);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => buildDeadlines(p, now), [p, minute]);
}
