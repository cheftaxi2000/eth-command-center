import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { COURSES, TARGETS, courseById } from '../lib/data';
import { getNow } from '../lib/now';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { GENERAL_ID } from '../lib/state';
import { actions, getPersonal, usePersonal } from '../lib/store';
import { DAY_SHORT, addDays, daysBetween, fmtTime, toLocalDate, toLocalISO } from '../lib/time';
import type { SessionKind } from '../types';
import { toast } from './toast';
import { CourseDot, Icon, Segmented, Sheet, cx } from './ui';
import { useUI } from './ui-context';

type DueMode = 'none' | 'today' | 'tomorrow' | 'exercise' | 'lecture' | 'custom';

function relDay(d: Date): string {
  const n = daysBetween(getNow(), d);
  return n === 0 ? 'heute' : n === 1 ? 'morgen' : DAY_SHORT[d.getDay()];
}

/** Start of the next session of that kind which has not started yet */
function nextStart(courseId: string, kind: SessionKind): Date | null {
  const course = courseById(courseId);
  if (!course) return null;
  const prefs = getPersonal().synced.prefs;
  const now = getNow();
  let occ = nextOccurrence(now, [course], prefs, kind);
  if (occ && +occ.start <= +now) occ = nextOccurrence(occ.end, [course], prefs, kind);
  return occ?.start ?? null;
}

/** Add / edit an own to-do or exam. Stored only in this app (and the optional GitHub sync). */
export function EditorSheet() {
  const { editor, closeEditor } = useUI();
  const { synced } = usePersonal();
  const [kind, setKind] = useState<'todo' | 'exam'>('todo');
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [text, setText] = useState('');
  const [dueMode, setDueMode] = useState<DueMode>('none');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  const editing = editor?.mode === 'edit' ? editor : null;

  useEffect(() => {
    if (!editor) return;
    const today = toLocalDate(getNow());
    if (editor.mode === 'new') {
      const fallback = getPersonal().local.lastCourse ?? COURSES[0].id;
      setKind(editor.kind);
      setCourseId(editor.courseId ?? (editor.kind === 'exam' && fallback === GENERAL_ID ? COURSES[0].id : fallback));
      setText(editor.text ?? (editor.kind === 'exam' ? 'Prüfung' : ''));
      setDueMode('none');
      setDate(today);
      setTime(editor.kind === 'exam' ? '09:00' : '');
      setLocation('');
    } else if (editor.kind === 'todo') {
      const t = getPersonal().synced.todos[editor.id];
      if (!t) return closeEditor();
      setKind('todo');
      setCourseId(t.courseId);
      setText(t.text);
      setDueMode(t.due ? 'custom' : 'none');
      setDate(t.due ? t.due.slice(0, 10) : today);
      setTime(t.due && t.due.length > 10 ? t.due.slice(11, 16) : '');
    } else {
      const e = getPersonal().synced.exams[editor.id];
      if (!e) return closeEditor();
      setKind('exam');
      setCourseId(e.courseId);
      setText(e.title);
      setDate(e.when.slice(0, 10));
      setTime(e.when.slice(11, 16));
      setLocation(e.location ?? '');
    }
  }, [editor, closeEditor]);

  const exercise = useMemo(() => (kind === 'todo' ? nextStart(courseId, 'exercise') : null), [kind, courseId, synced.prefs]);
  const lecture = useMemo(() => (kind === 'todo' ? nextStart(courseId, 'lecture') : null), [kind, courseId, synced.prefs]);

  if (!editor) return null;

  const dueString = (): string | undefined => {
    const now = getNow();
    switch (dueMode) {
      case 'today': return toLocalDate(now);
      case 'tomorrow': return toLocalDate(addDays(now, 1));
      case 'exercise': return exercise ? toLocalISO(exercise) : undefined;
      case 'lecture': return lecture ? toLocalISO(lecture) : undefined;
      case 'custom': return date ? (time ? `${date}T${time}` : date) : undefined;
      default: return undefined;
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const name = courseById(courseId)?.shortName ?? 'Allgemein';
    if (kind === 'todo') {
      if (editing) actions.updateTodo(editing.id, { text: value, courseId, due: dueString() });
      else {
        actions.addTodo({ courseId, text: value, due: dueString() });
        toast({ text: `To-do hinzugefügt · ${name}` }, 2500);
      }
    } else {
      if (!date) return;
      actions.saveExam({ id: editing?.id, courseId, title: value, when: `${date}T${time || '09:00'}`, location: location.trim() });
      if (!editing) toast({ text: `Prüfung eingetragen · ${name}` }, 2500);
    }
    closeEditor();
  };

  const remove = () => {
    if (!editing) return;
    if (editing.kind === 'todo') {
      const removed = actions.deleteTodo(editing.id);
      if (removed) toast({ text: 'To-do gelöscht', action: { label: 'Rückgängig', run: () => actions.restoreTodo(removed) } });
    } else {
      const removed = actions.deleteExam(editing.id);
      if (removed) toast({ text: 'Prüfung gelöscht', action: { label: 'Rückgängig', run: () => actions.restoreExam(removed) } });
    }
    closeEditor();
  };

  const targets = kind === 'exam' ? TARGETS.filter((t) => t.id !== GENERAL_ID) : TARGETS;
  const dueChips: { mode: DueMode; label: string }[] = [
    { mode: 'none', label: 'Kein Datum' },
    { mode: 'today', label: 'Heute' },
    { mode: 'tomorrow', label: 'Morgen' },
    ...(exercise ? [{ mode: 'exercise' as const, label: `Nächste ${KIND_LABEL.exercise} · ${relDay(exercise)} ${fmtTime(exercise)}` }] : []),
    ...(lecture ? [{ mode: 'lecture' as const, label: `Nächste ${KIND_LABEL.lecture} · ${relDay(lecture)} ${fmtTime(lecture)}` }] : []),
    { mode: 'custom', label: 'Datum …' },
  ];

  const title = editing ? (kind === 'todo' ? 'To-do bearbeiten' : 'Prüfung bearbeiten') : kind === 'todo' ? 'Neues To-do' : 'Prüfung eintragen';

  return (
    <Sheet open onClose={closeEditor} title={title}>
      <form className="form" onSubmit={submit}>
        {!editing && (
          <Segmented label="Art" value={kind} onChange={(k) => {
            setKind(k);
            if (k === 'exam' && courseId === GENERAL_ID) setCourseId(COURSES[0].id);
            if (k === 'exam' && !text) setText('Prüfung');
            if (k === 'todo' && text === 'Prüfung') setText('');
            setTime(k === 'exam' ? '09:00' : '');
          }}
            options={[{ value: 'todo', label: 'To-do' }, { value: 'exam', label: 'Prüfung' }]} />
        )}

        <label className="field">
          <span>{kind === 'todo' ? 'Was ist zu tun?' : 'Titel'}</span>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} enterKeyHint="done"
            placeholder={kind === 'todo' ? 'z. B. Skript Kapitel 3 nachlesen' : 'z. B. Basisprüfung'} required />
        </label>

        <div className="field">
          <span>Fach</span>
          <div className="pickchips" role="radiogroup" aria-label="Fach">
            {targets.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={courseId === t.id}
                className={cx('pick', courseId === t.id && 'is-on')} onClick={() => setCourseId(t.id)}>
                <CourseDot color={t.color} />{t.shortName}
              </button>
            ))}
          </div>
        </div>

        {kind === 'todo' ? (
          <div className="field">
            <span>Bis wann?</span>
            <div className="pickchips" role="radiogroup" aria-label="Fälligkeit">
              {dueChips.map((c) => (
                <button key={c.mode} type="button" role="radio" aria-checked={dueMode === c.mode}
                  className={cx('pick', dueMode === c.mode && 'is-on')} onClick={() => setDueMode(c.mode)}>
                  {c.mode === 'custom' && <Icon name="calendar" size={16} />}{c.label}
                </button>
              ))}
            </div>
            {dueMode === 'custom' && (
              <div className="field-row">
                <input type="date" aria-label="Datum" value={date} onChange={(e) => setDate(e.target.value)} />
                <input type="time" aria-label="Uhrzeit (optional)" value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="field-row">
              <label className="field"><span>Datum</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
              <label className="field"><span>Uhrzeit</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            </div>
            <label className="field">
              <span>Ort (optional)</span>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z. B. HG F 1" />
            </label>
          </>
        )}

        <div className="form__actions">
          {editing && (
            <button type="button" className="btn btn--quiet-danger" onClick={remove}><Icon name="trash" size={18} />Löschen</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeEditor}>Abbrechen</button>
          <button type="submit" className="btn btn--primary">{editing ? 'Speichern' : 'Hinzufügen'}</button>
        </div>
      </form>
    </Sheet>
  );
}
