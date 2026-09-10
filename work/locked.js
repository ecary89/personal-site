// locked.js — opens the password-protected pages under /work in the browser.
//
// Two modes, picked by ECLock.init({ mode }):
//   'gate'  (/work/)            tries the password against every page in manifest.json
//                               and redirects to the one that unlocks.
//   'page'  (/work/<page>/)     fetches ./locked.json, decrypts it, and replaces the document.
//
// Payloads are made by scripts/lock.js: PBKDF2-SHA256 -> AES-256-GCM. A wrong password
// simply fails to decrypt (GCM is authenticated), which is how the gate knows which
// page a password belongs to. The working password is kept in sessionStorage so
// moving between /work pages in the same tab doesn't re-prompt.

(function () {
    'use strict';

    var PW_KEY = 'ec_work_pw';

    function b64(s) {
        var bin = atob(s), out = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        return out;
    }

    async function decrypt(payload, password) {
        try {
            var enc = new TextEncoder();
            var base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
            var key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt: b64(payload.salt), iterations: payload.iter, hash: 'SHA-256' },
                base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
            var pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(payload.iv) }, key, b64(payload.ct));
            return new TextDecoder().decode(pt);
        } catch (e) {
            return null;
        }
    }

    async function fetchJSON(url) {
        var res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error('Could not load ' + url);
        return res.json();
    }

    function render(html) {
        document.open();
        document.write(html);
        document.close();
    }

    function init(opts) {
        var mode = opts.mode || 'gate';
        var lock = document.getElementById('lock');
        var status = document.getElementById('lock-status');
        var form = document.getElementById('lock-form');
        var input = document.getElementById('lock-input');
        var submit = document.getElementById('lock-submit');
        var error = document.getElementById('lock-error');
        var payloads = {};

        function showForm(message) {
            status.hidden = true;
            lock.hidden = false;
            submit.disabled = false;
            submit.textContent = 'Open';
            error.textContent = message || '';
            if (message) { input.value = ''; }
            input.focus();
        }

        function busy() {
            submit.disabled = true;
            submit.textContent = 'Opening…';
            error.textContent = '';
        }

        async function payloadFor(name) {
            if (!payloads[name]) payloads[name] = await fetchJSON(name === '.' ? opts.payload : name + '/locked.json');
            return payloads[name];
        }

        // Returns true and moves on if the password opens something.
        async function tryPassword(password) {
            if (mode === 'page') {
                var html = await decrypt(await payloadFor('.'), password);
                if (html === null) return false;
                try { sessionStorage.setItem(PW_KEY, password); } catch (e) {}
                render(html);
                return true;
            }
            var manifest = await fetchJSON(opts.manifest || 'manifest.json');
            var companies = manifest.pages || [];
            for (var i = 0; i < companies.length; i++) {
                var ok = await decrypt(await payloadFor(companies[i]), password);
                if (ok !== null) {
                    try { sessionStorage.setItem(PW_KEY, password); } catch (e) {}
                    window.location.replace(companies[i] + '/');
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
            if (!password) { input.focus(); return; }
            busy();
            try {
                if (!(await tryPassword(password))) showForm('That password didn’t open anything. Check for typos and try again.');
            } catch (err) {
                showForm('Something went wrong loading the page. Please refresh and try again.');
            }
        });

        // Remembered password from earlier in this tab? Try it quietly first.
        var saved = null;
        try { saved = sessionStorage.getItem(PW_KEY); } catch (e) {}
        if (saved) {
            status.hidden = false;
            tryPassword(saved).then(function (ok) { if (!ok) showForm(); }, function () { showForm(); });
        } else {
            showForm();
        }
    }

    window.ECLock = { init: init };
})();
