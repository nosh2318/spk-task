// ★ SPK Service Worker — 自己破棄型 (2026-08-14 再導入)
//   目的: 「バージョンが上がらない（古いapp.jsが出続ける）」キャッシュ問題の根治。
//   install → 即 skipWaiting / activate → 全キャッシュ削除 ＋ SW登録解除 ＋ (初回のみ)全画面リロード。
//   fetch ハンドラは持たない = 全リクエストがネットワーク直 = キャッシュ由来の旧版が二度と出ない。
//   ※ ループ防止: キャッシュが有った初回だけ reload。以降(キャッシュ空)は unregister のみで reload しない。
//   ※ 全端末が最新化して落ち着いたら、必要なら cache-first 版に戻してよい。
const SW_V = '982';

self.addEventListener('install', function(){ self.skipWaiting(); });

self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try{
      var keys = await caches.keys();
      var had = keys.length > 0;
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
      try{ await self.registration.unregister(); }catch(_e){}
      if (had){
        var cs = await self.clients.matchAll({ type: 'window' });
        cs.forEach(function(c){ try{ c.navigate(c.url); }catch(_e){} });
      }
    }catch(_e){}
  })());
});
// fetch を介入しない = 常にネットワーク = 常に最新
