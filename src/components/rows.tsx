import { Link } from 'react-router-dom';
import type { Deadline } from '../types';
import { courseById } from '../lib/data';
import { KIND_LABEL, type Occurrence } from '../lib/schedule';
import { actions } from '../lib/store';
import { dueInfo, fmtDateShort, fmtTime } from '../lib/time';
import { Chip, CheckButton, CourseDot, Icon, cvar, cx } from './ui';

export function DeadlineRow({ d, now, hideCourse }: { d: Deadline; now: Date; hideCourse?: boolean }) {
  const course = courseById(d.courseId);
  const info = dueInfo(d.when, now);
  return (
    <li className={cx('row', 'deadline', d.done && 'is-done')}>
      {d.kind === 'task' ? (
        <CheckButton checked={d.done} label={`${d.title} erledigt`} onChange={(v) => actions.setTaskDone(d.id, v, d.local)} />
      ) : (
        <span className="row__lead" aria-hidden="true"><Icon name="flag" size={20} /></span>
      )}
      <div className="row__main">
        <div className="row__title">
          {d.title}
          {d.kind === 'exam' && <Chip tone="accent">Prüfung</Chip>}
          {d.inProgress && <Chip>In Arbeit</Chip>}
        </div>
        {/* Notion's task category ("Individual") is the same for every task – noise, so only exam locations show here */}
        {(!hideCourse || (d.kind === 'exam' && d.meta)) && (
          <div className="row__meta">
            {!hideCourse && course && (
              <Link to={`/courses/${course.id}`} className="meta-link">
                <CourseDot color={course.color} />
                {course.shortName}
              </Link>
            )}
            {d.kind === 'exam' && d.meta && <span>{d.meta}</span>}
          </div>
        )}
      </div>
      <div className={cx('row__due', !d.done && `tone-${info.tone}`)}>
        {d.done ? <span>{fmtDateShort(d.when)}</span> : (<><span className="due-label">{info.label}</span><span className="due-detail">{info.detail}</span></>)}
      </div>
      {d.local && d.kind === 'task' && (
        <button type="button" className="icon-btn icon-btn--quiet" aria-label={`${d.title} entfernen`} onClick={() => actions.removeTask(d.id)}>
          <Icon name="trash" size={18} />
        </button>
      )}
      {d.local && d.kind === 'exam' && (
        <button type="button" className="icon-btn icon-btn--quiet" aria-label={`${d.title} entfernen`} onClick={() => actions.removeExam(d.id)}>
          <Icon name="trash" size={18} />
        </button>
      )}
    </li>
  );
}

export function flagText(o: Occurrence, short = false): string | null {
  if (o.flag === 'biweekly') return short ? '2-wöchentl.' : '2-wöchentlich · Woche offen';
  if (o.flag === 'choice') return short ? 'Gruppe?' : 'Gruppe wählen';
  return null;
}

export function SessionRow({ occ, now, showDay }: { occ: Occurrence; now: Date; showDay?: boolean }) {
  const { course, session } = occ;
  const live = +now >= +occ.start && +now < +occ.end;
  const past = +now >= +occ.end;
  const flag = flagText(occ);
  return (
    <li className={cx('session', past && 'is-past', live && 'is-live')}>
      <Link to={`/courses/${course.id}`} className="row row--link">
        <span className="stripe" style={cvar(course.color)} aria-hidden="true" />
        <div className="session__time">
          <span>{fmtTime(occ.start)}</span>
          <span className="session__end">{fmtTime(occ.end)}</span>
        </div>
        <div className="row__main">
          <div className="row__title">{course.shortName}</div>
          <div className="row__meta">
            <span>{showDay && `${fmtDateShort(occ.start)} · `}{KIND_LABEL[session.kind]} · {session.room}</span>
            {flag && <Chip tone="warn">{flag}</Chip>}
          </div>
        </div>
        {live && <Chip tone="accent">Läuft</Chip>}
      </Link>
    </li>
  );
}
