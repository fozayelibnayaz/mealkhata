// Cache public application files only. Private API responses are NEVER cached here.
const CACHE='mealkhata-shell-v3';
const PRECACHE=[]; // Replaced with hashed public assets at build time.
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(['/','/workspace','/app-icon.svg','/manifest.webmanifest',...PRECACHE])));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).catch(()=>caches.match('/workspace')));return;}
 if(url.pathname.startsWith('/assets/')||url.pathname.startsWith('/fonts/')||url.pathname==='/app-icon.svg'){event.respondWith(caches.open(CACHE).then(async cache=>{const saved=await cache.match(req,{ignoreVary:true});if(saved)return saved;const response=await fetch(req);if(response.ok)await cache.put(req,response.clone());return response;}));}
});
