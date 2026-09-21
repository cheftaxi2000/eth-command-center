/**
 * AI proxy for the ETH Study Command Center.
 *
 * The app sends { messages, contextText, tools } (see src/lib/ai/provider.ts) and expects
 * { text, calls } back. This Worker holds the API key, talks to the provider and translates
 * between the two formats. It never executes anything itself – the app validates and runs the
 * returned calls through its own action layer.
 *
 * Provider is picked from the key itself, so switching is just `wrangler secret put` again:
 *   gsk_…  → Groq            (OpenAI-compatible)
 *   AIza…  → Google Gemini   (its OpenAI-compatible endpoint)
 */

const PROVIDERS = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash' },
};

const MAX_BODY = 200_000; // bytes – the app's context is a few KB; anything bigger is not from the app

function providerFor(key) {
  if (key.startsWith('gsk_')) return PROVIDERS.groq;
  if (key.startsWith('AIza')) return PROVIDERS.gemini;
  return null;
}

/** App param types → JSON Schema. Formats go into the description so the model gets them right. */
function toSchema(p) {
  const hint = {
    date: ' (Format JJJJ-MM-TT)',
    datetime: ' (Format JJJJ-MM-TTTHH:MM)',
    due: ' (Format JJJJ-MM-TT oder JJJJ-MM-TTTHH:MM)',
    subject: ' (Fachname oder Fach-Id)',
    id: ' (Id aus dem Kontext)',
  }[p.type] ?? '';
  const type = p.type === 'boolean' ? 'boolean' : p.type === 'integer' ? 'integer' : 'string';
  return { type, description: p.description + hint, ...(p.values ? { enum: p.values } : {}) };
}

function toTools(tools = []) {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description + (t.needsConfirmation ? ' (Der Nutzer wird vorher um Bestätigung gebeten.)' : ''),
      parameters: {
        type: 'object',
        properties: Object.fromEntries(Object.entries(t.parameters ?? {}).map(([k, v]) => [k, toSchema(v)])),
        required: Object.entries(t.parameters ?? {}).filter(([, v]) => v.required).map(([k]) => k),
      },
    },
  }));
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(origin)) return json({ error: 'Origin not allowed' }, 403, {});
    const h = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405, h);

    if (env.LIMITER) {
      const who = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.LIMITER.limit({ key: who });
      if (!success) return json({ error: 'Zu viele Anfragen – kurz warten.' }, 429, h);
    }

    const key = env.AI_API_KEY;
    const provider = key && providerFor(key);
    if (!provider) return json({ error: 'AI_API_KEY fehlt oder ist weder ein Groq- (gsk_) noch ein Gemini-Schlüssel (AIza).' }, 500, h);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return json({ error: 'Anfrage zu gross' }, 413, h);
    let req;
    try {
      req = JSON.parse(raw);
    } catch {
      return json({ error: 'Kein gültiges JSON' }, 400, h);
    }
    if (!Array.isArray(req.messages)) return json({ error: 'messages fehlt' }, 400, h);

    // The app's system prompt comes first; the live app context goes right after it.
    const messages = req.messages
      .filter((m) => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-30);
    const firstUser = messages.findIndex((m) => m.role !== 'system');
    messages.splice(firstUser < 0 ? messages.length : firstUser, 0, {
      role: 'system',
      content: `Aktueller Stand der App:\n\n${String(req.contextText ?? '').slice(0, 60_000)}`,
    });

    const tools = toTools(req.tools);
    const upstream = await fetch(provider.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: env.MODEL || provider.model,
        messages,
        ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
        temperature: 0.2,
      }),
    });

    if (!upstream.ok) {
      // Pass the status on, but not the provider's raw body (it can echo request details).
      return json({ error: `AI-Anbieter antwortet mit ${upstream.status}` }, 502, h);
    }

    const data = await upstream.json();
    const msg = data?.choices?.[0]?.message ?? {};
    const calls = (msg.tool_calls ?? [])
      .map((c) => {
        try {
          return { action: c.function.name, params: JSON.parse(c.function.arguments || '{}') };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return json({ text: typeof msg.content === 'string' ? msg.content : '', calls }, 200, h);
  },
};
