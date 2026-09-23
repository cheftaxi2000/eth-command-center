import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { COURSES, TARGETS, targetOf, type Item } from '../lib/data';
import { useNow } from '../lib/now';
import { roomUrl } from '../lib/rooms';
import { KIND_LABEL, suggestCourse, type Occurrence } from '../lib/schedule';
import { GENERAL_ID } from '../lib/state';
import { actions, usePersonal } from '../lib/store';
import { dueInfo, fmtDateShort, fmtDuration, fmtTime, minutesUntil } from '../lib/time';
import { toast } from './toast';
import { Chip, CheckButton, CourseDot, Icon, RoomLink, cvar, cx } from './ui';
import { useUI } from './ui-context';

export function flagText(o: Occurrence, short = false): string | null {
  if (o.flag === 'biweekly') return short ? '2-wöchentl.' : '2-wöchentlich · Woche offen';
  if (o.flag === 'choice') return short ? 'Gruppe?' : 'Gruppe wählen';
  return null;
}

/** A lecture/exercise. The focused one (running now / next today) shows a live countdown. */
export function SessionRow({ occ, now, focus, showDay }: { occ: Occurrence; now: Date; focus?: boolean; showDay?: boolean }) {
  const { course, session } = occ;
  const live = +now >= +occ.start && +now < +occ.end;
  const past = +now >= +occ.end;
  const flag = flagText(occ);
  const countdown = focus
    ? live
      ? `läuft · noch ${fmtDuration(minutesUntil(occ.end, now))}`
      : `in ${fmtDuration(minutesUntil(occ.start, now))}`
    : null;
  return (
    <li className={cx('session', past && 'is-past', focus && 'is-focus', live && 'is-live')}>
      <Link to={`/courses/${course.id}`} className="session__main">
        <span className="stripe" style={cvar(course.color)} aria-hidden="true" />
        <span className="session__time">
          <span>{fmtTime(occ.start)}</span>
          <span className="session__end">{fmtTime(occ.end)}</span>
        </span>
        <span className="row__main">
          <span className="row__title">{course.shortName}</span>
          <span className="row__meta">
            <span>{showDay && `${fmtDateShort(occ.start)} · `}{KIND_LABEL[session.kind]}</span>
            {countdown && <strong className="countdown">{countdown}</strong>}
            {flag && <Chip tone="warn">{flag}</Chip>}
          </span>
        </span>
      </Link>
      <RoomLink room={session.room} url={roomUrl(session.room)} />
    </li>
  );
}

function toggleItem(item: Item, done: boolean) {
  const set = (v: boolean) =>
    item.kind === 'notion' ? actions.setTaskDone(item.id, v)
      : item.kind === 'exercise' ? actions.setExerciseDone(item.id, v)
      : actions.setTodoDone(item.id, v);
  set(done);
  if (done) toast({ text: `Erledigt: ${item.title}`, action: { label: 'Rückgängig', run: () => set(false) } }, 3500);
}

/** Delete a personal to-do or exam right from the row – no need to open the sheet first. */
function deleteItem(item: Item) {
  if (item.kind === 'exam') {
    const removed = actions.deleteExam(item.id);
    if (removed) toast({ text: `Gelöscht: ${item.title}`, action: { label: 'Rückgängig', run: () => actions.restoreExam(removed) } }, 3500);
  } else if (item.kind === 'todo') {
    const removed = actions.deleteTodo(item.id);
    if (removed) toast({ text: `Gelöscht: ${item.title}`, action: { label: 'Rückgängig', run: () => actions.restoreTodo(removed) } }, 3500);
  }
}

/** "korrekt" for a written exercise, "bestanden" for something you sit through */
const correctWord = (role: string) => (role === 'quiz' || role === 'assessment' ? 'bestanden' : 'korrekt');

/** Notion task, own to-do, exam or official course exercise – one consistent row */
export function ItemRow({ item, now, hideCourse, linger, detailed }: { item: Item; now: Date; hideCourse?: boolean; linger?: boolean; detailed?: boolean }) {
  const ui = useUI();
  const target = targetOf(item.courseId);
  const info = item.due ? dueInfo(item.due, now, item.allDay) : null;
  const ex = item.exercise;
  // Official exercises come from the course, like Notion tasks: tick them off, but never edit them here.
  const editable = item.kind !== 'notion' && item.kind !== 'exercise';

  const body = (
    <>
      <span className="row__title">
        <span className="item__text">{item.title}</span>
        {item.kind === 'exam' && <Chip tone="accent">Prüfung</Chip>}
        {/* Bonus, Quiz und Zwischenprüfungen entscheiden über die Note – die stechen rot heraus */}
        {ex && <Chip tone={ex.key ? 'danger' : undefined}>{ex.typeShort}</Chip>}
        {ex?.compulsory && <Chip tone="warn">Pflicht</Chip>}
        {item.inProgress && <Chip>In Arbeit</Chip>}
      </span>
      {(!hideCourse || item.location || ex) && (
        <span className="row__meta">
          {!hideCourse && (
            <span className="meta-course"><CourseDot color={target.color} />{target.shortName}</span>
          )}
          {item.location && <span>{item.location}</span>}
          {ex?.weekStart && <span>Woche vom {fmtDateShort(ex.weekStart)}</span>}
          {ex && !item.due && !ex.weekStart && ex.dateNote && <span>{ex.dateNote}</span>}
          {detailed && ex?.detail && <span className="muted-tag">{ex.detail}</span>}
          {detailed && ex?.where && !ex.detail && <span className="muted-tag">{ex.where}</span>}
        </span>
      )}
    </>
  );

  return (
    <li className={cx('row', 'item', ex?.key && 'item--key', item.done && 'is-done', linger && 'is-linger')}>
      {item.kind === 'exam' ? (
        <span className="row__lead" aria-hidden="true"><Icon name="flag" size={20} /></span>
      ) : (
        <CheckButton checked={item.done} label={`${item.title} erledigt`} onChange={(v) => toggleItem(item, v)} />
      )}
      {editable ? (
        <button type="button" className="item__body" aria-label={`${item.title} bearbeiten`}
          onClick={() => ui.openEditor({ mode: 'edit', kind: item.kind === 'exam' ? 'exam' : 'todo', id: item.id })}>
          {body}
        </button>
      ) : ex ? (
        ex.url ? (
          <a className="item__body" href={ex.url} target="_blank" rel="noopener noreferrer" title={`${ex.typeLabel} öffnen`}>{body}</a>
        ) : (
          <div className="item__body" title={`${ex.typeLabel}${ex.where ? ` · ${ex.where}` : ''} – offizielle Kursangabe, hier nur abhakbar.`}>{body}</div>
        )
      ) : (
        <div className="item__body" title="Aus Notion – dort bearbeiten. Abhaken gilt nur in dieser App.">{body}</div>
      )}
      {detailed && ex && (
        <button type="button" className={cx('icon-btn', 'item__link', ex.ownUrl && 'is-set')}
          title={ex.ownUrl ? 'Eigenen Link ändern' : 'Eigenen Link hinzufügen'}
          aria-label={`${ex.ownUrl ? 'Link ändern' : 'Link hinzufügen'}: ${item.title}`}
          onClick={() => ui.openLinkEditor({ mode: 'exercise', id: item.id })}>
          <Icon name="link" size={18} />
        </button>
      )}
      {ex?.tracksCorrect && (item.done || ex.correct) && (
        <button type="button" className={cx('mini-toggle', ex.correct && 'is-on')}
          aria-pressed={ex.correct}
          onClick={() => actions.setExerciseCorrect(item.id, !ex.correct)}>
          <Icon name="check" size={14} />{correctWord(ex.role)}
        </button>
      )}
      {editable && (
        <button type="button" className="icon-btn item__delete" title="Löschen"
          aria-label={`${item.title} löschen`} onClick={() => deleteItem(item)}>
          <Icon name="trash" size={18} />
        </button>
      )}
      {info && (
        <div className={cx('row__due', !item.done && `tone-${info.tone}`)}>
          {item.done ? <span className="due-detail">{info.detail}</span> : (<><span className="due-label">{info.label}</span><span className="due-detail">{info.detail}</span></>)}
        </div>
      )}
    </li>
  );
}

/**
 * Fastest way to jot something down: type, Enter. On the home page the course chips show (and set)
 * which course it belongs to – preselected with the session that is running or just ended.
 */
export function TodoComposer({ fixedCourseId, autoFocus }: { fixedCourseId?: string; autoFocus?: boolean }) {
  const now = useNow();
  const { synced, local } = usePersonal();
  const ui = useUI();
  const [picked, setPicked] = useState<string | null>(null);
  const [text, setText] = useState('');
  const suggested = useMemo(
    () => suggestCourse(now, COURSES, synced.prefs, local.lastCourse ?? COURSES[0].id),
    // only re-guess every few minutes, not on every tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(+now / 300_000), synced.prefs, local.lastCourse],
  );
  const courseId = fixedCourseId ?? picked ?? suggested;
  const target = targetOf(courseId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    actions.addTodo({ courseId, text: value });
    setText('');
  };

  return (
    <form className="composer" onSubmit={submit}>
      <div className="composer__row">
        <span className="composer__plus" aria-hidden="true"><Icon name="plus" size={20} /></span>
        <input
          className="composer__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={fixedCourseId ? `Neues To-do für ${target.shortName} …` : `Neues To-do · ${target.shortName} …`}
          aria-label="Neues To-do"
          enterKeyHint="done"
          autoFocus={autoFocus}
        />
        {text.trim() && <button type="submit" className="btn btn--primary btn--sm">Hinzufügen</button>}
        <button type="button" className="icon-btn" aria-label="Mit Datum hinzufügen"
          onClick={() => { ui.openEditor({ mode: 'new', kind: 'todo', courseId, text: text.trim() || undefined }); setText(''); }}>
          <Icon name="calendar" size={20} />
        </button>
      </div>
      {!fixedCourseId && (
        <div className="composer__courses" data-noswipe role="radiogroup" aria-label="Fach für das neue To-do">
          {TARGETS.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={courseId === t.id}
              className={cx('pick', 'pick--sm', courseId === t.id && 'is-on')} onClick={() => setPicked(t.id)}>
              <CourseDot color={t.color} />{t.shortName}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}

/** Open to-dos grouped by course (home page) – at most `limit` per course, rest behind a link */
export function TodoGroups({ items, now, limit = 4, lingering }: { items: Item[]; now: Date; limit?: number; lingering?: Set<string> }) {
  const groups = TARGETS.map((t) => ({ t, list: items.filter((i) => i.courseId === t.id) })).filter((g) => g.list.length > 0);
  return (
    <div className="todo-groups">
      {groups.map(({ t, list }) => (
        <section key={t.id} className="todo-group" aria-label={t.name}>
          <h3 className="todo-group__head">
            {t.id === GENERAL_ID ? (
              <span className="todo-group__name"><CourseDot color={t.color} />{t.name}</span>
            ) : (
              <Link to={`/courses/${t.id}`} className="todo-group__name"><CourseDot color={t.color} />{t.shortName}<Icon name="chevron-right" size={16} /></Link>
            )}
            <span className="count">{list.length}</span>
          </h3>
          <ul className="list">
            {list.slice(0, limit).map((i) => <ItemRow key={i.id} item={i} now={now} hideCourse linger={lingering?.has(i.id)} />)}
          </ul>
          {list.length > limit && (
            <Link className="more more--row" to={t.id === GENERAL_ID ? '/tasks' : `/courses/${t.id}`}>
              Alle {list.length} anzeigen<Icon name="chevron-right" size={16} />
            </Link>
          )}
        </section>
      ))}
    </div>
  );
}
