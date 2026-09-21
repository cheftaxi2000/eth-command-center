import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { GroupChoice, ParityControl } from '../components/course';
import { toast } from '../components/toast';
import { Icon, Segmented } from '../components/ui';
import { useUI } from '../components/ui-context';
import { seed } from '../data/seed';
import { COURSES } from '../lib/data';
import { useTitle } from '../lib/hooks';
import { canonical } from '../lib/state';
import { actions, getPersonal, usePersonal } from '../lib/store';
import { getSyncConfig, joinSync, newSyncCode, syncNow, switchToSharedCode, useSyncStatus } from '../lib/sync';
import { toLocalDate } from '../lib/time';
import { createAIService } from '../lib/ai';
import { maskKey, setAIKey, useAIKey } from '../lib/ai/key';

export function SettingsPage() {
  useTitle('Einstellungen');
  const { hash } = useLocation();
  const { synced, local } = usePersonal();
  const ui = useUI();
  const [confirm, setConfirm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const groups = COURSES.flatMap((c) =>
    [...new Set(c.sessions.map((s) => s.choiceGroup).filter(Boolean))].map((g) => ({ course: c, group: g as string })),
  );
  const biweekly = COURSES.filter((c) => c.sessions.some((s) => s.biweekly));

  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [hash]);

  const exportBackup = () => {
    const blob = new Blob([canonical(getPersonal().synced, 1)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `studium-backup-${toLocalDate(new Date())}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const importBackup = async (file: File | undefined) => {
    if (!file) return;
    try {
      actions.importBackup(JSON.parse(await file.text()));
      toast({ text: 'Backup eingelesen und zusammengeführt' });
    } catch {
      toast({ text: 'Diese Datei ist kein gültiges Backup' });
    }
  };

  const ownCount = Object.keys(synced.todos).length + Object.keys(synced.exams).length + Object.keys(synced.memos).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Persönlich</p>
          <h1>Einstellungen</h1>
        </div>
      </header>

      <SyncSection />

      <AISection />

      <section>
        <h2 className="h-section spaced">Darstellung</h2>
        <div className="panel panel--pad">
          <Segmented label="Farbschema" value={local.theme} onChange={actions.setTheme}
            options={[{ value: 'system', label: 'Automatisch' }, { value: 'light', label: 'Hell' }, { value: 'dark', label: 'Dunkel' }]} />
        </div>
      </section>

      {(biweekly.length > 0 || groups.length > 0) && (
        <section>
          <h2 className="h-section spaced">Stundenplan präzisieren</h2>
          <p className="hint hint--block">Das steht nicht in Notion. Sobald du es festlegst, zeigen Heute und Woche nur noch deine Termine.</p>
          {biweekly.map((c) => (
            <div key={c.id} className="panel panel--pad">
              <p className="inline-control__title">{c.name}: 2-wöchentliche Vorlesung</p>
              <ParityControl />
            </div>
          ))}
          {groups.map(({ course, group }) => (
            <div key={group} className="panel panel--pad">
              <p className="inline-control__title">{course.name}: welche Übungsgruppe besuchst du?</p>
              <GroupChoice course={course} group={group} />
            </div>
          ))}
        </section>
      )}

      <section>
        <h2 className="h-section spaced">Backup</h2>
        <div className="panel panel--pad">
          <p className="hint hint--top">Deine To-dos, Notizen, Prüfungen und Häkchen als Datei – zusätzlich zum Sync oder falls du ihn nicht nutzt.</p>
          <div className="btn-row">
            <button type="button" className="btn" onClick={exportBackup}>Backup herunterladen</button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Backup einlesen</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { void importBackup(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="h-section spaced">Daten</h2>
        <div className="panel panel--pad">
          <dl className="kv">
            <dt>Quelle</dt><dd>Notion „UNI“ – nur gelesen, nie verändert</dd>
            <dt>Stand</dt><dd>{seed.meta.snapshotAt}</dd>
            <dt>Eigene Einträge</dt><dd>{Object.keys(synced.todos).length} To-dos · {Object.keys(synced.memos).length} Notizen · {Object.keys(synced.exams).length} Prüfungen</dd>
            <dt>App-Version</dt><dd>{__BUILD_TIME__}</dd>
          </dl>
          {ownCount > 0 && (confirm ? (
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setConfirm(false)}>Abbrechen</button>
              <button type="button" className="btn btn--danger" onClick={() => { actions.deleteAllOwn(); setConfirm(false); toast({ text: 'Alle eigenen Einträge gelöscht' }); }}>
                Wirklich alle löschen
              </button>
            </div>
          ) : (
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => setConfirm(true)}>Alle eigenen To-dos, Notizen & Prüfungen löschen</button>
            </div>
          ))}
        </div>
      </section>

      <section className="only-wide">
        <h2 className="h-section spaced">Tastatur</h2>
        <div className="panel panel--pad">
          <button type="button" className="btn" onClick={() => ui.setHelpOpen(true)}><Icon name="keyboard" size={18} />Tastenkürzel anzeigen</button>
        </div>
      </section>
    </>
  );
}

function SyncSection() {
  const status = useSyncStatus();
  const cfg = getSyncConfig();
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const join = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await joinSync(joinCode);
      setJoinCode('');
      toast({ text: 'Gekoppelt – deine Einträge von beiden Geräten sind jetzt zusammengeführt' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(cfg.bucket);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable – the code is still selectable text */
    }
  };

  const freshCode = async () => {
    setBusy(true);
    try {
      await newSyncCode();
      toast({ text: 'Eigener Sync-Code erzeugt – deine Einträge sind mitgenommen. Auf anderen Geräten denselben Code eintragen.' }, 6000);
    } catch (err) {
      toast({ text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const backToShared = async () => {
    setBusy(true);
    try {
      await switchToSharedCode();
      toast({ text: 'Wieder am eingebauten Code – alle Browser und Geräte teilen denselben Stand.' }, 5000);
    } finally {
      setBusy(false);
    }
  };

  const last = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : null;
  const stateText =
    status.phase === 'syncing' ? 'Synchronisiere …'
    : status.phase === 'error' ? 'Sync-Problem'
    : status.phase === 'offline' ? 'Offline – synct automatisch weiter'
    : 'Synchronisiert';
  const shared = cfg.source === 'shared';

  return (
    <section id="sync" className="scroll-target">
      <h2 className="h-section">Sync über alle Browser und Geräte</h2>
      <div className="panel panel--pad">
        <p className="sync-state">
          <Icon name={status.phase === 'error' ? 'alert' : status.phase === 'offline' ? 'cloud-off' : 'cloud'} size={20} />
          <span><strong>{stateText}</strong>{last && ` · zuletzt ${last}`}</span>
        </p>
        {status.error && <p className="form-error">{status.error}</p>}

        <p className="hint hint--top">
          {shared
            ? 'Läuft automatisch – der Code steckt fest in der App. Egal ob Edge, Chrome, Safari oder iPad: alles zeigt denselben Stand, ohne dass du irgendwo etwas einrichtest.'
            : 'Du nutzt einen eigenen, privaten Code. Andere Geräte sehen diese Daten nur, wenn du den Code dort einträgst.'}
        </p>
        <div className="sync-code" data-noswipe>
          <span className="sync-code__value">{cfg.bucket}</span>
          <button type="button" className="btn btn--sm" onClick={() => void copyCode()}>{copied ? 'Kopiert' : 'Kopieren'}</button>
        </div>
        <p className="hint">
          {shared
            ? 'Ehrlich gesagt: Dieser Code steht im öffentlichen JavaScript der Seite. Wer die Adresse der Seite kennt, könnte die Daten lesen oder ändern. Für Stundenplan und To-dos in Ordnung – für Passwörter nicht.'
            : 'Wer diesen Code kennt, kann diese Daten lesen und ändern – nicht öffentlich teilen.'}
        </p>
        <div className="btn-row">
          <button type="button" className="btn btn--primary" onClick={() => void syncNow()} disabled={status.phase === 'syncing'}>Jetzt synchronisieren</button>
          {shared ? (
            <button type="button" className="btn" onClick={() => void freshCode()} disabled={busy}>Eigenen Code erzeugen</button>
          ) : (
            <button type="button" className="btn" onClick={() => void backToShared()} disabled={busy}>Zurück zum eingebauten Code</button>
          )}
        </div>

        <form className="form" onSubmit={join} style={{ marginTop: 18 }}>
          <label className="field">
            <span>Code eines anderen Geräts eingeben</span>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="z. B. FRxf6S1NureFCzBQtiDtS8"
              autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </label>
          {error && <p className="form-error">{error}</p>}
          <div className="btn-row">
            <button type="submit" className="btn" disabled={busy || !joinCode.trim()}>{busy ? 'Koppele …' : 'Koppeln'}</button>
          </div>
        </form>
      </div>
    </section>
  );
}

/**
 * The Gemini key is typed in here, once per browser. It stays in this browser's localStorage only –
 * never synced (the sync store is public), never in a backup, never in the app's code.
 */
function AISection() {
  const key = useAIKey();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    setAIKey(v);
    setDraft('');
    setState(null);
    void test();
  };

  const test = async () => {
    setBusy(true);
    setState(null);
    try {
      const turn = await createAIService().send('Antworte nur mit dem Satz: Verbindung steht.');
      setState({ tone: 'ok', text: turn.reply ? `Gemini antwortet: „${turn.reply.slice(0, 80)}"` : 'Gemini ist erreichbar.' });
    } catch (err) {
      setState({ tone: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section id="ai" className="scroll-target">
      <h2 className="h-section spaced">Assistent (Gemini)</h2>
      <div className="panel panel--pad">
        {key ? (
          <>
            <p className="sync-state">
              <Icon name="spark" size={20} />
              <span><strong>Schlüssel gespeichert</strong> · {maskKey(key)}</span>
            </p>
            {state && <p className={state.tone === 'error' ? 'form-error' : 'hint'}>{state.text}</p>}
            <div className="btn-row">
              <button type="button" className="btn" onClick={() => void test()} disabled={busy}>{busy ? 'Teste …' : 'Verbindung testen'}</button>
              <button type="button" className="btn btn--quiet-danger" onClick={() => { setAIKey(null); setState(null); }}>Schlüssel entfernen</button>
            </div>
          </>
        ) : (
          <form className="form" onSubmit={save}>
            <p className="hint hint--top">
              Ohne Schlüssel versteht der Assistent nur einfache Sätze. Mit einem kostenlosen Gemini-Schlüssel
              (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">hier erzeugen</a>) versteht er alles.
            </p>
            <label className="field">
              <span>Gemini-API-Schlüssel</span>
              <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="AIza…"
                autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </label>
            {state && <p className="form-error">{state.text}</p>}
            <div className="btn-row">
              <button type="submit" className="btn btn--primary" disabled={!draft.trim()}>Speichern</button>
            </div>
          </form>
        )}
        <p className="hint">
          Der Schlüssel bleibt nur in diesem Browser – er wird nicht synchronisiert und steht nirgends im Code.
          Auf jedem weiteren Gerät einmal eintragen. Hinweis: Im Gratis-Tarif darf Google Eingaben zur Verbesserung
          seiner Dienste verwenden – der Assistent sieht deine Aufgaben, Notizen und den Stundenplan.
        </p>
      </div>
    </section>
  );
}
