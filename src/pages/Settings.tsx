import { useState } from 'react';
import { GroupChoice, ParityControl } from '../components/course';
import { Segmented } from '../components/ui';
import { seed } from '../data/seed';
import { COURSES } from '../lib/data';
import { actions, usePersonal } from '../lib/store';

export function SettingsPage() {
  const p = usePersonal();
  const [confirm, setConfirm] = useState(false);
  const groups = COURSES.flatMap((c) =>
    [...new Set(c.sessions.map((s) => s.choiceGroup).filter(Boolean))].map((g) => ({ course: c, group: g as string })),
  );
  const hasBiweekly = COURSES.some((c) => c.sessions.some((s) => s.biweekly));

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Persönlich</p>
          <h1>Einstellungen</h1>
        </div>
      </header>

      <section>
        <h2 className="h-section">Darstellung</h2>
        <div className="panel panel--pad">
          <Segmented label="Farbschema" value={p.theme} onChange={actions.setTheme}
            options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]} />
        </div>
      </section>

      {(hasBiweekly || groups.length > 0) && (
        <section>
          <h2 className="h-section spaced">Stundenplan präzisieren</h2>
          <p className="hint hint--block">Notion enthält diese Angaben nicht. Sobald du sie setzt, zeigt der Wochenplan nur noch deine Termine.</p>
          {hasBiweekly && (
            <div className="panel panel--pad">
              <p className="inline-control__title">Analysis I · Montags-Vorlesung ist 2-wöchentlich</p>
              <ParityControl />
            </div>
          )}
          {groups.map(({ course, group }) => (
            <div key={group} className="panel panel--pad">
              <p className="inline-control__title">{course.name} · welche Übungsgruppe besuchst du?</p>
              <GroupChoice course={course} group={group} />
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="h-section spaced">Daten</h2>
        <div className="panel panel--pad">
          <dl className="kv">
            <dt>Quelle</dt><dd>Notion „UNI“, nur lesend</dd>
            <dt>Stand des Snapshots</dt><dd>{seed.meta.snapshotAt}</dd>
            <dt>Eigene Einträge</dt><dd>{p.localTasks.length} Aufgaben · {p.exams.length} Prüfungen (nur auf diesem Gerät)</dd>
          </dl>
          <p className="hint">Diese App schreibt nie in Notion. Abgehakte Aufgaben und eigene Einträge bleiben lokal.</p>
          {confirm ? (
            <div className="form__actions">
              <button type="button" className="btn" onClick={() => setConfirm(false)}>Abbrechen</button>
              <button type="button" className="btn btn--danger" onClick={() => { actions.resetAll(); setConfirm(false); }}>Wirklich zurücksetzen</button>
            </div>
          ) : (
            <button type="button" className="btn" onClick={() => setConfirm(true)}>Eigene Daten zurücksetzen</button>
          )}
        </div>
      </section>
    </>
  );
}
