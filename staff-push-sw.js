// 個別URL（staff.html）専用の通知SW（2026-11-10）。scope は staff.html だけ。キャッシュの横取りはしない（fetch ハンドラなし）。
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('push',e=>{let d={};try{d=e.data.json();}catch(_){d={title:'HANDYMAN',body:e.data?e.data.text():''};}
  e.waitUntil(self.registration.showNotification(d.title||'HANDYMAN',{body:d.body||'',icon:'push-test/icon.png',badge:'push-test/icon.png',requireInteraction:true})
   .then(()=>self.registration.getNotifications()).then(ns=>{try{return self.navigator.setAppBadge&&self.navigator.setAppBadge(ns.length||1);}catch(_){}}));});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil((async()=>{
  const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const c of cs){if(/staff\.html/.test(c.url)&&'focus'in c)return c.focus();}
  let url='staff.html';try{const r=await caches.match('/__staff_push_me');if(r)url=await r.text();}catch(_){}
  return self.clients.openWindow(url);})());});
