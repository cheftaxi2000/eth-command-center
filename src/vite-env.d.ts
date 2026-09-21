/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Build timestamp, injected by vite.config.ts – shows which version is installed */
declare const __BUILD_TIME__: string;

interface ImportMetaEnv {
  /** Overrides the built-in shared sync code at build time (see lib/sync.ts) */
  readonly VITE_SYNC_BUCKET?: string;
  /** Endpoint of the server-side AI proxy; no API key ever lives in the bundle (see lib/ai/provider.ts) */
  readonly VITE_AI_PROXY_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
