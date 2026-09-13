// copy-email.js — every Email link or button copies the address instead of opening a mail app,
// and says "Copied" for a moment. If the clipboard isn't available, it falls back to the mailto link.
(function () {
    'use strict';
    var EMAIL = 'erika.mi.cary@gmail.com';

    var HOLD = 2500; // how long the "copied" state shows
    var CHECK = '<svg class="copy-check" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

    function feedback(el) {
        if (el.dataset.copyHold !== undefined) return; // already showing
        el.dataset.copyHold = '1';
        var toast = el.querySelector('.copy-toast') || (el.parentNode && el.parentNode.querySelector('.copy-toast'));
        if (toast) {
            // The icon button on the gate: icon becomes a check, "Copied" appears beside it
            el.classList.add('is-copied');
            el.setAttribute('aria-label', 'Copied');
            toast.classList.add('is-on');
            setTimeout(function () {
                el.classList.remove('is-copied');
                el.setAttribute('aria-label', 'Copy email address');
                toast.classList.remove('is-on');
                delete el.dataset.copyHold;
            }, HOLD);
            return;
        }
        // A text link or button: label becomes a check plus "Email copied"
        var original = el.innerHTML;
        el.innerHTML = CHECK + ' Email copied';
        el.classList.add('is-copied');
        setTimeout(function () {
            el.innerHTML = original;
            el.classList.remove('is-copied');
            delete el.dataset.copyHold;
        }, HOLD);
    }

    document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('a[href^="mailto:"], [data-email]') : null;
        if (!el) return;
        var email = el.getAttribute('data-email') || (el.getAttribute('href') || '').replace(/^mailto:/, '').split('?')[0] || EMAIL;
        if (!(navigator.clipboard && navigator.clipboard.writeText)) return; // let the mailto link do its thing
        e.preventDefault();
        navigator.clipboard.writeText(email).then(function () { feedback(el); }, function () {
            if (el.tagName === 'A' && el.getAttribute('href')) window.location.href = el.getAttribute('href');
            else window.prompt('Copy this address:', email);
        });
    });
})();
