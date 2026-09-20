import { useEffect, useState, type FormEvent } from 'react';
import { COURSES, TARGETS } from '../lib/data';
import { GENERAL_ID } from '../lib/state';
import { actions, getPersonal } from '../lib/store';
import { toast } from './toast';
import { CourseDot, Icon, Sheet, cx } from './ui';
import { useUI } from './ui-context';

/** Add / edit a personal note. Stored only in this app (and synced via the Sync-Code). */
export function MemoSheet() {
  const { memoEditor, closeMemoEditor } = useUI();
  const [courseId, setCourseId] = useState(GENERAL_ID);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const editing = memoEditor?.mode === 'edit' ? memoEditor : null;

  useEffect(() => {
    if (!memoEditor) return;
    if (memoEditor.mode === 'new') {
      setCourseId(memoEditor.courseId ?? getPersonal().local.lastCourse ?? GENERAL_ID);
      setTitle('');
      setBody('');
    } else {
      const m = getPersonal().synced.memos[memoEditor.id];
      if (!m) return closeMemoEditor();
      setCourseId(m.courseId);
      setTitle(m.title);
      setBody(m.body);
    }
  }, [memoEditor, closeMemoEditor]);

  if (!memoEditor) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    const b = body.trim();
    if (!t && !b) return;
    const name = COURSES.find((c) => c.id === courseId)?.shortName ?? 'Allgemein';
    if (editing) {
      actions.updateMemo(editing.id, { title: t, body: b, courseId });
    } else {
      actions.addMemo({ courseId, title: t || 'Notiz', body: b });
      toast({ text: `Notiz gespeichert · ${name}` }, 2500);
    }
    closeMemoEditor();
  };

  const remove = () => {
    if (!editing) return;
    const removed = actions.deleteMemo(editing.id);
    if (removed) toast({ text: 'Notiz gelöscht', action: { label: 'Rückgängig', run: () => actions.restoreMemo(removed) } });
    closeMemoEditor();
  };

  return (
    <Sheet open onClose={closeMemoEditor} title={editing ? 'Notiz bearbeiten' : 'Neue Notiz'}>
      <form className="form" onSubmit={submit}>
        <label className="field">
          <span>Titel</span>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. WLAN-Passwort" enterKeyHint="next" />
        </label>

        <div className="field">
          <span>Fach</span>
          <div className="pickchips" role="radiogroup" aria-label="Fach">
            {TARGETS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={courseId === t.id}
                className={cx('pick', courseId === t.id && 'is-on')} onClick={() => setCourseId(t.id)}>
                <CourseDot color={t.color} />{t.shortName}
              </button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Text</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={7} placeholder="Frei reinschreiben …" />
        </label>

        <div className="form__actions">
          {editing && (
            <button type="button" className="btn btn--quiet-danger" onClick={remove}><Icon name="trash" size={18} />Löschen</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeMemoEditor}>Abbrechen</button>
          <button type="submit" className="btn btn--primary">{editing ? 'Speichern' : 'Hinzufügen'}</button>
        </div>
      </form>
    </Sheet>
  );
}
