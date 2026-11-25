/* TESSELLA service worker — makes the installed game work offline and update itself.
 * Every build writes a new VERSION, so browsers notice the change and swap workers. */
const VERSION = '__VERSION__';
const CACHE = 'tessella-' + VERSION;
const CORE = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('tessella-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The game page: newest from the network when it answers quickly (that is how updates arrive),
// otherwise the copy saved on the device; a slow download still finishes in the background and is
// used on the next launch.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  if (isPage) {
    const net = fetch(req, { cache: 'no-cache' }).then(async (res) => {
      if (res.ok) {
        const c = await caches.open(CACHE);
        await c.put('./', res.clone());
      }
      return res;
    });
    e.waitUntil(net.then(() => undefined, () => undefined));
    e.respondWith((async () => {
      const cached = await caches.match('./');
      if (!cached) return net;
      const timeout = new Promise((r) => setTimeout(() => r(null), 4000));
      const fresh = await Promise.race([net.catch(() => null), timeout]);
      return fresh && fresh.ok ? fresh : cached;
    })());
    return;
  }
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then(async (res) => {
      if (res.ok && url.pathname.includes('/icons/')) (await caches.open(CACHE)).put(req, res.clone());
      return res;
    })),
  );
});
