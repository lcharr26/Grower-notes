// Service worker: always try the network first and check every file with the
// server, so the phone never ends up mixing old and new versions of the app
// after an update. Whatever loads is kept, so the app still opens with no
// signal. Notes and photos live in IndexedDB, not here.

const CACHE = 'growers-notebook-app';
const NETWORK_TIMEOUT_MS = 5000; // patchy signal: fall back to the saved copy

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((value) => { clearTimeout(timer); resolve(value); }, (err) => { clearTimeout(timer); reject(err); });
  });
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // 'no-cache' asks the server whether the file changed, skipping any
      // stale copy in the browser's own cache.
      const response = await withTimeout(fetch(request, { cache: 'no-cache' }), NETWORK_TIMEOUT_MS);
      if (response.ok) cache.put(request, response.clone());
      return response;
    } catch (err) {
      const saved = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
      if (saved) return saved;
      throw err;
    }
  })());
});
