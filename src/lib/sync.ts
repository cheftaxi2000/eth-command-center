import { useSyncExternalStore } from 'react';
import { canonical, mergeSynced, normalizeSynced, type SyncedState } from './state';
import { applyMerged, getPersonal, onSyncedChange } from './store';

/**
 * Optional sync of the app's own data between devices via ONE file in a PRIVATE GitHub repo.
 * Talks to api.github.com only – never to Notion. The token stays on the device (localStorage).
 */

export interface SyncConfig {
  owner: string;
  repo: string;
  token: string;
  path: string;
}

export type SyncPhase = 'off' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt?: number;
  error?: string;
}

export class SyncError extends Error {
  constructor(message: string, public kind: 'auth' | 'forbidden' | 'notfound' | 'network' | 'other' = 'other') {
    super(message);
  }
}

/* ---------- core (pure, unit-tested) ---------- */

export interface RemoteFile {
  state: SyncedState | null;
  sha?: string;
}
export interface SyncApi {
  read(): Promise<RemoteFile>;
  /** false = the file changed in the meantime (stale sha) → caller re-reads and merges again */
  write(state: SyncedState, sha?: string): Promise<boolean>;
}

export async function syncOnce(
  getLocal: () => SyncedState,
  setLocal: (s: SyncedState) => void,
  api: SyncApi,
  attempts = 3,
): Promise<'pushed' | 'unchanged'> {
  for (let i = 0; i < attempts; i++) {
    const remote = await api.read();
    const merged = remote.state ? mergeSynced(getLocal(), remote.state) : getLocal();
    setLocal(merged);
    if (remote.state && canonical(merged) === canonical(remote.state)) return 'unchanged';
    if (await api.write(merged, remote.sha)) return 'pushed';
  }
  throw new SyncError('Gleichzeitige Änderung auf einem anderen Gerät – bitte gleich nochmal versuchen.');
}

/* ---------- GitHub adapter ---------- */

const API = 'https://api.github.com';
const FILE = 'studium.json';

function toB64(text: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromB64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Android/.test(ua)) return 'Android';
  return 'Browser';
}

async function request(url: string, token: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new SyncError('Keine Verbindung zu GitHub.', 'network');
  }
  return res;
}

function fail(res: Response): never {
  if (res.status === 401) throw new SyncError('Token ungültig oder abgelaufen.', 'auth');
  if (res.status === 403) {
    throw new SyncError('Keine Berechtigung: Der Token braucht „Contents: Read and write“ für dieses Repo.', 'forbidden');
  }
  if (res.status === 404) {
    throw new SyncError('Repo nicht gefunden – Name prüfen, oder der Token hat keinen Zugriff darauf.', 'notfound');
  }
  throw new SyncError(`GitHub antwortet mit Fehler ${res.status}.`);
}

function githubApi(cfg: SyncConfig): SyncApi {
  const url = `${API}/repos/${cfg.owner}/${cfg.repo}/contents/${cfg.path}`;
  return {
    async read() {
      const res = await request(url, cfg.token);
      if (res.status === 404) return { state: null }; // no file yet (or no access – the write will tell)
      if (!res.ok) fail(res);
      const body = (await res.json()) as { content: string; sha: string };
      return { state: normalizeSynced(JSON.parse(fromB64(body.content))), sha: body.sha };
    },
    async write(state, sha) {
      const res = await request(url, cfg.token, {
        method: 'PUT',
        body: JSON.stringify({
          message: `Sync von ${deviceName()}`,
          content: toB64(canonical(state, 1) + '\n'),
          ...(sha ? { sha } : {}),
        }),
      });
      if (res.status === 409 || res.status === 422) return false;
      if (!res.ok) fail(res);
      return true;
    },
  };
}

/* ---------- config & status ---------- */

const CONFIG_KEY = 'eth-cc:sync';

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    return raw ? (JSON.parse(raw) as SyncConfig) : null;
  } catch {
    return null;
  }
}

function saveConfig(cfg: SyncConfig | null) {
  try {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* ignore */
  }
}

let status: SyncStatus = { phase: 'off' };
const listeners = new Set<() => void>();
function setStatus(next: SyncStatus) {
  status = next;
  listeners.forEach((l) => l());
}
export const getSyncStatus = () => status;
export const useSyncStatus = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getSyncStatus,
    getSyncStatus,
  );

/* ---------- scheduling ---------- */

let timer: number | undefined;
let running: Promise<void> | null = null;
let again = false;

export function scheduleSync(delay = 1500) {
  if (!getSyncConfig()) return;
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

export function syncNow(): Promise<void> {
  const cfg = getSyncConfig();
  if (!cfg) {
    setStatus({ phase: 'off' });
    return Promise.resolve();
  }
  if (running) {
    again = true;
    return running;
  }
  if (!navigator.onLine) {
    setStatus({ ...status, phase: 'offline' });
    return Promise.resolve();
  }
  setStatus({ ...status, phase: 'syncing', error: undefined });
  running = (async () => {
    try {
      await syncOnce(() => getPersonal().synced, applyMerged, githubApi(cfg));
      setStatus({ phase: 'idle', lastSyncAt: Date.now() });
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError(String(e));
      setStatus({ ...status, phase: err.kind === 'network' ? 'offline' : 'error', error: err.message });
    } finally {
      running = null;
      if (again) {
        again = false;
        scheduleSync(300);
      }
    }
  })();
  return running;
}

let started = false;
export function initSync() {
  if (started) return;
  started = true;
  onSyncedChange(() => scheduleSync());
  window.addEventListener('online', () => scheduleSync(200));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(200);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, 2 * 60_000);
  if (getSyncConfig()) {
    setStatus({ phase: 'idle' });
    scheduleSync(50);
  }
}

/** Validate token + repo, refuse public repos, then run a first sync. */
export async function connectSync(tokenInput: string, repoInput: string): Promise<SyncConfig> {
  const token = tokenInput.trim();
  let repo = repoInput.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
  let owner = '';
  if (repo.includes('/')) [owner, repo] = repo.split('/', 2);
  if (!token || !repo) throw new SyncError('Bitte Token und Repo angeben.');

  if (!owner) {
    const me = await request(`${API}/user`, token);
    if (!me.ok) fail(me);
    owner = ((await me.json()) as { login: string }).login;
  }
  const res = await request(`${API}/repos/${owner}/${repo}`, token);
  if (!res.ok) fail(res);
  const info = (await res.json()) as { private: boolean };
  if (!info.private) {
    throw new SyncError(`${owner}/${repo} ist öffentlich. Bitte ein privates Repo verwenden – sonst wären deine Einträge für alle sichtbar.`);
  }

  const cfg: SyncConfig = { owner, repo, token, path: FILE };
  saveConfig(cfg);
  await syncNow();
  if (status.phase === 'error') {
    const message = status.error ?? 'Sync fehlgeschlagen.';
    saveConfig(null);
    setStatus({ phase: 'off' });
    throw new SyncError(message);
  }
  return cfg;
}

export function disconnectSync() {
  saveConfig(null);
  window.clearTimeout(timer);
  setStatus({ phase: 'off' });
}
