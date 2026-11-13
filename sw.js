// Last Orders: works offline once loaded. Bump VERSION on every release.
const VERSION = "lo-v7";
const FILES = ["/", "/index.html", "/common.css", "/common.js", "/flying-pint.html", "/run.html", "/run3d.js", "/vendor/three.module.min.js", "/run-lite.html", "/darts.html", "/pop.html", "/pop.js", "/merge.html", "/merge.js", "/crush.html", "/crush.js", "/barman.html", "/barman.js", "/stack.html", "/stack.js", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin === location.origin) {
    // network first so updates show straight away, cache when offline
    e.respondWith(fetch(e.request).then((r) => { const c = r.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); return r; }).catch(() => caches.match(e.request).then((r) => r || caches.match("/"))));
  } else if (u.hostname.endsWith("gstatic.com") || u.hostname.endsWith("googleapis.com")) {
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request).then((n) => { const c = n.clone(); caches.open(VERSION).then((x) => x.put(e.request, c)); return n; })));
  }
});
