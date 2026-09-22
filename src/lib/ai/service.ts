import { ACTIONS, executeAction, runConfirmed, toolSpecs, type ActionCall, type ActionResult } from './actions';
import { buildAIContext, formatAIContext, type AIContext, type AIContextOptions } from './context';
import { DAY_LONG, addDays, parseLocal } from '../time';
import { geminiProvider } from './gemini';
import { getAIKey } from './key';
import { mockProvider } from './mock';
import { configuredProxy, httpProvider, type AIMessage, type AIProvider } from './provider';

/**
 * The one place that ties model, context and actions together:
 *
 *   Nachricht → frischer App-Context → Provider → strukturierte Calls → Validierung
 *             → Action-Layer → Store → UI/Sync aktualisieren
 *
 * The context is rebuilt on every send(), never reused from a previous turn – that is what keeps
 * the assistant from answering with data that was true two minutes ago.
 */

export interface AITurn {
  /** The assistant's own words. */
  reply: string;
  /** Actions that ran, in order, each with a message safe to show the user. */
  performed: ActionResult[];
  /** Destructive actions waiting for a yes. Pass one to confirm() to run it. */
  pending: { call: ActionCall; question: string }[];
  /** When the context behind this answer was built. */
  contextAt: string;
}

const SYSTEM = [
  'Du bist der Assistent einer persönlichen Studien-App (Deutsch, Schweiz).',
  'Antworte kurz und konkret. Nutze ausschliesslich die aufgeführten Aktionen, um etwas zu ändern.',
  'Erfinde nie Aufgaben, Notizen oder Termine, die nicht im Kontext stehen.',
  'Verwende für Aufgaben und Notizen immer die Ids aus dem Kontext.',
  'Datumsangaben immer als JJJJ-MM-TT bzw. JJJJ-MM-TTTHH:MM.',
  'Fragen beantwortest du direkt aus dem Kontext – dafür brauchst du keine get_-Aktion.',
  'Nach einer Änderung bestätigst du in einem kurzen Satz, was du getan hast.',
  'Formatiere mit einfachem Markdown: kurze Listen, **fett** für Zeiten, Räume und Fristen. Keine Überschriften bei kurzen Antworten.',
  'Für Lernpläne nutze die freien Zeitfenster (free) aus dem Stundenplan und die nächsten Fristen.',
].join(' ');

/** Today's date as the very first thing the model reads – so "morgen" can never be a question. */
function systemPrompt(ctx: AIContext, extra?: string): string {
  const d = ctx.dynamic.today;
  const tomorrow = addDays(parseLocal(d.date), 1);
  const anchor = `Heute ist ${d.weekday}, ${d.date}, ${d.time} Uhr (Europe/Zurich, KW ${d.isoWeek}). Morgen ist ${DAY_LONG[tomorrow.getDay()]}, ${toIso(tomorrow)}.`;
  return [anchor, SYSTEM, extra].filter(Boolean).join('\n\n');
}
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Tools actually offered to the model. Lookups whose data is already in the context (tasks,
 * schedule, subjects, study time) are left out: offered, a model tends to "look up" instead of
 * answering. get_notes stays – note texts are not in the context.
 */
const modelTools = () => toolSpecs().filter((t) => !t.readOnly || t.name === 'get_notes');

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  get providerLabel() {
    return this.provider.label;
  }

  /** One user turn. History is optional; the caller owns the conversation. */
  async send(userText: string, history: AIMessage[] = [], ctxOpts: AIContextOptions = {}): Promise<AITurn> {
    const context = buildAIContext(ctxOpts); // rebuilt here, every single time
    const conversation: AIMessage[] = [...history.filter((m) => m.role !== 'system'), { role: 'user', content: userText }];
    const messages: AIMessage[] = [{ role: 'system', content: systemPrompt(context) }, ...conversation];

    const reply = await this.provider.complete({ messages, contextText: formatAIContext(context), tools: modelTools() });

    const performed: ActionResult[] = [];
    const pending: AITurn['pending'] = [];
    for (const call of reply.calls) {
      const result = executeAction(call);
      if (result.needsConfirmation) pending.push({ call, question: result.message });
      else performed.push(result);
    }

    // A model that only looked something up (get_tasks …) often says nothing yet. Hand it the
    // results once more – without tools, so it can only answer, not act again.
    let text = reply.text;
    const reads = performed.filter((r) => r.ok && ACTIONS[r.action]?.readOnly);
    if (!text && reads.length > 0 && pending.length === 0) {
      const results = reads.map((r) => `${r.action}: ${JSON.stringify(r.data)}`).join('\n').slice(0, 30_000);
      const second = await this.provider.complete({
        // Results go into the one system prompt; the user's question stays the last message.
        messages: [{ role: 'system', content: systemPrompt(context, `Ergebnisse deiner Abfragen:\n${results}\nBeantworte damit die letzte Frage des Nutzers.`) }, ...conversation],
        contextText: formatAIContext(context),
        tools: [],
      });
      text = second.text;
    }
    return { reply: text, performed, pending, contextAt: context.generatedAt };
  }

  /** Run something the user just said yes to. Validated again – confirmation is not a bypass. */
  confirm(call: ActionCall): ActionResult {
    return runConfirmed(call);
  }
}

/**
 * The service to use right now: a server proxy if one is configured at build time, otherwise
 * Gemini with the key saved in THIS browser, otherwise the rule-based mock – so the assistant
 * always answers something, and gets smart as soon as a key is entered. Built per use, so a key
 * entered in Settings takes effect immediately.
 */
export function createAIService(): AIService {
  const proxy = configuredProxy();
  if (proxy) return new AIService(httpProvider(proxy));
  const key = getAIKey();
  return new AIService(key ? geminiProvider(key) : mockProvider());
}

/** Demo/test entry point: one sentence in, the full pipeline out, with no model involved. */
export function mockAI(text: string, now?: () => Date): Promise<AITurn> {
  return new AIService(mockProvider(now)).send(text, [], now ? { now: now() } : {});
}
