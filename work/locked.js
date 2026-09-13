// locked.js — opens the password-protected pages under /work in the browser.
//
// Two modes, picked by ECLock.init({ mode }):
//   'gate'  (/work/)            tries the password against every entry page in manifest.json
//                               and opens the one that unlocks in place (the address bar is updated).
//   'page'  (/work/<page>/)     fetches ./locked.json, decrypts it, and replaces the document.
//
// Payloads are made by scripts/lock.js. v2: the page is encrypted with a random content
// key, and that key is wrapped once per allowed password (PBKDF2-SHA256 -> AES-256-GCM).
// A wrong password simply fails to unwrap (GCM is authenticated), which is how the gate
// knows which page a password belongs to. The working password is kept in sessionStorage
// so moving between /work pages in the same tab doesn't re-prompt. Visit /work/?lock to forget it.

(function () {
    'use strict';

    var PW_KEY = 'ec_work_pw';

    // Local testing only (npx serve): always show the form, and an empty Open uses the
    // shopping password from work/_src/passwords.json, which only exists on Erika's laptop.
    var DEV = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
    var DEV_ENTRY = 'shopping';

    async function devPassword() {
        try {
            var cfg = await (await fetch('/work/_src/passwords.json', { cache: 'no-store' })).json();
            return (cfg.passwords || cfg)[DEV_ENTRY] || '';
        } catch (e) { return ''; }
    }

    function b64(s) {
        var bin = atob(s), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    async function kek(password, salt, iterations) {
        var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: salt, iterations: iterations, hash: 'SHA-256' },
            base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    }

    // Resolves to the page HTML, or null when the password doesn't open this payload.
    async function decrypt(payload, password) {
        try {
            if (payload.v === 2) {
                for (var i = 0; i < payload.keys.length; i++) {
                    var k = payload.keys[i], raw;
                    try {
                        raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(k.iv) },
                            await kek(password, b64(k.salt), payload.iter), b64(k.wk));
                    } catch (e) { continue; }
                    var key = await crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['decrypt']);
                    var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, key, b64(payload.ct));
                    return new TextDecoder().decode(pt);
                }
                return null;
            }
            // v1: page encrypted directly under one password
            var key1 = await kek(password, b64(payload.salt), payload.iter);
            var pt1 = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, key1, b64(payload.ct));
            return new TextDecoder().decode(pt1);
        } catch (e) {
            return null;
        }
    }

    async function fetchJSON(url) {
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load ' + url);
        return res.json();
    }

    // Scripts only run if they are created fresh, so clone with that in mind.
    function importNode(node) {
        function fresh(old) {
            var el = document.createElement('script');
            for (var i = 0; i < old.attributes.length; i++) el.setAttribute(old.attributes[i].name, old.attributes[i].value);
            el.text = old.text;
            return el;
        }
        if (node.nodeType === 1 && node.tagName === 'SCRIPT') return fresh(node);
        var copy = document.importNode(node, true);
        if (copy.querySelectorAll) {
            var scripts = copy.querySelectorAll('script');
            for (var j = 0; j < scripts.length; j++) scripts[j].parentNode.replaceChild(fresh(scripts[j]), scripts[j]);
        }
        return copy;
    }

    // Swap the decrypted page into the current document instead of writing a new one,
    // so the curtain element stays on screen without a single blank frame. It then
    // sweeps up and off, and the page's own entrance animation runs behind it.
    function render(html, curtain) {
        var doc = new DOMParser().parseFromString(html, 'text/html');

        document.title = doc.title;
        var have = {};
        var loaded = document.head.querySelectorAll('link[href], script[src]');
        for (var i = 0; i < loaded.length; i++) have[loaded[i].getAttribute('href') || loaded[i].getAttribute('src')] = true;
        var heads = doc.head.children;
        for (var h = 0; h < heads.length; h++) {
            var el = heads[h];
            var key = el.getAttribute('href') || el.getAttribute('src');
            if (key && have[key]) continue;
            if (el.tagName === 'TITLE' || el.tagName === 'META') continue;
            document.head.appendChild(importNode(el));
        }

        var body = document.body;
        body.className = (doc.body.className ? doc.body.className + ' ' : '') + 'has-curtain';
        while (body.firstChild) body.removeChild(body.firstChild);
        if (curtain) body.appendChild(curtain);
        var nodes = doc.body.childNodes;
        for (var n = 0; n < nodes.length; n++) body.appendChild(importNode(nodes[n]));
        window.scrollTo(0, 0);
        if (window.ECCursor) window.ECCursor.mount();
        if (window.ECReveal) window.ECReveal.init();

        if (curtain) {
            curtain.hidden = false;
            curtain.className = 'lock-curtain lock-curtain--leave';
            var done = function () { if (curtain.parentNode) curtain.parentNode.removeChild(curtain); };
            curtain.addEventListener('animationend', done);
            setTimeout(done, 1400);
        }
    }

    function init(opts) {
        var mode = opts.mode || 'gate';
        var lock = document.getElementById('lock');
        var status = document.getElementById('lock-status');
        var form = document.getElementById('lock-form');
        var input = document.getElementById('lock-input');
        var submit = document.getElementById('lock-submit');
        var error = document.getElementById('lock-error');
        var curtain = document.getElementById('lock-curtain');
        var payloads = {};
        var dropTimer = null;

        var curtainUp = Promise.resolve();

        function curtainSet(state) {
            if (!curtain) return;
            clearTimeout(dropTimer);
            curtain.className = 'lock-curtain' + (state ? ' ' + state : '');
            curtain.hidden = !state;
            if (state === 'is-dropping') dropTimer = setTimeout(function () { curtainSet(''); }, 700);
            // Resolves once the curtain has finished rising (or right away if it isn't animating),
            // so the page is never written under a curtain that is still on its way up.
            if (state === 'is-rising') {
                curtainUp = new Promise(function (resolve) {
                    var done = function () { curtain.removeEventListener('animationend', done); resolve(); };
                    curtain.addEventListener('animationend', done);
                    setTimeout(done, 1000);
                });
            } else {
                curtainUp = Promise.resolve();
            }
        }

        // Sweep from the rest point to full cover; resolves when the screen is covered.
        function curtainCover() {
            if (!curtain || curtain.hidden) return Promise.resolve();
            return new Promise(function (resolve) {
                var done = function () { curtain.removeEventListener('animationend', done); resolve(); };
                curtain.addEventListener('animationend', done);
                setTimeout(done, 520);
                curtain.className = 'lock-curtain is-covering-up';
            });
        }

        function showForm(message) {
            status.hidden = true;
            lock.hidden = false;
            lock.classList.remove('is-receding');
            submit.disabled = false;
            submit.textContent = 'Open';
            error.textContent = message || '';
            if (message) { input.value = ''; }
            // A wrong password: the curtain drops back down to reveal the form again.
            if (curtain && !curtain.hidden) curtainSet('is-dropping'); else curtainSet('');
            input.focus();
        }

        // Typed password: the curtain rises over the form while we try it.
        function busy() {
            submit.disabled = true;
            submit.textContent = 'Opening…';
            error.textContent = '';
            status.hidden = false;
            lock.classList.add('is-receding');
            curtainSet('is-rising');
        }

        // Everything is addressed from /work/ so the pages work with or without a trailing slash.
        var BASE = '/work/';
        var here = window.location.pathname.replace(/\/?$/, '/');

        async function payloadFor(name) {
            if (!payloads[name]) payloads[name] = await fetchJSON((name === '.' ? here : BASE + name + '/') + 'locked.json');
            return payloads[name];
        }

        // Returns true and moves on if the password opens something.
        async function tryPassword(password) {
            if (mode === 'page') {
                var html = await decrypt(await payloadFor('.'), password);
                if (html === null) return false;
                try { sessionStorage.setItem(PW_KEY, password); } catch (e) {}
                await curtainUp;
                await curtainCover();
                render(html, curtain);
                return true;
            }
            var manifest = await fetchJSON(BASE + 'manifest.json');
            var pages = manifest.pages || [];
            for (var i = 0; i < pages.length; i++) {
                var html2 = await decrypt(await payloadFor(pages[i]), password);
                if (html2 !== null) {
                    try { sessionStorage.setItem(PW_KEY, password); } catch (e) {}
                    // Open the page right here and just update the address bar: no reload,
                    // so the curtain stays on screen and nothing flashes.
                    try { window.history.replaceState(null, '', BASE + pages[i] + '/'); } catch (e) {}
                    await curtainUp;
                    await curtainCover();
                    render(html2, curtain);
                    return true;
                }
            }
            return false;
        }

        if (!(window.crypto && crypto.subtle)) {
            showForm('This page needs a secure (https) connection to open.');
            submit.disabled = true;
            return;
        }

        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var password = input.value.trim();
            if (!password && DEV) password = await devPassword();
            if (!password) { input.focus(); return; }
            busy();
            try {
                if (!(await tryPassword(password))) showForm('That password didn’t open anything. Check for typos and try again.');
            } catch (err) {
                showForm('Something went wrong loading the page. Please refresh and try again.');
            }
        });

        // /work/?lock forgets the remembered password (handy for testing the gate).
        if (/(^|[?&])lock(=|&|$)/.test(window.location.search)) {
            try { sessionStorage.removeItem(PW_KEY); } catch (e) {}
            if (window.history.replaceState) window.history.replaceState(null, '', window.location.pathname);
        }

        // Remembered password from earlier in this tab? Try it quietly first.
        var saved = null;
        try { saved = sessionStorage.getItem(PW_KEY); } catch (e) {}
        if (DEV) saved = null;
        if (saved) {
            status.hidden = false;
            curtainSet('is-rising');
            tryPassword(saved).then(function (ok) { if (!ok) showForm(); }, function () { showForm(); });
        } else {
            showForm();
        }
    }

    window.ECLock = { init: init };
})();
