// Minimaler Service Worker (macht die Seite installierbar). Nichts wird zwischengespeichert, Updates kommen immer direkt.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
