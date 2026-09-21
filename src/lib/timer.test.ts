import { beforeEach, describe, expect, it } from 'vitest';
import { parseIntent } from './ai/mock';
import { buildAIDynamicContext } from './ai/context';
import { executeAction } from './ai/actions';
import { emptySynced, mergeSynced, normalizeSynced, type StudySession } from './state';
import { actions, getPersonal } from './store';
import { completeIfDue, getTimer, startTimer, stopTimer, weekStats } from './timer';
import { parseLocal } from './time';

const t = (s: string) => +parseLocal(s);
const session = (id: string, courseId: string, start: string, minutes: number): StudySession => ({ id, courseId, start: t(start), minutes, updatedAt: 1 });

beforeEach(() => {
  if (getTimer()) stopTimer(getTimer()!.startedAt); // discard, 0 minutes → not logged
  for (const id of Object.keys(getPersonal().synced.study)) actions.deleteStudy(id);
});

describe('study timer', () => {
  it('sums this ISO week per course and ignores last week', () => {
    const now = parseLocal('2026-09-24T18:00'); // Thursday, KW 39
    const s = weekStats([
      session('a', 'analysis-1', '2026-09-21T10:00', 25),
      session('b', 'analysis-1', '2026-09-23T16:00', 50),
      session('c', 'chemistry', '2026-09-24T08:00', 25),
      session('d', 'chemistry', '2026-09-18T08:00', 25), // previous week
    ], now);
    expect(s.total).toBe(100);
    expect(s.sessions).toBe(3);
    expect(s.byCourse).toEqual([{ courseId: 'analysis-1', minutes: 75 }, { courseId: 'chemistry', minutes: 25 }]);
  });

  it('logs a block only once it ran at least 5 minutes, and the full block when time is up', () => {
    startTimer('mechanik-1', 25, t('2026-09-21T10:00'));
    expect(stopTimer(t('2026-09-21T10:03'))).toBe(0);
    expect(Object.keys(getPersonal().synced.study)).toHaveLength(0);

    startTimer('mechanik-1', 25, t('2026-09-21T11:00'));
    expect(completeIfDue(t('2026-09-21T11:20'))).toBeNull(); // not yet
    expect(completeIfDue(t('2026-09-21T11:26'))?.minutes).toBe(25);
    expect(getTimer()).toBeNull();
    expect(Object.values(getPersonal().synced.study)).toMatchObject([{ courseId: 'mechanik-1', minutes: 25 }]);

    startTimer('chemistry', 50, t('2026-09-21T12:00'));
    expect(stopTimer(t('2026-09-21T12:31'))).toBe(31);
  });

  it('syncs finished blocks like everything else, deletions included', () => {
    const a = { ...emptySynced(), study: { s1: session('s1', 'analysis-1', '2026-09-21T10:00', 25) } };
    const b = { ...emptySynced(), study: { s2: session('s2', 'chemistry', '2026-09-21T12:00', 50) } };
    expect(Object.keys(mergeSynced(a, b).study).sort()).toEqual(['s1', 's2']);
    const deleted = { ...b, tombstones: { s1: Date.now() } };
    expect(Object.keys(mergeSynced(a, deleted).study)).toEqual(['s2']);
    // data from before the timer existed has no `study` at all – that must not break anything
    expect(normalizeSynced({ v: 2, todos: {} }).study).toEqual({});
  });

  it('can be driven by the assistant', () => {
    expect(parseIntent('Starte 25 Minuten Analysis').calls[0]).toEqual({ action: 'start_study_timer', params: { subject: 'analysis-1', minutes: 25 } });
    expect(parseIntent('Lernblock stoppen').calls[0]).toEqual({ action: 'stop_study_timer', params: {} });
    expect(parseIntent('Wie viel habe ich diese Woche gelernt?').calls[0].action).toBe('get_study_stats');

    const res = executeAction({ action: 'start_study_timer', params: { subject: 'Chemie', minutes: 50 } });
    expect(res.ok).toBe(true);
    expect(res.message).toMatch(/50 min Chemistry/);
    expect(buildAIDynamicContext().study.running?.subject).toBe('Chemistry');
    expect(executeAction({ action: 'start_study_timer', params: {} }).ok).toBe(false); // subject required
  });
});
