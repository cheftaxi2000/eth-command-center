import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createAIService, transcribeAudio } from '../lib/ai';
import { chat, getChat, historyForModel, useChat, type ChatEntry } from '../lib/ai/chat';
import { useAIKey } from '../lib/ai/key';
import { toPlainText } from '../lib/markdown';
import { startDictation, voiceMode, type Dictation, type VoiceState } from '../lib/voice';
import { Markdown } from './Markdown';
import { Icon, cx } from './ui';
import { useUI } from './ui-context';

/** `fill`: puts the text into the field instead of sending – nothing gets created by one stray tap. */
const SUGGESTIONS: { text: string; hint: string; fill?: boolean }[] = [
  { text: 'Was muss ich diese Woche noch machen?', hint: 'Offene Aufgaben und Fristen' },
  { text: 'Ich habe morgen zwei Stunden Zeit. Was soll ich lernen?', hint: 'Lernplan aus deinen freien Lücken' },
  { text: 'Was habe ich morgen?', hint: 'Stundenplan mit Räumen' },
  { text: 'Neue Aufgabe für Analysis bis Freitag: ', hint: 'Aufgabe per Satz anlegen – du schreibst weiter', fill: true },
];

/** Full-screen assistant, like a normal chatbot. Only mounted while open. */
export function Assistant() {
  const ui = useUI();
  if (!ui.assistantOpen) return null;
  return <AssistantScreen onClose={() => ui.setAssistantOpen(false)} />;
}

function AssistantScreen({ onClose }: { onClose: () => void }) {
  const entries = useChat();
  const key = useAIKey();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dictation = useRef<Dictation | null>(null);
  const before = useRef('');
  const mode = voiceMode(!!key);

  // Lock the page behind, focus the input, Esc closes (or first stops a running dictation)
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.setTimeout(() => inputRef.current?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (dictation.current) dictation.current.stop();
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
      dictation.current?.stop();
    };
  }, [onClose]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length, busy]);

  // Grow the input with its content (up to ~6 lines), also where CSS field-sizing is missing
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  useEffect(() => {
    if (voice !== 'listening') return;
    setSeconds(0);
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [voice]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || busy) return;
    dictation.current?.stop();
    const history = historyForModel(getChat());
    chat.add({ role: 'user', text: message });
    setText('');
    setBusy(true);
    try {
      // Built per message: uses a key entered a moment ago and builds fresh app context
      const turn = await createAIService().send(message, history);
      const changed = turn.performed.filter((r) => !r.action.startsWith('get_'));
      const reply = turn.reply || (changed.length === 0 && turn.pending.length === 0 ? 'Dazu habe ich keine Antwort.' : '');
      chat.add({ role: 'assistant', text: reply, done: changed, pending: turn.pending });
    } catch (err) {
      chat.add({ role: 'assistant', text: err instanceof Error ? err.message : String(err), error: true });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const answer = (entryId: string, index: number, yes: boolean) => {
    const p = getChat().find((e) => e.id === entryId)?.pending?.[index];
    if (!p || p.resolved) return;
    const result = yes ? createAIService().confirm(p.call) : null; // once, outside any state updater
    chat.update(entryId, (e) => ({
      ...e,
      pending: e.pending?.map((q, i) => (i === index ? { ...q, resolved: yes ? ('yes' as const) : ('no' as const) } : q)),
      done: result ? [...(e.done ?? []), result] : e.done,
    }));
  };

  const toggleMic = () => {
    if (dictation.current) {
      dictation.current.stop();
      return;
    }
    setVoiceError(null);
    before.current = text.trim() ? `${text.trimEnd()} ` : '';
    dictation.current = startDictation(
      {
        onText: (t, final) => {
          setText(`${before.current}${t}`);
          if (final) {
            dictation.current = null;
            inputRef.current?.focus();
          }
        },
        onState: (s) => {
          setVoice(s);
          if (s === 'idle') dictation.current = null;
        },
        onError: setVoiceError,
      },
      key ? (wav) => transcribeAudio(key, wav) : undefined,
    );
  };

  const copy = async (e: ChatEntry) => {
    try {
      await navigator.clipboard.writeText(toPlainText(e.text));
      setCopied(e.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked – text stays selectable */
    }
  };

  const fillInput = (value: string) => {
    setText(value);
    window.setTimeout(() => {
      const el = inputRef.current;
      el?.focus();
      el?.setSelectionRange(value.length, value.length);
    }, 0);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(text);
  };

  const listening = voice === 'listening';
  const micTitle =
    mode === 'none' ? 'Diktieren geht in diesem Browser nicht – in Chrome, Edge oder Safari schon.'
    : listening ? 'Aufnahme beenden' : 'Diktieren';

  return (
    <div className="asst" role="dialog" aria-modal="true" aria-label="Assistent">
      <header className="asst__bar">
        <div className="asst__title">
          <span className="asst__avatar" aria-hidden="true"><Icon name="spark" size={18} /></span>
          <div>
            <strong>Assistent</strong>
            <span className="asst__status">
              {key ? (
                <><span className="asst__dot asst__dot--on" />Gemini</>
              ) : (
                <><span className="asst__dot" />Regel-Modus · <Link to="/settings#ai" onClick={onClose}>Gemini einrichten</Link></>
              )}
            </span>
          </div>
        </div>
        <div className="asst__actions">
          {entries.length > 0 && (
            <button type="button" className="btn btn--sm asst__new" onClick={() => chat.clear()} disabled={busy}>
              <Icon name="plus" size={16} />Neuer Chat
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Assistent schließen"><Icon name="close" /></button>
        </div>
      </header>

      <div className="asst__scroll" ref={scrollRef}>
        <div className="asst__col">
          {entries.length === 0 && (
            <div className="asst__welcome">
              <span className="asst__avatar asst__avatar--big" aria-hidden="true"><Icon name="spark" size={26} /></span>
              <h1>Was steht an?</h1>
              <p>Frag nach deinem Plan, lass dir beim Lernen helfen oder leg Aufgaben und Notizen per Satz an – getippt oder gesprochen.</p>
              <div className="asst__suggest">
                {SUGGESTIONS.map((s) => (
                  <button key={s.text} type="button" className="asst__card" onClick={() => (s.fill ? fillInput(s.text) : void send(s.text))}>
                    <span className="asst__card-text">{s.text}</span>
                    <span className="asst__card-hint">{s.hint}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((e) =>
            e.role === 'user' ? (
              <div key={e.id} className="msg msg--user"><div className="msg__bubble">{e.text}</div></div>
            ) : (
              <div key={e.id} className="msg msg--bot">
                <span className="asst__avatar" aria-hidden="true"><Icon name="spark" size={16} /></span>
                <div className="msg__body">
                  {e.error ? <p className="msg__error"><Icon name="alert" size={16} />{e.text}</p> : e.text && <Markdown text={e.text} />}
                  {e.pending?.map((p, i) => (
                    <div key={i} className="msg__confirm">
                      <p>{p.question}</p>
                      {p.resolved ? (
                        <p className="msg__resolved">{p.resolved === 'yes' ? 'Bestätigt.' : 'Abgebrochen – nichts gelöscht.'}</p>
                      ) : (
                        <div className="btn-row">
                          <button type="button" className="btn btn--sm" onClick={() => answer(e.id, i, false)}>Nein</button>
                          <button type="button" className="btn btn--sm btn--danger" onClick={() => answer(e.id, i, true)}>Ja, löschen</button>
                        </div>
                      )}
                    </div>
                  ))}
                  {e.done?.map((r, i) => (
                    <p key={i} className={cx('msg__done', !r.ok && 'msg__done--fail')}>
                      <Icon name={r.ok ? 'check' : 'alert'} size={15} />{r.message}
                    </p>
                  ))}
                  {!e.error && e.text && (
                    <div className="msg__tools">
                      <button type="button" className="msg__tool" onClick={() => void copy(e)} aria-label="Antwort kopieren">
                        <Icon name={copied === e.id ? 'check' : 'copy'} size={15} />{copied === e.id ? 'Kopiert' : 'Kopieren'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}

          {busy && (
            <div className="msg msg--bot">
              <span className="asst__avatar" aria-hidden="true"><Icon name="spark" size={16} /></span>
              <div className="msg__typing" aria-label="Assistent schreibt"><span /><span /><span /></div>
            </div>
          )}
        </div>
      </div>

      <footer className="asst__foot">
        <div className="asst__col">
          {voiceError && <p className="asst__voice-error" role="alert">{voiceError}</p>}
          <form className={cx('asst__composer', listening && 'is-listening')} onSubmit={submit}>
            <textarea
              ref={inputRef}
              className="asst__input"
              value={text}
              rows={1}
              placeholder={listening ? 'Sprich jetzt …' : voice === 'transcribing' ? 'Wird umgeschrieben …' : 'Nachricht an den Assistenten'}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send(text);
                }
              }}
              aria-label="Nachricht an den Assistenten"
            />
            <div className="asst__buttons">
              {listening && <span className="asst__rec" aria-live="polite"><span className="asst__rec-dot" />{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span>}
              {voice === 'transcribing' && <span className="asst__rec">Schreibe um …</span>}
              <button type="button" className={cx('asst__mic', listening && 'is-on')} onClick={toggleMic}
                disabled={mode === 'none' || voice === 'transcribing'} title={micTitle} aria-label={micTitle} aria-pressed={listening}>
                <Icon name={listening ? 'stop' : 'mic'} size={20} />
              </button>
              <button type="submit" className="asst__send" disabled={busy || !text.trim()} aria-label="Senden">
                <Icon name="arrow-up" size={20} />
              </button>
            </div>
          </form>
          <p className="asst__note">Kann sich irren – jede Änderung siehst du sofort in der App. Enter sendet, Shift+Enter neue Zeile.</p>
        </div>
      </footer>
    </div>
  );
}
