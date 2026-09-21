import { useSyncExternalStore } from 'react';
import type { ActionCall, ActionResult } from './actions';
import type { AIMessage } from './provider';

/**
 * The conversation with the assistant – kept in THIS browser only (localStorage), like a normal
 * chatbot remembers your last chat. Deliberately not synced: the sync store is public, and a chat
 * can contain more than the app data itself.
 */

export interface ChatEntry {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
  /** What actually changed in the app because of this answer. */
  done?: ActionResult[];
  /** Deletions waiting for a yes. `resolved` once answered either way. */
  pending?: { call: ActionCall; question: string; resolved?: 'yes' | 'no' }[];
  error?: boolean;
}

const KEY = 'eth-cc:chat';
const MAX = 60;
const listeners = new Set<() => void>();

function load(): ChatEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((e): e is ChatEntry => !!e && typeof e.id === 'string' && typeof e.text === 'string') : [];
  } catch {
    return [];
  }
}

let entries: ChatEntry[] = load();

function commit(next: ChatEntry[]) {
  entries = next.slice(-MAX);
  try {
    if (entries.length) localStorage.setItem(KEY, JSON.stringify(entries));
    else localStorage.removeItem(KEY);
  } catch {
    /* quota / private mode – the chat just won't survive a reload */
  }
  listeners.forEach((l) => l());
}

export const getChat = () => entries;
export const useChat = () =>
  useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    getChat,
    getChat,
  );

let seq = 0;
export const chatId = () => `c${Date.now().toString(36)}${(seq++).toString(36)}`;

export const chat = {
  add(entry: Omit<ChatEntry, 'id' | 'at'>): string {
    const id = chatId();
    commit([...entries, { ...entry, id, at: Date.now() }]);
    return id;
  },
  update(id: string, fn: (e: ChatEntry) => ChatEntry) {
    commit(entries.map((e) => (e.id === id ? fn(e) : e)));
  },
  clear() {
    commit([]);
  },
};

/** What the model gets to see of the conversation: the last few turns, as plain messages. */
export function historyForModel(list: ChatEntry[], turns = 10): AIMessage[] {
  return list
    .filter((e) => !e.error && e.text.trim())
    .slice(-turns)
    .map((e) => ({ role: e.role, content: e.text }));
}
