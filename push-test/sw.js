// 通知テスト専用（2026-11-10）。キャッシュは持たない。届いた通知を出すだけ。
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data.json();}catch(_){d={title:'通知テスト',body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'通知テスト',{body:d.body||'',icon:'icon.png',badge:'icon.png',data:{url:d.url||'./'},requireInteraction:true}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(self.clients.matchAll({type:'window'}).then(cs=>{for(const c of cs){if('focus'in c)return c.focus();}return self.clients.openWindow(e.notification.data.url||'./');}));});
