import { useSyncExternalStore } from 'react';
import { canonical, mergeSynced, normalizeSynced, type SyncedState } from './state';
import { applyMerged, getPersonal, onSyncedChange } from './store';

/**
 * Sync of the app's own data between devices via kvdb.io – a free, anonymous key-value
 * store (no account, no token). One "Sync-Code" (= a kvdb bucket id) per install; pairing a
 * second device just means typing in the same code. Talks to kvdb.io only – never to Notion.
 * The code stays on the device (localStorage) and is the only thing protecting the data:
 * whoever has it can read/write it, so it is never sent anywhere except kvdb.io.
 */

export interface SyncConfig {
  bucket: string;
}

export type SyncPhase = 'starting' | 'idle' | 'syncing' | 'offline' | 'error';
export interface SyncStatus {
  phase: SyncPhase;
  lastSyncAt?: number;
  error?: string;
}

export class SyncError extends Error {
  constructor(message: string, public kind: 'network' | 'other' = 'other') {
    super(message);
  }
}

/* ---------- core (pure, unit-tested) ---------- */

export interface RemoteFile {
  state: SyncedState | null;
}
export interface SyncApi {
  read(): Promise<RemoteFile>;
  write(state: SyncedState): Promise<boolean>;
}

export async function syncOnce(getLocal: () => SyncedState, setLocal: (s: SyncedState) => void, api: SyncApi): Promise<'pushed' | 'unchanged'> {
  const remote = await api.read();
  const merged = remote.state ? mergeSynced(getLocal(), remote.state) : getLocal();
  setLocal(merged);
  if (remote.state && canonical(merged) === canonical(remote.state)) return 'unchanged';
  await api.write(merged);
  return 'pushed';
}

/* ---------- kvdb.io adapter ---------- */

const API = 'https://kvdb.io';
const KEY = 'studium';

async function request(url: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: 'no-store' });
  } catch {
    throw new SyncError('Keine Verbindung.', 'network');
  }
}

function kvdbApi(cfg: SyncConfig): SyncApi {
  const url = `${API}/${cfg.bucket}/${KEY}`;
  return {
    async read() {
      const res = await request(url);
      if (res.status === 404) return { state: null };
      if (!res.ok) throw new SyncError(`kvdb.io antwortet mit Fehler ${res.status}.`);
      const text = await res.text();
      if (!text.trim()) return { state: null };
      try {
        return { state: normalizeSynced(JSON.parse(text)) };
      } catch {
        return { state: null }; // corrupt/foreign value in that bucket – don't crash, just start fresh from here
      }
    },
    async write(state) {
      const res = await request(url, { method: 'POST', body: canonical(state) });
      if (!res.ok) throw new SyncError(`kvdb.io antwortet mit Fehler ${res.status}.`);
      return true;
    },
  };
}

/**
 * New anonymous kvdb.io bucket. kvdb requires an "email" field on creation, and – found by
 * testing, not documented – locks a bucket's writes behind "verify your email" as soon as it
 * sees an address it treats as disposable (e.g. anything under the reserved .invalid TLD).
 * The RFC 2606 placeholder "test@example.com" is the one address that consistently stayed
 * unlocked across many created buckets and repeated writes in testing; it is not tied to any
 * real person or mailbox. This is an undocumented quirk of a free third-party service, not a
 * guarantee – if kvdb ever changes it, sync would need a different backend.
 */
async function createBucket(): Promise<string> {
  const res = await request(API + '/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'email=test%40example.com',
  });
  if (!res.ok) throw new SyncError(`Konnte keinen Sync-Code erzeugen (kvdb.io: ${res.status}).`);
  const id = (await res.text()).trim();
  if (!id) throw new SyncError('kvdb.io hat keinen Sync-Code zurückgegeben.');
  return id;
}

/* ---------- config & status ---------- */

const CONFIG_KEY = 'eth-cc:sync';

export function getSyncConfig(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    return typeof parsed.bucket === 'string' && parsed.bucket ? { bucket: parsed.bucket } : null;
  } catch {
    return null;
  }
}

function saveConfig(cfg: SyncConfig) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  } catch {
    /* private mode / quota – sync just won't persist across reloads */
  }
}

let status: SyncStatus = { phase: 'starting' };
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
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

export function syncNow(): Promise<void> {
  const cfg = getSyncConfig();
  if (!cfg) return Promise.resolve(); // still creating the first bucket – initSync will retry
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
      await syncOnce(() => getPersonal().synced, applyMerged, kvdbApi(cfg));
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

  const existing = getSyncConfig();
  if (existing) {
    setStatus({ phase: 'idle' });
    scheduleSync(50);
    return;
  }
  // First ever launch on this device: get a code immediately, no action required.
  setStatus({ phase: 'starting' });
  void (async () => {
    try {
      const bucket = await createBucket();
      saveConfig({ bucket });
      setStatus({ phase: 'idle' });
      scheduleSync(50);
    } catch (e) {
      const err = e instanceof SyncError ? e : new SyncError(String(e));
      setStatus({ phase: err.kind === 'network' ? 'offline' : 'error', error: err.message });
      // try again once we're back online – until then the app works fine purely offline/local
      window.addEventListener('online', () => initSyncRetry(), { once: true });
    }
  })();
}

function initSyncRetry() {
  started = false;
  initSync();
}

/** Adopt another device's code – existing local data is merged in, not discarded. */
export async function joinSync(codeInput: string): Promise<SyncConfig> {
  const bucket = codeInput.trim();
  if (!bucket) throw new SyncError('Bitte einen Code eingeben.');
  const cfg: SyncConfig = { bucket };
  saveConfig(cfg);
  await syncNow();
  if (getSyncStatus().phase === 'error') throw new SyncError(getSyncStatus().error ?? 'Koppeln fehlgeschlagen.');
  return cfg;
}

/** Starts a brand-new, empty code – e.g. to stop sharing an old one. Local data stays. */
export async function newSyncCode(): Promise<SyncConfig> {
  const bucket = await createBucket();
  const cfg: SyncConfig = { bucket };
  saveConfig(cfg);
  await syncNow();
  return cfg;
}
