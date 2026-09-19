import { useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Course, CourseLink } from '../types';
import { COURSES, type Item } from '../lib/data';
import { getNow } from '../lib/now';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { actions, usePersonal } from '../lib/store';
import { DAY_SHORT, fmtRelDay, fmtTime, isoWeek } from '../lib/time';
import { Chip, CourseDot, Icon, Segmented, cvar, cx } from './ui';

export function CourseRow({ course, items, now }: { course: Course; items: Item[]; now: Date }) {
  const { synced } = usePersonal();
  const next = nextOccurrence(now, [course], synced.prefs);
  const open = items.filter((i) => i.courseId === course.id && !i.done && i.kind !== 'exam').length;
  return (
    <li>
      <Link to={`/courses/${course.id}`} className="row row--link">
        <CourseDot color={course.color} />
        <span className="row__main">
          <span className="row__title">{course.name}</span>
          <span className="row__meta">
            <span>{next ? `${fmtRelDay(next.start, now)} ${fmtTime(next.start)} · ${KIND_LABEL[next.session.kind]} · ${next.session.room}` : 'Keine Termine'}</span>
          </span>
        </span>
        {open > 0 && <Chip>{open} offen</Chip>}
        <Icon name="chevron-right" size={18} />
      </Link>
    </li>
  );
}

/** One-tap course switching on iPad/phone: horizontally scrolling chips, current course highlighted */
export function CourseSwitcher() {
  const ref = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  useEffect(() => {
    const bar = ref.current;
    const active = bar?.querySelector<HTMLElement>('.is-active');
    if (bar && active) bar.scrollLeft = active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2;
  }, [pathname]);
  return (
    <nav className="switcher" ref={ref} data-noswipe aria-label="Kurs wechseln">
      {COURSES.map((c) => (
        <NavLink key={c.id} to={`/courses/${c.id}`} className={({ isActive }) => cx('switch', isActive && 'is-active')} style={cvar(c.color)}>
          <CourseDot color={c.color} />
          {c.shortName}
        </NavLink>
      ))}
    </nav>
  );
}

const LINK_KIND: Record<CourseLink['kind'], string> = {
  moodle: 'Moodle', exercise: 'Übungen', course: 'Kurswebsite', video: 'Video', other: 'Link',
};
export const linkKindLabel = (k: CourseLink['kind']) => LINK_KIND[k];

/** The course's external links as big tap targets right under the title */
export function LinkButtons({ links }: { links: CourseLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="linkbtns" data-noswipe>
      {links.map((l) => (
        <a key={l.url} className="linkbtn" href={l.url} target="_blank" rel="noopener noreferrer">
          {l.label}
          <Icon name="external" size={15} />
        </a>
      ))}
    </div>
  );
}

/** Which ISO-week parity the 2-weekly lecture follows – asked once, then remembered (and synced). */
export function ParityControl() {
  const { synced } = usePersonal();
  const week = isoWeek(getNow());
  return (
    <div className="parity">
      <Segmented
        label="Wochen der 2-wöchentlichen Vorlesung"
        value={synced.prefs.biweeklyParity ?? 'unset'}
        onChange={(v) => actions.setParity(v === 'unset' ? null : v)}
        options={[
          { value: 'unset', label: 'Noch offen' },
          { value: 'odd', label: 'Ungerade KW' },
          { value: 'even', label: 'Gerade KW' },
        ]}
      />
      <p className="hint">Diese Woche ist KW {week} ({week % 2 ? 'ungerade' : 'gerade'}). Notion sagt nur „2-wöchentlich“, nicht in welchen Wochen.</p>
    </div>
  );
}

/** Pick which of several alternative exercise groups the student attends. */
export function GroupChoice({ course, group }: { course: Course; group: string }) {
  const { synced } = usePersonal();
  const chosen = synced.prefs.choices[group];
  return (
    <ul className="choice" role="radiogroup" aria-label="Übungsgruppe">
      {course.sessions.filter((s) => s.choiceGroup === group).map((s) => (
        <li key={s.id}>
          <button type="button" role="radio" aria-checked={chosen === s.id}
            className={cx('choice__btn', chosen === s.id && 'is-on')}
            onClick={() => actions.setChoice(group, chosen === s.id ? null : s.id)}>
            <span className="choice__radio" aria-hidden="true" />
            <span>{DAY_SHORT[s.day]} {s.start}–{s.end} · {s.room}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
