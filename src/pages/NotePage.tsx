import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chip, CourseDot, Icon } from '../components/ui';
import { seed } from '../data/seed';
import { courseById } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { slug } from '../lib/search';

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable – ignore */
    }
  };
  return (
    <div className="code">
      <button type="button" className="code__copy" onClick={copy} aria-label="Code kopieren">
        <Icon name={copied ? 'check' : 'copy'} size={16} />
        {copied ? 'Kopiert' : 'Kopieren'}
      </button>
      <pre><code>{text}</code></pre>
    </div>
  );
}

export function NotePage() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const note = seed.notes.find((n) => n.id === id);
  const course = note ? courseById(note.courseId) : undefined;
  const target = sp.get('h');
  useTitle(note?.title ?? 'Notiz');

  useEffect(() => {
    if (target) document.getElementById(`h-${target}`)?.scrollIntoView({ block: 'start' });
  }, [target, id]);

  if (!note) {
    return (
      <>
        <Link to="/courses" className="back"><Icon name="chevron-left" size={18} />Kurse</Link>
        <h1>Notiz nicht gefunden</h1>
      </>
    );
  }

  const headings = note.blocks.filter((b) => b.type === 'h2' || b.type === 'h3');

  return (
    <article className="note">
      <Link to={course ? `/courses/${course.id}` : '/courses'} className="back"><Icon name="chevron-left" size={18} />{course?.shortName ?? 'Kurse'}</Link>
      <header className="page-head page-head--plain">
        <div>
          <p className="eyebrow">{course && <CourseDot color={course.color} />}{course?.name} · Notiz <Chip>{note.sessionType}</Chip></p>
          <h1>{note.title}</h1>
        </div>
      </header>

      {headings.length > 1 && (
        <nav className="outline" aria-label="Auf dieser Seite">
          {headings.map((h) => (
            <button key={h.text} type="button" className="filter"
              onClick={() => document.getElementById(`h-${slug(h.text)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
              {h.text}
            </button>
          ))}
        </nav>
      )}

      <div className="prose">
        {note.blocks.map((b, i) => {
          if (b.type === 'h2') return <h2 key={i} id={`h-${slug(b.text)}`}>{b.text}</h2>;
          if (b.type === 'h3') return <h3 key={i} id={`h-${slug(b.text)}`}>{b.text}</h3>;
          if (b.type === 'code') return <CodeBlock key={i} text={b.text} />;
          return <p key={i}>{b.text}</p>;
        })}
      </div>
    </article>
  );
}
