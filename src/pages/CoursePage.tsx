import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GroupChoice, ParityControl, linkKindLabel } from '../components/course';
import { DeadlineRow } from '../components/rows';
import { Accordion, Chip, Empty, Icon, SectionHead, cvar } from '../components/ui';
import { useUI } from '../components/ui-context';
import { courseById, notesOf, useDeadlines } from '../lib/data';
import { useNow } from '../lib/now';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { actions, usePersonal } from '../lib/store';
import { DAY_LONG, DAY_SHORT, dueInfo, fmtDateShort, fmtTime } from '../lib/time';
import type { Session } from '../types';

const hostOf = (url: string) => {
  try { return new URL(url).hostname; } catch { return url; }
};

export function CoursePage() {
  const { id = '' } = useParams();
  const course = courseById(id);
  const now = useNow();
  const p = usePersonal();
  const ui = useUI();
  const deadlines = useDeadlines();

  useEffect(() => {
    if (course) actions.touchCourse(course.id);
  }, [course]);

  if (!course) {
    return (
      <>
        <Link to="/courses" className="back"><Icon name="chevron-left" size={18} />Kurse</Link>
        <h1>Kurs nicht gefunden</h1>
      </>
    );
  }

  const mine = deadlines.filter((d) => d.courseId === course.id);
  const tasks = mine.filter((d) => d.kind === 'task');
  const exams = mine.filter((d) => d.kind === 'exam');
  const nextDeadline = mine.find((d) => !d.done);
  const next = nextOccurrence(now, [course], p.prefs);
  const notes = notesOf(course.id);
  const lectures = course.sessions.filter((s) => s.kind === 'lecture');
  const exercises = course.sessions.filter((s) => s.kind === 'exercise');
  const groups = [...new Set(course.sessions.map((s) => s.choiceGroup).filter(Boolean))] as string[];
  const hasBiweekly = course.sessions.some((s) => s.biweekly);
  const altRooms = course.sessions.filter((s) => s.altRooms?.length);

  return (
    <>
      <Link to="/courses" className="back"><Icon name="chevron-left" size={18} />Kurse</Link>

      <header className="course-head" style={cvar(course.color)}>
        <p className="eyebrow"><span className="dot" style={cvar(course.color)} />{course.code}</p>
        <h1>{course.name}</h1>
        <p className="course-head__sub">{course.instructor} · {course.semester}</p>
      </header>

      {/* Current */}
      <section aria-label="Aktuell">
        <SectionHead title="Aktuell" />
        <dl className="panel facts">
          <div>
            <dt>Nächster Termin</dt>
            <dd>
              {next ? (
                <>
                  <strong>{DAY_SHORT[next.start.getDay()]} {fmtTime(next.start)}</strong>
                  <span>{KIND_LABEL[next.session.kind]} · {next.session.room}</span>
                </>
              ) : <span>Keine Termine</span>}
            </dd>
          </div>
          <div>
            <dt>Nächste Deadline</dt>
            <dd>
              {nextDeadline ? (
                <>
                  <strong>{nextDeadline.title}</strong>
                  <span className={`tone-${dueInfo(nextDeadline.when, now).tone}`}>{dueInfo(nextDeadline.when, now).label} · {fmtDateShort(nextDeadline.when)}</span>
                </>
              ) : <span>Nichts offen</span>}
            </dd>
          </div>
          <div>
            <dt>Offene Aufgaben</dt>
            <dd><strong>{tasks.filter((d) => !d.done).length}</strong></dd>
          </div>
        </dl>
      </section>

      {/* Structure */}
      <section aria-label="Zeiten und Räume">
        <SectionHead title="Zeiten & Räume" />
        <div className="panel">
          <SessionBlock title="Vorlesung" sessions={lectures} />
          <SessionBlock title="Übung" sessions={exercises} />
        </div>

        {hasBiweekly && (
          <div className="inline-control">
            <p className="inline-control__title">Zweiwöchentliche Vorlesung: in welchen Wochen?</p>
            <ParityControl />
          </div>
        )}
        {groups.map((g) => (
          <div key={g} className="inline-control">
            <p className="inline-control__title">Mehrere Übungsgruppen – welche besuchst du?</p>
            <GroupChoice course={course} group={g} />
          </div>
        ))}

        {altRooms.length > 0 && (
          <Accordion title="Weitere Räume (Übertragung)">
            <ul className="plain">
              {altRooms.map((s) => (
                <li key={s.id}>{DAY_SHORT[s.day]} {s.start} · {s.altRooms!.join(', ')}</li>
              ))}
            </ul>
          </Accordion>
        )}
      </section>

      {/* Tasks */}
      <section aria-label="Aufgaben">
        <SectionHead title="Aufgaben" action={<button type="button" className="text-btn" onClick={() => ui.openAdd('task', course.id)}>+ Aufgabe</button>} />
        {tasks.length > 0 ? (
          <ul className="panel list">{tasks.map((d) => <DeadlineRow key={d.id} d={d} now={now} hideCourse />)}</ul>
        ) : (
          <Empty>Keine Aufgaben für diesen Kurs.</Empty>
        )}
      </section>

      {/* Assessment */}
      <section aria-label="Prüfung">
        <SectionHead title="Prüfung & Bewertung" action={<button type="button" className="text-btn" onClick={() => ui.openAdd('exam', course.id)}>+ Prüfung</button>} />
        {exams.length > 0 ? (
          <ul className="panel list">{exams.map((d) => <DeadlineRow key={d.id} d={d} now={now} hideCourse />)}</ul>
        ) : (
          <Empty>Noch keine Prüfung eingetragen. In Notion sind weder Prüfungstermine noch Gewichtungen hinterlegt – du kannst sie hier selbst ergänzen.</Empty>
        )}
      </section>

      {/* Resources */}
      <section aria-label="Ressourcen">
        <SectionHead title="Ressourcen" />
        {course.links.length + notes.length > 0 ? (
          <ul className="panel list">
            {course.links.map((l) => (
              <li key={l.url}>
                <a className="row row--link" href={l.url} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={20} />
                  <div className="row__main"><div className="row__title">{l.label}</div><div className="row__meta"><span>{linkKindLabel(l.kind)} · {hostOf(l.url)}</span></div></div>
                </a>
              </li>
            ))}
            {notes.map((n) => (
              <li key={n.id}>
                <Link className="row row--link" to={`/notes/${n.id}`}>
                  <Icon name="note" size={20} />
                  <div className="row__main"><div className="row__title">{n.title}</div><div className="row__meta"><span>Notiz</span><Chip>{n.sessionType}</Chip></div></div>
                  <Icon name="chevron-right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Für diesen Kurs sind in Notion noch keine Links oder Notizen hinterlegt.</Empty>
        )}
        <p className="hint hint--block">Folien, PDFs und Vorlesungsthemen sind in Notion nicht hinterlegt.</p>
      </section>

      <Accordion title="Details">
        <dl className="kv">
          <dt>Kurscode</dt><dd>{course.code}</dd>
          <dt>Semester</dt><dd>{course.semester}</dd>
          <dt>Dozent</dt><dd>{course.instructor}</dd>
          <dt>Credits</dt><dd className="muted">In Notion nicht hinterlegt</dd>
        </dl>
      </Accordion>
    </>
  );
}

function SessionBlock({ title, sessions }: { title: string; sessions: Session[] }) {
  if (sessions.length === 0) return null;
  return (
    <div className="sessblock">
      <h3 className="h-section">{title}</h3>
      <ul>
        {sessions.map((s) => (
          <li key={s.id} className="sessline">
            <span className="sessline__day">{DAY_LONG[s.day]}</span>
            <span className="sessline__time">{s.start}–{s.end}</span>
            <span className="sessline__room">{s.room}</span>
            {s.biweekly && <Chip tone="warn">2-wöchentlich</Chip>}
            {s.choiceGroup && <Chip>Gruppe</Chip>}
          </li>
        ))}
      </ul>
    </div>
  );
}
