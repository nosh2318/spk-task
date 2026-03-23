var CACHE_NAME = 'spk-v4256';
var URLS = ['/', '/index.html', '/index2.html'];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(URLS);
    }).then(function() { self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  // Only cache same-origin HTML files
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html'))) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
        // Serve cache first, update in background
        var fetchPromise = fetch(e.request).then(function(resp) {
          if (resp.ok) {
            var clone = resp.clone();
            caches.open(CACHE_NAME).then(function(cache) { cache.put(e.request, clone); });
          }
          return resp;
        }).catch(function() { return cached; });
        return cached || fetchPromise;
      })
    );
  }
});
