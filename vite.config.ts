import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Content-Security-Policy for the production build. `connect-src` only allows the app itself and
 * kvdb.io (the token-free device sync) and Gemini (the assistant, with the key the user typed in) –
 * the app technically cannot talk to Notion or anywhere else.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://kvdb.io https://generativelanguage.googleapis.com",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
});

const stamp = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const BUILD_TIME = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} ${pad(stamp.getHours())}:${pad(stamp.getMinutes())}`;

// `base: './'` + HashRouter => the built app works under any sub-path (GitHub Pages) without rewrites.
export default defineConfig({
  base: './',
  define: { __BUILD_TIME__: JSON.stringify(BUILD_TIME) },
  // Tiny font subsets would otherwise be inlined as data: URLs, which the CSP (font-src 'self') blocks.
  // As files they load normally and are precached for offline use like the rest.
  build: { assetsInlineLimit: (file: string) => (file.endsWith('.woff2') ? false : undefined) },
  plugins: [
    react(),
    csp(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ETH Study Command Center',
        short_name: 'Studium',
        description: 'Persönliche Studienübersicht: Heute, To-dos, Fristen, Woche, Kurse.',
        lang: 'de',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: '#f6f5f1',
        theme_color: '#f6f5f1',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        shortcuts: [
          { name: 'Aufgaben', url: './#/tasks' },
          { name: 'Woche', url: './#/week' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // German text only needs the latin subsets – keeps the offline cache small
        globIgnores: ['**/*-{cyrillic,cyrillic-ext,greek,greek-ext,vietnamese}-*.woff2'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
