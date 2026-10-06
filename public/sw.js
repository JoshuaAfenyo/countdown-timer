// Offline support. Online: pages load fresh from the network (and the saved copy is refreshed).
// Offline or slow: the saved copy loads instead.
// Change CACHE only when you add or rename files in PRECACHE. Edits to existing files are picked up automatically.
const CACHE = "countdown-timer-v1";
const PRECACHE = ["/", "/display", "/manifest.json", "/icon-192.png", "/icon-512.png"];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE.map(u => new Request(u, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// /index.html and /display.html are saved under their clean paths ("/" and "/display").
function keyFor(req) {
  return new URL(req.url).pathname.replace(/\/index\.html$/, "/").replace(/\.html$/, "");
}
// A page can't be served from a response that was marked as redirected, so rebuild it without the mark.
function clean(res) {
  return res.redirected ? new Response(res.body, { status: res.status, statusText: res.statusText, headers: res.headers }) : res;
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(handle(e, req));
});

async function handle(e, req) {
  const cache = await caches.open(CACHE);
  const key = keyFor(req);
  const network = fetch(req).then(res => {
    if (res.ok && !res.redirected) cache.put(key, res.clone());
    return res;
  });
  e.waitUntil(network.catch(() => {}));
  try {
    return await Promise.race([network, new Promise((_, reject) => setTimeout(reject, NETWORK_TIMEOUT_MS))]);
  } catch (err) {
    const hit = await cache.match(key);
    return hit ? clean(hit) : network;
  }
}
