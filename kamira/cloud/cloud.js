/* Kamira cloud: Google sign-in, saving stories to your account, and the public feed.

   In plain words:
   - Signed out, Kamira works like before: everything stays in this browser.
   - Signed in, your stories and cutouts also save to your account (Supabase), so clearing
     the browser or switching computers doesn't lose them. They stay private.
   - Any page can be made public from Share. Before it goes public, the pictures people
     added themselves get a quick explicit-picture check, right here in the browser
     (shop pieces and Kamira's paintings are skipped, they're known to be fine).
   - The feed shows public pages. People can heart them, report them, or "Use these pieces"
     to start a page of their own. 2 reports hide a page until an admin looks.

   Everything is off until KAMIRA_CLOUD below has the project's link and public key.
   Setup steps: kamira/cloud/SETUP.md. Database rules: kamira/cloud/setup.sql. */

// Supabase > Project Settings > API: "Project URL" and the "anon public" key. Both are safe to publish.
const KAMIRA_CLOUD = { url:'', key:'' };

const Cloud = (() => {
  const cfg = window.KAMIRA_CLOUD_TEST || KAMIRA_CLOUD;
  const on = !!(cfg.url && cfg.key);
  const here = document.currentScript && document.currentScript.src ? new URL('.', document.currentScript.src).href : 'cloud/';
  let sb = null, user = null, admin = false, readyP = null;
  // Wait for this browser's own saved stories to load before mixing in the account's
  let localDone, pristine = null; const localP = new Promise(r => { localDone = r; });
  // found: this browser had saved stories. If not, remember the sample story as it started,
  // so we can tell later whether anyone has touched it.
  const localLoaded = found => {
    if (!localDone) return;
    if (!found) pristine = bookHash(book);
    else if (!user) editListeners.forEach(f => { try { f(); } catch (e){} }); // they've made things before: offer to save them
    localDone(); localDone = null;
  };
  const listeners = new Set();
  const changed = () => listeners.forEach(f => { try { f(user); } catch (e){ console.warn(e); } });
  const loadScript = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s);
  });

  /* ---------------- Sign-in ---------------- */
  function start(){
    if (!on) return Promise.resolve(null);
    return readyP || (readyP = (async () => {
      if (!window.supabase) await loadScript(here + 'vendor/supabase.js');
      sb = window.supabase.createClient(cfg.url, cfg.key, { auth:{ flowType:'pkce', persistSession:true, autoRefreshToken:true, detectSessionInUrl:true } });
      const { data } = await sb.auth.getSession();
      await setUser(data && data.session);
      // Don't call Supabase inside this callback (it can lock up); hop out first
      sb.auth.onAuthStateChange((ev, s) => setTimeout(() => setUser(s), 0));
      return sb;
    })().catch(e => { console.warn('Kamira cloud is off:', e); return null; }));
  }
  async function setUser(session){
    const next = session && session.user || null;
    if ((next && next.id) === (user && user.id)){ user = next; return; }
    user = next; admin = false; myPosts = new Map(); marks = null;
    changed();
    if (!user) return;
    let justSignedIn = false;
    try { justSignedIn = sessionStorage.getItem('kamira-signing-in') === '1'; sessionStorage.removeItem('kamira-signing-in'); } catch (e){}
    if (justSignedIn){ track('cloud_sign_in'); toast('Signed in. Your stories now save to your account.'); }
    try { const { data } = await sb.rpc('is_admin'); admin = data === true; } catch (e){}
    try { await loadMine(); } catch (e){ console.warn(e); }
    await localP;
    if (!user || user.id !== next.id) return;
    await pull();
    changed();
  }
  async function signIn(){
    await start();
    if (!sb){ toast('Sign-in isn\'t working right now. Try again in a bit.'); return; }
    try { sessionStorage.setItem('kamira-signing-in', '1'); } catch (e){}
    track('cloud_sign_in_start');
    // Save first, so nothing is lost while we're away at Google
    try { syncLibrary(); await DB.set('state', { v:2, active:book.id, books:library, user:[...USER.values()] }); } catch (e){}
    const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo:location.origin + location.pathname } });
    if (error) toast('Sign-in didn\'t start. Try again.');
  }
  async function signOut(){
    if (!sb) return;
    await push().catch(() => {});
    await sb.auth.signOut();
    toast('Signed out. Your stories stay in this browser too.');
  }
  const firstName = () => {
    const m = user && user.user_metadata || {};
    return (m.given_name || (m.full_name || m.name || '').split(' ')[0] || 'Someone').slice(0, 30);
  };

  /* ---------------- Saving to your account ---------------- */
  // What this browser has already saved to the account, so we only send what changed:
  // books: { id: { h:fingerprint, u:when saved } or 'deleted' }, cuts: { id: fingerprint }
  let marks = null;
  async function loadMarks(){ const all = await DB.get('cloud').catch(() => null) || {}; marks = all[user.id] || { books:{}, cuts:{} }; }
  async function saveMarks(){ if (!user || !marks) return; const all = await DB.get('cloud').catch(() => null) || {}; all[user.id] = marks; await DB.set('cloud', all).catch(() => {}); }
  const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36) + ':' + s.length; };
  const bookHash = b => hash(JSON.stringify({ t:b.title, p:b.pages, c:b.cover }));
  const cutKey = u => (u.t || 0) + ':' + (u.src ? u.src.length : 0);
  const mimeOf = src => (/^data:([^;,]+)/.exec(src) || [])[1] || 'image/webp';
  const extOf = src => ({ 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' })[mimeOf(src)] || 'webp';
  const toBlob = src => fetch(src).then(r => r.blob());
  const toDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  const metaOf = u => { const { src, orig, cutState, ...m } = u; return m; };

  // Bring down what's in the account. Pictures first, so pages show them right away.
  let pulling = null;
  async function pull(){
    if (!user || !sb) return;
    if (pulling) return pulling;
    pulling = (async () => {
      await loadMarks();
      let any = false, openChanged = false;
      const { data:cuts, error:e1 } = await sb.from('cutouts').select('id,meta,path,updated,deleted');
      if (e1) throw e1;
      for (const r of cuts || []){
        if (r.deleted || !r.path) continue;
        const local = USER.get(r.id);
        if (local && (local.t || 0) >= r.updated){ if (!marks.cuts[r.id]) marks.cuts[r.id] = cutKey(local); continue; }
        const { data:blob, error } = await sb.storage.from('private').download(r.path);
        if (error || !blob) continue;
        const src = await toDataUrl(blob);
        const u = { ...r.meta, id:r.id, src, orig:src, t:r.updated };
        USER.set(r.id, u); marks.cuts[r.id] = cutKey(u); any = true;
      }
      const { data:rows, error:e2 } = await sb.from('books').select('id,data,updated,deleted');
      if (e2) throw e2;
      for (const r of rows || []){
        const i = library.findIndex(b => b.id === r.id), local = library[i], m = marks.books[r.id];
        const unsynced = local && (!m || m === 'deleted' || m.h !== bookHash(local)); // changed here since the last save to the account
        const newer = !m || m === 'deleted' || r.updated > m.u;                        // changed somewhere else since then
        if (r.deleted){
          if (local && !unsynced){ library.splice(i, 1); if (r.id === book.id) openChanged = true; any = true; }
          if (!local || !unsynced) marks.books[r.id] = 'deleted';
          continue;
        }
        if (!local){ library.push({ ...r.data, id:r.id, updated:r.updated }); marks.books[r.id] = { h:bookHash(r.data), u:r.updated }; any = true; continue; }
        if (!newer) continue;
        if (bookHash(r.data) === bookHash(local)){ marks.books[r.id] = { h:bookHash(local), u:r.updated }; continue; }
        if (unsynced){
          // Changed in both places: keep this browser's version, and add the account's as a copy
          const copy = { ...r.data, id:newBookId(), title:(r.data.title || 'Untitled') + ' (other device)', updated:r.updated };
          library.push(copy); any = true;
          marks.books[r.id] = { h:'', u:r.updated }; // so this browser's version saves over it
        } else {
          library[i] = { ...r.data, id:r.id, updated:r.updated }; marks.books[r.id] = { h:bookHash(r.data), u:r.updated };
          if (r.id === book.id) openChanged = true; any = true;
        }
      }
      // A browser with nothing saved yet (just the sample story): show the account's stories instead
      const untouched = pristine && library.filter(b => b.id !== book.id).length === 0 && bookHash(book) === pristine;
      pristine = null;
      if (untouched && (rows || []).some(r => !r.deleted)){
        const keep = new Set((rows || []).filter(r => !r.deleted).map(r => r.id));
        library = library.filter(b => keep.has(b.id));
        const newest = [...library].sort((a, c) => (c.updated || 0) - (a.updated || 0))[0];
        await saveMarks();
        loadBookInto(newest); afterSwitch();
        return;
      }
      await saveMarks();
      if (any){
        if (openChanged || !library.some(b => b.id === book.id)){
          const b = library.find(x => x.id === book.id) || [...library].sort((a, c) => (c.updated || 0) - (a.updated || 0))[0];
          loadBookInto(b || blankBook()); afterSwitch();
        } else { renderAll(); refreshViews(); scheduleSave(); }
      } else pushSoon();
    })();
    try { await pulling; } catch (e){ console.warn('Kamira: couldn\'t load from your account', e); } finally { pulling = null; }
  }

  // Send what changed. Called a moment after every save.
  let pushTimer = null, pushing = false, again = false, failures = 0;
  const editListeners = new Set();
  function pushSoon(delay = 2500){
    if (!user){ editListeners.forEach(f => { try { f(); } catch (e){} }); return; } // signed out: just let the "Save your work" note know
    clearTimeout(pushTimer); pushTimer = setTimeout(() => push().catch(() => {}), delay);
  }
  async function push(){
    if (!user || !sb) return;
    await localP;
    if (pulling){ pushSoon(); return; }
    if (pushing){ again = true; return; }
    pushing = true;
    try {
      if (!marks) await loadMarks();
      syncLibrary();
      for (const u of [...USER.values()]){
        if (!u.src || !u.src.startsWith('data:')) continue;
        const k = cutKey(u); if (marks.cuts[u.id] === k) continue;
        const path = `${user.id}/cutouts/${u.id}.${extOf(u.src)}`;
        const up = await sb.storage.from('private').upload(path, await toBlob(u.src), { upsert:true, contentType:mimeOf(u.src) });
        if (up.error) throw up.error;
        const { error } = await sb.from('cutouts').upsert({ user_id:user.id, id:u.id, meta:metaOf(u), path, updated:u.t || Date.now(), deleted:false });
        if (error) throw error;
        marks.cuts[u.id] = k; await saveMarks();
      }
      const now = Date.now(), rows = [];
      for (const b of library){ const h = bookHash(b), m = marks.books[b.id]; if (!m || m === 'deleted' || m.h !== h) rows.push({ b, h }); }
      // Books saved before but no longer here were deleted in this browser
      const gone = Object.keys(marks.books).filter(id => marks.books[id] !== 'deleted' && !library.some(b => b.id === id));
      const upserts = [...rows.map(({ b }) => ({ user_id:user.id, id:b.id, data:b, updated:now, deleted:false })),
        ...gone.map(id => ({ user_id:user.id, id, data:{}, updated:now, deleted:true }))];
      if (upserts.length){
        const { error } = await sb.from('books').upsert(upserts);
        if (error) throw error;
        rows.forEach(({ b, h }) => { marks.books[b.id] = { h, u:now }; });
        gone.forEach(id => { marks.books[id] = 'deleted'; });
        await saveMarks();
      }
      failures = 0;
    } catch (e){
      failures++; console.warn('Kamira: couldn\'t save to your account yet', e);
      pushSoon(Math.min(120000, 5000 * 2 ** failures));
    } finally {
      pushing = false;
      if (again){ again = false; pushSoon(500); }
    }
  }

  /* ---------------- The explicit-picture check (runs in this browser) ---------------- */
  const Safety = {
    model:null, loading:null,
    load(){
      return this.loading || (this.loading = (async () => {
        if (!window.tf) await loadScript(here + 'vendor/tf.min.js');
        if (!window.nsfwjs) await loadScript(here + 'vendor/nsfwjs.min.js');
        this.model = await window.nsfwjs.load(here + 'vendor/nsfw-model/model.json');
      })().catch(e => { this.loading = null; throw e; }));
    },
    // Scores for one picture: { Porn, Hentai, Sexy, Drawing, Neutral }, each 0 to 1
    async score(src){
      const im = await loadImage(src);
      const S = 224, c = document.createElement('canvas'); c.width = c.height = S;
      const x = c.getContext('2d'); x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, S, S); // see-through parts become white, not black
      const k = S / Math.max(im.naturalWidth, im.naturalHeight), w = im.naturalWidth * k, h = im.naturalHeight * k;
      x.drawImage(im, (S - w) / 2, (S - h) / 2, w, h);
      const preds = await this.model.classify(c, 5);
      return Object.fromEntries(preds.map(p => [p.className, p.probability]));
    },
    // Tested on all 243 of Kamira's own pictures (Oct 2026): none flagged; the closest scored .44 (a sticker).
    flagged(s){ return (s.Porn || 0) + (s.Hentai || 0) >= .6 || (s.Sexy || 0) >= .85; },
    // true if any picture looks explicit
    async check(srcs){
      if (!srcs.length) return false;
      await this.load();
      for (const src of srcs){ if (this.flagged(await this.score(src))) return true; }
      return false;
    },
  };

  /* ---------------- Making a page public ---------------- */
  let myPosts = new Map(); // your public pages, by page key
  const POST_FIELDS = 'id,user_id,author,image,w,h,page,pieces,hearts,hidden,created_at,updated_at,page_key';
  async function loadMine(){
    const { data, error } = await sb.from('posts').select('id,page_key,image,pieces,hidden,hearts,created_at,updated_at').eq('user_id', user.id);
    if (error) throw error;
    myPosts = new Map((data || []).map(p => [p.page_key, p]));
  }
  const postOf = p => p && p.pid && myPosts.get(p.pid) || null;
  // Pictures on the page that this person added themselves (not shop pieces or Kamira's paintings)
  const ownPictures = p => [...new Set([p.scene, ...(p.items || []).map(it => it.value)].filter(v => typeof v === 'string' && USER.has(v)))];
  const publicUrl = path => sb.storage.from('public').getPublicUrl(path).data.publicUrl;
  const filesOf = post => [post.image, ...Object.values(post.pieces || {}).map(pc => pc.src)].map(u => pathOf(u)).filter(Boolean);
  const pathOf = url => { const m = /\/object\/public\/public\/(.+)$/.exec(url || ''); return m ? decodeURIComponent(m[1].split('?')[0]) : null; };

  async function publish(p, step = () => {}){
    if (!user) throw new Error('signed out');
    step('check');
    const ids = ownPictures(p);
    if (await Safety.check(ids.map(id => USER.get(id).src))){ track('publish_blocked'); return { ok:false, why:'pictures' }; }
    step('post');
    if (!p.pid){ p.pid = 'pg_' + uid() + uid(); scheduleSave(); }
    const before = myPosts.get(p.pid), id = before ? before.id : crypto.randomUUID();
    // The page as a picture, 1000 wide (big enough for the feed, small enough to load fast)
    const full = await renderPageImage(p, false), W = 1000, H = Math.round(full.height * W / full.width);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; cv.getContext('2d').drawImage(full, 0, 0, W, H);
    const jpg = await new Promise(res => cv.toBlob(res, 'image/jpeg', .86));
    const stamp = Date.now().toString(36), imgPath = `${user.id}/posts/${id}-${stamp}.jpg`;
    const up = await sb.storage.from('public').upload(imgPath, jpg, { contentType:'image/jpeg', upsert:true });
    if (up.error) throw up.error;
    // Your own pictures on the page go public too, so "Use these pieces" can use them
    const pieces = {};
    for (const aid of ids){
      const u = USER.get(aid), path = `${user.id}/pieces/${id}-${stamp}/${aid}.${extOf(u.src)}`;
      const r = await sb.storage.from('public').upload(path, await toBlob(u.src), { contentType:mimeOf(u.src), upsert:true });
      if (r.error) throw r.error;
      const { name, brand, price, url, w, h, kind, cut, tags } = u;
      pieces[aid] = { src:publicUrl(path), name, brand, price, url, w, h, kind, cut, tags };
    }
    const row = { author:firstName(), page_key:p.pid, image:publicUrl(imgPath), w:W, h:H,
      page:{ scene:p.scene, sat:p.sat, title:p.title || '', story:p.story || '', items:p.items }, pieces };
    const q = before ? sb.from('posts').update(row).eq('id', id) : sb.from('posts').insert({ id, user_id:user.id, ...row });
    const { data, error } = await q.select('id,page_key,image,pieces,hidden,hearts,created_at,updated_at').single();
    if (error){ sb.storage.from('public').remove([imgPath, ...filesOf({ pieces })]); throw error; }
    if (before) sb.storage.from('public').remove(filesOf(before)); // the old picture and pieces
    myPosts.set(p.pid, data);
    syncLibrary(); push().catch(() => {}); // save the page's public marker to the account now, not in a few seconds
    track(before ? 'publish_update' : 'publish_page', { pictures:ids.length });
    return { ok:true, post:data };
  }
  async function unpublish(p){
    const post = postOf(p); if (!post) return;
    await removePost(post);
    track('unpublish_page');
  }
  async function removePost(post){
    const { error } = await sb.from('posts').delete().eq('id', post.id);
    if (error) throw error;
    sb.storage.from('public').remove(filesOf(post)).catch(() => {}); // its picture, and your own cutouts on it
    for (const [k, v] of myPosts) if (v.id === post.id) myPosts.delete(k);
  }

  /* ---------------- The feed ---------------- */
  async function feed({ mode = 'all', before = null, limit = 24 } = {}){
    await start();
    if (!sb) throw new Error('offline');
    let q = sb.from('posts').select(POST_FIELDS).order('created_at', { ascending:false }).limit(limit);
    if (mode === 'all') q = q.eq('hidden', false);
    else if (mode === 'mine') q = q.eq('user_id', user ? user.id : '00000000-0000-0000-0000-000000000000');
    else if (mode === 'hidden') q = q.eq('hidden', true);
    if (before) q = q.lt('created_at', before);
    const { data, error } = await q;
    if (error) throw error;
    let hearted = new Set();
    if (user && data.length){
      const h = await sb.from('hearts').select('post_id').in('post_id', data.map(p => p.id));
      hearted = new Set((h.data || []).map(x => x.post_id));
    }
    return data.map(p => ({ ...p, hearted:hearted.has(p.id), mine:!!user && p.user_id === user.id }));
  }
  async function heart(post, on){
    const r = on ? await sb.from('hearts').insert({ post_id:post.id, user_id:user.id })
                 : await sb.from('hearts').delete().eq('post_id', post.id).eq('user_id', user.id);
    if (r.error && r.error.code !== '23505') throw r.error; // already hearted is fine
    track(on ? 'feed_heart' : 'feed_unheart');
  }
  async function report(post){
    const r = await sb.from('reports').insert({ post_id:post.id, user_id:user.id });
    if (r.error && r.error.code !== '23505') throw r.error; // already reported is fine
    track('feed_report');
  }
  async function restore(post){
    const { error } = await sb.from('posts').update({ hidden:false }).eq('id', post.id);
    if (error) throw error;
    track('feed_restore');
  }

  // "Use these pieces": a new page in your open story with the same background and pieces
  async function usePieces(post){
    const map = {};
    for (const [aid, pc] of Object.entries(post.pieces || {})){
      const id = 'f_' + post.id.slice(0, 8) + '_' + aid;
      if (!USER.has(id)){
        const blob = await fetch(pc.src).then(r => { if (!r.ok) throw new Error('picture'); return r.blob(); });
        const src = await toDataUrl(blob);
        const { src:_, ...meta } = pc;
        USER.set(id, { ...meta, id, src, orig:src, source:'feed', cut:pc.cut !== false, t:Date.now() });
        shareUser(USER.get(id));
      }
      map[aid] = id;
    }
    const pg = post.page || {}, groups = {};
    const scene = map[pg.scene] || (SCENES[pg.scene] ? pg.scene : 'blank');
    const items = (pg.items || []).map(it => {
      const c = { ...it, id:nextId++ };
      if (typeof c.value === 'string' && map[c.value]) c.value = map[c.value];
      if (c.group) c.group = groups[c.group] || (groups[c.group] = newGroupId());
      return c;
    }).filter(c => c.type !== 'photo' || asset(c.value));
    onCover = false;
    book.pages.splice(book.current + 1, 0, { scene, sat:pg.sat, title:'', story:'', items });
    goToPage(book.current + 1);
    commit(); scheduleSave();
    track('feed_use_pieces', { pieces:items.length });
  }

  // Leaving or hiding the tab: save what's waiting now
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && user && pushTimer){ clearTimeout(pushTimer); pushTimer = null; syncLibrary(); push().catch(() => {}); } });

  // Start right away if someone was signed in before (or is coming back from Google)
  if (on){
    let had = false;
    try { had = Object.keys(localStorage).some(k => /^sb-.*-auth-token/.test(k)) || /[?&]code=/.test(location.search); } catch (e){}
    if (had) start(); else setTimeout(start, 4000);
  }

  return {
    on, start, signIn, localLoaded, signOut, pushSoon, push, pull, publish, unpublish, removePost, postOf, ownPictures,
    feed, heart, report, restore, usePieces, Safety,
    get user(){ return user; }, get admin(){ return admin; }, get name(){ return firstName(); },
    onChange(f){ listeners.add(f); return () => listeners.delete(f); },
    onEdit(f){ editListeners.add(f); },
  };
})();
