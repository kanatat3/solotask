const CACHE_NAME = "kodo-v3";
// ไลบรารีจาก CDN ที่แอปใช้ (three.js สำหรับสัตว์เลี้ยง 3D) — เก็บ cache ครั้งแรกที่โหลด แล้วใช้ออฟไลน์ได้
const RUNTIME_CACHE_PREFIXES = ["https://cdnjs.cloudflare.com/ajax/libs/three.js/"];
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// network-first for navigations so users get the latest app on reload,
// falling back to the cached shell when offline
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }
  if (RUNTIME_CACHE_PREFIXES.some((p) => e.request.url.startsWith(p))) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then((c) => c.put(e.request, copy)); }
        return res;
      }))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => cached || fetch(e.request))
  );
});
