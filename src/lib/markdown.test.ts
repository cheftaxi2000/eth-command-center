import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, toPlainText } from './markdown';
import { encodeWav } from './voice';

describe('markdown for assistant replies', () => {
  it('turns the reply from the screenshot into a real list with bold times', () => {
    const reply = 'Morgen, am Dienstag, hast du folgende Termine:\n\n*   **08:15 - 10:00 Uhr**: Informatik I (Übung) in HG D 3.1\n*   **10:15 - 12:00 Uhr**: Lineare Algebra I (Vorlesung) in ETA F 5';
    const blocks = parseMarkdown(reply);
    expect(blocks.map((b) => b.type)).toEqual(['p', 'ul']);
    const list = blocks[1];
    expect(list.type === 'ul' && list.items).toHaveLength(2);
    expect(list.type === 'ul' && list.items[0].inline[0]).toEqual({ kind: 'bold', children: [{ kind: 'text', text: '08:15 - 10:00 Uhr' }] });
    expect(toPlainText(reply)).not.toContain('*');
  });

  it('keeps numbered lists, headings, code and nested bullets', () => {
    const blocks = parseMarkdown('## Plan\n1. Serie lesen\n2. Aufgaben 1–3\n   - zuerst `L\'Hôpital`\n\n```\nx = 1\n```');
    expect(blocks.map((b) => b.type)).toEqual(['h', 'ol', 'ul', 'code']);
    const nested = blocks[2];
    expect(nested.type === 'ul' && nested.items[0].depth).toBe(1);
    expect(blocks[3]).toEqual({ type: 'code', text: 'x = 1' });
  });

  it('reads simple tables', () => {
    const t = parseMarkdown('| Zeit | Fach |\n|---|---|\n| 08:15 | Analysis |\n| 10:15 | Mechanik |')[0];
    expect(t.type === 'table' && t.rows).toHaveLength(2);
  });

  it('never turns text into markup: HTML stays text, only http(s) links become links', () => {
    expect(parseInline('<img src=x onerror=alert(1)>')).toEqual([{ kind: 'text', text: '<img src=x onerror=alert(1)>' }]);
    expect(parseInline('[klick](javascript:alert(1))').some((p) => p.kind === 'link')).toBe(false);
    expect(parseInline('[ETH](https://ethz.ch)')[0]).toMatchObject({ kind: 'link', href: 'https://ethz.ch' });
  });

  it('does not mistake a multiplication or a lone star for italics', () => {
    expect(parseInline('3 * 4 = 12').every((p) => p.kind === 'text')).toBe(true);
  });
});

describe('WAV encoding for dictation', () => {
  it('writes a valid 16-bit mono PCM header and clamps samples', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 2]), 16000);
    const v = new DataView(wav.buffer);
    const tag = (o: number) => String.fromCharCode(...wav.slice(o, o + 4));
    expect([tag(0), tag(8), tag(12), tag(36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint32(40, true)).toBe(8); // 4 samples × 2 bytes
    expect(v.getInt16(46, true)).toBe(32767);
    expect(v.getInt16(50, true)).toBe(32767); // 2 clamped to 1
    expect(wav.length).toBe(52);
  });
});
