import { beforeEach, describe, expect, it } from 'vitest';
import { seed } from '../data/seed';
import { ownLinksOf } from './data';
import { normalizeUrl, splitPasted, suggestLabel } from './links';
import { createSearch } from './search';
import { emptySynced, mergeSynced, normalizeSynced, type OwnLink } from './state';
import { actions, getPersonal } from './store';

const link = (id: string, patch: Partial<OwnLink> = {}): OwnLink => ({
  id, courseId: 'analysis-1', label: id, url: `https://example.ch/${id}`, createdAt: 1, updatedAt: 1, ...patch,
});

describe('web addresses', () => {
  it('accepts what people paste, with or without https://', () => {
    expect(normalizeUrl('moodle-app2.let.ethz.ch/course/view.php?id=28343')).toBe('https://moodle-app2.let.ethz.ch/course/view.php?id=28343');
    expect(normalizeUrl('  https://video.ethz.ch/lectures  ')).toBe('https://video.ethz.ch/lectures');
    expect(normalizeUrl('<https://n.ethz.ch/~x/skript.pdf>')).toBe('https://n.ethz.ch/~x/skript.pdf');
    expect(normalizeUrl('HTTP://ETHZ.CH')).toBe('http://ethz.ch/');
    expect(normalizeUrl('localhost:5173')).toBe('https://localhost:5173/');
  });

  it('refuses everything that is not a web address – above all javascript:', () => {
    for (const bad of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,<b>x</b>', 'mailto:a@b.ch', 'file:///C:/x', 'hallo', 'moodle ethz ch', '']) {
      expect(normalizeUrl(bad), bad).toBeNull();
    }
  });

  it('names a link nobody named: known services, PDFs by file name, else the host', () => {
    expect(suggestLabel('https://moodle-app2.let.ethz.ch/course/view.php?id=1')).toBe('Moodle');
    expect(suggestLabel('https://video.ethz.ch/lectures/d-infk/2026/autumn')).toBe('Aufzeichnungen');
    expect(suggestLabel('https://people.math.ethz.ch/~steiger/Analysis_I%20Skript.pdf')).toBe('Analysis I Skript');
    expect(suggestLabel('https://www.example.org/a')).toBe('example.org');
  });

  it('splits "name + address" pasted in one go', () => {
    expect(splitPasted('Skript Analysis: https://example.ch/a.pdf')).toEqual({ url: 'https://example.ch/a.pdf', rest: 'Skript Analysis' });
    expect(splitPasted('kein Link hier')).toBeNull();
  });
});

describe('own links in the synced data', () => {
  it('merge like notes: newer edit wins, deletions win over older copies', () => {
    const a = { ...emptySynced(), links: { k: link('k', { label: 'alt', updatedAt: 1 }), gone: link('gone') } };
    const b = { ...emptySynced(), links: { k: link('k', { label: 'neu', updatedAt: 5 }) }, tombstones: { gone: 3 } };
    expect(mergeSynced(a, b, 10).links).toEqual({ k: link('k', { label: 'neu', updatedAt: 5 }) });
    expect(mergeSynced(b, a, 10).links).toEqual(mergeSynced(a, b, 10).links);
  });

  it('drop malformed and non-web entries – the sync store is publicly writable', () => {
    const raw = { links: { evil: link('evil', { url: 'javascript:alert(1)' }), ok: link('ok'), bad: { id: 'bad' } } };
    expect(normalizeSynced(raw).links).toEqual({ ok: link('ok') });
    // data from before links existed simply has none
    expect(normalizeSynced({ todos: {} }).links).toEqual({});
  });

  it('are found by the search and open the address', () => {
    const search = createSearch({ ...seed, todos: [], exams: [], memos: [], links: [link('f', { label: 'Formelsammlung' })] });
    expect(search.search('Formelsammlung')[0]).toMatchObject({ type: 'link', target: { kind: 'external', url: 'https://example.ch/f' } });
    expect(search.search('Link hinzufügen').some((h) => h.id === 'action:add-link')).toBe(true);
  });
});

describe('link actions in the store', () => {
  beforeEach(() => actions.deleteAllOwn());

  it('stores a clean address, fills in a name, and refuses anything but http(s)', () => {
    const id = actions.addLink({ courseId: 'chemistry', url: 'moodle-app2.let.ethz.ch/course/view.php?id=9' })!;
    expect(getPersonal().synced.links[id]).toMatchObject({ courseId: 'chemistry', label: 'Moodle', url: 'https://moodle-app2.let.ethz.ch/course/view.php?id=9' });
    expect(actions.addLink({ courseId: 'chemistry', url: 'javascript:alert(1)' })).toBeNull();
    expect(Object.keys(getPersonal().synced.links)).toEqual([id]);
  });

  it('edits, deletes and restores', () => {
    const id = actions.addLink({ courseId: 'analysis-1', url: 'https://example.ch/a', label: 'Skript' })!;
    expect(actions.updateLink(id, { label: '  ', url: 'example.ch/b.pdf', courseId: 'mechanik-1' })).toBe(true);
    expect(getPersonal().synced.links[id]).toMatchObject({ label: 'b', url: 'https://example.ch/b.pdf', courseId: 'mechanik-1' });
    expect(actions.updateLink(id, { url: 'javascript:void 0' })).toBe(false);
    expect(ownLinksOf(getPersonal().synced, 'mechanik-1').map((l) => l.id)).toEqual([id]);

    const removed = actions.deleteLink(id)!;
    expect(getPersonal().synced.links[id]).toBeUndefined();
    expect(getPersonal().synced.tombstones[id]).toBeDefined();
    actions.restoreLink(removed);
    expect(getPersonal().synced.links[id]?.label).toBe('b');
  });
});
