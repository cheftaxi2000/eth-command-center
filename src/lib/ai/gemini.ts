import type { toolSpecs } from './actions';
import type { AIProvider, AIReply, AIRequest } from './provider';

/**
 * Gemini, called straight from the browser with the key the user typed into Settings.
 * Uses Google's OpenAI-compatible endpoint (CORS-enabled for this site – checked), so the same
 * request shape would also work for other OpenAI-compatible providers later.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODEL_KEY = 'eth-cc:ai-model';

type Spec = ReturnType<typeof toolSpecs>[number];

const HINT: Record<string, string> = {
  date: ' (Format JJJJ-MM-TT)',
  datetime: ' (Format JJJJ-MM-TTTHH:MM)',
  due: ' (Format JJJJ-MM-TT oder JJJJ-MM-TTTHH:MM)',
  subject: ' (Fachname oder Fach-Id)',
  id: ' (Id aus dem Kontext)',
};

/** App action specs → OpenAI "function" tools. Formats go into descriptions so the model gets them right. */
export function toOpenAITools(specs: Spec[]) {
  return specs.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description + (t.needsConfirmation ? ' (Der Nutzer wird vorher um Bestätigung gebeten.)' : ''),
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, p]) => [
            k,
            {
              type: p.type === 'boolean' ? 'boolean' : p.type === 'integer' ? 'integer' : 'string',
              description: p.description + (HINT[p.type] ?? ''),
              ...('values' in p && p.values ? { enum: p.values } : {}),
            },
          ]),
        ),
        required: Object.entries(t.parameters).filter(([, p]) => p.required).map(([k]) => k),
      },
    },
  }));
}

interface ChatCompletion {
  choices?: { message?: { content?: string | null; tool_calls?: { function?: { name?: string; arguments?: string } }[] } }[];
}

export function parseCompletion(data: ChatCompletion): AIReply {
  const msg = data.choices?.[0]?.message ?? {};
  const calls = (msg.tool_calls ?? []).flatMap((c) => {
    if (!c.function?.name) return [];
    try {
      return [{ action: c.function.name, params: JSON.parse(c.function.arguments || '{}') as Record<string, unknown> }];
    } catch {
      return [];
    }
  });
  return { text: typeof msg.content === 'string' ? msg.content.trim() : '', calls };
}

function buildBody(req: AIRequest, model: string) {
  const messages = [...req.messages];
  // Live app state goes right after the app's own system prompt, before the conversation.
  const at = messages.findIndex((m) => m.role !== 'system');
  messages.splice(at < 0 ? messages.length : at, 0, { role: 'system', content: `Aktueller Stand der App:\n\n${req.contextText}` });
  const tools = toOpenAITools(req.tools);
  return { model, messages, temperature: 0.2, ...(tools.length ? { tools, tool_choice: 'auto' } : {}) };
}

function storedModel(): string {
  try {
    return localStorage.getItem(MODEL_KEY) || DEFAULT_MODEL;
  } catch {
    return DEFAULT_MODEL;
  }
}

/** Google retires model names over time – if ours is gone, pick a current "flash" model once and remember it. */
async function findCurrentModel(key: string): Promise<string | null> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
  if (!res.ok) return null;
  const data = (await res.json()) as { models?: { name: string; supportedGenerationMethods?: string[] }[] };
  const usable = (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name.replace(/^models\//, ''));
  const pick = usable.find((n) => /^gemini-[\d.]+-flash$/.test(n)) ?? usable.find((n) => n.includes('flash') && !n.includes('lite')) ?? usable[0];
  if (pick) {
    try {
      localStorage.setItem(MODEL_KEY, pick);
    } catch {
      /* ignore */
    }
  }
  return pick ?? null;
}

function explain(status: number): string {
  if (status === 400 || status === 401 || status === 403) return 'Gemini lehnt den Schlüssel ab. Bitte in den Einstellungen prüfen.';
  if (status === 429) return 'Das Gratis-Kontingent von Gemini ist gerade erschöpft. Kurz warten oder morgen wieder.';
  return `Gemini antwortet mit Fehler ${status}.`;
}

export function geminiProvider(key: string): AIProvider {
  return {
    id: 'gemini',
    label: 'Gemini',
    async complete(req) {
      const send = (model: string) =>
        fetch(`${BASE}/openai/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(buildBody(req, model)),
        });

      let res: Response;
      try {
        res = await send(storedModel());
        if (res.status === 404) {
          const model = await findCurrentModel(key);
          if (model) res = await send(model);
        }
      } catch {
        throw new Error('Keine Verbindung zu Gemini.');
      }
      if (!res.ok) throw new Error(explain(res.status));
      return parseCompletion((await res.json()) as ChatCompletion);
    },
  };
}

/**
 * Speech → text for browsers without built-in dictation (see lib/voice.ts). Uses the native
 * generateContent endpoint, which takes audio inline; the result goes into the input field, the
 * user still decides whether to send it.
 */
export async function transcribeAudio(key: string, wavBase64: string): Promise<string> {
  const send = (model: string) =>
    fetch(`${BASE}/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: 'Transkribiere diese Sprachaufnahme wörtlich auf Deutsch. Gib nur den gesprochenen Text zurück, ohne Anführungszeichen oder Kommentar.' },
              { inline_data: { mime_type: 'audio/wav', data: wavBase64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      }),
    });

  let res: Response;
  try {
    res = await send(storedModel());
    if (res.status === 404) {
      const model = await findCurrentModel(key);
      if (model) res = await send(model);
    }
  } catch {
    throw new Error('Keine Verbindung zu Gemini.');
  }
  if (!res.ok) throw new Error(explain(res.status));
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
}
