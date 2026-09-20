import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { backlog, buildItems, dueWithin } from './data';
import { parseRoom, roomUrl } from './rooms';
import { focusOfDay, nextOccurrence, occurrencesInWeek, occurrencesOn, suggestCourse } from './schedule';
import { createSearch, detectCourse, groupHits } from './search';
import { canonical, emptySynced, mergeSynced, migrateV1, normalizeSynced, type Memo, type SyncedState, type Todo } from './state';
import { syncOnce, type SyncApi } from './sync';
import { dueInfo, dueMoment, isoWeek, parseLocal, startOfWeek } from './time';

const prefs = emptySynced().prefs;
const at = (s: string) => parseLocal(s);
const todo = (id: string, patch: Partial<Todo> = {}): Todo => ({ id, courseId: 'analysis-1', text: id, done: false, createdAt: 1, updatedAt: 1, ...patch });
const withTodos = (...todos: Todo[]): SyncedState => ({ ...emptySynced(), todos: Object.fromEntries(todos.map((t) => [t.id, t])) });
const memo = (id: string, patch: Partial<Memo> = {}): Memo => ({ id, courseId: 'allgemein', title: id, body: '', createdAt: 1, updatedAt: 1, ...patch });

describe('time', () => {
  it('computes ISO weeks and week starts', () => {
    expect(isoWeek(at('2026-09-21'))).toBe(39);
    expect(isoWeek(at('2026-09-19'))).toBe(38);
    expect(startOfWeek(at('2026-09-19T12:00')).getDate()).toBe(14);
  });
  it('describes deadlines relative to now', () => {
    const now = at('2026-09-19T10:00');
    expect(dueInfo(at('2026-09-22T14:00'), now)).toMatchObject({ label: 'in 3 Tagen', tone: 'soon' });
    expect(dueInfo(at('2026-09-20T09:00'), now).label).toBe('Morgen, 09:00');
    expect(dueInfo(at('2026-09-19T18:00'), now).tone).toBe('today');
    expect(dueInfo(at('2026-09-18T18:00'), now).tone).toBe('overdue');
    expect(dueInfo(at('2027-02-08T09:00'), now)).toMatchObject({ label: 'in 20 Wochen', tone: 'later' });
  });
  it('treats date-only due dates as "that day", overdue only from the next day', () => {
    const due = dueMoment('2026-09-19');
    expect(dueInfo(due, at('2026-09-19T23:00'), true)).toMatchObject({ label: 'Heute', tone: 'today' });
    expect(dueInfo(due, at('2026-09-20T08:00'), true).tone).toBe('overdue');
  });
});

describe('rooms', () => {
  it('parses ETH room codes with and without spaces', () => {
    expect(parseRoom('HG E 26.1')).toEqual({ building: 'HG', floor: 'E', room: '26.1' });
    expect(parseRoom('ETF E1')).toEqual({ building: 'ETF', floor: 'E', room: '1' });
    expect(parseRoom('ML J 34.3')).toEqual({ building: 'ML', floor: 'J', room: '34.3' });
    expect(parseRoom('Online')).toBeNull();
  });
  it('links every room of the snapshot to the ETH location page', () => {
    for (const c of seed.courses) for (const s of c.sessions) for (const r of [s.room, ...(s.altRooms ?? [])]) expect(roomUrl(r)).toMatch(/^https:\/\/ethz\.ch\/de\/utils\/location\.html\?building=/);
    expect(roomUrl('LEE C 114')).toBe('https://ethz.ch/de/utils/location.html?building=LEE&floor=C&room=114&lang=de');
  });
});

describe('schedule', () => {
  it('lists Monday 2026-09-21 in time order (default parity = even, so this odd week has no Analysis lecture)', () => {
    expect(prefs.biweeklyParity).toBe('even'); // confirmed real schedule fact, not a guess
    const occ = occurrencesOn(at('2026-09-21'), seed.courses, prefs);
    expect(occ.map((o) => o.session.id)).toEqual(['mech-v-mo', 'ed-v']);
    // …but shows up (flagged as uncertain) once someone explicitly clears the parity in Settings
    const unset = occurrencesOn(at('2026-09-21'), seed.courses, { ...prefs, biweeklyParity: null });
    expect(unset.map((o) => o.session.id)).toEqual(['mech-v-mo', 'ana-v-mo', 'ed-v']);
    expect(unset[1].flag).toBe('biweekly');
  });
  it('applies week parity and the chosen exercise group', () => {
    expect(occurrencesOn(at('2026-09-21'), seed.courses, prefs).some((o) => o.session.id === 'ana-v-mo')).toBe(false); // KW 39, odd
    expect(occurrencesOn(at('2026-09-28'), seed.courses, prefs).some((o) => o.session.id === 'ana-v-mo')).toBe(true); // KW 40, even
    const odd = { ...prefs, biweeklyParity: 'odd' as const };
    expect(occurrencesOn(at('2026-09-21'), seed.courses, odd).some((o) => o.session.id === 'ana-v-mo')).toBe(true);
    expect(occurrencesOn(at('2026-09-28'), seed.courses, odd).some((o) => o.session.id === 'ana-v-mo')).toBe(false);
    const chosen = { ...prefs, choices: { 'mechanik-uebung': 'mech-u-do1' } };
    expect(occurrencesOn(at('2026-09-22'), seed.courses, chosen).some((o) => o.session.id === 'mech-u-di')).toBe(false);
  });
  it('has no overlapping sessions in a normal week', () => {
    const chosen = { biweeklyParity: 'odd' as const, choices: { 'mechanik-uebung': 'mech-u-do1' } };
    for (const day of occurrencesInWeek(at('2026-09-21'), seed.courses, chosen)) {
      for (let i = 1; i < day.length; i++) expect(+day[i].start).toBeGreaterThanOrEqual(+day[i - 1].end);
    }
  });
  it('finds the running / next session and the next session of a kind', () => {
    const mon = occurrencesOn(at('2026-09-21'), seed.courses, prefs);
    expect(focusOfDay(at('2026-09-21T11:00'), mon)).toMatchObject({ live: true, occ: { session: { id: 'mech-v-mo' } } });
    expect(focusOfDay(at('2026-09-21T12:05'), mon)).toMatchObject({ live: false, occ: { session: { id: 'ed-v' } } });
    expect(focusOfDay(at('2026-09-21T17:00'), mon)).toBeNull();
    expect(nextOccurrence(at('2026-09-19T10:00'), seed.courses, prefs)?.session.id).toBe('mech-v-mo');
    const ana = seed.courses.filter((c) => c.id === 'analysis-1');
    expect(nextOccurrence(at('2026-09-19T10:00'), ana, prefs, 'exercise')?.session.id).toBe('ana-u');
  });
  it('suggests the course of the running or just finished session for new to-dos', () => {
    expect(suggestCourse(at('2026-09-21T11:00'), seed.courses, prefs, 'chemistry')).toBe('mechanik-1');
    expect(suggestCourse(at('2026-09-21T12:10'), seed.courses, prefs, 'chemistry')).toBe('mechanik-1');
    expect(suggestCourse(at('2026-09-19T10:00'), seed.courses, prefs, 'chemistry')).toBe('chemistry');
  });
});

describe('items', () => {
  it('merges Notion tasks, check-offs, to-dos and exams, dated first', () => {
    const now = at('2026-09-19T10:00');
    const s: SyncedState = {
      ...withTodos(todo('a'), todo('b', { due: '2026-09-20' }), todo('c', { due: '2026-12-01' })),
      taskDone: { 'task-ana-serie-1': { done: true, updatedAt: 1 } },
      exams: { e1: { id: 'e1', courseId: 'analysis-1', title: 'Prüfung', when: '2027-02-08T09:00', updatedAt: 1 } },
    };
    const items = buildItems(s, now);
    expect(items).toHaveLength(8);
    expect(items.find((i) => i.id === 'task-ana-serie-1')?.done).toBe(true);
    expect(items.at(-1)?.id).toBe('a');
    expect(dueWithin(items, now, 7).map((i) => i.id)).toEqual(['b', 'task-la-serie-1', 'task-chem-ps-1']);
    expect(backlog(items, now, 7).map((i) => i.id)).toEqual(['c', 'a']);
  });
});

describe('merge & sync', () => {
  it('keeps the newer version of an item and lets deletions win over older edits', () => {
    const a = withTodos(todo('x', { text: 'alt', updatedAt: 1 }), todo('y'));
    const b = { ...withTodos(todo('x', { text: 'neu', updatedAt: 5 })), tombstones: { y: 3 } };
    const m = mergeSynced(a, b, 10);
    expect(m.todos.x.text).toBe('neu');
    expect(m.todos.y).toBeUndefined();
    expect(canonical(mergeSynced(b, a, 10))).toBe(canonical(m));
  });
  it('restoring after a delete brings the item back everywhere', () => {
    const deleted = { ...emptySynced(), tombstones: { y: 3 } };
    const restored = withTodos(todo('y', { updatedAt: 4 }));
    expect(mergeSynced(deleted, restored, 10).todos.y).toBeDefined();
  });
  it('migrates v1 data and survives garbage', () => {
    const { synced, local } = migrateV1({ localTasks: [{ id: 't', courseId: 'chemistry', title: 'Lesen', due: '2026-09-30T12:00', status: 'not-started' }], taskDone: { k: true }, theme: 'dark' }, 7);
    expect(synced.todos.t).toMatchObject({ text: 'Lesen', due: '2026-09-30T12:00', done: false });
    expect(synced.taskDone.k).toEqual({ done: true, updatedAt: 7 });
    expect(local.theme).toBe('dark');
    expect(normalizeSynced({ todos: { bad: 1, ok: todo('ok') }, prefs: 'x' }).todos).toEqual({ ok: todo('ok') });
    // v1 installs have no `memos` at all – old data must load without crashing, defaulting to none
    expect(synced.memos).toEqual({});
  });

  it('merges notes like to-dos and exams, and drops malformed ones', () => {
    const a = { ...emptySynced(), memos: { p: memo('p', { title: 'alt', updatedAt: 1 }) } };
    const b = { ...emptySynced(), memos: { p: memo('p', { title: 'neu', updatedAt: 5 }), q: memo('q') } };
    expect(mergeSynced(a, b).memos).toEqual({ p: memo('p', { title: 'neu', updatedAt: 5 }), q: memo('q') });
    expect(normalizeSynced({ memos: { bad: { id: 'bad' }, ok: memo('ok') } }).memos).toEqual({ ok: memo('ok') });
  });

  /** In-memory stand-in for the kvdb.io bucket: plain read/write, no versioning. */
  function fakeBucket() {
    let text: string | null = null;
    const api = (): SyncApi => ({
      async read() {
        return { state: text ? normalizeSynced(JSON.parse(text)) : null };
      },
      async write(state) {
        text = canonical(state);
        return true;
      },
    });
    return { api, get: () => (text ? normalizeSynced(JSON.parse(text)) : null) };
  }

  it('two devices converge: additions, check-offs and deletions travel both ways', async () => {
    const bucket = fakeBucket();
    let laptop = withTodos(todo('from-laptop'));
    let ipad = withTodos(todo('from-ipad'));
    const sync = (get: () => SyncedState, set: (s: SyncedState) => void) => syncOnce(get, set, bucket.api());

    expect(await sync(() => laptop, (s) => (laptop = s))).toBe('pushed');
    expect(await sync(() => ipad, (s) => (ipad = s))).toBe('pushed');
    await sync(() => laptop, (s) => (laptop = s));
    expect(Object.keys(laptop.todos).sort()).toEqual(['from-ipad', 'from-laptop']);

    const T = Date.now();
    ipad = { ...ipad, todos: { ...ipad.todos, 'from-laptop': { ...ipad.todos['from-laptop'], done: true, updatedAt: T } } };
    const { ['from-ipad']: _gone, ...rest } = laptop.todos;
    laptop = { ...laptop, todos: rest, tombstones: { 'from-ipad': T } };
    await sync(() => ipad, (s) => (ipad = s));
    await sync(() => laptop, (s) => (laptop = s));
    await sync(() => ipad, (s) => (ipad = s));
    expect(canonical(ipad)).toBe(canonical(laptop));
    expect(laptop.todos['from-laptop'].done).toBe(true);
    expect(laptop.todos['from-ipad']).toBeUndefined();
    expect(await sync(() => laptop, (s) => (laptop = s))).toBe('unchanged');
  });

  it('a same-instant write race self-heals on the next sync round (kvdb has no conflict check)', async () => {
    const bucket = fakeBucket();
    let laptop = withTodos(todo('from-laptop'));
    let ipad = withTodos(todo('from-ipad'));
    const sync = (get: () => SyncedState, set: (s: SyncedState) => void) => syncOnce(get, set, bucket.api());

    // Both read the (empty) bucket before either has written – laptop's write clobbers ipad's
    await bucket.api().write(withTodos()); // primed empty, as if freshly created
    await sync(() => laptop, (s) => (laptop = s));
    await bucket.api().write(withTodos()); // simulate: ipad's read happened before laptop's write landed
    await sync(() => ipad, (s) => (ipad = s));
    expect(Object.keys(bucket.get()!.todos)).toEqual(['from-ipad']); // laptop's item is transiently missing …

    // … but each device still has it locally, so the very next sync round brings it back for good
    await sync(() => laptop, (s) => (laptop = s));
    await sync(() => ipad, (s) => (ipad = s));
    expect(Object.keys(bucket.get()!.todos).sort()).toEqual(['from-ipad', 'from-laptop']);
  });
});

describe('search', () => {
  const search = createSearch({ ...seed, todos: [todo('Skript Taylorreihen nachlesen')], exams: [], memos: [] });
  const top = (q: string) => search.search(q)[0];

  it('finds courses by name and alias', () => {
    expect(top('Analysis 1')?.id).toBe('course:analysis-1');
    expect(top('linalg')?.id).toBe('course:lineare-algebra-1');
    expect(top('Mechanik')?.type).toBe('course');
    expect(top('Chemie')?.id).toBe('course:chemistry');
  });
  it('finds to-dos, instructors, tasks, links, rooms and note contents', () => {
    expect(top('Taylor')?.type).toBe('todo');
    expect(search.search('Steiger').some((h) => h.type === 'instructor')).toBe(true);
    expect(search.search('Serie').filter((h) => h.type === 'deadline')).toHaveLength(2);
    expect(search.search('codeexpert').some((h) => h.type === 'link')).toBe(true);
    expect(search.search('HG E 26.1').some((h) => h.type === 'session')).toBe(true);
    expect(search.search('getline').some((h) => h.id === 'note:informatik-cpp-basics')).toBe(true);
  });
  it('ignores case and umlauts, and never invents content', () => {
    expect(search.search('PRUFUNG').some((h) => h.id === 'action:add-exam')).toBe(true);
    expect(createSearch({ ...seed, todos: [], exams: [], memos: [] }).search('Taylor')).toEqual([]);
  });
  it('guesses the course from free text for quick capture', () => {
    expect(detectCourse('Mechanik Übung 3 nachrechnen', seed.courses)).toBe('mechanik-1');
    expect(detectCourse('LinAlg Serie 2 fragen', seed.courses)).toBe('lineare-algebra-1');
    expect(detectCourse('Legi abholen', seed.courses)).toBeNull();
  });
  it('groups hits by type in a stable order', () => {
    expect(groupHits(search.search('Analysis'))[0].type).toBe('course');
  });
});
