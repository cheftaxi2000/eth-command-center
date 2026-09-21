import { useSyncExternalStore } from 'react';
import { canonical, mergeSynced, normalizeSynced, type SyncedState } from './state';
import { applyMerged, getPersonal, onSyncedChange } from './store';

/**
 * Sync of the app's own data between devices AND browsers via kvdb.io – a free, anonymous
 * key-value store (no account, no token). Talks to kvdb.io only, never to Notion.
 *
 * WHY A FIXED, BUILT-IN CODE:
 * Until now every install generated its own code on first launch, so Edge and Chrome on the same
 * laptop each created a separate store and never saw each other's data. To make sync work with
 * zero setup – the explicit requirement – the app ships ONE shared code that every install uses
 * by default. The trade-off, accepted deliberately: this code is part of the public JavaScript
 * bundle, so anyone who opens the public site could read or overwrite this data. It is a personal
 * study planner, not a secret store – don't keep passwords or anything sensitive in the notes.
 * "Eigenen Code erzeugen" in Settings switches to a private store for anyone who wants that.
 */

/** Overridable at build time (`VITE_SYNC_BUCKET=…`) without touching the source. */
export const SHARED_BUCKET: string = import.meta.env.VITE_SYNC_BUCKET || '92oHKuqyUDHM6uDLLnfZRv';

export interface SyncConfig {
  bucket: string;
  /** 'shared' = the built-in code everyone gets; 'own' = a private code this user chose. */
  source: 'shared' | 'own';
}

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error';
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

export function kvdbApi(bucket: string): SyncApi {
  const url = `${API}/${bucket}/${KEY}`;
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

/* ---------- config ---------- */

const CONFIG_KEY = 'eth-cc:sync';

/** Only stored when the user deliberately left the shared code; otherwise everyone shares one store. */
function storedOverride(): SyncConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SyncConfig>;
    if (typeof p.bucket !== 'string' || !p.bucket) return null;
    // Configs written before the shared code existed have no `source`. Those were auto-generated
    // per browser, which is exactly the bug being fixed – treat them as "not a deliberate choice".
    return p.source === 'own' ? { bucket: p.bucket, source: 'own' } : null;
  } catch {
    return null;
  }
}

export function getSyncConfig(): SyncConfig {
  return storedOverride() ?? { bucket: SHARED_BUCKET, source: 'shared' };
}

function saveConfig(cfg: SyncConfig | null) {
  try {
    if (cfg && cfg.source === 'own') localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
  } catch {
    /* private mode / quota – sync just won't persist across reloads */
  }
}

/** A pre-shared-code install kept its data in its own bucket. Read it once so nothing is lost. */
const LEGACY_DONE_KEY = 'eth-cc:sync-migrated';
function legacyBucket(): string | null {
  try {
    if (localStorage.getItem(LEGACY_DONE_KEY)) return null;
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<SyncConfig>;
    if (p.source || typeof p.bucket !== 'string' || !p.bucket || p.bucket === SHARED_BUCKET) return null;
    return p.bucket;
  } catch {
    return null;
  }
}

async function migrateLegacy() {
  const bucket = legacyBucket();
  try {
    localStorage.setItem(LEGACY_DONE_KEY, '1');
  } catch {
    /* ignore – worst case we re-read the old bucket once more, which is harmless */
  }
  if (!bucket) return;
  try {
    const { state } = await kvdbApi(bucket).read();
    // Merge into local only. The next regular sync round pushes the result into the shared store.
    if (state) applyMerged(mergeSynced(getPersonal().synced, state));
  } catch {
    /* old bucket unreachable – local data is still intact, nothing to recover from */
  }
  saveConfig(null);
}

/* ---------- status ---------- */

let status: SyncStatus = { phase: 'idle' };
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

/** While the tab is visible we poll this often, so another browser's change shows up on its own. */
const POLL_MS = 15_000;

let timer: number | undefined;
let running: Promise<void> | null = null;
let again = false;

export function scheduleSync(delay = 1500) {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => void syncNow(), delay);
}

export function syncNow(): Promise<void> {
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
      await syncOnce(() => getPersonal().synced, applyMerged, kvdbApi(getSyncConfig().bucket));
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

  onSyncedChange(() => {
    scheduleSync();
    // Other tabs of THIS browser get the change immediately, without waiting for a poll.
    channel?.postMessage('changed');
  });
  window.addEventListener('online', () => scheduleSync(200));
  window.addEventListener('focus', () => scheduleSync(200));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleSync(200);
  });
  window.setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow();
  }, POLL_MS);

  void (async () => {
    await migrateLegacy();
    scheduleSync(50);
  })();
}

/** Same browser, other tab: pick the change up right away instead of after the next poll. */
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('eth-cc:sync') : null;
channel?.addEventListener('message', () => scheduleSync(150));

/** Adopt another device's code – existing local data is merged in, not discarded. */
export async function joinSync(codeInput: string): Promise<SyncConfig> {
  const bucket = codeInput.trim();
  if (!bucket) throw new SyncError('Bitte einen Code eingeben.');
  const cfg: SyncConfig = { bucket, source: bucket === SHARED_BUCKET ? 'shared' : 'own' };
  saveConfig(cfg);
  await syncNow();
  if (getSyncStatus().phase === 'error') throw new SyncError(getSyncStatus().error ?? 'Koppeln fehlgeschlagen.');
  return cfg;
}

/** Leave the shared store for a private one. Local data stays and is pushed into the new store. */
export async function newSyncCode(): Promise<SyncConfig> {
  const cfg: SyncConfig = { bucket: await createBucket(), source: 'own' };
  saveConfig(cfg);
  await syncNow();
  return cfg;
}

/** Back to the built-in code that every install shares. */
export async function switchToSharedCode(): Promise<SyncConfig> {
  saveConfig(null);
  await syncNow();
  return getSyncConfig();
}
