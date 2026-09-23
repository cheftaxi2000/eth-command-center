/**
 * Reminder service – runs every 10 minutes as a GitHub Action (.github/workflows/reminders.yml).
 *
 * Reads the synced data from kvdb.io, finds reminders of important to-dos that are due right now
 * (same rules as the app: src/lib/reminders.ts) and sends them as Web Push to every subscribed
 * device. What it sent – and when it last ran – goes into its OWN kvdb key, so it never races the
 * app over the synced data and a reminder is never sent twice.
 *
 * Needs the secret VAPID_PRIVATE_KEY. Without it the run ends quietly: nothing to send with.
 */
import { pathToFileURL } from 'node:url';
import webpush from 'web-push';
import { seed } from '../../src/data/seed.ts';
import { DEFAULT_BUCKET, REMINDER_LOG_KEY, REMINDER_ZONE, VAPID_PUBLIC_KEY } from '../../src/lib/push-config.ts';
import { dueReminders, reminderTag, reminderText } from '../../src/lib/reminders.ts';

const KVDB = 'https://kvdb.io';
const MONTH = 30 * 86_400_000;
// Apple's push service insists on a real contact; the site address is one that belongs to the project.
const SUBJECT = 'https://cheftaxi2000.github.io/eth-command-center/';

const courseName = (id) => seed.courses.find((c) => c.id === id)?.shortName ?? 'Allgemein';

async function getJson(url, fetchFn) {
  const res = await fetchFn(url, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`kvdb.io ${res.status} für ${url.replace(/\/[^/]+\/([^/]+)$/, '/…/$1')}`);
  const text = await res.text();
  return text.trim() ? JSON.parse(text) : null;
}

/**
 * One run. Everything from outside is passed in, so a test can drive it with fakes.
 * Returns what happened, for the log.
 */
export async function run({ bucket, privateKey, now = Date.now(), fetchFn = fetch, send = webpush.sendNotification.bind(webpush) }) {
  const state = await getJson(`${KVDB}/${bucket}/studium`, fetchFn);
  const log = (await getJson(`${KVDB}/${bucket}/${REMINDER_LOG_KEY}`, fetchFn)) ?? {};
  const sent = Object.fromEntries(Object.entries(log.sent ?? {}).filter(([, t]) => now - t < MONTH));
  const dead = { ...(log.dead ?? {}) };

  const todos = Object.values(state?.todos ?? {});
  const subs = Object.values(state?.push ?? {}).filter((s) => s && typeof s.endpoint === 'string' && s.endpoint.startsWith('https://') && !dead[s.endpoint]);
  const due = dueReminders(todos, now, (k) => k in sent, REMINDER_ZONE);

  const result = { reminders: due.length, devices: subs.length, delivered: 0, failed: 0, expired: 0 };
  for (const r of due) {
    const todo = todos.find((t) => t.id === r.todoId);
    const { title, body } = reminderText(r, todo, courseName(todo.courseId), now, REMINDER_ZONE);
    const payload = JSON.stringify({ title, body, tag: reminderTag(r), url: './#/tasks' });
    for (const s of subs) {
      try {
        await send(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 3600, urgency: 'high', vapidDetails: { subject: SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey } },
        );
        result.delivered++;
      } catch (err) {
        // 404/410: the browser dropped this subscription – skip it from now on (the app renews its own)
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          dead[s.endpoint] = now;
          result.expired++;
        } else {
          result.failed++;
          console.warn(`Push fehlgeschlagen (${err?.statusCode ?? 'kein Status'}): ${err?.body ?? err?.message ?? err}`);
        }
      }
    }
    // Marked as sent even if one device failed: better one missed reminder than one every 10 minutes.
    for (const k of r.covers) sent[k] = now;
  }

  const next = { lastRun: now, sent, dead: Object.fromEntries(Object.entries(dead).filter(([, t]) => now - t < MONTH)) };
  const res = await fetchFn(`${KVDB}/${bucket}/${REMINDER_LOG_KEY}`, { method: 'POST', body: JSON.stringify(next) });
  if (!res.ok) throw new Error(`Log konnte nicht geschrieben werden (kvdb.io ${res.status})`);
  return result;
}

// Run directly (not when imported by a test)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const bucket = process.env.SYNC_BUCKET?.trim() || DEFAULT_BUCKET;
  if (!privateKey) {
    console.log('VAPID_PRIVATE_KEY ist nicht gesetzt – keine Erinnerungen verschickt (siehe README, „Erinnerungen“).');
    process.exit(0);
  }
  run({ bucket, privateKey })
    .then((r) => console.log(`Erinnerungen fällig: ${r.reminders} · Geräte: ${r.devices} · zugestellt: ${r.delivered} · abgelaufen: ${r.expired} · Fehler: ${r.failed}`))
    .catch((err) => {
      console.error(err.message ?? err);
      process.exit(1);
    });
}
