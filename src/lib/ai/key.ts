import { useSyncExternalStore } from 'react';

/**
 * The Gemini API key, stored ONLY in this browser's localStorage.
 *
 * Deliberately separate from lib/store.ts: that state is synced to kvdb.io, whose code is public
 * (see lib/sync.ts) – a key there would be readable by anyone. This key is never synced, never in
 * a backup file, never in the bundle. The price: it is entered once per browser/device.
 */

const KEY = 'eth-cc:ai-key';
const listeners = new Set<() => void>();

export function getAIKey(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setAIKey(value: string | null) {
  try {
    const v = value?.trim();
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode – the key just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

export const useAIKey = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => e.key === KEY && cb();
      window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener('storage', onStorage);
      };
    },
    getAIKey,
    () => null,
  );

/** "AIza…1234" – enough to recognise it, not enough to use it. */
export const maskKey = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : '••••');
