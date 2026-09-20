import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Sidebar layout (desktop, iPad landscape) vs. bottom tab bar (iPad portrait, phone) */
export const WIDE_QUERY = '(min-width: 1024px)';

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Studium` : 'Studium';
  }, [title]);
}

const isApple = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
export const MOD_KEY = isApple ? '⌘' : 'Strg';

export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Keeps a just-completed item visible (checked, struck through) for a beat instead of it
 * instantly vanishing into a collapsed "Erledigt" section – so the green checkmark is actually seen.
 * Returns the open items plus any that finished within the last `ms`; also returns their ids so
 * callers can add a highlight class.
 */
export function useLingerDone<T extends { id: string; done: boolean }>(all: T[], ms = 900): { items: T[]; lingering: Set<string> } {
  const openNow = useMemo(() => all.filter((i) => !i.done), [all]);
  const openIds = useMemo(() => new Set(openNow.map((i) => i.id)), [openNow]);
  const key = useMemo(() => all.map((i) => `${i.id}:${i.done}`).join(','), [all]);

  const prevOpenIds = useRef<Set<string>>(openIds);
  const timers = useRef(new Map<string, number>());
  const [lingering, setLingering] = useState<Map<string, T>>(new Map());

  useEffect(() => {
    const justDone = [...prevOpenIds.current].filter((id) => !openIds.has(id));
    if (justDone.length > 0) {
      setLingering((prev) => {
        const next = new Map(prev);
        for (const id of justDone) {
          const item = all.find((i) => i.id === id);
          if (item) next.set(id, item);
        }
        return next;
      });
      for (const id of justDone) {
        window.clearTimeout(timers.current.get(id));
        timers.current.set(
          id,
          window.setTimeout(() => {
            setLingering((prev) => {
              if (!prev.has(id)) return prev;
              const next = new Map(prev);
              next.delete(id);
              return next;
            });
            timers.current.delete(id);
          }, ms),
        );
      }
    }
    prevOpenIds.current = openIds;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    const t = timers.current;
    return () => t.forEach((id) => window.clearTimeout(id));
  }, []);

  const overflow = [...lingering.values()].filter((i) => !openIds.has(i.id));
  return { items: [...openNow, ...overflow], lingering: new Set(overflow.map((i) => i.id)) };
}

/**
 * Horizontal swipe on touch screens (e.g. next/previous course). Ignores vertical scrolling,
 * edge swipes and anything inside inputs or horizontally scrolling areas ([data-noswipe]).
 */
export function useSwipe(onSwipe: (dir: 'left' | 'right') => void) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  return {
    onTouchStart(e: React.TouchEvent) {
      const t = e.touches[0];
      const target = e.target as HTMLElement;
      const blocked =
        e.touches.length !== 1 ||
        !!target.closest('[data-noswipe], input, textarea, select, pre') ||
        t.clientX < 24 ||
        t.clientX > window.innerWidth - 24;
      start.current = blocked ? null : { x: t.clientX, y: t.clientY, t: Date.now() };
    },
    onTouchEnd(e: React.TouchEvent) {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.t < 700 && Math.abs(dx) > 70 && Math.abs(dx) > 2.2 * Math.abs(dy)) {
        onSwipe(dx < 0 ? 'left' : 'right');
      }
    },
  };
}
