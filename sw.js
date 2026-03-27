var CACHE_NAME = 'spk-v440';
var URLS = ['/', '/index.html', '/index2.html', '/app.js'];
var CDN_CACHE = 'spk-cdn-v1';
var CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

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
      return Promise.all(keys.filter(function(k) { return k !== CACHE_NAME && k !== CDN_CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // CDN scripts: cache-first (stale-while-revalidate)
  if (CDN_HOSTS.some(function(h) { return url.hostname === h; })) {
    e.respondWith(
      caches.open(CDN_CACHE).then(function(cache) {
        return cache.match(e.request).then(function(cached) {
          var fetchPromise = fetch(e.request).then(function(resp) {
            if (resp.ok) { cache.put(e.request, resp.clone()); }
            return resp;
          }).catch(function() { return cached; });
          return cached || fetchPromise;
        });
      })
    );
    return;
  }

  // Same-origin assets: cache-first with background update
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname === '/app.js')) {
    e.respondWith(
      caches.match(e.request).then(function(cached) {
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
