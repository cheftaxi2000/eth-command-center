import { Icon, CourseDot } from '../components/ui';
import { LinkRow, linkKindLabel } from '../components/course';
import { useUI } from '../components/ui-context';
import { seed } from '../data/seed';
import { COURSES, ownLinksOf } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { hostOf } from '../lib/links';
import { GENERAL_ID } from '../lib/state';
import { usePersonal } from '../lib/store';

export function LinksPage() {
  useTitle('Links & Admin');
  const ui = useUI();
  const { synced } = usePersonal();
  const general = ownLinksOf(synced, GENERAL_ID);
  const courses = COURSES.map((c) => ({ c, own: ownLinksOf(synced, c.id) }));
  const withLinks = courses.filter(({ c, own }) => c.links.length + own.length > 0);
  const without = courses.filter(({ c, own }) => c.links.length + own.length === 0).map(({ c }) => c);
  const edit = (id: string) => () => ui.openLinkEditor({ mode: 'edit', id });

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Studium & Organisation</p>
          <h1>Links & Admin</h1>
        </div>
        <button type="button" className="btn btn--primary" onClick={() => ui.openLinkEditor({ mode: 'new' })}>
          <Icon name="plus" size={18} />Link
        </button>
      </header>

      <p className="h-section">Departement</p>
      <ul className="panel list">
        {seed.adminLinks.map((l) => <LinkRow key={l.url} label={l.label} meta={l.description ?? hostOf(l.url)} url={l.url} />)}
      </ul>

      {general.length > 0 && (
        <>
          <p className="h-section spaced">Allgemein</p>
          <ul className="panel list">
            {general.map((l) => <LinkRow key={l.id} label={l.label} meta={`Eigener Link · ${hostOf(l.url)}`} url={l.url} onEdit={edit(l.id)} />)}
          </ul>
        </>
      )}

      {withLinks.map(({ c, own }) => (
        <div key={c.id}>
          <p className="h-section spaced"><CourseDot color={c.color} /> {c.name}</p>
          <ul className="panel list">
            {c.links.map((l) => <LinkRow key={l.url} label={l.label} meta={`${linkKindLabel(l.kind)} · ${hostOf(l.url)}`} url={l.url} />)}
            {own.map((l) => <LinkRow key={l.id} label={l.label} meta={`Eigener Link · ${hostOf(l.url)}`} url={l.url} onEdit={edit(l.id)} />)}
          </ul>
        </div>
      ))}

      {without.length > 0 && (
        <section className="links-missing" aria-label="Kurse ohne Links">
          <p className="hint">Noch ohne Links – Moodle, Skript oder Aufzeichnungen gleich hier ablegen:</p>
          <div className="pickchips">
            {without.map((c) => (
              <button key={c.id} type="button" className="pick" onClick={() => ui.openLinkEditor({ mode: 'new', courseId: c.id })}>
                <Icon name="plus" size={15} /><CourseDot color={c.color} />{c.shortName}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
