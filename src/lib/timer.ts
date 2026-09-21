import { useSyncExternalStore } from 'react';
import type { StudySession } from './state';
import { actions } from './store';
import { startOfWeek } from './time';

/**
 * The focus timer. The RUNNING timer lives only on this device (localStorage, survives a reload);
 * once a session is finished it becomes a StudySession in the synced store, so the weekly total is
 * the same on every device.
 */

export interface RunningTimer {
  courseId: string;
  startedAt: number;
  minutes: number;
}

const KEY = 'eth-cc:timer';
/** Stopping earlier than this is treated as "didn't really start" and not logged. */
export const MIN_LOGGED = 5;

const listeners = new Set<() => void>();

function read(): RunningTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    const t = raw ? (JSON.parse(raw) as Partial<RunningTimer>) : null;
    return t && typeof t.courseId === 'string' && typeof t.startedAt === 'number' && typeof t.minutes === 'number' ? (t as RunningTimer) : null;
  } catch {
    return memory;
  }
}

let memory: RunningTimer | null = null;
let current: RunningTimer | null = read();

function set(next: RunningTimer | null) {
  current = next;
  memory = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* no storage (tests, private mode) – kept in memory */
  }
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    current = read();
    listeners.forEach((l) => l());
  });
}

export const getTimer = () => current;
export const useTimer = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getTimer,
    () => null,
  );

export const endsAt = (t: RunningTimer) => t.startedAt + t.minutes * 60_000;
export const remainingMs = (t: RunningTimer, now: number) => Math.max(0, endsAt(t) - now);

/** Starts a focus block; a timer already running is stopped (and logged) first. */
export function startTimer(courseId: string, minutes = 25, now = Date.now()): RunningTimer {
  if (current) stopTimer(now);
  const t = { courseId, startedAt: now, minutes: Math.max(1, Math.min(180, Math.round(minutes))) };
  set(t);
  return t;
}

/** Stops early. Returns the logged minutes, or 0 if it was too short to count. */
export function stopTimer(now = Date.now()): number {
  const t = current;
  if (!t) return 0;
  const minutes = Math.min(t.minutes, Math.floor((now - t.startedAt) / 60_000));
  set(null);
  if (minutes < MIN_LOGGED) return 0;
  actions.logStudy({ courseId: t.courseId, start: t.startedAt, minutes });
  return minutes;
}

/** If the running timer is over, log the full block and clear it. Returns it, so the UI can say so. */
export function completeIfDue(now = Date.now()): RunningTimer | null {
  const t = current;
  if (!t || now < endsAt(t)) return null;
  set(null);
  actions.logStudy({ courseId: t.courseId, start: t.startedAt, minutes: t.minutes });
  return t;
}

/** Minutes studied this ISO week (Mon–Sun), in total and per course, largest first. */
export function weekStats(sessions: StudySession[], now: Date) {
  const from = +startOfWeek(now);
  const week = sessions.filter((s) => s.start >= from && s.start <= +now);
  const byCourse = new Map<string, number>();
  for (const s of week) byCourse.set(s.courseId, (byCourse.get(s.courseId) ?? 0) + s.minutes);
  return {
    total: week.reduce((sum, s) => sum + s.minutes, 0),
    sessions: week.length,
    byCourse: [...byCourse.entries()].map(([courseId, minutes]) => ({ courseId, minutes })).sort((a, b) => b.minutes - a.minutes),
  };
}

export const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`);
