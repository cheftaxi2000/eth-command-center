import { useSyncExternalStore } from 'react';
import { Icon } from './ui';

export interface ToastData {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
  persistent?: boolean;
}

let toasts: ToastData[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(t: Omit<ToastData, 'id'>, ms = 4500): number {
  const id = ++seq;
  toasts = [...toasts.slice(-2), { ...t, id }];
  emit();
  if (!t.persistent) window.setTimeout(() => dismiss(id), ms);
  return id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function Toasts() {
  const list = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => toasts,
    () => toasts,
  );
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast__text">{t.text}</span>
          {t.action && (
            <button type="button" className="toast__btn" onClick={() => { t.action!.run(); dismiss(t.id); }}>
              {t.action.label}
            </button>
          )}
          {t.persistent && (
            <button type="button" className="toast__close" onClick={() => dismiss(t.id)} aria-label="Schließen">
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
