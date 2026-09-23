import { useSyncExternalStore } from 'react';
import { normalizeUrl, suggestLabel } from './links';
import {
  canonical, defaultLocal, emptySynced, inferCategory, mergeSynced, migrateV1, normalizeSynced, uid,
  type Exam, type LocalState, type Memo, type OwnLink, type PushSub, type StudySession, type SyncedState, type Todo, type TodoCategory,
} from './state';

/**
 * The app's OWN data (to-dos, exams, notes, check-offs, preferences) in localStorage on this device.
 * Nothing here is ever written to Notion; the sync (lib/sync.ts) only talks to kvdb.io.
 */
export interface Personal {
  synced: SyncedState;
  local: LocalState;
}

const KEY = 'eth-cc:v2';
const V1_KEY = 'eth-cc:v1';

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function load(): Personal {
  const ls = storage();
  try {
    const raw = ls?.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Personal>;
      return { synced: normalizeSynced(p.synced), local: { ...defaultLocal(), ...p.local } };
    }
    const v1 = ls?.getItem(V1_KEY);
    if (v1) return migrateV1(JSON.parse(v1));
  } catch {
    /* corrupt storage – start fresh */
  }
  return { synced: emptySynced(), local: defaultLocal() };
}

let state: Personal = load();
const listeners = new Set<() => void>();
const syncedListeners = new Set<() => void>();

function commit(next: Personal, syncedChanged: boolean, notifySync = true) {
  state = next;
  try {
    storage()?.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota – keep in memory */
  }
  listeners.forEach((l) => l());
  if (syncedChanged && notifySync) syncedListeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

// Another tab of this same browser saved something: adopt it immediately. Deliberately not via
// commit() – the data is already in localStorage, and re-writing it would loop the sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY || !e.newValue) return;
    try {
      const p = JSON.parse(e.newValue) as Partial<Personal>;
      state = { synced: normalizeSynced(p.synced), local: { ...defaultLocal(), ...p.local } };
      listeners.forEach((l) => l());
    } catch {
      /* malformed write from another tab – keep what we have */
    }
  });
}

export const getPersonal = () => state;
export const usePersonal = () => useSyncExternalStore(subscribe, getPersonal, getPersonal);

/** The sync module registers here: called after every local change of synced data. */
export function onSyncedChange(cb: () => void) {
  syncedListeners.add(cb);
  return () => {
    syncedListeners.delete(cb);
  };
}

/** Used by the sync: adopt a merge result without triggering another sync round. */
export function applyMerged(merged: SyncedState) {
  if (canonical(merged) === canonical(state.synced)) return;
  commit({ ...state, synced: merged }, true, false);
}

const updateSynced = (fn: (s: SyncedState) => SyncedState) => commit({ ...state, synced: fn(state.synced) }, true);
const updateLocal = (patch: Partial<LocalState>) => commit({ ...state, local: { ...state.local, ...patch } }, false);
const now = () => Date.now();

type RecordKind = 'todos' | 'exams' | 'memos' | 'links' | 'exercises' | 'study' | 'push';

function put<K extends RecordKind>(kind: K, rec: SyncedState[K][string]) {
  updateSynced((s) => {
    const tombstones = { ...s.tombstones };
    delete tombstones[rec.id];
    return { ...s, [kind]: { ...s[kind], [rec.id]: rec }, tombstones } as SyncedState;
  });
}

function remove(kind: RecordKind, ids: string[]) {
  if (ids.length === 0) return;
  updateSynced((s) => {
    const records = { ...s[kind] };
    const tombstones = { ...s.tombstones };
    for (const id of ids) {
      delete records[id];
      tombstones[id] = now();
    }
    return { ...s, [kind]: records, tombstones } as SyncedState;
  });
}

export const actions = {
  /** Without a kind it is guessed from the text ("Bonusaufgabe 2" → Bonus); always changeable later. */
  addTodo(input: { courseId: string; text: string; due?: string; category?: TodoCategory; important?: boolean }): string {
    const id = uid('todo');
    const t = now();
    const text = input.text.trim();
    put('todos', {
      id, courseId: input.courseId, text, due: input.due || undefined, done: false,
      category: input.category ?? inferCategory(text), ...(input.important ? { important: true } : {}),
      createdAt: t, updatedAt: t,
    });
    updateLocal({ lastCourse: input.courseId });
    return id;
  },
  updateTodo(id: string, patch: Partial<Pick<Todo, 'text' | 'due' | 'courseId' | 'done' | 'category' | 'important'>>) {
    const cur = state.synced.todos[id];
    if (!cur) return;
    const next: Todo = { ...cur, ...patch, updatedAt: now() };
    if ('due' in patch && !patch.due) delete next.due;
    if (!next.important) delete next.important;
    put('todos', next);
  },
  setTodoDone(id: string, done: boolean) {
    actions.updateTodo(id, { done });
  },
  /** Returns the removed to-do so the caller can offer "Rückgängig" */
  deleteTodo(id: string): Todo | undefined {
    const cur = state.synced.todos[id];
    remove('todos', [id]);
    return cur;
  },
  restoreTodo(todo: Todo) {
    put('todos', { ...todo, updatedAt: now() });
  },
  clearDoneTodos(courseId?: string) {
    const ids = Object.values(state.synced.todos)
      .filter((t) => t.done && (!courseId || t.courseId === courseId))
      .map((t) => t.id);
    remove('todos', ids);
    return ids.length;
  },

  saveExam(input: Omit<Exam, 'id' | 'updatedAt'> & { id?: string }) {
    put('exams', { ...input, id: input.id ?? uid('exam'), location: input.location || undefined, updatedAt: now() });
  },
  deleteExam(id: string): Exam | undefined {
    const cur = state.synced.exams[id];
    remove('exams', [id]);
    return cur;
  },
  restoreExam(exam: Exam) {
    put('exams', { ...exam, updatedAt: now() });
  },

  /** Check off a Notion task – stored only in this app */
  setTaskDone(taskId: string, done: boolean) {
    updateSynced((s) => ({ ...s, taskDone: { ...s.taskDone, [taskId]: { done, updatedAt: now() } } }));
  },

  /**
   * Progress on an official course exercise. The exercise itself comes from the read-only course
   * data (src/data/exercises.ts) and is never changed here – only this check-off is the user's.
   */
  setExerciseDone(id: string, done: boolean) {
    const cur = state.synced.exercises[id];
    // Handing something in that was marked correct and is now un-ticked drops the correctness too.
    put('exercises', { ...cur, id, done, correct: done ? cur?.correct : false, updatedAt: now() });
  },
  /** "Korrekt" / "bestanden" – only used by course types that track it (e.g. Analysis, Chemistry-Quiz). */
  setExerciseCorrect(id: string, correct: boolean) {
    const cur = state.synced.exercises[id];
    put('exercises', { ...cur, id, done: correct ? true : cur?.done, correct, updatedAt: now() });
  },
  /**
   * An own link for an official exercise – the course's own definition stays untouched, this is just
   * where the student keeps the sheet or the submission page. null removes it again.
   */
  setExerciseUrl(id: string, url: string | null): boolean {
    const cur = state.synced.exercises[id];
    if (url === null) {
      const next = { ...cur, id, updatedAt: now() };
      delete next.url;
      put('exercises', next);
      return true;
    }
    const clean = normalizeUrl(url);
    if (!clean) return false;
    put('exercises', { ...cur, id, url: clean, updatedAt: now() });
    return true;
  },

  /**
   * Hide a read-only item (a Notion task or an official course exercise) from every list. The
   * source stays exactly as it is – this is a per-student preference, reversible with unhideItem.
   */
  hideItem(id: string) {
    updateSynced((s) => ({ ...s, hidden: { ...s.hidden, [id]: { id, hidden: true, updatedAt: now() } } }));
  },
  unhideItem(id: string) {
    updateSynced((s) => ({ ...s, hidden: { ...s.hidden, [id]: { id, hidden: false, updatedAt: now() } } }));
  },

  /** A plain counter for things a course has no individual entries for ("10 Serien abgegeben"). */
  setExerciseCount(tallyId: string, count: number) {
    put('exercises', { ...state.synced.exercises[tallyId], id: tallyId, count: Math.max(0, Math.round(count)), updatedAt: now() });
  },
  /** Which exercise roles the week view shows. null = all. A filter – it never changes exercise data. */
  setWeekExerciseRoles(roles: string[] | null) {
    updateSynced((s) => ({ ...s, prefs: { ...s.prefs, weekExerciseRoles: roles, updatedAt: now() } }));
  },

  setParity(p: 'odd' | 'even' | null) {
    updateSynced((s) => ({ ...s, prefs: { ...s.prefs, biweeklyParity: p, updatedAt: now() } }));
  },
  setChoice(group: string, sessionId: string | null) {
    updateSynced((s) => {
      const choices = { ...s.prefs.choices };
      if (sessionId) choices[group] = sessionId;
      else delete choices[group];
      return { ...s, prefs: { ...s.prefs, choices, updatedAt: now() } };
    });
  },

  setTheme(theme: LocalState['theme']) {
    updateLocal({ theme });
  },
  touchCourse(id: string) {
    if (state.local.recent[0] === id) return;
    updateLocal({ recent: [id, ...state.local.recent.filter((r) => r !== id)].slice(0, 4) });
  },

  /** Merge a backup file into the current data (nothing is overwritten blindly) */
  importBackup(raw: unknown) {
    updateSynced((s) => mergeSynced(s, normalizeSynced(raw)));
  },
  addMemo(input: { courseId: string; title: string; body: string }): string {
    const id = uid('memo');
    const t = now();
    put('memos', { id, courseId: input.courseId, title: input.title.trim(), body: input.body.trim(), createdAt: t, updatedAt: t });
    updateLocal({ lastCourse: input.courseId });
    return id;
  },
  updateMemo(id: string, patch: Partial<Pick<Memo, 'title' | 'body' | 'courseId'>>) {
    const cur = state.synced.memos[id];
    if (!cur) return;
    put('memos', { ...cur, ...patch, updatedAt: now() });
  },
  /** Returns the removed memo so the caller can offer "Rückgängig" */
  deleteMemo(id: string): Memo | undefined {
    const cur = state.synced.memos[id];
    remove('memos', [id]);
    return cur;
  },
  restoreMemo(memo: Memo) {
    put('memos', { ...memo, updatedAt: now() });
  },

  /**
   * An own link under "Ressourcen". Without a name it gets one from the address ("Moodle", the PDF's
   * file name …). Returns null – and stores nothing – if `url` is not a web address.
   */
  addLink(input: { courseId: string; url: string; label?: string }): string | null {
    const url = normalizeUrl(input.url);
    if (!url) return null;
    const id = uid('link');
    const t = now();
    put('links', { id, courseId: input.courseId, url, label: input.label?.trim() || suggestLabel(url), createdAt: t, updatedAt: t });
    return id;
  },
  /** false if there is no such link or the new address is not a web address (then nothing changes). */
  updateLink(id: string, patch: Partial<Pick<OwnLink, 'label' | 'url' | 'courseId'>>): boolean {
    const cur = state.synced.links[id];
    if (!cur) return false;
    const url = patch.url === undefined ? cur.url : normalizeUrl(patch.url);
    if (!url) return false;
    const label = patch.label === undefined ? cur.label : patch.label.trim() || suggestLabel(url);
    put('links', { ...cur, ...patch, url, label, updatedAt: now() });
    return true;
  },
  /** Returns the removed link so the caller can offer "Rückgängig" */
  deleteLink(id: string): OwnLink | undefined {
    const cur = state.synced.links[id];
    remove('links', [id]);
    return cur;
  },
  restoreLink(link: OwnLink) {
    put('links', { ...link, updatedAt: now() });
  },

  /** A finished focus session (see lib/timer.ts) – synced like everything else. */
  logStudy(input: { courseId: string; start: number; minutes: number }): string {
    const id = uid('study');
    put('study', { id, courseId: input.courseId, start: input.start, minutes: Math.round(input.minutes), updatedAt: now() });
    return id;
  },
  deleteStudy(id: string): StudySession | undefined {
    const cur = state.synced.study[id];
    remove('study', [id]);
    return cur;
  },

  /** This device's Web Push subscription – the reminder service sends to every one stored here. */
  savePushSub(sub: Omit<PushSub, 'updatedAt'>) {
    const cur = state.synced.push[sub.id];
    if (cur && cur.endpoint === sub.endpoint && cur.p256dh === sub.p256dh && cur.auth === sub.auth && cur.device === sub.device) return;
    put('push', { ...sub, updatedAt: now() });
  },
  removePushSub(id: string) {
    if (state.synced.push[id]) remove('push', [id]);
  },

  /** Deletes all own to-dos, exams, notes and links – on every synced device */
  deleteAllOwn() {
    remove('todos', Object.keys(state.synced.todos));
    remove('exams', Object.keys(state.synced.exams));
    remove('memos', Object.keys(state.synced.memos));
    remove('links', Object.keys(state.synced.links));
  },
};
