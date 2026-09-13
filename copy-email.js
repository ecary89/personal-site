// copy-email.js — every Email link or button copies the address instead of opening a mail app,
// and says "Copied" for a moment. If the clipboard isn't available, it falls back to the mailto link.
(function () {
    'use strict';
    var EMAIL = 'erika.mi.cary@gmail.com';

    function feedback(el) {
        var toast = el.parentNode && el.parentNode.querySelector('.copy-toast');
        if (toast) {
            toast.classList.add('is-on');
            setTimeout(function () { toast.classList.remove('is-on'); }, 1800);
            return;
        }
        if (el.dataset.copyLabel !== undefined) return;
        var label = el.textContent;
        el.dataset.copyLabel = label;
        el.textContent = 'Copied';
        el.classList.add('is-copied');
        setTimeout(function () { el.textContent = label; el.classList.remove('is-copied'); delete el.dataset.copyLabel; }, 1800);
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
