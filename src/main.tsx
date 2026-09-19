import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles.css';
import './components.css';
import { App } from './App';
import { toast } from './components/toast';
import { initSync } from './lib/sync';

// New version deployed → ask before reloading, so nothing you are typing gets lost
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    toast({ text: 'Neue Version verfügbar', action: { label: 'Aktualisieren', run: () => void updateSW(true) }, persistent: true });
  },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
    window.setInterval(check, 60 * 60_000);
  },
});

// Ask the browser not to evict our data (Safari clears storage of unused sites otherwise)
void navigator.storage?.persist?.().catch(() => {});

initSync();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
