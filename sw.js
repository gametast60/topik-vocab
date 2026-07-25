const CACHE = "vocab-v5.4.0";
const FILES = [
  "index.html","style.css","refresh-loading.css",
  "app.js","game.js","navigation.js",
  "flashcard1.js","flashcard2.js","flashcard_en_a1.js","flashcard_en_a2.js","flashcard_en_b1.js","flashcard_en_b2.js",
  "srs.js","manifest.json", "vocab_editor.js","icon-192.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});