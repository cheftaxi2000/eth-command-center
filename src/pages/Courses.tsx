import { CourseRow } from '../components/course';
import { seed } from '../data/seed';
import { COURSES, useItems } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { useNow } from '../lib/now';

/** All courses at a glance. Notizen, Bonus, Links and Einstellungen live in the ☰ menu. */
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
    </>
  );
}
