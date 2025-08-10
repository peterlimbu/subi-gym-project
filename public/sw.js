
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open('mewtwo-cache-v1').then(cache => cache.addAll(['/','/manifest.webmanifest'])));
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request).catch(() => new Response('Offline', {status:200, headers:{'Content-Type':'text/plain'}})))
  );
});
