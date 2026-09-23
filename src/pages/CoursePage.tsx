import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { GroupChoice, LinkButtons, LinkRow, ParityControl, linkKindLabel } from '../components/course';
import { ExerciseSections } from '../components/exercises';
import { ItemRow, TodoComposer } from '../components/rows';
import { neighbourCourse } from '../components/Shortcuts';
import { toast } from '../components/toast';
import { Accordion, Chip, Empty, Icon, RoomLink, SectionHead, cvar, cx } from '../components/ui';
import { useUI } from '../components/ui-context';
import { courseById, notesOf, ownLinksOf, useItems } from '../lib/data';
import { useLingerDone, useSwipe, useTitle } from '../lib/hooks';
import { hostOf } from '../lib/links';
import { useNow } from '../lib/now';
import { roomUrl } from '../lib/rooms';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { actions, usePersonal } from '../lib/store';
import { DAY_LONG, DAY_SHORT, dueInfo, fmtRelDay, fmtTime } from '../lib/time';
import type { Session } from '../types';
import { MemoRow } from './Notes';
import { StudyStart } from '../components/StudyTimer';

export function CoursePage() {
  const { id = '' } = useParams();
  const course = courseById(id);
  const nav = useNavigate();
  const slide = (useLocation().state as { slide?: 'left' | 'right' } | null)?.slide;
  useTitle(course?.shortName ?? 'Kurs');
  const now = useNow();
  const ui = useUI();
  const { synced } = usePersonal();
  const items = useItems();
  const swipe = useSwipe((dir) => {
    if (course) nav(`/courses/${neighbourCourse(course.id, dir === 'left' ? 1 : -1)}`, { state: { slide: dir } });
  });

  useEffect(() => {
    if (course) actions.touchCourse(course.id);
  }, [course]);

  // Hooks before the early return below – otherwise going from an unknown course to a real one
  // would change the number of hooks between renders.
  // Own to-dos, Notion tasks and (if any) exams in ONE list – the course's official exercises have their own section.
  const tasks = items.filter((i) => i.courseId === course?.id && i.kind !== 'exercise');
  const { items: openTasks, lingering } = useLingerDone(tasks);

  if (!course) {
    return (
      <>
        <Link to="/courses" className="back"><Icon name="chevron-left" size={18} />Kurse</Link>
        <h1>Kurs nicht gefunden</h1>
      </>
    );
  }

  const mine = items.filter((i) => i.courseId === course.id);
  const doneTasks = tasks.filter((i) => i.done && !lingering.has(i.id));
  const next = nextOccurrence(now, [course], synced.prefs);
  const nextDue = mine.find((i) => !i.done && i.due && +i.due >= +now);
  const notes = notesOf(course.id);
  const ownLinks = ownLinksOf(synced, course.id);
  const addLink = () => ui.openLinkEditor({ mode: 'new', courseId: course.id });
  const memos = Object.values(synced.memos)
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const groups = [...new Set(course.sessions.map((s) => s.choiceGroup).filter(Boolean))] as string[];
  const altRooms = course.sessions.filter((s) => s.altRooms?.length);

  return (
    <div {...swipe} key={course.id} className={cx('course-page', slide && `slide-${slide}`)}>
      <header className="course-head" style={cvar(course.color)}>
        <p className="eyebrow">{course.code} · {course.semester}</p>
        <h1>{course.name}</h1>
        <p className="course-head__sub">{course.instructor}</p>
        <LinkButtons links={[...course.links, ...ownLinks]} onAdd={addLink} />
        <StudyStart courseId={course.id} />
      </header>

      <dl className="panel facts">
        <div>
          <dt>Nächster Termin</dt>
          <dd>
            {next ? (
              <>
                <strong>{fmtRelDay(next.start, now)}, {fmtTime(next.start)}</strong>
                <span>{KIND_LABEL[next.session.kind]} · <RoomLink room={next.session.room} url={roomUrl(next.session.room)} /></span>
              </>
            ) : <span>Keine Termine</span>}
          </dd>
        </div>
        <div>
          <dt>Nächste Frist</dt>
          <dd>
            {nextDue?.due ? (
              <>
                <strong>{nextDue.title}</strong>
                <span className={`tone-${dueInfo(nextDue.due, now, nextDue.allDay).tone}`}>{dueInfo(nextDue.due, now, nextDue.allDay).label} · {dueInfo(nextDue.due, now, nextDue.allDay).detail}</span>
              </>
            ) : <span>Nichts offen</span>}
          </dd>
        </div>
      </dl>

      <section aria-labelledby="h-todos">
        <SectionHead id="h-todos" title="Aufgaben" action={openTasks.length > 0 ? <span className="count">{openTasks.length} offen</span> : undefined} />
        <div className="panel">
          <TodoComposer fixedCourseId={course.id} />
          {openTasks.length > 0 && <ul className="list list--top">{openTasks.map((i) => <ItemRow key={i.id} item={i} now={now} hideCourse linger={lingering.has(i.id)} />)}</ul>}
        </div>
        {openTasks.length === 0 && <p className="hint hint--block">Nichts offen – notier hier, was für {course.shortName} noch zu tun ist.</p>}
        {doneTasks.length > 0 && (
          <Accordion title={`Erledigt (${doneTasks.length})`}>
            <ul className="panel list">{doneTasks.map((i) => <ItemRow key={i.id} item={i} now={now} hideCourse />)}</ul>
            {doneTasks.some((i) => i.kind === 'todo') && (
              <button type="button" className="text-btn" onClick={() => {
                const n = actions.clearDoneTodos(course.id);
                toast({ text: `${n} erledigte To-dos entfernt` }, 2500);
              }}>Erledigte To-dos entfernen</button>
            )}
          </Accordion>
        )}
      </section>

      <ExerciseSections courseId={course.id} />

      <section aria-labelledby="h-times">
        <SectionHead id="h-times" title="Zeiten & Räume" />
        <div className="panel">
          <SessionBlock title="Vorlesung" sessions={course.sessions.filter((s) => s.kind === 'lecture')} />
          <SessionBlock title="Übung" sessions={course.sessions.filter((s) => s.kind === 'exercise')} />
        </div>
        {course.sessions.some((s) => s.biweekly) && (
          <div className="inline-control">
            <p className="inline-control__title">Die Vorlesung ist 2-wöchentlich – in welchen Wochen?</p>
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
                <li key={s.id}>
                  <span className="plain__label">{DAY_SHORT[s.day]} {s.start}</span>
                  {s.altRooms!.map((r) => <RoomLink key={r} room={r} url={roomUrl(r)} />)}
                </li>
              ))}
            </ul>
          </Accordion>
        )}
      </section>

      <section aria-labelledby="h-res">
        <SectionHead id="h-res" title="Ressourcen"
          action={<button type="button" className="text-btn" onClick={addLink}>+ Link</button>} />
        {course.links.length + ownLinks.length + notes.length > 0 ? (
          <ul className="panel list">
            {course.links.map((l) => <LinkRow key={l.url} label={l.label} meta={`${linkKindLabel(l.kind)} · ${hostOf(l.url)}`} url={l.url} />)}
            {ownLinks.map((l) => (
              <LinkRow key={l.id} label={l.label} meta={`Eigener Link · ${hostOf(l.url)}`} url={l.url}
                onEdit={() => ui.openLinkEditor({ mode: 'edit', id: l.id })} />
            ))}
            {notes.map((n) => (
              <li key={n.id}>
                <Link className="row row--link" to={`/notes/${n.id}`}>
                  <Icon name="note" size={20} />
                  <span className="row__main"><span className="row__title">{n.title}</span><span className="row__meta"><span>Notiz aus Notion</span><Chip>{n.sessionType}</Chip></span></span>
                  <Icon name="chevron-right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Noch keine Links. Leg mit „+ Link“ ab, was du für {course.shortName} immer wieder öffnest – Moodle, Skript, Aufzeichnungen, Übungsblätter. Sie sind dann auf all deinen Geräten da.</Empty>
        )}
      </section>

      <section aria-labelledby="h-memos">
        <SectionHead id="h-memos" title="Meine Notizen"
          action={<button type="button" className="text-btn" onClick={() => ui.openMemoEditor({ mode: 'new', courseId: course.id })}>+ Notiz</button>} />
        {memos.length > 0 ? (
          <ul className="panel list">{memos.map((m) => <MemoRow key={m.id} memo={m} hideCourse />)}</ul>
        ) : (
          <Empty>Noch keine eigenen Notizen für {course.shortName}.</Empty>
        )}
      </section>

      <Accordion title="Details">
        <dl className="kv">
          <dt>Kurscode</dt><dd>{course.code}</dd>
          <dt>Semester</dt><dd>{course.semester}</dd>
          <dt>Dozent</dt><dd>{course.instructor}</dd>
          <dt>Credits</dt><dd className="muted">In Notion nicht hinterlegt</dd>
        </dl>
      </Accordion>
    </div>
  );
}

function SessionBlock({ title, sessions }: { title: string; sessions: Session[] }) {
  if (sessions.length === 0) return null;
  return (
    <div className="sessblock">
      <h3 className="sessblock__title">{title}</h3>
      <ul>
        {sessions.map((s) => (
          <li key={s.id} className="sessline">
            <span className="sessline__day">{DAY_LONG[s.day]}</span>
            <span className="sessline__time">{s.start}–{s.end}</span>
            <RoomLink room={s.room} url={roomUrl(s.room)} />
            {s.biweekly && <Chip tone="warn">2-wöchentlich</Chip>}
            {s.choiceGroup && <Chip>Gruppe</Chip>}
          </li>
        ))}
      </ul>
    </div>
  );
}
