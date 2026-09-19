import { Link } from 'react-router-dom';
import { CourseRow } from '../components/course';
import { Icon } from '../components/ui';
import { COURSES, useDeadlines } from '../lib/data';
import { useNow } from '../lib/now';
import { seed } from '../data/seed';

export function CoursesPage() {
  const now = useNow();
  const deadlines = useDeadlines();
  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">{seed.meta.semester}</p>
          <h1>Kurse</h1>
        </div>
      </header>

      <ul className="panel list">
        {COURSES.map((c) => <CourseRow key={c.id} course={c} deadlines={deadlines} now={now} />)}
      </ul>

      <p className="h-section spaced">Mehr</p>
      <ul className="panel list">
        <li>
          <Link to="/links" className="row row--link">
            <Icon name="link" size={20} />
            <div className="row__main"><div className="row__title">Links & Admin</div><div className="row__meta"><span>Studiensekretariat, Curriculum, alle Kurslinks</span></div></div>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
        <li>
          <Link to="/settings" className="row row--link">
            <Icon name="settings" size={20} />
            <div className="row__main"><div className="row__title">Einstellungen</div><div className="row__meta"><span>Darstellung, Wochen, Übungsgruppe, Daten</span></div></div>
            <Icon name="chevron-right" size={18} />
          </Link>
        </li>
      </ul>
    </>
  );
}
