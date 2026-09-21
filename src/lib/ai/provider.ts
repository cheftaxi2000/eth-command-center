import type { ActionCall } from './actions';

/**
 * Everything provider-specific lives behind this one interface, so swapping the model later
 * (Groq, Gemini, Mistral, a local one – whatever ends up being free enough) means writing one
 * new `AIProvider` and changing one line in service.ts. Nothing else in the app knows or cares
 * which model answered.
 */

export type AIRole = 'system' | 'user' | 'assistant';
export interface AIMessage {
  role: AIRole;
  content: string;
}

export interface AIRequest {
  /** Conversation so far, oldest first. The system message is added by AIService. */
  messages: AIMessage[];
  /** Pre-rendered app context (see context.ts) – already trimmed to what this turn needs. */
  contextText: string;
  /** Callable actions, from actions.toolSpecs(). */
  tools: ReturnType<typeof import('./actions').toolSpecs>;
}

export interface AIReply {
  /** What to show the user. */
  text: string;
  /** Structured actions the model wants performed. Never executed by the provider itself. */
  calls: ActionCall[];
}

export interface AIProvider {
  readonly id: string;
  readonly label: string;
  complete(req: AIRequest): Promise<AIReply>;
}

/**
 * NO API KEY EVER LIVES IN THIS APP.
 *
 * This is a static site: anything in the bundle is public, so a key here would be a key given
 * away. The config below therefore has no field to put one in – it only knows a URL. That URL
 * points at a small server-side proxy (a serverless function is enough) which holds the key in
 * an environment variable, calls the model, and returns { text, calls }.
 *
 *   Browser ──► /api/ai (proxy, holds AI_API_KEY in env) ──► model provider
 *
 * Set it at build time with VITE_AI_PROXY_URL. Remember to add the proxy's origin to `connect-src`
 * in vite.config.ts – the CSP currently allows only the app itself and kvdb.io, so an un-listed
 * endpoint is blocked by the browser rather than silently working.
 */
export interface ProxyConfig {
  endpoint: string;
  id?: string;
  label?: string;
}

const KEY_LOOKING = /(^|[?&])(api[-_]?key|key|token|access[-_]?token)=/i;

export function httpProvider(cfg: ProxyConfig): AIProvider {
  if (KEY_LOOKING.test(cfg.endpoint)) {
    throw new Error('Der AI-Endpunkt darf keinen Schlüssel in der URL enthalten – der Schlüssel gehört auf den Server.');
  }
  return {
    id: cfg.id ?? 'proxy',
    label: cfg.label ?? 'AI über Server-Proxy',
    async complete(req) {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (!res.ok) throw new Error(`AI-Dienst antwortet mit Fehler ${res.status}.`);
      const data = (await res.json()) as Partial<AIReply>;
      return { text: typeof data.text === 'string' ? data.text : '', calls: Array.isArray(data.calls) ? data.calls : [] };
    },
  };
}

/** The endpoint configured for this build, if any. Absent = the app runs without a real model. */
export const configuredProxy = (): ProxyConfig | null =>
  import.meta.env.VITE_AI_PROXY_URL ? { endpoint: import.meta.env.VITE_AI_PROXY_URL } : null;
