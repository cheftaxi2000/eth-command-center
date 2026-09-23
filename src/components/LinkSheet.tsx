import { useEffect, useState, type FormEvent } from 'react';
import { seed } from '../data/seed';
import { TARGETS, courseById, targetOf } from '../lib/data';
import { exerciseEntry } from '../lib/exercises';
import { normalizeUrl, splitPasted, suggestLabel } from '../lib/links';
import { GENERAL_ID } from '../lib/state';
import { actions, getPersonal } from '../lib/store';
import { toast } from './toast';
import { CourseDot, Icon, Sheet, cx } from './ui';
import { useUI } from './ui-context';

/** Name of a link in that course with the same address – from Notion or an own one (other than `except`). */
function sameAddress(courseId: string, url: string, except?: string): string | null {
  const official = courseId === GENERAL_ID ? seed.adminLinks : courseById(courseId)?.links ?? [];
  const hit = official.find((l) => normalizeUrl(l.url) === url)
    ?? Object.values(getPersonal().synced.links).find((l) => l.id !== except && l.courseId === courseId && l.url === url);
  return hit?.label ?? null;
}

/** Add / edit an own link ("Ressourcen"). Synced like to-dos and notes; Notion's links stay read-only. */
export function LinkSheet() {
  const { linkEditor, closeLinkEditor } = useUI();
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [courseId, setCourseId] = useState(GENERAL_ID);
  const [error, setError] = useState('');

  const editing = linkEditor?.mode === 'edit' ? linkEditor : null;
  // Attaching a link to an official exercise: only the address, the exercise already has a name
  const forExercise = linkEditor?.mode === 'exercise' ? exerciseEntry(linkEditor.id) : null;

  useEffect(() => {
    if (!linkEditor) return;
    setError('');
    if (linkEditor.mode === 'exercise') {
      const entry = exerciseEntry(linkEditor.id);
      if (!entry) return closeLinkEditor();
      setUrl(getPersonal().synced.exercises[linkEditor.id]?.url ?? '');
      setLabel('');
      setCourseId(entry.courseId);
    } else if (linkEditor.mode === 'new') {
      setUrl('');
      setLabel('');
      setCourseId(linkEditor.courseId ?? GENERAL_ID);
    } else {
      const l = getPersonal().synced.links[linkEditor.id];
      if (!l) return closeLinkEditor();
      setUrl(l.url);
      setLabel(l.label);
      setCourseId(l.courseId);
    }
  }, [linkEditor, closeLinkEditor]);

  if (!linkEditor) return null;

  const address = normalizeUrl(url);
  const suggestion = address ? suggestLabel(address) : '';

  const onUrl = (value: string) => {
    setError('');
    // "Skript https://…" pasted in one go: the address goes here, the words around it become the name.
    // Only for a paste (many characters at once) – while typing it would swallow the spaces.
    const pasted = value.length - url.length > 1;
    const split = pasted && /\s/.test(value.trim()) ? splitPasted(value) : null;
    setUrl(split ? split.url : value);
    if (split?.rest && !label.trim()) setLabel(split.rest);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!address) {
      setError(url.trim() ? 'Das ist keine Web-Adresse – zum Beispiel moodle-app2.let.ethz.ch/course/view.php?id=…' : 'Adresse eingeben oder einfügen.');
      return;
    }
    if (forExercise) {
      actions.setExerciseUrl(forExercise.exercise.id, address);
      toast({ text: `Link gespeichert · ${forExercise.exercise.title}` }, 2500);
      closeLinkEditor();
      return;
    }
    const twin = sameAddress(courseId, address, editing?.id);
    if (twin) {
      setError(`Diese Adresse gibt es bei ${targetOf(courseId).shortName} schon: „${twin}“.`);
      return;
    }
    if (editing) {
      actions.updateLink(editing.id, { url: address, label, courseId });
    } else {
      actions.addLink({ courseId, url: address, label });
      toast({ text: `Link gespeichert · ${targetOf(courseId).shortName}` }, 2500);
    }
    closeLinkEditor();
  };

  const remove = () => {
    if (forExercise) {
      actions.setExerciseUrl(forExercise.exercise.id, null);
      toast({ text: 'Link entfernt' }, 2500);
      closeLinkEditor();
      return;
    }
    if (!editing) return;
    const removed = actions.deleteLink(editing.id);
    if (removed) toast({ text: 'Link gelöscht', action: { label: 'Rückgängig', run: () => actions.restoreLink(removed) } });
    closeLinkEditor();
  };

  return (
    <Sheet open onClose={closeLinkEditor} title={forExercise ? `Link zu „${forExercise.exercise.title}"` : editing ? 'Link bearbeiten' : 'Neuer Link'}>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">
          <span>Adresse</span>
          <input autoFocus={!editing} value={url} onChange={(e) => onUrl(e.target.value)} placeholder="https://… – einfach einfügen"
            inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false} enterKeyHint="next"
            aria-invalid={error ? true : undefined} aria-describedby={error ? 'link-error' : undefined} />
          {error && <span id="link-error" className="field__error" role="alert">{error}</span>}
        </label>

        {forExercise && (
          <p className="hint">
            {targetOf(forExercise.courseId).shortName} · {forExercise.type.label}
            {forExercise.type.where ? ` · ${forExercise.type.where}` : ''}
          </p>
        )}

        <label className={cx('field', forExercise && 'is-hidden')} hidden={!!forExercise}>
          <span>Name <em className="field__opt">optional</em></span>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={suggestion || 'z. B. Skript oder Übungsblätter'} enterKeyHint="done" />
        </label>

        <div className="field" hidden={!!forExercise}>
          <span>Fach</span>
          <div className="pickchips" role="radiogroup" aria-label="Fach">
            {TARGETS.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={courseId === t.id}
                className={cx('pick', courseId === t.id && 'is-on')} onClick={() => { setCourseId(t.id); setError(''); }}>
                <CourseDot color={t.color} />{t.shortName}
              </button>
            ))}
          </div>
        </div>

        <div className="form__actions">
          {(editing || (forExercise && getPersonal().synced.exercises[forExercise.exercise.id]?.url)) && (
            <button type="button" className="btn btn--quiet-danger" onClick={remove}><Icon name="trash" size={18} />Löschen</button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={closeLinkEditor}>Abbrechen</button>
          <button type="submit" className="btn btn--primary">{editing ? 'Speichern' : 'Hinzufügen'}</button>
        </div>
      </form>
    </Sheet>
  );
}
