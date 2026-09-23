import { afterEach, describe, expect, it } from 'vitest';
import { buildItems } from './data';
import { dueReminders, reminderSchedule, reminderTag, reminderText, zonedTime, type ReminderTodo } from './reminders';
import { emptySynced, inferCategory, mergeSynced, normalizeSynced } from './state';
import { actions, getPersonal } from './store';

const ZONE = 'Europe/Zurich';
const H = 3_600_000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 16);

const todo = (patch: Partial<ReminderTodo> = {}): ReminderTodo => ({
  id: 't1', text: 'Bonusaufgabe 2 abgeben', courseId: 'analysis-1', due: '2026-10-01T10:00', done: false, important: true,
  createdAt: Date.UTC(2026, 8, 20), ...patch,
});

describe('reminders of important to-dos', () => {
  it('converts Zurich wall-clock time correctly on both sides of the DST switch', () => {
    expect(iso(zonedTime(2026, 10, 1, 10, 0, ZONE))).toBe('2026-10-01T08:00'); // CEST, UTC+2
    expect(iso(zonedTime(2026, 10, 26, 10, 0, ZONE))).toBe('2026-10-26T09:00'); // CET, UTC+1
    expect(iso(zonedTime(2026, 10, 25, 1, 30, ZONE))).toBe('2026-10-24T23:30'); // the night of the switch
  });

  it('are set for the day before and an hour before a timed deadline', () => {
    const [day, hour] = reminderSchedule(todo(), ZONE);
    expect(iso(day.at)).toBe('2026-09-30T08:00');
    expect(iso(hour.at)).toBe('2026-10-01T07:00');
    expect(iso(hour.due)).toBe('2026-10-01T08:00');
    expect(day.key).toBe('t1|day|2026-10-01T10:00');
  });

  it('come the evening before and that morning for an all-day deadline', () => {
    const [day, hour] = reminderSchedule(todo({ due: '2026-10-02' }), ZONE);
    expect(iso(day.at)).toBe('2026-10-01T16:00'); // 18:00 in Zurich
    expect(iso(hour.at)).toBe('2026-10-02T06:00'); // 08:00 in Zurich
  });

  it('only exist for open, important to-dos with a deadline', () => {
    expect(reminderSchedule(todo({ important: false }), ZONE)).toEqual([]);
    expect(reminderSchedule(todo({ important: undefined }), ZONE)).toEqual([]);
    expect(reminderSchedule(todo({ done: true }), ZONE)).toEqual([]);
    expect(reminderSchedule(todo({ due: undefined }), ZONE)).toEqual([]);
    expect(reminderSchedule(todo({ due: 'morgen' }), ZONE)).toEqual([]);
  });

  it('go out at the right moment, once, and never after the deadline', () => {
    const due = zonedTime(2026, 10, 1, 10, 0, ZONE);
    const none = () => false;
    expect(dueReminders([todo()], due - 25 * H, none, ZONE)).toEqual([]);
    const day = dueReminders([todo()], due - 23 * H, none, ZONE);
    expect(day.map((r) => r.kind)).toEqual(['day']);
    // the day reminder was sent → an hour before only the hour reminder follows
    const sent = new Set(day[0].covers);
    expect(dueReminders([todo()], due - 2 * H, (k) => sent.has(k), ZONE)).toEqual([]);
    const hour = dueReminders([todo()], due - 50 * 60_000, (k) => sent.has(k), ZONE);
    expect(hour.map((r) => r.kind)).toEqual(['hour']);
    expect(hour[0].covers).toEqual(['t1|hour|2026-10-01T10:00']);
    expect(dueReminders([todo()], due + 60_000, none, ZONE)).toEqual([]);
  });

  it('send only the later one when both are due at once – it covers the missed one', () => {
    const due = zonedTime(2026, 10, 1, 10, 0, ZONE);
    const [r] = dueReminders([todo()], due - 30 * 60_000, () => false, ZONE);
    expect(r.kind).toBe('hour');
    expect(r.covers).toEqual(['t1|day|2026-10-01T10:00', 't1|hour|2026-10-01T10:00']);
  });

  it('skip a moment that passed before the to-do was even written', () => {
    const due = zonedTime(2026, 10, 1, 10, 0, ZONE);
    const fresh = todo({ createdAt: due - 3 * H });
    expect(dueReminders([fresh], due - 2 * H, () => false, ZONE)).toEqual([]);
    expect(dueReminders([fresh], due - 40 * 60_000, () => false, ZONE).map((r) => r.kind)).toEqual(['hour']);
  });

  it('are re-armed when the deadline moves', () => {
    const a = reminderSchedule(todo(), ZONE)[1].key;
    const b = reminderSchedule(todo({ due: '2026-10-02T10:00' }), ZONE)[1].key;
    expect(a).not.toBe(b);
  });

  it('read naturally', () => {
    const due = zonedTime(2026, 10, 1, 10, 0, ZONE);
    const [day, hour] = reminderSchedule(todo(), ZONE);
    expect(reminderText(day, todo(), 'Analysis I', due - 24 * H, ZONE)).toEqual({ title: 'Bonusaufgabe 2 abgeben', body: 'Morgen 10:00 fällig · Analysis I' });
    expect(reminderText(hour, todo(), 'Analysis I', due - H, ZONE).body).toBe('In 1 Stunde fällig · Analysis I');
    expect(reminderText(hour, todo(), 'Analysis I', due - 20 * 60_000, ZONE).body).toBe('In 20 Min fällig · Analysis I');
    const allDay = todo({ due: '2026-10-02' });
    const [d2, h2] = reminderSchedule(allDay, ZONE);
    expect(reminderText(d2, allDay, 'Analysis I', d2.at, ZONE).body).toBe('Morgen fällig · Analysis I');
    expect(reminderText(h2, allDay, 'Analysis I', h2.at, ZONE).body).toBe('Heute fällig · Analysis I');
    expect(reminderTag(hour)).toBe('reminder:t1|hour|2026-10-01T10:00');
  });
});

describe('to-do kinds and importance', () => {
  const created: string[] = [];
  afterEach(() => {
    created.splice(0).forEach((id) => actions.deleteTodo(id));
  });

  it('guesses the kind from the words', () => {
    expect(inferCategory('Bonusaufgabe 3 abgeben')).toBe('bonus');
    expect(inferCategory('Quiz vorbereiten')).toBe('bonus');
    expect(inferCategory('Serie 4 rechnen')).toBe('uebung');
    expect(inferCategory('Problem Set 2')).toBe('uebung');
    expect(inferCategory('Legi abholen')).toBe('rest');
  });

  it('stores kind and importance, and every list sees them', () => {
    const a = actions.addTodo({ courseId: 'analysis-1', text: 'Legi abholen', category: 'bonus', important: true, due: '2026-10-01T10:00' });
    const b = actions.addTodo({ courseId: 'chemistry', text: 'Serie 2' });
    created.push(a, b);
    const s = getPersonal().synced;
    expect(s.todos[a]).toMatchObject({ category: 'bonus', important: true });
    expect(s.todos[b].category).toBe('uebung');
    expect('important' in s.todos[b]).toBe(false);
    const items = buildItems(s, new Date('2026-09-23T12:00'));
    expect(items.find((i) => i.id === a)).toMatchObject({ category: 'bonus', important: true });
    expect(items.find((i) => i.id === b)).toMatchObject({ category: 'uebung', important: false });

    actions.updateTodo(a, { important: false, category: 'rest' });
    expect(getPersonal().synced.todos[a].category).toBe('rest');
    expect('important' in getPersonal().synced.todos[a]).toBe(false);
  });

  it('survives old and malformed data: missing kind is guessed, junk is dropped', () => {
    const raw = {
      todos: {
        old: { id: 'old', courseId: 'analysis-1', text: 'Bonusaufgabe 1', done: false, createdAt: 1, updatedAt: 1 },
        junk: { id: 'junk', courseId: 'analysis-1', text: 'x', done: false, category: 'wichtig!!', important: 'yes', createdAt: 1, updatedAt: 1 },
      },
    };
    const s = normalizeSynced(raw);
    expect(s.todos.old.category).toBeUndefined();
    expect(s.todos.junk.category).toBeUndefined();
    expect(s.todos.junk.important).toBeUndefined();
    const items = buildItems(s, new Date('2026-09-23T12:00'));
    expect(items.find((i) => i.id === 'old')?.category).toBe('bonus');
  });
});

describe('push subscriptions in the synced data', () => {
  const sub = { id: 'dev-a', endpoint: 'https://web.push.apple.com/abc', p256dh: 'BKey', auth: 'auth', device: 'iPad (App)', updatedAt: 5 };

  it('only accept https endpoints with both keys', () => {
    const s = normalizeSynced({
      push: {
        ok: sub,
        http: { ...sub, id: 'http', endpoint: 'http://evil.test/x' },
        js: { ...sub, id: 'js', endpoint: 'javascript:alert(1)' },
        nokey: { ...sub, id: 'nokey', auth: undefined },
      },
    });
    expect(Object.keys(s.push)).toEqual(['ok']);
  });

  it('merge across devices, and a removal wins over an older copy', () => {
    const a = { ...emptySynced(), push: { 'dev-a': sub } };
    const b = { ...emptySynced(), push: { 'dev-b': { ...sub, id: 'dev-b', device: 'Chrome · Windows' } } };
    expect(Object.keys(mergeSynced(a, b).push).sort()).toEqual(['dev-a', 'dev-b']);
    const removed = { ...emptySynced(), tombstones: { 'dev-a': 10 } };
    expect(Object.keys(mergeSynced(a, removed, 20).push)).toEqual([]);
  });

  it('are saved and removed through the store without touching anything else', () => {
    actions.savePushSub({ id: 'dev-test', endpoint: sub.endpoint, p256dh: 'k', auth: 'a', device: 'Test' });
    expect(getPersonal().synced.push['dev-test']).toMatchObject({ endpoint: sub.endpoint, device: 'Test' });
    const before = getPersonal().synced.push['dev-test'].updatedAt;
    // the same subscription again is not a change (no sync round for nothing)
    actions.savePushSub({ id: 'dev-test', endpoint: sub.endpoint, p256dh: 'k', auth: 'a', device: 'Test' });
    expect(getPersonal().synced.push['dev-test'].updatedAt).toBe(before);
    actions.removePushSub('dev-test');
    expect(getPersonal().synced.push['dev-test']).toBeUndefined();
  });
});
