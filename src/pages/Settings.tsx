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
import { connectSync, disconnectSync, getSyncConfig, syncNow, useSyncStatus } from '../lib/sync';
import { toLocalDate } from '../lib/time';

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

  const ownCount = Object.keys(synced.todos).length + Object.keys(synced.exams).length;

  return (
    <>
      <header className="page-head">
        <div>
          <p className="eyebrow">Persönlich</p>
          <h1>Einstellungen</h1>
        </div>
      </header>

      <SyncSection />

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
          <p className="hint hint--top">Deine To-dos, Prüfungen und Häkchen als Datei – zusätzlich zum Sync oder falls du ihn nicht nutzt.</p>
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
            <dt>Eigene Einträge</dt><dd>{Object.keys(synced.todos).length} To-dos · {Object.keys(synced.exams).length} Prüfungen</dd>
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
              <button type="button" className="btn" onClick={() => setConfirm(true)}>Alle eigenen To-dos & Prüfungen löschen</button>
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
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState('studium-sync');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await connectSync(token, repo);
      setToken('');
      toast({ text: `Verbunden mit ${c.owner}/${c.repo}` });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const last = status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <section id="sync" className="scroll-target">
      <h2 className="h-section">Sync zwischen Laptop und iPad</h2>
      <div className="panel panel--pad">
        {cfg ? (
          <>
            <p className="sync-state">
              <Icon name={status.phase === 'error' ? 'alert' : status.phase === 'offline' ? 'cloud-off' : 'cloud'} size={20} />
              <span>
                <strong>
                  {status.phase === 'syncing' ? 'Synchronisiere …' : status.phase === 'error' ? 'Sync-Problem' : status.phase === 'offline' ? 'Offline' : 'Synchronisiert'}
                </strong>
                {' · '}{cfg.owner}/{cfg.repo}{last && ` · zuletzt ${last}`}
              </span>
            </p>
            {status.error && <p className="form-error">{status.error}</p>}
            <p className="hint">To-dos, Prüfungen, Häkchen und Stundenplan-Einstellungen werden über die Datei <code>{cfg.path}</code> in deinem privaten Repo abgeglichen. Farbschema bleibt pro Gerät.</p>
            <div className="btn-row">
              <button type="button" className="btn btn--primary" onClick={() => void syncNow()} disabled={status.phase === 'syncing'}>Jetzt synchronisieren</button>
              <button type="button" className="btn" onClick={() => { disconnectSync(); toast({ text: 'Sync auf diesem Gerät getrennt' }); }}>Trennen</button>
            </div>
          </>
        ) : (
          <form className="form" onSubmit={connect}>
            <p className="hint hint--top">Einmal pro Gerät einrichten (am iPad <strong>in der installierten App</strong>, nicht in Safari). Deine Einträge liegen dann privat in deinem GitHub – Notion bleibt unberührt.</p>
            <ol className="steps">
              <li>
                <a href="https://github.com/new?name=studium-sync&visibility=private" target="_blank" rel="noopener noreferrer">Privates Repo „studium-sync“ anlegen</a>
                {' '}– Sichtbarkeit <strong>Private</strong>.
              </li>
              <li>
                <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">Fine-grained Token erstellen</a>:
                Repository access → <em>Only select repositories</em> → studium-sync; Permissions → <em>Contents: Read and write</em>.
              </li>
              <li>Token kopieren und hier einfügen.</li>
            </ol>
            <label className="field">
              <span>GitHub-Token</span>
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" required />
            </label>
            <label className="field">
              <span>Repo</span>
              <input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="studium-sync oder benutzer/studium-sync" autoCapitalize="off" autoCorrect="off" spellCheck={false} required />
            </label>
            {error && <p className="form-error">{error}</p>}
            <div className="btn-row">
              <button type="submit" className="btn btn--primary" disabled={busy}>{busy ? 'Verbinde …' : 'Verbinden'}</button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
