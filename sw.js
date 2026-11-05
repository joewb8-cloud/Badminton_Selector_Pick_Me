const CACHE = "badminton-v2";
const FILES = ["./", "./index.html", "./style.css", "./app.js", "./manifest.json",
               "./icon-192.png", "./icon-512.png"];
self.addEventListener("install", e => {
  // Cache files one by one so a single missing file can't break installation
  e.waitUntil(caches.open(CACHE).then(c =>
    Promise.all(FILES.map(f => c.add(f).catch(() => console.warn("Not cached:", f))))));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
