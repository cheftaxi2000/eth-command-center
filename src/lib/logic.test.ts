import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { buildDeadlines } from './data';
import { defaultPersonal } from './store';
import { nextOccurrence, occurrencesInWeek, occurrencesOn } from './schedule';
import { createSearch, groupHits } from './search';
import { dueInfo, isoWeek, parseLocal, startOfWeek } from './time';

const prefs = defaultPersonal.prefs;
const search = createSearch({ ...seed, exams: [] });

describe('time helpers', () => {
  it('computes ISO weeks', () => {
    expect(isoWeek(parseLocal('2026-09-21T00:00'))).toBe(39); // Monday
    expect(isoWeek(parseLocal('2026-09-19T00:00'))).toBe(38); // Saturday before
  });
  it('finds the Monday of a week', () => {
    const mon = startOfWeek(parseLocal('2026-09-19T12:00')); // Saturday
    expect(mon.getDay()).toBe(1);
    expect(mon.getDate()).toBe(14);
  });
  it('describes deadlines relative to now', () => {
    const now = parseLocal('2026-09-19T10:00');
    expect(dueInfo(parseLocal('2026-09-22T14:00'), now)).toMatchObject({ label: 'in 3 Tagen', tone: 'soon' });
    expect(dueInfo(parseLocal('2026-09-20T09:00'), now).label).toBe('Morgen, 09:00');
    expect(dueInfo(parseLocal('2026-09-19T18:00'), now).tone).toBe('today');
    expect(dueInfo(parseLocal('2026-09-18T18:00'), now).tone).toBe('overdue');
    expect(dueInfo(parseLocal('2026-10-30T18:00'), now).tone).toBe('later');
  });
});

describe('schedule', () => {
  it('lists Monday 2026-09-21 in time order (2-weekly lecture flagged while parity is unknown)', () => {
    const occ = occurrencesOn(parseLocal('2026-09-21T00:00'), seed.courses, prefs);
    expect(occ.map((o) => o.session.id)).toEqual(['mech-v-mo', 'ana-v-mo', 'ed-v']);
    expect(occ.find((o) => o.session.id === 'ana-v-mo')?.flag).toBe('biweekly');
  });

  it('applies the week parity of a 2-weekly lecture', () => {
    const week39 = parseLocal('2026-09-21T00:00'); // odd ISO week
    const week40 = parseLocal('2026-09-28T00:00');
    const odd = { ...prefs, biweeklyParity: 'odd' as const };
    expect(occurrencesOn(week39, seed.courses, odd).some((o) => o.session.id === 'ana-v-mo')).toBe(true);
    expect(occurrencesOn(week40, seed.courses, odd).some((o) => o.session.id === 'ana-v-mo')).toBe(false);
  });

  it('keeps only the chosen exercise group', () => {
    const tue = parseLocal('2026-09-22T00:00');
    const all = occurrencesOn(tue, seed.courses, prefs).filter((o) => o.session.kind === 'exercise' && o.course.id === 'mechanik-1');
    expect(all).toHaveLength(1);
    expect(all[0].flag).toBe('choice');
    const chosen = { ...prefs, choices: { 'mechanik-uebung': 'mech-u-do1' } };
    expect(occurrencesOn(tue, seed.courses, chosen).some((o) => o.course.id === 'mechanik-1' && o.session.kind === 'exercise')).toBe(false);
    expect(occurrencesOn(parseLocal('2026-09-24T00:00'), seed.courses, chosen).map((o) => o.session.id)).toContain('mech-u-do1');
  });

  it('has no overlapping sessions in a normal week', () => {
    const chosen = { biweeklyParity: 'odd' as const, choices: { 'mechanik-uebung': 'mech-u-do1' } };
    for (const day of occurrencesInWeek(parseLocal('2026-09-21T00:00'), seed.courses, chosen)) {
      for (let i = 1; i < day.length; i++) expect(+day[i].start).toBeGreaterThanOrEqual(+day[i - 1].end);
    }
  });

  it('finds the next session from a weekend', () => {
    const next = nextOccurrence(parseLocal('2026-09-19T10:00'), seed.courses, prefs);
    expect(next?.session.id).toBe('mech-v-mo');
  });
});

describe('deadlines', () => {
  it('merges Notion tasks, local check-offs and exams', () => {
    const now = parseLocal('2026-09-19T10:00');
    const p = {
      ...defaultPersonal,
      taskDone: { 'task-ana-serie-1': true },
      exams: [{ id: 'e1', courseId: 'analysis-1', title: 'Prüfung', when: '2027-02-01T09:00' }],
    };
    const list = buildDeadlines(p, now);
    expect(list).toHaveLength(5);
    expect(list.find((d) => d.id === 'task-ana-serie-1')?.done).toBe(true);
    expect(list.find((d) => d.id === 'task-info-ex-1')?.inProgress).toBe(true);
    expect(list.at(-1)?.kind).toBe('exam');
  });
});

describe('search', () => {
  const top = (q: string) => search.search(q)[0];

  it('finds courses by name and alias', () => {
    expect(top('Analysis 1')?.id).toBe('course:analysis-1');
    expect(top('Analysis I')?.id).toBe('course:analysis-1');
    expect(top('linalg')?.id).toBe('course:lineare-algebra-1');
    expect(top('Mechanik')?.type).toBe('course');
    expect(top('Chemie')?.id).toBe('course:chemistry');
  });

  it('ignores case and umlauts', () => {
    expect(search.search('prufung').length).toBeGreaterThan(0);
    expect(search.search('PRÜFUNG').some((h) => h.id === 'action:add-exam')).toBe(true);
  });

  it('finds instructors, tasks, links, rooms and note contents', () => {
    const steiger = search.search('Steiger');
    expect(steiger.some((h) => h.type === 'instructor')).toBe(true);
    expect(steiger[0].courseId).toBe('analysis-1');
    expect(search.search('Serie').filter((h) => h.type === 'deadline')).toHaveLength(2);
    expect(search.search('codeexpert').some((h) => h.type === 'link')).toBe(true);
    expect(search.search('HG E3').some((h) => h.type === 'session')).toBe(true);
    expect(search.search('getline').some((h) => h.id === 'note:informatik-cpp-basics')).toBe(true);
    expect(search.search('iostream').some((h) => h.type === 'topic')).toBe(true);
  });

  it('returns nothing for content that is not in the data (no invented topics)', () => {
    expect(search.search('Taylor')).toEqual([]);
  });

  it('groups hits by type in a stable order', () => {
    const groups = groupHits(search.search('Analysis'));
    expect(groups[0].type).toBe('course');
  });
});
