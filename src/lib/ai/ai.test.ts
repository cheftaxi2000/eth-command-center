import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { seed } from '../../data/seed';
import { exerciseEntries } from '../exercises';
import { actions, getPersonal } from '../store';
import { buildAIContext, buildAIDynamicContext, formatAIContext } from './context';
import { executeAction, resolveSubject, runConfirmed, toolSpecs, validateAction } from './actions';
import { geminiProvider, parseCompletion, toOpenAITools } from './gemini';
import { parseIntent } from './mock';
import type { AIProvider, AIRequest } from './provider';
import { AIService, mockAI } from './service';

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

  it('hides a Notion task or a course exercise instead of failing to delete it – the source stays untouched', () => {
    const notionId = 'task-la-serie-1';
    const exerciseId = 'lineare-algebra-1:bonus-1';

    const attempt = executeAction({ action: 'delete_task', params: { id: notionId } });
    expect(attempt).toMatchObject({ needsConfirmation: true, message: 'Soll ich „Serie 1" wirklich ausblenden?' });
    expect(getPersonal().synced.hidden[notionId]).toBeUndefined(); // not yet – only after confirming

    const done = runConfirmed({ action: 'delete_task', params: { id: notionId } });
    expect(done).toMatchObject({ ok: true, message: expect.stringContaining('ausgeblendet') });
    expect(getPersonal().synced.hidden[notionId]).toMatchObject({ hidden: true });
    // seed.ts itself is never touched – buildItems just stops returning it
    expect(seed.tasks.find((t) => t.id === notionId)).toBeDefined();
    expect(buildAIDynamicContext().tasks.some((t) => t.id === notionId)).toBe(false);

    const exAttempt = executeAction({ action: 'delete_task', params: { id: exerciseId } });
    expect(exAttempt.message).toBe('Soll ich „Bonusaufgabe 1" wirklich ausblenden?');
    runConfirmed({ action: 'delete_task', params: { id: exerciseId } });
    expect(buildAIDynamicContext().exercises.some((e) => e.id === exerciseId)).toBe(false);

    actions.unhideItem(notionId);
    actions.unhideItem(exerciseId);
  });

  it('brings a hidden item back with unhide_item', () => {
    const id = 'task-chem-ps-1';
    actions.hideItem(id);
    expect(executeAction({ action: 'unhide_item', params: { id: 'nie-versteckt' } }).ok).toBe(false);
    const r = executeAction({ action: 'unhide_item', params: { id } });
    expect(r).toMatchObject({ ok: true, message: '„Problem Set 1" wieder eingeblendet.' });
    expect(getPersonal().synced.hidden[id].hidden).toBe(false);
    expect(toolSpecs().find((s) => s.name === 'unhide_item')?.needsConfirmation).toBe(false); // reversible, not destructive
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

  it('finds a task by a fragment of its title', async () => {
    const id = actions.addTodo({ courseId: 'analysis-1', text: 'Kapitel 3 Übungen 1–10 durchrechnen' });
    const turn = await mockAI('Lösch die Aufgabe Kapitel 3', () => NOW);
    expect(turn.pending[0]?.call).toEqual({ action: 'delete_task', params: { id } });
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

describe('Gemini provider (Google simulated, no real key)', () => {
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const req = (): AIRequest => ({
    messages: [{ role: 'system', content: 'SYS' }, { role: 'user', content: 'Neue Aufgabe' }],
    contextText: 'CTX',
    tools: toolSpecs(),
  });

  it('sends the key as a header to Google only, with the live context and the tool list', async () => {
    const fetchMock = vi.fn(async () => reply({ choices: [{ message: { content: 'Ok.' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    await geminiProvider('AIzaTEST').complete(req());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(url).not.toContain('AIza');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer AIzaTEST');
    const body = JSON.parse(init.body as string);
    // exactly one system message, first, holding instructions AND the live app state
    expect(body.messages.map((m: { role: string }) => m.role)).toEqual(['system', 'user']);
    expect(body.messages[0].content).toMatch(/^SYS[\s\S]*Aktueller Stand der App:\n\nCTX$/);
    expect(body.tools.some((t: { function: { name: string } }) => t.function.name === 'create_task')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('turns tool calls into app actions and tells a rejected key apart from an empty quota', async () => {
    expect(parseCompletion({ choices: [{ message: { content: null, tool_calls: [{ function: { name: 'create_task', arguments: '{"title":"X"}' } }] } }] }))
      .toEqual({ text: '', calls: [{ action: 'create_task', params: { title: 'X' } }] });
    vi.stubGlobal('fetch', vi.fn(async () => reply({}, 400)));
    await expect(geminiProvider('AIzaBAD').complete(req())).rejects.toThrow(/Schlüssel/);
    vi.stubGlobal('fetch', vi.fn(async () => reply({}, 429)));
    await expect(geminiProvider('AIzaX').complete(req())).rejects.toThrow(/Kontingent/);
    vi.unstubAllGlobals();
  });

  it('switches to a current model by itself when Google retired the default one', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('/models?')) return reply({ models: [{ name: 'models/gemini-9.0-flash', supportedGenerationMethods: ['generateContent'] }] });
      const model = JSON.parse(init!.body as string).model;
      return model === 'gemini-9.0-flash' ? reply({ choices: [{ message: { content: 'Hallo' } }] }) : reply({}, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
    expect((await geminiProvider('AIzaX').complete(req())).text).toBe('Hallo');
    vi.unstubAllGlobals();
  });

  it('describes date formats to the model so it sends values the validator accepts', () => {
    const create = toOpenAITools(toolSpecs()).find((t) => t.function.name === 'create_task')!;
    expect(create.function.parameters.required).toEqual(['title']);
    expect(JSON.stringify(create.function.parameters.properties)).toMatch(/JJJJ-MM-TT/);
  });
});

describe('what the model is told', () => {
  it('starts with today and tomorrow, in one system message, and offers no redundant lookups', async () => {
    let seen: AIRequest | null = null;
    const provider: AIProvider = { id: 'spy', label: 'spy', complete: async (r) => ((seen = r), { text: 'ok', calls: [] }) };
    await new AIService(provider).send('Was habe ich morgen?', [{ role: 'assistant', content: 'Hallo' }]);
    const req = seen as unknown as AIRequest;
    expect(req.messages.map((m) => m.role)).toEqual(['system', 'assistant', 'user']);
    expect(req.messages[0].content).toMatch(/^Heute ist Montag, 2026-09-21, 09:00 Uhr .*Morgen ist Dienstag, 2026-09-22\./);
    const names = req.tools.map((t) => t.name);
    expect(names).toContain('create_task');
    expect(names).toContain('get_notes');
    expect(names).not.toContain('get_schedule');
    expect(names).not.toContain('get_tasks');
  });
});

describe('answering after a lookup', () => {
  it('asks the model again with the results when it only looked something up', async () => {
    let round = 0;
    const provider: AIProvider = {
      id: 'fake',
      label: 'fake',
      async complete(r) {
        round++;
        if (round === 1) return { text: '', calls: [{ action: 'get_tasks', params: {} }] };
        expect(r.tools).toHaveLength(0); // second round may only answer, not act
        expect(r.messages.filter((m) => m.role === 'system')).toHaveLength(1);
        expect(r.messages[0].content).toMatch(/Ergebnisse/);
        expect(r.messages.at(-1)).toEqual({ role: 'user', content: 'Was ist offen?' });
        return { text: 'Du hast 4 offene Aufgaben.', calls: [] };
      },
    };
    const turn = await new AIService(provider).send('Was ist offen?');
    expect(round).toBe(2);
    expect(turn.reply).toBe('Du hast 4 offene Aufgaben.');
  });
});

describe('links through the assistant', () => {
  it('turns a sentence with an address into create_link – and a task that mentions a site stays a task', () => {
    expect(parseIntent('Speichere den Link https://people.math.ethz.ch/~x/Skript.pdf für Analysis als Skript', NOW).calls[0]).toEqual({
      action: 'create_link',
      params: { url: 'https://people.math.ethz.ch/~x/Skript.pdf', label: 'Skript', subject: 'analysis-1' },
    });
    expect(parseIntent('moodle-app2.let.ethz.ch/course/view.php?id=28343', NOW).calls[0]).toEqual({
      action: 'create_link',
      params: { url: 'moodle-app2.let.ethz.ch/course/view.php?id=28343' },
    });
    expect(parseIntent('Füge eine Aufgabe hinzu: Serie 3 auf moodle.ethz.ch hochladen', NOW).calls[0].action).toBe('create_task');
    expect(parseIntent('Schreib max@ethz.ch wegen Serie 3', NOW).calls.every((c) => c.action !== 'create_link')).toBe(true);
  });

  it('saves it for the right subject, names it, and puts it into the next context', () => {
    const r = executeAction({ action: 'create_link', params: { url: 'moodle-app2.let.ethz.ch/course/view.php?id=1', subject: 'Mechanik' } });
    expect(r).toMatchObject({ ok: true, message: 'Link „Moodle" unter Mechanik I gespeichert.' });
    expect(buildAIDynamicContext().links.filter((l) => l.own)).toMatchObject([{ label: 'Moodle', subjectId: 'mechanik-1' }]);
    expect(formatAIContext(buildAIContext())).toContain('Moodle · Mechanik I · https://moodle-app2.let.ethz.ch/course/view.php?id=1');
    // the same address twice for one subject is refused, not duplicated
    expect(executeAction({ action: 'create_link', params: { url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=1', subject: 'mechanik-1' } }).ok).toBe(false);
  });

  it('never stores anything but http(s)', () => {
    const r = executeAction({ action: 'create_link', params: { url: 'javascript:alert(1)' } });
    expect(r.ok).toBe(false);
    expect(Object.keys(getPersonal().synced.links)).toHaveLength(0);
  });

  it('deletes a link only after a yes', () => {
    const { data } = executeAction({ action: 'create_link', params: { url: 'https://example.ch/formeln.pdf', subject: 'Analysis' } }) as { data: { id: string } };
    expect(parseIntent('Lösch den Link formeln', NOW).calls[0]).toEqual({ action: 'delete_link', params: { id: data.id } });
    const pending = executeAction({ action: 'delete_link', params: { id: data.id } });
    expect(pending).toMatchObject({ ok: false, needsConfirmation: true, message: 'Soll ich den Link „formeln" wirklich löschen?' });
    expect(getPersonal().synced.links[data.id]).toBeDefined();
    expect(runConfirmed({ action: 'delete_link', params: { id: data.id } }).ok).toBe(true);
    expect(getPersonal().synced.links[data.id]).toBeUndefined();
  });

  it('offers the model the link actions, with the address format in the description', () => {
    const tools = toOpenAITools(toolSpecs().filter((t) => t.name === 'create_link'));
    expect(tools[0].function.parameters.required).toEqual(['url']);
    expect(tools[0].function.parameters.properties.url).toMatchObject({ type: 'string' });
    expect(String((tools[0].function.parameters.properties.url as { description: string }).description)).toMatch(/https/);
  });
});

describe('official course exercises and bonus rules', () => {
  beforeEach(() => {
    for (const e of exerciseEntries()) actions.setExerciseDone(e.exercise.id, false);
    actions.setExerciseCount('chemistry:series', 0);
    actions.setWeekExerciseRoles(null);
  });

  it('puts the exercises and every course rule into the context, apart from the to-dos', () => {
    const d = buildAIDynamicContext();
    expect(d.tasks.every((t) => t.origin !== ('exercise' as unknown))).toBe(true);
    const ba = d.exercises.find((e) => e.id === 'lineare-algebra-1:bonus-1')!;
    expect(ba).toMatchObject({ type: 'Bonusaufgabe', role: 'bonus', bonusRelevant: true, deadline: '2026-09-25T10:00', status: 'open' });
    expect(d.exercises.find((e) => e.id === 'analysis-1:bonus-7')).toMatchObject({ deadline: null, dateNote: expect.stringContaining('Moodle') });
    expect(d.exercises.find((e) => e.id === 'engineering-design:quiz-1')).toMatchObject({ weekOf: '2026-11-09' });

    const chem = d.bonus.find((b) => b.subjectId === 'chemistry')!;
    expect(chem.quote).toContain('2 of these 3 graded quizzes');
    expect(chem.progress.map((p) => p.required)).toEqual([2, 10]);
    expect(chem.unverified.join(' ')).toMatch(/dates will be announced/);

    const text = formatAIContext(buildAIContext());
    expect(text).toContain('## Bonus / Leistung pro Fach');
    expect(text).toContain('Kein Übungsbonus'); // Mechanik keeps its own system
    expect(text).toContain('[analysis-1:bonus-1]');
  });

  it('ticks an exercise off through the action layer, with its correctness', () => {
    expect(executeAction({ action: 'complete_exercise', params: { id: 'gibt-es-nicht' } }).ok).toBe(false);
    const r = executeAction({ action: 'complete_exercise', params: { id: 'analysis-1:bonus-1', correct: true } });
    expect(r).toMatchObject({ ok: true, message: '„Bonusaufgabe 1" (Analysis I) ist erledigt und korrekt.' });
    expect(getPersonal().synced.exercises['analysis-1:bonus-1']).toMatchObject({ done: true, correct: true });
    expect(buildAIDynamicContext().bonus.find((b) => b.subjectId === 'analysis-1')!.progress[0]).toMatchObject({ have: 1, required: 9 });
    executeAction({ action: 'complete_exercise', params: { id: 'analysis-1:bonus-1', done: false } });
    expect(getPersonal().synced.exercises['analysis-1:bonus-1']).toMatchObject({ done: false, correct: false });
  });

  it('keeps counters and the week filter inside the validated action layer', () => {
    expect(executeAction({ action: 'set_exercise_counter', params: { counter: 'erfunden', count: 3 } }).ok).toBe(false);
    expect(executeAction({ action: 'set_exercise_counter', params: { counter: 'chemistry:series', count: 4 } }).ok).toBe(true);
    expect(getPersonal().synced.exercises['chemistry:series'].count).toBe(4);

    expect(executeAction({ action: 'set_week_exercise_filter', params: { types: 'bonus, quiz' } }).ok).toBe(true);
    expect(getPersonal().synced.prefs.weekExerciseRoles).toEqual(['bonus', 'quiz']);
    expect(executeAction({ action: 'set_week_exercise_filter', params: { types: 'hausaufgaben' } }).ok).toBe(false);
    expect(executeAction({ action: 'set_week_exercise_filter', params: { types: 'alle' } }).ok).toBe(true);
    expect(getPersonal().synced.prefs.weekExerciseRoles).toBeNull();
  });

  it('understands the questions in the rule mode too', () => {
    expect(parseIntent('Welche Bonusregeln gelten für Chemie?', NOW).calls[0]).toEqual({ action: 'get_bonus', params: { subject: 'chemistry' } });
    expect(parseIntent('Wie weit bin ich mit dem Analysis-Bonus?', NOW).calls[0]).toEqual({ action: 'get_bonus', params: { subject: 'analysis-1' } });
    expect(parseIntent('Welche Bonusaufgaben habe ich noch offen?', NOW).calls[0]).toEqual({ action: 'get_exercises', params: { status: 'open', role: 'bonus' } });
    expect(parseIntent('Hake Bonusaufgabe 1 als korrekt ab', NOW).calls[0]).toMatchObject({ action: 'complete_exercise', params: { correct: true } });
  });
});
