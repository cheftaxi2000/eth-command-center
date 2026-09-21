# AI-Proxy (Cloudflare Worker)

Hält den API-Key, damit er nie in der App landet. Einmalig einrichten (im Ordner `worker/`):

```bash
npx wrangler login
npx wrangler deploy
npx wrangler secret put AI_API_KEY
```

Beim letzten Befehl den Schlüssel einfügen – die Eingabe ist unsichtbar und landet verschlüsselt bei
Cloudflare. Groq-Schlüssel (`gsk_…`) und Gemini-Schlüssel (`AIza…`) werden automatisch erkannt.
Schlüssel wechseln = denselben Befehl nochmal ausführen.

`deploy` gibt die Adresse aus (`https://eth-ai.<name>.workers.dev`) – die kommt als
`VITE_AI_PROXY_URL` in den Build der App.
