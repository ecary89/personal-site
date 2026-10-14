/* Kamira cloud screens: sign-in on the profile, the Public switch in Share, and the feed.
   The work behind them (saving, publishing, the picture check) is in cloud.js. */
const CloudUI = (() => {
  const needSignIn = msg => toast(msg, { label:'Sign in', run:() => Cloud.signIn() });

  /* ---------- Profile: who you are, and where your stories are kept ---------- */
  function profileWho(who){
    if (!Cloud.on) return;
    const u = Cloud.user;
    who.innerHTML = '';
    if (!u){
      const b = el('button', 'btn primary sign-in'); b.innerHTML = GOOGLE_G + 'Sign in with Google';
      b.onclick = () => Cloud.signIn();
      const pv = el('a', 'privacy-link', 'Privacy'); pv.href = 'privacy.html';
      who.append(el('b', null, 'You'), el('span', null, 'Saved in this browser'), b, pv);
    } else {
      const out = el('button', 'link-btn', 'Sign out'); out.onclick = () => Cloud.signOut();
      const pv = el('a', 'link-btn', 'Privacy'); pv.href = 'privacy.html';
      const line = el('span'); line.append('Saved to your account · ', out, ' · ', pv);
      who.append(el('b', null, Cloud.name), line);
    }
  }
  const GOOGLE_G = '<svg class="i g-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-7.9Z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1-3.7 1-2.9 0-5.3-1.9-6.2-4.5H2.1V17A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.8 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8l3.7-2.8Z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4Z"/></svg>';

  /* ---------- Share: the Public switch for this page ---------- */
  function shareSection(p, cover){
    if (!Cloud.on || cover) return null;
    const sec = el('div', 'share-public');
    const draw = () => {
      sec.innerHTML = '';
      const post = Cloud.postOf(p), isOn = !!post;
      const row = el('button', 'pub-row'); row.setAttribute('role', 'switch'); row.setAttribute('aria-checked', String(isOn));
      row.append(el('span', 'pub-label', 'Show in the Kamira feed'), el('span', 'switch'));
      row.onclick = () => isOn ? goPrivate() : goPublic();
      sec.append(el('h3', null, 'Kamira feed'), row);
      if (isOn){
        const acts = el('div', 'pub-acts');
        if (post.hidden) acts.append(el('span', 'pub-note', 'Hidden while we take a look'));
        const upd = el('button', 'btn'); upd.innerHTML = icon('upload') + 'Update';
        upd.onclick = () => run(upd, 'Update');
        const view = el('button', 'btn'); view.innerHTML = icon('people') + 'See it';
        view.onclick = () => { feedStart = { mode:'mine', open:post.id }; openView('community'); };
        acts.append(upd, view); sec.append(acts);
      }
    };
    const goPrivate = async () => {
      try { await Cloud.unpublish(p); toast('This page is private again'); } catch (e){ toast('Couldn\'t change that. Try again.'); }
      draw();
    };
    const goPublic = () => {
      if (!Cloud.user){ sec.innerHTML = ''; const b = el('button', 'btn primary sign-in'); b.innerHTML = GOOGLE_G + 'Sign in with Google'; b.onclick = () => Cloud.signIn();
        const back = el('button', 'btn', 'Not now'); back.onclick = draw;
        const r = el('div', 'pub-acts'); r.append(back, b);
        sec.append(el('h3', null, 'Sign in to share pages'), r); return; }
      if (store.get('kamira-public-ok') !== '1'){ rules(); return; }
      run(null, 'Post');
    };
    // The first time: the content rule, and confirming they're 13 or older
    const rules = () => {
      sec.innerHTML = '';
      const box = el('div', 'pub-rules');
      box.append(el('h3', null, 'Before you share'), el('p', null, 'Kamira has one rule for public pages: nothing explicit. If you\'re not sure about a page, keep it private.'));
      const lab = el('label', 'pub-check'); const cb = el('input'); cb.type = 'checkbox'; lab.append(cb, el('span', null, 'I\'m 13 or older'));
      const cancel = el('button', 'btn', 'Cancel'); cancel.onclick = draw;
      const go = el('button', 'btn primary', 'Make public'); go.disabled = true; cb.onchange = () => { go.disabled = !cb.checked; };
      go.onclick = () => { store.set('kamira-public-ok', '1'); track('publish_rules_ok'); run(null, 'Post'); };
      const r = el('div', 'pub-acts'); r.append(cancel, go);
      box.append(lab, r); sec.append(box);
    };
    const run = async (btn, verb) => {
      sec.innerHTML = '';
      const msg = el('p', 'pub-busy', 'Checking pictures…'); sec.append(el('h3', null, 'Kamira feed'), msg);
      try {
        const r = await Cloud.publish(p, s => { msg.textContent = s === 'check' ? 'Checking pictures…' : verb === 'Update' ? 'Updating…' : 'Posting…'; });
        if (!r.ok){
          draw();
          sec.append(el('p', 'pub-warn', 'This page can\'t be public. One of your pictures may break the no-explicit rule.'));
          return;
        }
        toast(verb === 'Update' ? 'Updated in the feed' : 'Your page is in the feed');
      } catch (e){ console.warn(e); toast('Couldn\'t post right now. Try again in a bit.'); }
      draw();
    };
    draw();
    return sec;
  }

  /* ---------- The feed ---------- */
  let feedStart = null; // open the feed on a tab, or straight to one page
  function fillFeed(box){
    const start = feedStart || {}; feedStart = null;
    let mode = start.mode || 'all', posts = [], more = true, loading = false, gridTop = 0;
    track('feed_open', { mode });
    const wrap = el('div', 'feed');
    const tabs = el('div', 'seg feed-tabs'); tabs.setAttribute('role', 'group'); tabs.setAttribute('aria-label', 'Show');
    const grid = el('div', 'feed-grid');
    const foot = el('div', 'feed-foot');
    const detail = el('div', 'feed-detail'); detail.hidden = true;
    const list = el('div', 'feed-list'); list.append(tabs, grid, foot);
    wrap.append(list, detail); box.append(wrap);

    const drawTabs = () => {
      tabs.innerHTML = '';
      const t = [['all', 'Everyone'], ['mine', 'Yours']]; if (Cloud.admin) t.push(['hidden', 'Hidden']);
      t.forEach(([m, label]) => { const b = el('button', null, label); b.setAttribute('aria-pressed', String(mode === m)); b.onclick = () => { if (mode === m) return; mode = m; reload(); }; tabs.append(b); });
    };
    const card = post => {
      const c = el('button', 'feed-card'); c.setAttribute('aria-label', (post.page && post.page.title) || `A page by ${post.author || 'someone'}`);
      const im = el('img'); im.src = post.image; im.alt = ''; im.loading = 'lazy'; im.decoding = 'async';
      if (post.w && post.h) im.style.aspectRatio = post.w + ' / ' + post.h;
      const meta = el('span', 'feed-meta'); meta.append(el('span', null, post.author || 'Someone'));
      if (post.hearts) { const h = el('span', 'feed-hearts'); h.innerHTML = icon('heart', 2) + post.hearts; meta.append(h); }
      c.append(im, meta); c.onclick = () => openPost(post);
      return c;
    };
    const empty = () => {
      const msg = mode === 'mine' ? (Cloud.user ? 'None of your pages are public yet. Use Share on a page to add it.' : 'Sign in to see your public pages.')
        : mode === 'hidden' ? 'Nothing is hidden. All clear.' : 'Nothing here yet. Use Share on a page to be the first.';
      foot.append(el('p', 'empty-note', msg));
      if (mode === 'mine' && !Cloud.user){ const b = el('button', 'btn primary sign-in'); b.innerHTML = GOOGLE_G + 'Sign in with Google'; b.onclick = () => Cloud.signIn(); foot.append(b); }
    };
    async function loadMore(){
      if (loading || !more) return; loading = true;
      foot.innerHTML = ''; foot.append(el('p', 'empty-note', 'Loading…'));
      try {
        const got = await Cloud.feed({ mode, before:posts.length ? posts[posts.length - 1].created_at : null });
        posts.push(...got); got.forEach(p => grid.append(card(p))); more = got.length >= 24;
        foot.innerHTML = '';
        if (!posts.length) empty();
        if (start.open){ const p = posts.find(x => x.id === start.open); start.open = null; if (p) openPost(p); }
      } catch (e){
        console.warn(e); foot.innerHTML = '';
        const again = el('button', 'btn', 'Try again'); again.onclick = () => { loadMore(); };
        foot.append(el('p', 'empty-note', 'The feed didn\'t load.'), again);
      }
      loading = false;
    }
    function reload(){ posts = []; more = true; grid.innerHTML = ''; drawTabs(); loadMore(); }
    // Load more when the bottom comes into view
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting) && detail.hidden) loadMore(); }, { root:box, rootMargin:'400px' });
    io.observe(foot);

    function openPost(post){
      gridTop = box.scrollTop;
      list.hidden = true; detail.hidden = false; detail.innerHTML = '';
      track('feed_open_post', { mine:post.mine });
      const back = el('button', 'icon-btn feed-back'); back.innerHTML = icon('left', 2); back.setAttribute('aria-label', 'Back to the feed');
      back.onclick = closePost;
      const fig = el('div', 'feed-big'); const im = el('img'); im.src = post.image; im.alt = (post.page && post.page.title) || 'A Kamira page';
      if (post.w && post.h) im.style.aspectRatio = post.w + ' / ' + post.h;
      fig.append(im);
      const side = el('div', 'feed-side');
      const pg = post.page || {};
      if (pg.title) side.append(el('h3', 'feed-title', pg.title));
      if (pg.story) side.append(el('p', 'feed-story', pg.story));
      side.append(el('p', 'feed-by', 'By ' + (post.author || 'someone')));
      const acts = el('div', 'feed-acts');
      const use = el('button', 'btn primary'); use.innerHTML = icon('plus', 2) + 'Use these pieces';
      use.onclick = async () => {
        use.disabled = true;
        try { await Cloud.usePieces(post); closeSheet(); toast('Added a page with these pieces'); }
        catch (e){ console.warn(e); use.disabled = false; toast('Couldn\'t copy those pieces. Try again.'); }
      };
      const heart = el('button', 'btn heart-toggle');
      const drawHeart = () => { heart.setAttribute('aria-pressed', String(!!post.hearted)); heart.innerHTML = icon('heart', 2) + (post.hearts || 0); heart.setAttribute('aria-label', (post.hearted ? 'Remove heart' : 'Heart this page') + `, ${post.hearts || 0}`); };
      heart.onclick = async () => {
        if (!Cloud.user){ needSignIn('Sign in to heart pages'); return; }
        const on = !post.hearted; post.hearted = on; post.hearts = Math.max(0, (post.hearts || 0) + (on ? 1 : -1)); drawHeart();
        try { await Cloud.heart(post, on); } catch (e){ post.hearted = !on; post.hearts += on ? -1 : 1; drawHeart(); toast('Couldn\'t save that heart. Try again.'); }
      };
      drawHeart();
      acts.append(heart, use);
      side.append(acts);
      // Smaller actions: report someone else's page; remove your own; restore a hidden one
      const small = el('div', 'feed-small');
      const smallBtns = [];
      if (!post.mine){
        const rep = el('button', 'link-btn', 'Report');
        rep.onclick = () => {
          if (!Cloud.user){ needSignIn('Sign in to report a page'); return; }
          small.innerHTML = '';
          const yes = el('button', 'link-btn strong', 'Report it'), no = el('button', 'link-btn', 'Cancel');
          yes.onclick = async () => {
            try { await Cloud.report(post); toast('Thanks. We\'ll take a look.'); dropPost(post); closePost(); }
            catch (e){ toast('Couldn\'t send that. Try again.'); }
          };
          no.onclick = drawSmall;
          small.append(el('span', null, 'Report this page as explicit?'), yes, no);
        };
        smallBtns.push(rep);
      }
      if (Cloud.admin && post.hidden){
        const rs = el('button', 'link-btn strong', 'Restore');
        rs.onclick = async () => { try { await Cloud.restore(post); post.hidden = false; toast('Restored to the feed'); dropPost(post); closePost(); } catch (e){ toast('Couldn\'t restore it.'); } };
        smallBtns.push(rs);
      }
      if (post.mine || Cloud.admin){
        const rm = el('button', 'link-btn', post.mine ? 'Remove from feed' : 'Delete');
        rm.onclick = async () => {
          try { await Cloud.removePost(post); toast(post.mine ? 'Removed from the feed' : 'Deleted'); dropPost(post); closePost(); }
          catch (e){ toast('Couldn\'t remove it. Try again.'); }
        };
        smallBtns.push(rm);
      }
      function drawSmall(){ small.innerHTML = ''; small.append(...smallBtns); }
      drawSmall();
      side.append(small);
      const body = el('div', 'feed-post'); body.append(fig, side);
      detail.append(back, body);
      box.scrollTop = 0;
      back.focus({ preventScroll:true });
    }
    function closePost(){ detail.hidden = true; detail.innerHTML = ''; list.hidden = false; box.scrollTop = gridTop; }
    function dropPost(post){ const i = posts.indexOf(post); if (i >= 0){ posts.splice(i, 1); grid.children[i] && grid.children[i].remove(); } if (!posts.length){ foot.innerHTML = ''; empty(); } }

    drawTabs(); loadMore();
    const off = Cloud.onChange(() => { if (sheetKind === 'community') reload(); else off(); });
  }

  /* ---------- "Save your work": a small note in the corner once someone has made something ----------
     Only while signed out. Closing it hides it for a week. */
  let upsell = null;
  function makeUpsell(){ // built on first use: the app's helpers (el, icon, store) load after this file
    upsell = el('div', 'save-upsell'); upsell.hidden = true; upsell.setAttribute('role', 'complementary'); upsell.setAttribute('aria-label', 'Save your work');
    const go = el('button', 'save-upsell-go'); go.innerHTML = '<b>Save your work</b><span>Create an account</span>';
    go.onclick = () => { track('upsell_click'); Cloud.signIn(); };
    const x = el('button', 'save-upsell-x'); x.innerHTML = icon('close', 2); x.setAttribute('aria-label', 'Hide');
    x.onclick = () => { store.set('kamira-upsell-hidden', String(Date.now())); track('upsell_hide'); drawUpsell(); };
    upsell.append(go, x);
    document.body.append(upsell);
  }
  let madeSomething = false;
  const upsellSnoozed = () => Date.now() - Number(store.get('kamira-upsell-hidden') || 0) < 7 * 864e5;
  function drawUpsell(){
    const show = Cloud.on && !Cloud.user && madeSomething && !upsellSnoozed();
    if (!upsell){ if (!show) return; makeUpsell(); }
    if (show && upsell.hidden) track('upsell_show');
    upsell.hidden = !show;
    document.body.classList.toggle('has-upsell', show);
  }
  if (Cloud.on){
    Cloud.onEdit(() => { madeSomething = true; drawUpsell(); });
    Cloud.onChange(drawUpsell);
  }

  // When the account changes, redraw whatever is open that shows it
  if (Cloud.on) Cloud.onChange(() => { if (sheetKind === 'profile' || sheetKind === 'share') openView(sheetKind); });

  return { profileWho, shareSection, fillFeed, openFeed(o){ feedStart = o || null; openView('community'); } };
})();
