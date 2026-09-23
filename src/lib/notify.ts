import { useEffect, useState } from 'react';
import { REMINDER_LOG_KEY, VAPID_PUBLIC_KEY } from './push-config';
import { reminderSchedule, type Reminder } from './reminders';
import type { SyncedState } from './state';
import { actions, getPersonal } from './store';

/**
 * Notifications for important to-dos, in two layers:
 *  1. While the app is open (any tab, any device): lib/reminders.ts decides, ReminderHost shows it.
 *  2. While it is closed: this device subscribes to Web Push; the subscription is synced, and the
 *     GitHub Action scripts/notify/send-reminders.mjs sends the same reminders from outside.
 * Both use the same tag per reminder, so if both fire the second one silently replaces the first.
 */

export type Permission = NotificationPermission | 'unsupported';

const DEVICE_KEY = 'eth-cc:device';
const SENT_KEY = 'eth-cc:reminded';

const hasNotifications = () => typeof window !== 'undefined' && 'Notification' in window;
export const hasPush = () => typeof window !== 'undefined' && 'PushManager' in window && 'serviceWorker' in navigator;
export const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const getPermission = (): Permission => (hasNotifications() ? Notification.permission : 'unsupported');

/** Re-reads the permission whenever the app comes back to the foreground (it can change in the browser settings). */
export function usePermission(): [Permission, () => void] {
  const [p, setP] = useState<Permission>(getPermission);
  useEffect(() => {
    const check = () => setP(getPermission());
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  return [p, () => setP(getPermission())];
}

/** A random id per browser – which push subscription belongs to this device. */
export function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `dev-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'dev-unknown';
  }
}

/** "iPad", "Chrome · Windows" … – only a label for the device list in Settings. */
export function deviceLabel(ua = navigator.userAgent): string {
  const os = /iPad/.test(ua) || (isIOS() && !/iPhone/.test(ua)) ? 'iPad' : /iPhone/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'Gerät';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
  if (os === 'iPad' || os === 'iPhone') return isStandalone() ? `${os} (App)` : `${os} · ${browser || 'Browser'}`;
  return browser ? `${browser} · ${os}` : os;
}

/** The service worker, if there is one within a few seconds (there is none in `npm run dev`). */
async function swRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => window.setTimeout(() => r(null), 3000)),
  ]).catch(() => null);
}

function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const b64url = (buf: ArrayBuffer | null) =>
  buf ? btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : '';

function storeSubscription(sub: PushSubscription) {
  const p256dh = b64url(sub.getKey('p256dh'));
  const auth = b64url(sub.getKey('auth'));
  if (!sub.endpoint.startsWith('https://') || !p256dh || !auth) return;
  actions.savePushSub({ id: deviceId(), endpoint: sub.endpoint, p256dh, auth, device: deviceLabel() });
}

/** Subscribes this device to Web Push (or refreshes an existing subscription). false = not possible here. */
async function subscribePush(): Promise<boolean> {
  if (!hasPush()) return false;
  const reg = await swRegistration();
  if (!reg) return false;
  try {
    const sub = (await reg.pushManager.getSubscription())
      ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) }));
    storeSubscription(sub);
    return true;
  } catch {
    return false;
  }
}

export interface EnableResult {
  ok: boolean;
  /** Push works → reminders also arrive while the app is closed */
  background: boolean;
  message: string;
}

/**
 * Must run inside a click/tap (browsers only ask for permission then). Asks, subscribes, stores.
 */
export async function enableReminders(): Promise<EnableResult> {
  if (!hasNotifications()) {
    return {
      ok: false, background: false,
      message: isIOS() && !isStandalone()
        ? 'Auf iPad/iPhone gibt es Mitteilungen nur in der Home-Bildschirm-App: Teilen → „Zum Home-Bildschirm“, dann von dort öffnen.'
        : 'Dieser Browser kann keine Mitteilungen anzeigen.',
    };
  }
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (perm !== 'granted') {
    return { ok: false, background: false, message: 'Mitteilungen sind blockiert – in den Website-Einstellungen des Browsers für diese Seite erlauben.' };
  }
  const background = await subscribePush();
  return {
    ok: true,
    background,
    message: background
      ? 'Erinnerungen an: am Vortag und 1 Stunde vorher – auch wenn die App zu ist.'
      : 'Erinnerungen an, solange die App offen ist. Im Hintergrund klappt es in diesem Browser nicht.',
  };
}

/** On start: keep this device's subscription in the synced list current (endpoints can rotate). */
export async function refreshPushSubscription(): Promise<void> {
  if (getPermission() !== 'granted' || !hasPush()) return;
  const reg = await swRegistration();
  if (!reg) return;
  try {
    const sub = await reg.pushManager.getSubscription();
    if (sub) storeSubscription(sub);
    // Was subscribed before, subscription got lost (browser data cleared, expired) → quietly renew.
    else if (getPersonal().synced.push[deviceId()]) await subscribePush();
  } catch {
    /* nothing to do – reminders still work while the app is open */
  }
}

/** Stops background reminders for this device (the in-app ones follow the browser permission). */
export async function disableBackground(): Promise<void> {
  const reg = await swRegistration();
  try {
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  } catch {
    /* already gone */
  }
  actions.removePushSub(deviceId());
}

export const thisDeviceSubscribed = (s: SyncedState) => !!s.push[deviceId()];

/** Shows a system notification – via the service worker when there is one (required on iPad and Android). */
export async function showSystemNotification(title: string, body: string, tag: string): Promise<boolean> {
  if (getPermission() !== 'granted') return false;
  const opts: NotificationOptions = { body, tag, icon: 'icons/icon-192.png', data: { url: './#/tasks' } };
  try {
    const reg = await swRegistration();
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
    return true;
  } catch {
    return false;
  }
}

/* ---------- what this device already showed ---------- */

function readSent(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as unknown;
    return raw && typeof raw === 'object' ? (raw as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export const wasShown = (key: string) => key in readSent();

export function markShown(keys: string[], now = Date.now()) {
  const month = 30 * 86_400_000;
  const next = Object.fromEntries(Object.entries(readSent()).filter(([, t]) => now - t < month));
  for (const k of keys) next[k] = now;
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode – worst case a reminder shows twice */
  }
}

/** The next reminders that are still ahead – for the overview in Settings. */
export function upcomingReminders(s: SyncedState, now: number, limit = 6): Reminder[] {
  return Object.values(s.todos)
    .flatMap((t) => reminderSchedule(t).filter((r) => r.at > now && r.at >= t.createdAt - 5 * 60_000))
    .sort((a, b) => a.at - b.at)
    .slice(0, limit);
}

/* ---------- the service's heartbeat ---------- */

export interface ServiceStatus {
  lastRun?: number;
  sent?: number;
}

/** What the reminder service last wrote to its own kvdb key (null = it never ran for this code). */
export async function fetchServiceStatus(bucket: string): Promise<ServiceStatus | null> {
  try {
    const res = await fetch(`https://kvdb.io/${bucket}/${REMINDER_LOG_KEY}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const log = (await res.json()) as { lastRun?: unknown; sent?: unknown };
    return {
      lastRun: typeof log.lastRun === 'number' ? log.lastRun : undefined,
      sent: log.sent && typeof log.sent === 'object' ? Object.keys(log.sent).length : 0,
    };
  } catch {
    return null;
  }
}
