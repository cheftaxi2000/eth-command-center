import { executeAction, runConfirmed, toolSpecs, type ActionCall, type ActionResult } from './actions';
import { buildAIContext, formatAIContext, type AIContextOptions } from './context';
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
].join(' ');

export class AIService {
  constructor(private readonly provider: AIProvider) {}

  get providerLabel() {
    return this.provider.label;
  }

  /** One user turn. History is optional; the caller owns the conversation. */
  async send(userText: string, history: AIMessage[] = [], ctxOpts: AIContextOptions = {}): Promise<AITurn> {
    const context = buildAIContext(ctxOpts); // rebuilt here, every single time
    const messages: AIMessage[] = [
      { role: 'system', content: SYSTEM },
      ...history,
      { role: 'user', content: userText },
    ];

    const reply = await this.provider.complete({ messages, contextText: formatAIContext(context), tools: toolSpecs() });

    const performed: ActionResult[] = [];
    const pending: AITurn['pending'] = [];
    for (const call of reply.calls) {
      const result = executeAction(call);
      if (result.needsConfirmation) pending.push({ call, question: result.message });
      else performed.push(result);
    }
    return { reply: reply.text, performed, pending, contextAt: context.generatedAt };
  }

  /** Run something the user just said yes to. Validated again – confirmation is not a bypass. */
  confirm(call: ActionCall): ActionResult {
    return runConfirmed(call);
  }
}

/**
 * The service this build uses: the real proxy when VITE_AI_PROXY_URL is set, otherwise the
 * rule-based mock, so the app is never in a broken state just because no model is connected yet.
 */
export function createAIService(): AIService {
  const proxy = configuredProxy();
  return new AIService(proxy ? httpProvider(proxy) : mockProvider());
}

/** Demo/test entry point: one sentence in, the full pipeline out, with no model involved. */
export function mockAI(text: string, now?: () => Date): Promise<AITurn> {
  return new AIService(mockProvider(now)).send(text, [], now ? { now: now() } : {});
}
