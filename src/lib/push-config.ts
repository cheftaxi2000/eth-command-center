/**
 * Constants shared by the app and the reminder service (scripts/notify/send-reminders.mjs).
 * No imports on purpose – Node reads this file directly, like lib/reminders.ts.
 */

/** The built-in sync code every install shares (see lib/sync.ts) */
export const DEFAULT_BUCKET = '92oHKuqyUDHM6uDLLnfZRv';

/**
 * Public half of the Web Push (VAPID) key pair. Public by design – browsers need it to subscribe.
 * The private half is ONLY a GitHub Actions secret (VAPID_PRIVATE_KEY); without it nobody can send.
 */
export const VAPID_PUBLIC_KEY = 'BG-2I_6UcO93cnhYThqJCfM-NbMVdfHrIC_HmzER7o7JScep7il22lN886jWg1nSQaA2fOilqBf0NaFXGXnGkTQ';

/** Deadlines are Zurich wall-clock times; the service runs in UTC and converts with this. */
export const REMINDER_ZONE = 'Europe/Zurich';

/** kvdb key the service writes to (what it sent, when it last ran) – never the synced data itself */
export const REMINDER_LOG_KEY = 'studium-reminders';
