import { Fragment, type ReactNode } from 'react';
import { parseMarkdown, type Inline, type ListItem } from '../lib/markdown';

/** Renders assistant Markdown as real elements – never via innerHTML, so replies cannot inject markup. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      {parseMarkdown(text).map((b, i) => {
        switch (b.type) {
          case 'p':
            return <p key={i}>{inline(b.inline)}</p>;
          case 'h':
            return <p key={i} className={`md__h md__h${b.level}`}>{inline(b.inline)}</p>;
          case 'ul':
            return <ul key={i}>{b.items.map(item)}</ul>;
          case 'ol':
            return <ol key={i} start={b.start}>{b.items.map(item)}</ol>;
          case 'code':
            return <pre key={i} className="md__code"><code>{b.text}</code></pre>;
          case 'hr':
            return <hr key={i} />;
          case 'table':
            return (
              <div key={i} className="md__table">
                <table>
                  <thead><tr>{b.head.map((c, j) => <th key={j}>{inline(c)}</th>)}</tr></thead>
                  <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{inline(c)}</td>)}</tr>)}</tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}

const item = (it: ListItem, i: number) => (
  <li key={i} style={it.depth ? { marginLeft: `${it.depth * 1.25}em` } : undefined}>{inline(it.inline)}</li>
);

function inline(parts: Inline[]): ReactNode {
  return parts.map((p, i) => {
    switch (p.kind) {
      case 'text':
        // keep the model's single line breaks inside a paragraph
        return <Fragment key={i}>{p.text.split('\n').map((line, j) => (j ? [<br key={j} />, line] : line))}</Fragment>;
      case 'code':
        return <code key={i}>{p.text}</code>;
      case 'bold':
        return <strong key={i}>{inline(p.children)}</strong>;
      case 'italic':
        return <em key={i}>{inline(p.children)}</em>;
      case 'link':
        return <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">{inline(p.children)}</a>;
    }
  });
}
