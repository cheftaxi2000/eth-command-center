/**
 * A deliberately small Markdown parser for assistant replies.
 *
 * Output is plain data (blocks + inline parts) that components/Markdown.tsx turns into React
 * elements – nothing is ever inserted as HTML, so a reply containing "<script>" is just text.
 * Covers what chat models actually write: paragraphs, bullet/numbered lists (with indentation),
 * headings, **bold**, *italic*, `code`, fenced code, [links](https://…) and simple pipe tables.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'bold' | 'italic'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] };

export interface ListItem {
  depth: number;
  inline: Inline[];
}

export type Block =
  | { type: 'p'; inline: Inline[] }
  | { type: 'h'; level: 1 | 2 | 3; inline: Inline[] }
  | { type: 'ul' | 'ol'; items: ListItem[]; start?: number }
  | { type: 'code'; text: string }
  | { type: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { type: 'hr' };

// Order matters: code first (its content is literal), then links, bold, italic.
const INLINE = /(`[^`\n]+`)|(\[[^\]\n]+\]\((https?:\/\/[^)\s]+)\))|(\*\*[^*\n]+?\*\*|__[^_\n]+?__)|(\*[^*\s][^*\n]*?\*|_[^_\s][^_\n]*?_)/g;

export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of src.matchAll(INLINE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ kind: 'text', text: src.slice(last, at) });
    const [whole, code, link, href, bold, italic] = m;
    if (code) out.push({ kind: 'code', text: code.slice(1, -1) });
    else if (link && href) out.push({ kind: 'link', href, children: parseInline(link.slice(1, link.indexOf(']('))) });
    else if (bold) out.push({ kind: 'bold', children: parseInline(bold.slice(2, -2)) });
    else if (italic) out.push({ kind: 'italic', children: parseInline(italic.slice(1, -1)) });
    last = at + whole.length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

const BULLET = /^(\s*)[-*•+]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^(#{1,6})\s+(.*)$/;
const RULE = /^\s*([-*_])(\s*\1){2,}\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const depthOf = (indent: string) => Math.min(3, Math.floor(indent.replace(/\t/g, '    ').length / 2));
const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => parseInline(c.trim()));

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];

  const flush = () => {
    if (para.length > 0) blocks.push({ type: 'p', inline: parseInline(para.join('\n')) });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    if (RULE.test(line)) {
      flush();
      blocks.push({ type: 'hr' });
      continue;
    }
    const h = line.match(HEADING);
    if (h) {
      flush();
      blocks.push({ type: 'h', level: Math.min(3, h[1].length) as 1 | 2 | 3, inline: parseInline(h[2].replace(/\s*#+\s*$/, '')) });
      continue;
    }
    if (line.trim().startsWith('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const head = cells(line);
      const rows: Inline[][][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      i--;
      blocks.push({ type: 'table', head, rows });
      continue;
    }
    const b = line.match(BULLET);
    const n = b ? null : line.match(NUMBERED);
    if (b || n) {
      flush();
      const type = b ? 'ul' : 'ol';
      const prev = blocks[blocks.length - 1];
      const item: ListItem = b ? { depth: depthOf(b[1]), inline: parseInline(b[2]) } : { depth: depthOf(n![1]), inline: parseInline(n![3]) };
      // Continue the list directly above (models often leave no blank line between items)
      if (prev && prev.type === type && lines[i - 1]?.trim()) prev.items.push(item);
      else blocks.push({ type, items: [item], ...(n ? { start: Number(n[2]) } : {}) });
      continue;
    }
    // A wrapped continuation line of the previous list item
    const prev = blocks[blocks.length - 1];
    if (para.length === 0 && prev && (prev.type === 'ul' || prev.type === 'ol') && /^\s{2,}\S/.test(line) && lines[i - 1]?.trim()) {
      const item = prev.items[prev.items.length - 1];
      item.inline = [...item.inline, { kind: 'text', text: ' ' }, ...parseInline(line.trim())];
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return blocks;
}

/** Plain text version – for "Kopieren" and for anything that must not show markup. */
export function toPlainText(src: string): string {
  const flat = (xs: Inline[]): string => xs.map((x) => ('text' in x ? x.text : flat(x.children))).join('');
  return parseMarkdown(src)
    .map((b) => {
      if (b.type === 'p' || b.type === 'h') return flat(b.inline);
      if (b.type === 'ul' || b.type === 'ol') return b.items.map((it, i) => `${'  '.repeat(it.depth)}${b.type === 'ul' ? '•' : `${(b.start ?? 1) + i}.`} ${flat(it.inline)}`).join('\n');
      if (b.type === 'code') return b.text;
      if (b.type === 'table') return [b.head, ...b.rows].map((r) => r.map(flat).join('  ·  ')).join('\n');
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}
