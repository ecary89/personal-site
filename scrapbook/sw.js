/*
 * Old Scrapbook service worker, kept so phones that added Scrapbook to their Home Screen
 * before the rename keep working.
 *
 * Pictures shared from an old install still arrive here (a POST to /scrapbook/share-target).
 * This file hands them to Kamira the same way the new worker does, then opens /kamira/.
 * Everything else goes to the network, where /scrapbook/ forwards to /kamira/.
 */
const SHARE_CACHE = 'scrapbook-share';
const KAMIRA = new URL('/kamira/', self.location);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) e.respondWith(takeShare(e.request));
});

async function takeShare(request){
  try {
    const form = await request.formData();
    const files = form.getAll('image').filter(f => f && typeof f !== 'string' && f.type && f.type.startsWith('image/'));
    const text = k => (typeof form.get(k) === 'string' ? form.get(k) : '').slice(0, 500);
    const cache = await caches.open(SHARE_CACHE);
    for (const k of await cache.keys()) await cache.delete(k);
    for (let i = 0; i < files.length; i++){
      await cache.put(new URL('shared/' + i, KAMIRA), new Response(files[i], { headers:{ 'content-type':files[i].type } }));
    }
    const meta = { count:files.length, title:text('title'), text:text('text'), url:text('url'), at:Date.now() };
    await cache.put(new URL('shared/meta', KAMIRA), new Response(JSON.stringify(meta), { headers:{ 'content-type':'application/json' } }));
    return Response.redirect(new URL('?shared=1', KAMIRA).href, 303);
  } catch (e){
    return Response.redirect(new URL('?shared=error', KAMIRA).href, 303);
  }
}
