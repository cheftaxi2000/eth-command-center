import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createAIService, type ActionCall, type ActionResult, type AIMessage } from '../lib/ai';
import { useAIKey } from '../lib/ai/key';
import { Icon, Sheet, cx } from './ui';
import { useUI } from './ui-context';

interface Entry {
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** What actually changed in the app because of this answer. */
  done?: ActionResult[];
  /** Deletions waiting for a yes. `resolved` once answered either way. */
  pending?: { call: ActionCall; question: string; resolved?: 'yes' | 'no' }[];
  error?: boolean;
}

const EXAMPLES = [
  'Was muss ich diese Woche noch machen?',
  'Was habe ich morgen?',
  'Neue Aufgabe für Analysis bis Freitag: Serie 2',
];

let nextId = 1;

/**
 * Chat with the assistant. It reads and changes the app only through lib/ai – the same store the
 * rest of the UI uses, so whatever it does shows up everywhere (lists, counters, sync) immediately.
 * The conversation lives only while the app is open; nothing of it is stored or synced.
 */
export function AssistantSheet() {
  const ui = useUI();
  const key = useAIKey();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, busy]);

  useEffect(() => {
    if (ui.assistantOpen) window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [ui.assistantOpen]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    const history: AIMessage[] = entries
      .filter((e) => !e.error && e.text)
      .slice(-10)
      .map((e) => ({ role: e.role, content: e.text }));
    setEntries((es) => [...es, { id: nextId++, role: 'user', text: message }]);
    setText('');
    setBusy(true);
    try {
      // Built per message: picks up a key entered in Settings a moment ago, and builds fresh context.
      const turn = await createAIService().send(message, history);
      const summary = turn.reply || (turn.performed.length === 0 && turn.pending.length === 0 ? 'Dazu habe ich keine Antwort.' : '');
      setEntries((es) => [...es, { id: nextId++, role: 'assistant', text: summary, done: turn.performed.filter((r) => !isRead(r)), pending: turn.pending }]);
    } catch (err) {
      setEntries((es) => [...es, { id: nextId++, role: 'assistant', text: err instanceof Error ? err.message : String(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const answer = (entryId: number, index: number, yes: boolean) => {
    const p = entries.find((e) => e.id === entryId)?.pending?.[index];
    if (!p || p.resolved) return;
    // Run the action OUTSIDE the state updater: React may call updaters twice, and a delete must happen once.
    const result = yes ? createAIService().confirm(p.call) : null;
    setEntries((es) =>
      es.map((e) => {
        if (e.id !== entryId || !e.pending) return e;
        const pending = e.pending.map((q, i) => (i === index ? { ...q, resolved: yes ? ('yes' as const) : ('no' as const) } : q));
        return { ...e, pending, done: result ? [...(e.done ?? []), result] : e.done };
      }),
    );
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  return (
    <Sheet open={ui.assistantOpen} onClose={() => ui.setAssistantOpen(false)} title="Assistent">
      <p className="chat__mode">
        {key ? (
          <><span className="chat__dot chat__dot--on" />Gemini · sieht deine Aufgaben, Notizen und den Stundenplan</>
        ) : (
          <>
            <span className="chat__dot" />Einfacher Regel-Modus ohne AI.{' '}
            <Link to="/settings#ai" onClick={() => ui.setAssistantOpen(false)}>Gemini-Schlüssel eintragen</Link>
          </>
        )}
      </p>

      <div className="chat__list" ref={listRef} aria-live="polite">
        {entries.length === 0 && (
          <div className="chat__empty">
            <p>Schreib, was du brauchst – zum Beispiel:</p>
            <div className="chat__examples">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="pick pick--sm" onClick={() => void send(ex)}>{ex}</button>
              ))}
            </div>
          </div>
        )}
        {entries.map((e) => (
          <div key={e.id} className={cx('chat__msg', `chat__msg--${e.role}`, e.error && 'chat__msg--error')}>
            {e.text && <p className="chat__text">{e.text}</p>}
            {e.pending?.map((p, i) => (
              <div key={i} className="chat__confirm">
                <p>{p.question}</p>
                {p.resolved ? (
                  <p className="chat__resolved">{p.resolved === 'yes' ? 'Bestätigt.' : 'Abgebrochen – nichts gelöscht.'}</p>
                ) : (
                  <div className="btn-row">
                    <button type="button" className="btn btn--sm" onClick={() => answer(e.id, i, false)}>Nein</button>
                    <button type="button" className="btn btn--sm btn--danger" onClick={() => answer(e.id, i, true)}>Ja, löschen</button>
                  </div>
                )}
              </div>
            ))}
            {e.done?.map((r, i) => (
              <p key={i} className={cx('chat__action', !r.ok && 'chat__action--fail')}>
                <Icon name={r.ok ? 'check' : 'alert'} size={15} />{r.message}
              </p>
            ))}
          </div>
        ))}
        {busy && <div className="chat__msg chat__msg--assistant chat__typing" aria-label="Assistent denkt nach"><span /><span /><span /></div>}
      </div>

      <form className="chat__form" onSubmit={submit}>
        <textarea
          ref={inputRef}
          className="chat__input"
          value={text}
          rows={1}
          placeholder="Nachricht an den Assistenten …"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send(text);
            }
          }}
          aria-label="Nachricht an den Assistenten"
        />
        <button type="submit" className="btn btn--primary chat__send" disabled={busy || !text.trim()} aria-label="Senden">
          <Icon name="send" size={18} />
        </button>
      </form>
    </Sheet>
  );
}

const isRead = (r: ActionResult) => r.action.startsWith('get_');
