import { Link } from 'react-router-dom';
import { CourseRow } from '../components/course';
import { SyncBadge } from '../components/Nav';
import { Icon } from '../components/ui';
import { seed } from '../data/seed';
import { COURSES, useItems } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';

export function CoursesPage() {
  useTitle('Kurse');
  const now = useNow();
  const items = useItems();
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{seed.meta.semester}</p>
          <h1>Kurse</h1>
        </div>
      </header>

      <ul className="panel list">
        {COURSES.map((c) => <CourseRow key={c.id} course={c} items={items} now={now} />)}
      </ul>

      <h2 className="h-section spaced">Mehr</h2>
      <ul className="panel list">
        <li>
          <Link to="/notes" className="row row--link">
            <Icon name="note" size={20} />
            <span className="row__main"><span className="row__title">Notizen</span><span className="row__meta"><span>Persönlich, nicht aus Notion</span></span></span>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
        <li>
          <Link to="/links" className="row row--link">
            <Icon name="link" size={20} />
            <span className="row__main"><span className="row__title">Links & Admin</span><span className="row__meta"><span>Curriculum, Administratives, alle Kurslinks</span></span></span>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
        <li>
          <Link to="/settings" className="row row--link">
            <Icon name="settings" size={20} />
            <span className="row__main"><span className="row__title">Einstellungen</span><span className="row__meta"><span>Sync, Darstellung, Stundenplan, Backup</span></span></span>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
      </ul>
      <div className="sync-row"><SyncBadge /></div>
    </>
  );
}
