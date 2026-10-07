/*
 * Scrapbook service worker.
 *
 * In plain words: once Scrapbook is added to an Android phone's Home Screen, it shows up in the
 * phone's Share menu. When someone shares a picture to it, the phone sends that picture here
 * (a POST to /scrapbook/share-target). This file catches it, tucks the picture away in a small
 * cache, and opens the scrapbook at ?shared=1. The page then picks the picture up and opens the
 * cutout window.
 *
 * Everything else goes to the network as usual. Nothing is cached for offline use (yet).
 */
const SHARE_CACHE = 'scrapbook-share';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-target')) e.respondWith(takeShare(e.request));
});

async function takeShare(request){
  const base = new URL('./', self.registration.scope);
  try {
    const form = await request.formData();
    const files = form.getAll('image').filter(f => f && typeof f !== 'string' && f.type && f.type.startsWith('image/'));
    const text = k => (typeof form.get(k) === 'string' ? form.get(k) : '').slice(0, 500);
    const cache = await caches.open(SHARE_CACHE);
    for (const k of await cache.keys()) await cache.delete(k); // only keep the newest share
    for (let i = 0; i < files.length; i++){
      await cache.put(new URL('shared/' + i, base), new Response(files[i], { headers:{ 'content-type':files[i].type } }));
    }
    const meta = { count:files.length, title:text('title'), text:text('text'), url:text('url'), at:Date.now() };
    await cache.put(new URL('shared/meta', base), new Response(JSON.stringify(meta), { headers:{ 'content-type':'application/json' } }));
    return Response.redirect(new URL('?shared=1', base).href, 303);
  } catch (e){
    return Response.redirect(new URL('?shared=error', base).href, 303);
  }
}
