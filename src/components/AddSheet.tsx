import { useEffect, useState, type FormEvent } from 'react';
import { COURSES } from '../lib/data';
import { getNow } from '../lib/now';
import { actions } from '../lib/store';
import { toLocalISO } from '../lib/time';
import { Segmented, Sheet } from './ui';
import { useUI } from './ui-context';

/** Add a personal task or an exam date. Stored only inside this app – never written to Notion. */
export function AddSheet() {
  const { add, closeAdd } = useUI();
  const [kind, setKind] = useState<'task' | 'exam'>('task');
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [location, setLocation] = useState('');

  useEffect(() => {
    if (!add) return;
    setKind(add.kind);
    setCourseId(add.courseId ?? COURSES[0].id);
    setTitle(add.kind === 'exam' ? 'Prüfung' : '');
    setDate(toLocalISO(getNow()).slice(0, 10));
    setTime(add.kind === 'exam' ? '09:00' : '12:00');
    setLocation('');
  }, [add]);

  const onKind = (k: 'task' | 'exam') => {
    setKind(k);
    setTitle((t) => (k === 'exam' && !t ? 'Prüfung' : k === 'task' && t === 'Prüfung' ? '' : t));
    setTime(k === 'exam' ? '09:00' : '12:00');
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    const when = `${date}T${time || '12:00'}`;
    if (kind === 'task') actions.addTask({ courseId, title: title.trim(), due: when });
    else actions.addExam({ courseId, title: title.trim(), when, location: location.trim() || undefined });
    closeAdd();
  };

  return (
    <Sheet open={!!add} onClose={closeAdd} title={kind === 'task' ? 'Aufgabe hinzufügen' : 'Prüfung eintragen'}>
      <form className="form" onSubmit={submit}>
        <Segmented label="Art" value={kind} onChange={onKind}
          options={[{ value: 'task', label: 'Aufgabe / Deadline' }, { value: 'exam', label: 'Prüfung' }]} />

        <label className="field">
          <span>Kurs</span>
          <select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
            {COURSES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <label className="field">
          <span>Titel</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === 'task' ? 'z. B. Serie 2' : 'z. B. Zwischenprüfung'} required />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Datum</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label className="field">
            <span>Uhrzeit</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        {kind === 'exam' && (
          <label className="field">
            <span>Ort (optional)</span>
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z. B. HG F 1" />
          </label>
        )}

        <p className="hint">Wird nur in dieser App auf diesem Gerät gespeichert. Dein Notion bleibt unverändert.</p>
        <div className="form__actions">
          <button type="button" className="btn" onClick={closeAdd}>Abbrechen</button>
          <button type="submit" className="btn btn--primary">Speichern</button>
        </div>
      </form>
    </Sheet>
  );
}
