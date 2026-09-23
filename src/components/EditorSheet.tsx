import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CATEGORY_LABEL, COURSES, TARGETS, courseById } from '../lib/data';
import { getNow } from '../lib/now';
import { enableReminders, getPermission, isIOS, isStandalone } from '../lib/notify';
import { KIND_LABEL, nextOccurrence } from '../lib/schedule';
import { CATEGORIES, GENERAL_ID, inferCategory, type TodoCategory } from '../lib/state';
import { actions, getPersonal, usePersonal } from '../lib/store';
import { DAY_SHORT, addDays, daysBetween, fmtTime, toLocalDate, toLocalISO } from '../lib/time';
import type { SessionKind } from '../types';
import { toast } from './toast';
import { CourseDot, Icon, Sheet, cx, type IconName } from './ui';
import { useUI } from './ui-context';

type DueMode = 'none' | 'today' | 'tomorrow' | 'exercise' | 'lecture' | 'custom';

const CATEGORY_ICON: Record<TodoCategory, IconName> = { bonus: 'trophy', uebung: 'courses', rest: 'tasks' };

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

/**
 * Add / edit an own to-do: what, which kind (Bonus / Übung / Sonstiges), which course, until when,
 * and whether it is important – important ones get a reminder the day before and an hour before.
 * An existing exam can still be edited here; new ones are no longer offered.
 */
export function EditorSheet() {
  const { editor, closeEditor } = useUI();
  const { synced } = usePersonal();
  const [kind, setKind] = useState<'todo' | 'exam'>('todo');
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [text, setText] = useState('');
  const [category, setCategory] = useState<TodoCategory>('rest');
  // Once the kind was picked by hand, typing no longer re-guesses it
  const [categoryPicked, setCategoryPicked] = useState(false);
  const [important, setImportant] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dueMode, setDueMode] = useState<DueMode>('none');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  const editing = editor?.mode === 'edit' ? editor : null;

  useEffect(() => {
    if (!editor) return;
    const today = toLocalDate(getNow());
    setNotice(null);
    if (editor.mode === 'new') {
      setKind('todo');
      setCourseId(editor.courseId ?? getPersonal().local.lastCourse ?? COURSES[0].id);
      setText(editor.text ?? '');
      setCategory(editor.category ?? inferCategory(editor.text ?? ''));
      setCategoryPicked(!!editor.category);
      setImportant(false);
      setDueMode('none');
      setDate(today);
      setTime('');
      setLocation('');
    } else if (editor.kind === 'todo') {
      const t = getPersonal().synced.todos[editor.id];
      if (!t) return closeEditor();
      setKind('todo');
      setCourseId(t.courseId);
      setText(t.text);
      setCategory(t.category ?? inferCategory(t.text));
      setCategoryPicked(true);
      setImportant(!!t.important);
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

  const onText = (v: string) => {
    setText(v);
    if (!categoryPicked && !editing) setCategory(inferCategory(v));
  };

  // A tap on the switch is the one moment a browser lets us ask for notification permission.
  const toggleImportant = async () => {
    const next = !important;
    setImportant(next);
    setNotice(null);
    if (next && getPermission() !== 'granted') {
      const r = await enableReminders();
      if (!r.ok) setNotice(r.message);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    const name = courseById(courseId)?.shortName ?? 'Allgemein';
    if (kind === 'todo') {
      const due = dueString();
      if (editing) actions.updateTodo(editing.id, { text: value, courseId, due, category, important });
      else {
        actions.addTodo({ courseId, text: value, due, category, important });
        toast({ text: `${important ? '⚑ ' : ''}${CATEGORY_LABEL[category]} hinzugefügt · ${name}${important && due ? ' · mit Erinnerung' : ''}` }, 2800);
      }
    } else {
      if (!date) return;
      actions.saveExam({ id: editing?.id, courseId, title: value, when: `${date}T${time || '09:00'}`, location: location.trim() });
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
  const noDate = !dueString();
  const title = editing ? (kind === 'todo' ? 'To-do bearbeiten' : 'Prüfung bearbeiten') : 'Neues To-do';

  return (
    <Sheet open onClose={closeEditor} title={title}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>{kind === 'todo' ? 'Was ist zu tun?' : 'Titel'}</span>
          <input autoFocus value={text} onChange={(e) => onText(e.target.value)} enterKeyHint="done"
            placeholder={kind === 'todo' ? 'z. B. Bonusaufgabe 2 abgeben' : 'z. B. Basisprüfung'} required />
        </label>

        {kind === 'todo' && (
          <div className="field">
            <span>Art</span>
            <div className="kinds" role="radiogroup" aria-label="Art">
              {CATEGORIES.map((c) => (
                <button key={c} type="button" role="radio" aria-checked={category === c}
                  className={cx('kind', `kind--${c}`, category === c && 'is-on')}
                  onClick={() => { setCategory(c); setCategoryPicked(true); }}>
                  <Icon name={CATEGORY_ICON[c]} size={18} />{CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
          </div>
        )}

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
          <>
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

            <div className={cx('toggle-row', important && 'is-on')}>
              <button type="button" role="switch" aria-checked={important} className="toggle-row__hit" onClick={() => void toggleImportant()}>
                <span className="toggle-row__icon"><Icon name="bell" size={20} /></span>
                <span className="toggle-row__text">
                  <strong>Wichtig</strong>
                  <span>Erinnerung am Vortag und 1 Stunde vorher</span>
                </span>
                <span className="switch" aria-hidden="true"><span className="switch__knob" /></span>
              </button>
            </div>
            {important && (noDate || notice || (isIOS() && !isStandalone())) && (
              <p className="toggle-row__note">
                {noDate ? 'Ohne Datum gibt es keine Erinnerung – wähle oben, bis wann.'
                  : notice ?? 'Auf dem iPad kommen Mitteilungen nur über die Home-Bildschirm-App (Teilen → „Zum Home-Bildschirm“).'}
              </p>
            )}
          </>
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
