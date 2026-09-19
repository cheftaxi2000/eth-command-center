import { Link } from 'react-router-dom';
import type { Course, CourseLink, Deadline } from '../types';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { actions, usePersonal } from '../lib/store';
import { getNow } from '../lib/now';
import { DAY_SHORT, fmtTime, isoWeek } from '../lib/time';
import { Chip, CourseDot, Icon, Segmented, cx } from './ui';

export function CourseRow({ course, deadlines, now }: { course: Course; deadlines: Deadline[]; now: Date }) {
  const p = usePersonal();
  const next = nextOccurrence(now, [course], p.prefs);
  const open = deadlines.filter((d) => d.courseId === course.id && !d.done).length;
  return (
    <li>
      <Link to={`/courses/${course.id}`} className="row row--link">
        <CourseDot color={course.color} />
        <div className="row__main">
          <div className="row__title">{course.name}</div>
          <div className="row__meta">
            <span>
              {next
                ? `Als Nächstes: ${DAY_SHORT[next.start.getDay()]} ${fmtTime(next.start)} · ${KIND_LABEL[next.session.kind]}`
                : 'Keine Termine'}
            </span>
          </div>
        </div>
        {open > 0 && <Chip>{open} offen</Chip>}
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

const LINK_KIND: Record<CourseLink['kind'], string> = {
  moodle: 'Moodle', exercise: 'Übungen', course: 'Kurs', video: 'Video', other: 'Link',
};

export function LinkChip({ link, course }: { link: CourseLink; course?: Course }) {
  return (
    <a className="linkchip" href={link.url} target="_blank" rel="noopener noreferrer">
      {course && <CourseDot color={course.color} />}
      <span>{link.label}</span>
      <Icon name="external" size={14} />
    </a>
  );
}

export const linkKindLabel = (k: CourseLink['kind']) => LINK_KIND[k];

/** Which ISO-week parity the 2-weekly lecture follows – asked once, then remembered. */
export function ParityControl() {
  const p = usePersonal();
  const week = isoWeek(getNow());
  return (
    <div className="parity">
      <Segmented
        label="Wochen der 2-wöchentlichen Vorlesung"
        value={p.prefs.biweeklyParity ?? 'unset'}
        onChange={(v) => actions.setParity(v === 'unset' ? null : v)}
        options={[
          { value: 'unset', label: 'Noch offen' },
          { value: 'odd', label: 'Ungerade KW' },
          { value: 'even', label: 'Gerade KW' },
        ]}
      />
      <p className="hint">Zur Orientierung: Heute ist KW {week} ({week % 2 ? 'ungerade' : 'gerade'}). Notion enthält nur „2-wöchentlich“, nicht in welchen Wochen.</p>
    </div>
  );
}

/** Pick which of several alternative exercise groups the student attends. */
export function GroupChoice({ course, group }: { course: Course; group: string }) {
  const p = usePersonal();
  const chosen = p.prefs.choices[group];
  const sessions = course.sessions.filter((s) => s.choiceGroup === group);
  return (
    <ul className="choice">
      {sessions.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            role="radio"
            aria-checked={chosen === s.id}
            className={cx('choice__btn', chosen === s.id && 'is-on')}
            onClick={() => actions.setChoice(group, chosen === s.id ? null : s.id)}
          >
            <span className="choice__radio" aria-hidden="true" />
            <span>{DAY_SHORT[s.day]} {s.start}–{s.end} · {s.room}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
