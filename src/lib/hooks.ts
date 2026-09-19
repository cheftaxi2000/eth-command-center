import { useEffect, useRef, useSyncExternalStore } from 'react';

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
