import { useEffect, useState } from 'react';
import { parseLocal } from './time';

/**
 * Dev/testing aid: open the app with `?now=2026-09-21T09:30` to see it as if it were
 * that moment (clock keeps running from there). Without the parameter this is just the real time.
 */
const offset = (() => {
  try {
    const raw = new URLSearchParams(window.location.search).get('now');
    if (!raw) return 0;
    const target = parseLocal(raw);
    return Number.isNaN(+target) ? 0 : +target - Date.now();
  } catch {
    return 0;
  }
})();

export const getNow = () => new Date(Date.now() + offset);

/** Re-renders every 30 s so "läuft gerade" and countdowns stay correct. */
export function useNow(): Date {
  const [now, setNow] = useState(getNow);
  useEffect(() => {
    const tick = () => setNow(getNow());
    const id = window.setInterval(tick, 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return now;
}
