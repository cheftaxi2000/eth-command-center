import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { COURSE_EXERCISES } from '../data/exercises';
import { seed } from '../data/seed';
import { buildItems, hiddenItems, openWork, undatedExercises } from './data';
import {
  bonusFromFormula, exerciseEntries, exerciseEntry, goalProgress, isKeyRole, matchesTypeFilter, rolesInUse, visibleInWeek,
} from './exercises';
import { createSearch } from './search';
import { canonical, emptySynced, mergeSynced, normalizeSynced } from './state';
import { actions, getPersonal } from './store';
import { parseLocal } from './time';

const now = parseLocal('2026-09-23T09:00');
const ids = (courseId: string, typeId: string) => exerciseEntries(courseId).filter((e) => e.type.id === typeId).map((e) => e.exercise.id);

describe('the course configuration itself', () => {
  it('is consistent: known courses, known types, unique ids, sources with a date', () => {
    const courseIds = seed.courses.map((c) => c.id);
    const seen = new Set<string>();
    for (const cfg of Object.values(COURSE_EXERCISES)) {
      expect(courseIds, cfg.courseId).toContain(cfg.courseId);
      expect(cfg.sources.length).toBeGreaterThan(0);
      for (const s of cfg.sources) expect(s.retrieved, s.url).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      for (const e of cfg.exercises) {
        expect(cfg.types.map((t) => t.id), e.id).toContain(e.typeId);
        expect(e.courseId).toBe(cfg.courseId);
        expect(seen.has(e.id)).toBe(false);
        seen.add(e.id);
        // a date is either exact, or a week, or openly missing – never both, never invented
        expect([e.dueAt, e.weekOf].filter(Boolean).length).toBeLessThanOrEqual(1);
        if (!e.dueAt && !e.weekOf) expect(e.dateNote, e.id).toBeTruthy();
        if (e.dueAt) expect(e.dueAt).toMatch(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/);
        if (e.weekOf) expect(parseLocal(`${e.weekOf}T00:00`).getDay()).toBe(1); // a Monday
      }
      for (const g of cfg.bonus.goals) {
        if (g.typeIds) for (const t of g.typeIds) expect(cfg.types.map((x) => x.id), `${cfg.courseId}/${g.id}`).toContain(t);
        if (g.metric === 'count') expect(g.tallyId, g.id).toBeTruthy();
      }
      if (cfg.bonus.formula) expect(cfg.bonus.goals.map((g) => g.id)).toContain(cfg.bonus.formula.goalId);
    }
  });

  it('keeps each course in its own system instead of one shared "bonus" scheme', () => {
    expect(COURSE_EXERCISES['analysis-1'].bonus.kind).toBe('grade-bonus');
    expect(COURSE_EXERCISES['mechanik-1'].bonus.kind).toBe('midterm-credit');
    expect(COURSE_EXERCISES['engineering-design'].bonus.kind).toBe('graded-performance');
    // and the wording each course uses stays the course's own
    expect(COURSE_EXERCISES['mechanik-1'].types[0].label).toBe('Freiwillige Zwischenprüfung');
    expect(COURSE_EXERCISES['lineare-algebra-1'].types.map((t) => t.label)).toContain('Lernkontrolle');
    // what decides the grade comes first – bonus, quiz, midterm – then the weekly work
    expect(rolesInUse()).toEqual(['bonus', 'quiz', 'assessment', 'normal', 'admin']);
    expect(rolesInUse().filter(isKeyRole)).toEqual(['bonus', 'quiz', 'assessment']);
  });

  it('carries only dates that a source really states', () => {
    expect(exerciseEntry('lineare-algebra-1:bonus-1')?.exercise.dueAt).toBe('2026-09-25T10:00');
    expect(exerciseEntry('lineare-algebra-1:serie-1')?.exercise.dueAt).toBe('2026-10-02T14:00');
    expect(exerciseEntry('engineering-design:quiz-1')?.exercise.weekOf).toBe('2026-11-09');
    // Analysis' twelve bonus tasks exist as a rule, their dates live on Moodle
    expect(ids('analysis-1', 'bonus')).toHaveLength(12);
    expect(exerciseEntry('analysis-1:bonus-7')?.exercise.dueAt).toBeUndefined();
    expect(exerciseEntry('analysis-1:bonus-7')?.exercise.dateNote).toMatch(/Moodle/);
  });
});

describe('progress towards each course\'s own goal', () => {
  beforeEach(() => {
    for (const e of exerciseEntries()) actions.setExerciseDone(e.exercise.id, false);
    actions.setExerciseCount('chemistry:series', 0);
  });

  it('Analysis: 9 of 12 correct is the requirement, handing in alone is not enough', () => {
    const bonus = ids('analysis-1', 'bonus');
    bonus.slice(0, 9).forEach((id) => actions.setExerciseDone(id, true));
    let g = goalProgress('analysis-1', getPersonal().synced);
    expect(g[0]).toMatchObject({ have: 0, required: 9, of: 12, reached: false }); // correct, not just handed in
    expect(g[1]).toMatchObject({ have: 9, of: 12 });

    bonus.slice(0, 8).forEach((id) => actions.setExerciseCorrect(id, true));
    expect(goalProgress('analysis-1', getPersonal().synced)[0].reached).toBe(false);
    actions.setExerciseCorrect(bonus[8], true);
    g = goalProgress('analysis-1', getPersonal().synced);
    expect(g[0]).toMatchObject({ have: 9, reached: true });
  });

  it('Lineare Algebra: points turn into min(0.25, 0.25·P/9)', () => {
    expect(bonusFromFormula('lineare-algebra-1', getPersonal().synced)?.value).toBe(0);
    actions.setExerciseDone('lineare-algebra-1:bonus-1', true);
    actions.setExerciseDone('lineare-algebra-1:lernkontrolle', true);
    const v = bonusFromFormula('lineare-algebra-1', getPersonal().synced)!;
    expect(v.value).toBeCloseTo(0.0556, 4);
    expect(v.text).toBe('0.056 Notenpunkte');
    // the Serie is not bonus-relevant, so it must not move the number
    actions.setExerciseDone('lineare-algebra-1:serie-1', true);
    expect(bonusFromFormula('lineare-algebra-1', getPersonal().synced)!.value).toBeCloseTo(0.0556, 4);
  });

  it('Chemistry: both conditions are tracked separately (2 of 3 quizzes AND 10 series)', () => {
    const quizzes = ids('chemistry', 'quiz');
    actions.setExerciseCorrect(quizzes[0], true);
    actions.setExerciseCorrect(quizzes[1], true);
    actions.setExerciseCount('chemistry:series', 7);
    const g = goalProgress('chemistry', getPersonal().synced);
    expect(g[0]).toMatchObject({ have: 2, required: 2, reached: true });
    expect(g[1]).toMatchObject({ have: 7, required: 10, reached: false });
    actions.setExerciseCount('chemistry:series', 10);
    expect(goalProgress('chemistry', getPersonal().synced)[1].reached).toBe(true);
  });

  it('un-ticking an exercise also drops the "correct" flag', () => {
    const [first] = ids('chemistry', 'quiz');
    actions.setExerciseCorrect(first, true);
    expect(getPersonal().synced.exercises[first]).toMatchObject({ done: true, correct: true });
    actions.setExerciseDone(first, false);
    expect(getPersonal().synced.exercises[first]).toMatchObject({ done: false, correct: false });
  });
});

describe('exercises in the shared item list', () => {
  beforeEach(() => {
    for (const e of exerciseEntries()) actions.setExerciseDone(e.exercise.id, false);
  });

  it('are ordinary items with their type on them, and dated ones sort in by date', () => {
    const items = buildItems(getPersonal().synced, now);
    const ba1 = items.find((i) => i.id === 'lineare-algebra-1:bonus-1')!;
    expect(ba1).toMatchObject({ kind: 'exercise', courseId: 'lineare-algebra-1', title: 'Bonusaufgabe 1' });
    expect(ba1.exercise).toMatchObject({ role: 'bonus', bonus: true, typeShort: 'Bonus' });
    expect(ba1.due).toEqual(parseLocal('2026-09-25T10:00'));
  });

  it('do not inflate the open-task count while their date is unknown', () => {
    const items = buildItems(getPersonal().synced, now);
    expect(undatedExercises(items).length).toBe(20); // 12 Analysis + 3 Chemie + 3 Informatik + 2 Mechanik
    expect(openWork(items).some((i) => i.id === 'analysis-1:bonus-7')).toBe(false);
    expect(openWork(items).some((i) => i.id === 'lineare-algebra-1:bonus-1')).toBe(true);
    // a quiz the course dates by week counts as work, it has a week
    expect(openWork(items).some((i) => i.id === 'engineering-design:quiz-1')).toBe(true);
  });

  it('filters by type on the tasks page and by role in the week view', () => {
    const items = buildItems(getPersonal().synced, now);
    const bonus = items.filter((i) => matchesTypeFilter(i, 'role:bonus'));
    expect(bonus.length).toBe(12 + 1 + 3); // Analysis, Lineare Algebra, Informatik
    expect(items.filter((i) => matchesTypeFilter(i, 'todo'))).toHaveLength(0);
    expect(items.filter((i) => matchesTypeFilter(i, 'other')).every((i) => i.kind === 'notion' || i.kind === 'exam')).toBe(true);
    expect(items.filter((i) => matchesTypeFilter(i, null))).toHaveLength(items.length);

    expect(visibleInWeek('bonus', { weekExerciseRoles: null })).toBe(true);
    expect(visibleInWeek('bonus', { weekExerciseRoles: ['normal', 'quiz'] })).toBe(false);
    expect(visibleInWeek('quiz', { weekExerciseRoles: ['normal', 'quiz'] })).toBe(true);
    // lectures and to-dos are never hidden by the exercise filter
    expect(visibleInWeek(null, { weekExerciseRoles: [] })).toBe(true);
  });

  it('are found by the search – by title and by bonus rule', () => {
    const search = createSearch({ ...seed, todos: [], exams: [], memos: [], links: [] });
    expect(search.search('Bonusaufgabe').some((h) => h.type === 'exercise')).toBe(true);
    expect(search.search('Bonus Analysis')[0]).toMatchObject({ type: 'exercise', target: { kind: 'route', to: '/bonus#analysis-1' } });
    expect(search.search('Lernkontrolle').some((h) => h.title === 'Lernkontrolle')).toBe(true);
  });
});

describe('storing the progress', () => {
  it('syncs like everything else and survives data from older versions', () => {
    const a = { ...emptySynced(), exercises: { x: { id: 'x', done: true, updatedAt: 5 } } };
    const b = { ...emptySynced(), exercises: { x: { id: 'x', done: false, updatedAt: 9 }, y: { id: 'y', count: 3, updatedAt: 1 } } };
    const m = mergeSynced(a, b, 10);
    expect(m.exercises).toEqual({ x: { id: 'x', done: false, updatedAt: 9 }, y: { id: 'y', count: 3, updatedAt: 1 } });
    expect(canonical(mergeSynced(b, a, 10))).toBe(canonical(m));

    // an install from before this feature simply has none of it – and loses nothing
    const old = { todos: { t: { id: 't', courseId: 'analysis-1', text: 'alt', done: false, createdAt: 1, updatedAt: 1 } }, prefs: { biweeklyParity: 'even', choices: {}, updatedAt: 2 } };
    const migrated = normalizeSynced(old);
    expect(migrated.exercises).toEqual({});
    expect(migrated.prefs.weekExerciseRoles).toBeNull();
    expect(migrated.todos.t.text).toBe('alt');

    // …and malformed entries from the public store are dropped
    expect(normalizeSynced({ exercises: { ok: { id: 'ok', updatedAt: 1 }, bad: { done: true } } }).exercises).toEqual({ ok: { id: 'ok', updatedAt: 1 } });
  });

  it('takes an own link per exercise – http(s) only, and removable again', () => {
    const id = 'analysis-1:bonus-3';
    expect(actions.setExerciseUrl(id, 'moodle-app2.let.ethz.ch/mod/assign/view.php?id=7')).toBe(true);
    const url = 'https://moodle-app2.let.ethz.ch/mod/assign/view.php?id=7';
    expect(getPersonal().synced.exercises[id].url).toBe(url);

    // the same rule as everywhere else: nothing but http(s) is stored
    expect(actions.setExerciseUrl(id, 'javascript:alert(1)')).toBe(false);
    expect(getPersonal().synced.exercises[id].url).toBe(url);
    expect(normalizeSynced({ exercises: { x: { id: 'x', url: 'javascript:alert(1)', updatedAt: 1 } } }).exercises).toEqual({});

    const item = buildItems(getPersonal().synced, now).find((i) => i.id === id)!;
    expect(item.exercise).toMatchObject({ url, ownUrl: url, key: true });
    // an ordinary series is not marked as grade-relevant, and keeps the course's own link
    const serie = buildItems(getPersonal().synced, now).find((i) => i.id === 'lineare-algebra-1:serie-1')!;
    expect(serie.exercise).toMatchObject({ key: false, ownUrl: undefined });
    expect(serie.exercise!.url).toContain('ex01.pdf');

    actions.setExerciseUrl(id, null);
    expect(getPersonal().synced.exercises[id].url).toBeUndefined();
  });

  it('remembers the week filter in the synced preferences', () => {
    actions.setWeekExerciseRoles(['bonus']);
    expect(getPersonal().synced.prefs.weekExerciseRoles).toEqual(['bonus']);
    actions.setWeekExerciseRoles(null);
    expect(getPersonal().synced.prefs.weekExerciseRoles).toBeNull();
  });
});

describe('hiding a read-only item (Notion task or course exercise)', () => {
  const notionId = 'task-info-ex-1';
  const exerciseId = 'chemistry:quiz-1';

  afterEach(() => {
    actions.unhideItem(notionId);
    actions.unhideItem(exerciseId);
  });

  it('removes it from buildItems and lists it in hiddenItems – the source stays put', () => {
    expect(buildItems(getPersonal().synced, now).some((i) => i.id === notionId)).toBe(true);
    actions.hideItem(notionId);
    expect(buildItems(getPersonal().synced, now).some((i) => i.id === notionId)).toBe(false);
    const h = hiddenItems(getPersonal().synced, now);
    expect(h.map((i) => i.id)).toContain(notionId);
    expect(h.find((i) => i.id === notionId)?.title).toBe('Exercise 1'); // still has its real title
    expect(seed.tasks.find((t) => t.id === notionId)).toBeDefined(); // seed.ts untouched

    actions.hideItem(exerciseId);
    expect(buildItems(getPersonal().synced, now).some((i) => i.id === exerciseId)).toBe(false);
    expect(COURSE_EXERCISES.chemistry.exercises.find((e) => e.id === exerciseId)).toBeDefined(); // config untouched

    actions.unhideItem(notionId);
    expect(buildItems(getPersonal().synced, now).some((i) => i.id === notionId)).toBe(true);
    expect(hiddenItems(getPersonal().synced, now).some((i) => i.id === notionId)).toBe(false);
  });

  it('is a synced record like taskDone: newer write wins, malformed entries are dropped, old backups default to none', () => {
    const a = { ...emptySynced(), hidden: { x: { id: 'x', hidden: true, updatedAt: 1 } } };
    const b = { ...emptySynced(), hidden: { x: { id: 'x', hidden: false, updatedAt: 5 } } };
    expect(mergeSynced(a, b, 10).hidden).toEqual({ x: { id: 'x', hidden: false, updatedAt: 5 } });
    expect(canonical(mergeSynced(b, a, 10))).toBe(canonical(mergeSynced(a, b, 10)));

    expect(normalizeSynced({ hidden: { ok: { id: 'ok', hidden: true, updatedAt: 1 }, bad: { id: 'bad' } } }).hidden)
      .toEqual({ ok: { id: 'ok', hidden: true, updatedAt: 1 } });
    expect(normalizeSynced({ todos: {} }).hidden).toEqual({}); // a backup from before this feature existed
  });

  it('a personal to-do or exam is never merely hidden – deleteTodo/deleteExam really remove it', () => {
    const id = actions.addTodo({ courseId: 'analysis-1', text: 'weg damit' });
    actions.deleteTodo(id);
    expect(getPersonal().synced.todos[id]).toBeUndefined();
    expect(getPersonal().synced.hidden[id]).toBeUndefined();
  });
});
