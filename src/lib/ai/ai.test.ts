import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { actions, getPersonal } from '../store';
import { buildAIContext, buildAIDynamicContext } from './context';
import { executeAction, resolveSubject, runConfirmed, toolSpecs, validateAction } from './actions';
import { parseIntent } from './mock';
import { mockAI } from './service';

// Monday of KW 39 – the same reference day the rest of the suite uses.
const NOW = new Date(2026, 8, 21, 9, 0);
vi.useFakeTimers();
vi.setSystemTime(NOW);
afterAll(() => vi.useRealTimers());

beforeEach(() => {
  actions.deleteAllOwn();
});

describe('AI context', () => {
  it('describes subjects, schedule and the open tasks from the one shared store', () => {
    const ctx = buildAIContext();
    expect(ctx.permanent.subjects.map((s) => s.id)).toContain('analysis-1');
    expect(ctx.permanent.subjects.find((s) => s.id === 'mechanik-1')?.sessions.some((s) => s.kind === 'Übung')).toBe(true);
    // The Notion snapshot's four tasks are visible without anything being added first
    expect(ctx.dynamic.tasks.filter((t) => t.origin === 'notion')).toHaveLength(4);
    expect(ctx.dynamic.schedule[0].weekday).toBe('Montag');
    expect(ctx.permanent.constraints.join(' ')).toMatch(/nur lesbar/);
  });

  it('never serves a stale snapshot: a change is in the very next context', () => {
    const before = buildAIDynamicContext().counts.openTasks;
    const id = actions.addTodo({ courseId: 'chemistry', text: 'Skript lesen' });
    const after = buildAIDynamicContext();
    expect(after.counts.openTasks).toBe(before + 1);
    expect(after.tasks.find((t) => t.id === id)?.title).toBe('Skript lesen');

    actions.setTodoDone(id, true);
    expect(buildAIDynamicContext().counts.openTasks).toBe(before);
  });

  it('marks Notion items as not editable so the model does not try', () => {
    const notion = buildAIDynamicContext().tasks.find((t) => t.origin === 'notion')!;
    expect(notion.editable).toBe(false);
    const res = executeAction({ action: 'update_task', params: { id: notion.id, title: 'Anders' } });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/Notion/);
  });
});

describe('action validation', () => {
  it('rejects unknown actions and undeclared parameters', () => {
    expect(validateAction({ action: 'delete_everything', params: {} })).toMatchObject({ ok: false });
    const v = validateAction({ action: 'create_task', params: { title: 'X', sqlQuery: 'DROP TABLE' } });
    expect(v).toMatchObject({ ok: false });
    expect(v.ok === false && v.errors.join()).toMatch(/sqlQuery/);
  });

  it('rejects malformed dates, missing required fields and unknown subjects', () => {
    expect(validateAction({ action: 'create_task', params: { title: 'X', deadline: 'nächste Woche' } })).toMatchObject({ ok: false });
    expect(validateAction({ action: 'create_task', params: {} })).toMatchObject({ ok: false });
    expect(validateAction({ action: 'create_task', params: { title: 'X', subject: 'Astrophysik' } })).toMatchObject({ ok: false });
    expect(validateAction({ action: 'create_task', params: { title: 'X', subject: 'Ana 1', deadline: '2026-09-25' } })).toMatchObject({ ok: true });
  });

  it('resolves subjects through the course aliases', () => {
    expect(resolveSubject('Analysis')).toBe('analysis-1');
    expect(resolveSubject('LinAlg')).toBe('lineare-algebra-1');
    expect(resolveSubject('Chemie')).toBe('chemistry');
    expect(resolveSubject('allgemein')).toBe('allgemein');
    expect(resolveSubject('Seefahrt')).toBeNull();
  });

  it('never deletes without a confirmation, and validates again when confirming', () => {
    const id = actions.addTodo({ courseId: 'analysis-1', text: 'Wegwerfbar' });
    const attempt = executeAction({ action: 'delete_task', params: { id } });
    expect(attempt.needsConfirmation).toBe(true);
    expect(attempt.message).toMatch(/wirklich löschen/);
    expect(getPersonal().synced.todos[id]).toBeDefined(); // still there

    expect(runConfirmed({ action: 'delete_task', params: { id } }).ok).toBe(true);
    expect(getPersonal().synced.todos[id]).toBeUndefined();
  });

  it('publishes a tool list that flags reads and confirmations', () => {
    const specs = toolSpecs();
    expect(specs.find((s) => s.name === 'get_tasks')?.readOnly).toBe(true);
    expect(specs.find((s) => s.name === 'delete_note')?.needsConfirmation).toBe(true);
    expect(specs.find((s) => s.name === 'create_task')?.parameters.title).toMatchObject({ required: true });
  });
});

describe('natural language → intent', () => {
  const on = (text: string) => parseIntent(text, NOW);

  it('turns a sentence into create_task with subject and deadline', () => {
    expect(on('Füge eine Aufgabe hinzu: Analysis Blatt 4 bis Donnerstag.').calls[0]).toEqual({
      action: 'create_task',
      params: { title: 'Analysis Blatt 4', subject: 'analysis-1', deadline: '2026-09-24' },
    });
  });

  it('takes the task text after the colon and the rest from the sentence', () => {
    expect(on('Mach mir eine Aufgabe für Analysis bis Freitag: Kapitel 3 Übungen 1–10.').calls[0]).toEqual({
      action: 'create_task',
      params: { title: 'Kapitel 3 Übungen 1–10', subject: 'analysis-1', deadline: '2026-09-25' },
    });
  });

  it('understands a time of day', () => {
    expect(on('Neue Aufgabe für Mechanik morgen um 14:00: Serie abgeben').calls[0].params).toMatchObject({
      subject: 'mechanik-1',
      deadline: '2026-09-22T14:00',
    });
  });

  it('routes a note to create_note', () => {
    const call = on("Schreib in meine Analysis-Notizen: Bei der Grenzwertaufgabe zuerst L'Hôpital prüfen.").calls[0];
    expect(call.action).toBe('create_note');
    expect(call.params).toMatchObject({ subject: 'analysis-1', body: "Bei der Grenzwertaufgabe zuerst L'Hôpital prüfen." });
  });

  it('routes questions to the read actions', () => {
    expect(on('Was habe ich morgen?').calls[0]).toEqual({ action: 'get_schedule', params: { days: 2 } });
    expect(on('Was muss ich diese Woche noch machen?').calls[0]).toEqual({ action: 'get_tasks', params: { status: 'open', withinDays: 6 } });
  });

  it('says so instead of guessing when it understands nothing', () => {
    const out = on('Wie ist das Wetter in Zürich?');
    expect(out.calls).toHaveLength(0);
    expect(out.reply).toMatch(/nicht verstanden/);
  });
});

describe('the whole chain, end to end', () => {
  it('Satz → Intent → Validierung → Store → Context → Zähler', async () => {
    const before = buildAIDynamicContext().counts.openTasks;

    const turn = await mockAI('Füge eine Analysis-Aufgabe für Freitag hinzu: Serie 2', () => NOW);
    expect(turn.performed).toHaveLength(1);
    expect(turn.performed[0]).toMatchObject({ ok: true, action: 'create_task' });

    // The store really changed – same place the UI reads from
    const created = Object.values(getPersonal().synced.todos).find((t) => t.text === 'Serie 2');
    expect(created).toMatchObject({ courseId: 'analysis-1', due: '2026-09-25', done: false });

    // …and the context the next question would see already knows about it
    const ctx = buildAIDynamicContext();
    expect(ctx.counts.openTasks).toBe(before + 1);
    expect(ctx.tasks.some((t) => t.title === 'Serie 2')).toBe(true);

    // Completing it flows back through the same layer
    const done = await mockAI('Serie 2 ist erledigt', () => NOW);
    expect(done.performed[0]).toMatchObject({ ok: true, action: 'complete_task' });
    expect(buildAIDynamicContext().counts.openTasks).toBe(before);
  });

  it('holds a delete back until it is confirmed', async () => {
    actions.addMemo({ courseId: 'informatik-1', title: 'Pointer', body: 'Sternchen nicht vergessen' });
    const turn = await mockAI('Lösch die Notiz Pointer', () => NOW);

    expect(turn.performed).toHaveLength(0);
    expect(turn.pending).toHaveLength(1);
    expect(turn.pending[0].question).toMatch(/„Pointer"/);
    expect(Object.keys(getPersonal().synced.memos)).toHaveLength(1);
  });

  it('answers a question from live data without changing anything', async () => {
    actions.addTodo({ courseId: 'chemistry', text: 'Laborbericht', due: '2026-09-23' });
    const turn = await mockAI('Was muss ich diese Woche noch machen?', () => NOW);

    expect(turn.performed[0].action).toBe('get_tasks');
    const data = turn.performed[0].data as { title: string }[];
    expect(data.some((t) => t.title === 'Laborbericht')).toBe(true);
    expect(Object.keys(getPersonal().synced.todos)).toHaveLength(1); // nothing added or removed
  });
});
