import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BonusDetail } from '../components/exercises';
import { CourseDot, Icon } from '../components/ui';
import { VERIFIED_ON } from '../data/exercises';
import { targetOf } from '../lib/data';
import { configOf, coursesWithExercises } from '../lib/exercises';
import { useTitle } from '../lib/hooks';

/**
 * One page that answers "Wie komme ich in jedem Fach zum Bonus?" – with the real HS26 rules, the
 * verbatim wording, the current progress and an honest list of what is not public.
 */
export function BonusPage() {
  useTitle('Bonus & Leistung');
  const { hash } = useLocation();
  const courses = coursesWithExercises();

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Was zählt in welchem Fach</p>
          <h1>Bonus & Leistung</h1>
        </div>
      </header>

      <p className="hint hint--block">
        Jeder Kurs macht es anders: Notenbonus für Bonusaufgaben, Bonus für Quiz plus abgegebene Serien,
        freiwillige Zwischenprüfungen, oder gar kein Bonus. Unten steht pro Fach die echte Regel im Wortlaut –
        Stand {VERIFIED_ON}.
      </p>

      <nav className="bonus-nav" aria-label="Zu einem Fach springen">
        {courses.map((c) => (
          <a key={c.id} className="pick" href={`#${c.id}`}>
            <CourseDot color={c.color} />{c.shortName}
          </a>
        ))}
      </nav>

      {courses.map((c) => {
        const cfg = configOf(c.id);
        return cfg ? <BonusDetail key={c.id} cfg={cfg} /> : null;
      })}

      <p className="hint hint--block">
        <Icon name="alert" size={16} /> Moodle und Code Expert verlangen ein Login – was dort steht (einzelne
        Termine, Serien), konnte die App nicht lesen und steht deshalb nirgends als Tatsache. Wenn du einen
        Termin kennst, trag ihn als eigenes To-do ein: {targetOf('allgemein').name} → „+ To-do".
      </p>
    </>
  );
}
