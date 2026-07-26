// ★ SPK Service Worker — バージョン付きキャッシュ (2026-07-12)
//   目的: スマホ起動高速化。app.js(1.5MB)とCDN(react/react-dom/supabase/tailwind)を
//   cache-first でキャッシュ。SW_V が上がったら旧キャッシュを全削除→新規取得。
//
//   ★ 絶対ルール:
//     - index.html / index2.html は絶対にキャッシュしない(常にネットワーク=常に最新版)
//       → 7/10「古いJS配信バグ」を原理的に排除
//     - キャッシュキー(CACHE)に SW_V を含める → 版更新で自動入れ替え
//     - キャッシュ対象は app.js?v=<版> と 下記CDN のみ
//
//   ★ 更新手順: index.src.html の SW登録 ./sw.js?v=<版> を上げたら、この SW_V も同じ値に合わせる
const SW_V = '893';
const CACHE = 'spk-precache-' + SW_V;

// 現行版の app.js とCDNをプリキャッシュ対象にする(SW_V と同値)
const APP_URL = './app.js?v=' + SW_V;
const CDN_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css'
];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      // 各URLを個別にadd(1つ失敗しても全体を止めない)
      return Promise.all([APP_URL].concat(CDN_URLS).map(function(u){
        return c.add(new Request(u, {mode: u.indexOf('http')===0 ? 'cors' : 'same-origin'})).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      // 自分(CACHE)以外の旧キャッシュは全削除 → 版更新で古いapp.jsを掃除
      return Promise.all(keys.filter(function(k){return k !== CACHE;}).map(function(k){return caches.delete(k);}));
    }).then(function(){ return self.clients.claim(); })
  );
});

// キャッシュ対象判定: app.js(?v=付き) と 指定CDN のみ。index.html等は素通し。
function isCacheable(url){
  if (/\/app\.js(\?|$)/.test(url)) return true;
  if (url.indexOf('cdnjs.cloudflare.com/ajax/libs/react/') >= 0) return true;
  if (url.indexOf('cdnjs.cloudflare.com/ajax/libs/react-dom/') >= 0) return true;
  if (url.indexOf('cdn.jsdelivr.net/npm/@supabase/supabase-js') >= 0) return true;
  if (url.indexOf('cdnjs.cloudflare.com/ajax/libs/tailwindcss/') >= 0) return true;
  return false;
}

self.addEventListener('fetch', function(e){
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = req.url;
  if (!isCacheable(url)) return; // index.html/API/その他は一切介入せずネットワーク素通し
  e.respondWith(
    caches.match(req).then(function(hit){
      if (hit) return hit; // cache-first(版が同じ間は即ヒット=激速)
      return fetch(req).then(function(res){
        if (res && (res.ok || res.type === 'opaque')) {
          var clone = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, clone); }).catch(function(){});
        }
        return res;
      });
    })
  );
});
