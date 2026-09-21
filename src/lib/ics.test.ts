import { describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { buildIcs, escapeText, foldLine } from './ics';
import { emptySynced } from './state';
import { parseLocal } from './time';

const now = parseLocal('2026-09-21T09:00');
const events = (ics: string) => ics.split('BEGIN:VEVENT').length - 1;
const summaries = (ics: string) => [...ics.matchAll(/^SUMMARY:(.*)$/gm)].map((m) => m[1].trim());

describe('calendar export (.ics)', () => {
  it('writes a valid calendar with CRLF lines, the week’s sessions and the open deadlines', () => {
    const ics = buildIcs({ now, weeks: 1, courses: seed.courses, synced: emptySynced() });
    expect(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.replace(/\r\n/g, '').includes('\n')).toBe(false); // every line break is CRLF
    const s = summaries(ics);
    // parity + chosen group honoured: KW 39 has no Monday Analysis lecture, Mechanik exercise only Thursday 08:15
    expect(s.filter((x) => x.startsWith('Analysis I – Vorlesung'))).toHaveLength(2);
    expect(s.filter((x) => x.startsWith('Mechanik I – Übung'))).toHaveLength(1);
    expect(s.filter((x) => x.startsWith('Abgabe:'))).toHaveLength(4); // the four Notion tasks
    expect(ics).toContain('TRIGGER:-P1D');
  });

  it('writes times in UTC, so the calendar shows the right local time', () => {
    const ics = buildIcs({ now, weeks: 1, courses: seed.courses, synced: emptySynced() });
    // Mechanik Mon 21.09. 10:15 local → the same instant in UTC (in Zurich, CEST: 08:15Z).
    // Derived instead of hard-coded, so the test holds in any time zone – CI runs in UTC.
    const expected = new Date(2026, 8, 21, 10, 15).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    expect(ics).toContain(`DTSTART:${expected}`);
  });

  it('exports an own all-day to-do as an all-day event, done ones not at all', () => {
    const synced = emptySynced();
    synced.todos.t1 = { id: 't1', courseId: 'chemistry', text: 'Laborbericht, Teil 2', due: '2026-09-24', done: false, createdAt: 1, updatedAt: 1 };
    synced.todos.t2 = { id: 't2', courseId: 'chemistry', text: 'Schon fertig', due: '2026-09-24', done: true, createdAt: 1, updatedAt: 1 };
    const ics = buildIcs({ now, weeks: 1, courses: seed.courses, synced });
    expect(ics).toContain('DTSTART;VALUE=DATE:20260924');
    expect(ics).toContain('SUMMARY:Fällig: Laborbericht\\, Teil 2 (Chemistry)');
    expect(ics).not.toContain('Schon fertig');
    expect(events(ics)).toBeGreaterThan(10);
  });

  it('escapes text and folds long lines by bytes, not characters', () => {
    expect(escapeText('a,b;c\\d\ne')).toBe('a\\,b\\;c\\\\d\\ne');
    const long = `SUMMARY:${'ü'.repeat(60)}`; // 8 + 120 bytes
    const folded = foldLine(long);
    for (const part of folded.split('\r\n')) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.split('\r\n').map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(long);
  });
});
