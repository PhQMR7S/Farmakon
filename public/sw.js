const SHELL='farmakon-shell-v3',DOWNLOADS='farmakon-downloads-v1';
self.addEventListener('install',e=>{e.waitUntil(caches.open(SHELL).then(c=>c.addAll(['/offline.html','/icon-192-v3.png','/icon-512-v3.png','/apple-touch-icon-v3.png'])));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('farmakon-shell-')&&key!==SHELL)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET')return;if(u.pathname==='/auth/logout'){e.waitUntil(caches.delete(DOWNLOADS));return}if(e.request.mode==='navigate')e.respondWith(fetch(e.request).catch(async()=>await caches.match('/offline.html')||new Response('Offline',{status:503})))});
self.addEventListener('message',e=>{if(e.data?.type==='CLEAR_DOWNLOADS')e.waitUntil(caches.delete(DOWNLOADS))});
