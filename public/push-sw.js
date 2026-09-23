/*
 * Web Push for reminders of important to-dos (sent by scripts/notify/send-reminders.mjs).
 * Pulled into the generated service worker via workbox `importScripts` (vite.config.ts).
 */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Studium', {
      body: data.body || '',
      tag: data.tag,
      icon: 'icons/icon-192.png',
      data: { url: data.url || './#/tasks' },
    }),
  );
});

// Tap on the notification: bring the open app to the front (on the task list), or open it.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './#/tasks', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if ('focus' in w) {
          await w.focus();
          try {
            await w.navigate(url);
          } catch {
            /* focus is enough */
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
