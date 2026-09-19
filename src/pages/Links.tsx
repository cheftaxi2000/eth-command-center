import { Icon, CourseDot } from '../components/ui';
import { linkKindLabel } from '../components/course';
import { seed } from '../data/seed';
import { COURSES } from '../lib/data';
import { useTitle } from '../lib/hooks';

const hostOf = (url: string) => {
  try { return new URL(url).hostname; } catch { return url; }
};

function LinkRow({ label, sub, url, lead }: { label: string; sub: string; url: string; lead?: React.ReactNode }) {
  return (
    <li>
      <a className="row row--link" href={url} target="_blank" rel="noopener noreferrer">
        {lead ?? <Icon name="external" size={20} />}
        <div className="row__main"><div className="row__title">{label}</div><div className="row__meta"><span>{sub}</span></div></div>
        <Icon name="external" size={16} />
      </a>
    </li>
  );
}

export function LinksPage() {
  useTitle('Links & Admin');
  const withLinks = COURSES.filter((c) => c.links.length > 0);
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Studium & Organisation</p>
          <h1>Links & Admin</h1>
        </div>
      </header>

      <p className="h-section">Departement</p>
      <ul className="panel list">
        {seed.adminLinks.map((l) => <LinkRow key={l.url} label={l.label} sub={l.description ?? hostOf(l.url)} url={l.url} />)}
      </ul>

      {withLinks.map((c) => (
        <div key={c.id}>
          <p className="h-section spaced"><CourseDot color={c.color} /> {c.name}</p>
          <ul className="panel list">
            {c.links.map((l) => <LinkRow key={l.url} label={l.label} sub={`${linkKindLabel(l.kind)} · ${hostOf(l.url)}`} url={l.url} />)}
          </ul>
        </div>
      ))}
    </>
  );
}
