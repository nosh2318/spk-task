// 自己破棄型 Service Worker — 過去のキャッシュ型SWが端末に居座り「更新が反映されない」を根絶。
// install: 即時有効化 / activate: 全キャッシュ削除→自身を登録解除→開いている全タブを再読込。
// 以降キャッシュを一切持たないので、常にネットワークから最新を取得する。
self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){
  e.waitUntil((async function(){
    try{
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }catch(_){}
    try{ await self.registration.unregister(); }catch(_){}
    try{
      var cs = await self.clients.matchAll({ type: 'window' });
      cs.forEach(function(c){ try{ c.navigate(c.url); }catch(_){} });
    }catch(_){}
  })());
});
