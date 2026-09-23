import { COURSE_EXERCISES, ROLE_LABEL } from '../data/exercises';
import { seed } from '../data/seed';
import type { BonusGoal, CourseExercises, ExerciseRole, ExerciseType, OfficialExercise } from '../types';
import type { SyncedState } from './state';
import { dueMoment, isAllDay, parseLocal } from './time';

/**
 * Official exercises = read-only course data (src/data/exercises.ts) + the student's own progress
 * (SyncedState.exercises). This module is the only place that joins the two, so every view – course
 * page, tasks, week, bonus page, search and the AI context – counts exactly the same things.
 */

export interface ExerciseEntry {
  exercise: OfficialExercise;
  type: ExerciseType;
  courseId: string;
  /** Exact deadline, when the source states one */
  due?: Date;
  allDay: boolean;
  /** Monday of the week, when the source only names a week */
  weekStart?: Date;
  /** Position in the course configuration – keeps lists stable */
  order: number;
}

export interface ExerciseStatus {
  done: boolean;
  /** Only meaningful for types with `tracksCorrect` */
  correct: boolean;
}

export interface GoalProgress {
  goal: BonusGoal;
  label: string;
  have: number;
  required?: number;
  of?: number;
  /** Requirement reached (only when the source names a number) */
  reached: boolean;
  hint?: string;
}

export const configOf = (courseId: string): CourseExercises | undefined => COURSE_EXERCISES[courseId];
export const hasExercises = (courseId: string) => !!COURSE_EXERCISES[courseId];
export const roleLabel = (role: ExerciseRole) => ROLE_LABEL[role] ?? role;

const ENTRIES: ExerciseEntry[] = Object.values(COURSE_EXERCISES).flatMap((cfg) =>
  cfg.exercises.map((exercise, i) => {
    const type = cfg.types.find((t) => t.id === exercise.typeId);
    if (!type) throw new Error(`Unbekannter Übungstyp "${exercise.typeId}" in ${cfg.courseId}`);
    return {
      exercise,
      type,
      courseId: cfg.courseId,
      due: exercise.dueAt ? dueMoment(exercise.dueAt) : undefined,
      allDay: exercise.dueAt ? isAllDay(exercise.dueAt) : false,
      weekStart: exercise.weekOf ? parseLocal(`${exercise.weekOf}T00:00`) : undefined,
      order: i,
    };
  }),
);

/** All official exercises, optionally of one course, in configuration order. */
export const exerciseEntries = (courseId?: string): ExerciseEntry[] =>
  courseId ? ENTRIES.filter((e) => e.courseId === courseId) : ENTRIES;

export const exerciseEntry = (id: string): ExerciseEntry | undefined => ENTRIES.find((e) => e.exercise.id === id);

/** The roles that actually occur in the configured courses, in a stable display order. */
const ROLE_ORDER: ExerciseRole[] = ['normal', 'bonus', 'quiz', 'assessment', 'project', 'admin'];
export const rolesInUse = (): ExerciseRole[] => ROLE_ORDER.filter((r) => ENTRIES.some((e) => e.type.role === r));

/**
 * The tasks page filter: official exercises by role, own to-dos, or the rest (Notion + exams).
 * Pure, so the same rule can be tested and reused.
 */
export const matchesTypeFilter = (i: { kind: string; exercise?: { role: string } }, filter: string | null): boolean =>
  !filter ? true
    : filter === 'todo' ? i.kind === 'todo'
    : filter === 'other' ? i.kind === 'notion' || i.kind === 'exam'
    : i.kind === 'exercise' && `role:${i.exercise?.role}` === filter;

/**
 * Does the week view show this? `null` means "not an exercise" (lectures, to-dos, exams – always
 * shown). The preference holds the roles to show; null there means all of them.
 */
export const visibleInWeek = (role: ExerciseRole | null, prefs: { weekExerciseRoles: string[] | null }): boolean =>
  role === null || prefs.weekExerciseRoles === null || prefs.weekExerciseRoles.includes(role);

export function exerciseStatus(synced: SyncedState, id: string): ExerciseStatus {
  const s = synced.exercises[id];
  return { done: !!s?.done, correct: !!s?.correct };
}

/** Value of a manual counter ("10 Serien abgegeben") – stored like an exercise, with a count. */
export const tallyValue = (synced: SyncedState, tallyId: string): number => Math.max(0, synced.exercises[tallyId]?.count ?? 0);

/** How far this course's bonus (or graded performance) has come, measured the way the course defines it. */
export function goalProgress(courseId: string, synced: SyncedState): GoalProgress[] {
  const cfg = COURSE_EXERCISES[courseId];
  if (!cfg) return [];
  return cfg.bonus.goals.map((goal) => {
    let have = 0;
    if (goal.metric === 'count') {
      have = goal.tallyId ? tallyValue(synced, goal.tallyId) : 0;
    } else {
      const entries = exerciseEntries(courseId).filter(
        (e) => (!goal.typeIds || goal.typeIds.includes(e.type.id)) && (!goal.exerciseIds || goal.exerciseIds.includes(e.exercise.id)),
      );
      have = entries.filter((e) => {
        const s = exerciseStatus(synced, e.exercise.id);
        return goal.metric === 'correct' ? s.correct : s.done;
      }).length;
    }
    return {
      goal,
      label: goal.label,
      have,
      required: goal.required,
      of: goal.of,
      reached: goal.required !== undefined && have >= goal.required,
      hint: goal.hint,
    };
  });
}

/** Where a course turns points into a grade bonus, the number that comes out right now. */
export function bonusFromFormula(courseId: string, synced: SyncedState): { value: number; text: string } | null {
  const cfg = COURSE_EXERCISES[courseId];
  const f = cfg?.bonus.formula;
  if (!cfg || !f) return null;
  const goal = goalProgress(courseId, synced).find((g) => g.goal.id === f.goalId);
  if (!goal) return null;
  const value = Math.min(f.cap, goal.have * f.perUnit);
  return { value, text: `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')} ${f.unit}` };
}

/** Courses that have a configuration, in the order of the timetable data. */
export const coursesWithExercises = () => seed.courses.filter((c) => !!COURSE_EXERCISES[c.id]);

/** Ids of every exercise of a course that counts towards a goal – used by the UI to show the goal inline. */
export function goalExerciseIds(courseId: string, goal: BonusGoal): string[] {
  return exerciseEntries(courseId)
    .filter((e) => (!goal.typeIds || goal.typeIds.includes(e.type.id)) && (!goal.exerciseIds || goal.exerciseIds.includes(e.exercise.id)))
    .map((e) => e.exercise.id);
}
