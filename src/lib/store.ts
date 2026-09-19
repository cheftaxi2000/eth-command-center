import { useSyncExternalStore } from 'react';
import type { Exam, Prefs, Task } from '../types';

/**
 * The app's OWN data: check-offs, user-entered tasks/exams, preferences.
 * Stored in localStorage on this device only. Nothing here is ever sent to or read
 * back from Notion.
 */
export interface PersonalState {
  /** Overrides for Notion tasks: id -> done? */
  taskDone: Record<string, boolean>;
  localTasks: Task[];
  exams: Exam[];
  prefs: Prefs;
  theme: 'system' | 'light' | 'dark';
  recent: string[];
}

export const defaultPersonal: PersonalState = {
  taskDone: {},
  localTasks: [],
  exams: [],
  prefs: { biweeklyParity: null, choices: {} },
  theme: 'system',
  recent: [],
};

const KEY = 'eth-cc:v1';

function load(): PersonalState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersonalState>;
      return {
        ...defaultPersonal,
        ...parsed,
        prefs: { ...defaultPersonal.prefs, ...parsed.prefs, choices: { ...parsed.prefs?.choices } },
      };
    }
  } catch {
    /* storage unavailable or corrupt – start fresh */
  }
  return defaultPersonal;
}

let state = load();
const listeners = new Set<() => void>();

function commit(next: PersonalState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota – keep in memory */
  }
  listeners.forEach((l) => l());
}

export const getPersonal = () => state;
export const usePersonal = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => state,
  );

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const actions = {
  setTaskDone(id: string, done: boolean, local: boolean) {
    if (local) {
      commit({
        ...state,
        localTasks: state.localTasks.map((t) => (t.id === id ? { ...t, status: done ? 'done' : 'not-started' } : t)),
      });
    } else {
      commit({ ...state, taskDone: { ...state.taskDone, [id]: done } });
    }
  },
  addTask(t: Omit<Task, 'id' | 'status' | 'category'>) {
    commit({ ...state, localTasks: [...state.localTasks, { ...t, id: uid('task'), status: 'not-started', category: 'Persönlich' }] });
  },
  removeTask(id: string) {
    commit({ ...state, localTasks: state.localTasks.filter((t) => t.id !== id) });
  },
  addExam(e: Omit<Exam, 'id'>) {
    commit({ ...state, exams: [...state.exams, { ...e, id: uid('exam') }] });
  },
  removeExam(id: string) {
    commit({ ...state, exams: state.exams.filter((e) => e.id !== id) });
  },
  setParity(p: Prefs['biweeklyParity']) {
    commit({ ...state, prefs: { ...state.prefs, biweeklyParity: p } });
  },
  setChoice(group: string, sessionId: string | null) {
    const choices = { ...state.prefs.choices };
    if (sessionId) choices[group] = sessionId;
    else delete choices[group];
    commit({ ...state, prefs: { ...state.prefs, choices } });
  },
  setTheme(theme: PersonalState['theme']) {
    commit({ ...state, theme });
  },
  touchCourse(id: string) {
    if (state.recent[0] === id) return;
    commit({ ...state, recent: [id, ...state.recent.filter((r) => r !== id)].slice(0, 4) });
  },
  resetAll() {
    commit(defaultPersonal);
  },
};
