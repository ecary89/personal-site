// reveal.js — blocks below the first screen wait, then fade in and rise as they scroll into view.
// Blocks already on screen at load keep the page-load entrance. Runs once per block.
// Exposes ECReveal.init() so a page that swaps its body (the /work gate) can re-run it.
(function () {
    'use strict';
    var SELECTOR = '.wk-tile, .wk-quotes, .site-footer, .cs-section, .cs-figure, .cs-story, .claims .claim';

    function init() {
        if (!('IntersectionObserver' in window)) return;
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var nodes = document.querySelectorAll(SELECTOR);
        var pending = [];
        for (var i = 0; i < nodes.length; i++) {
            var el = nodes[i];
            if (el.classList.contains('reveal') || el.classList.contains('is-in')) continue;
            if (el.getBoundingClientRect().top < vh * 0.9) continue; // on screen now: leave the load entrance alone
            el.classList.add('reveal');
            pending.push(el);
        }
        if (!pending.length) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
        pending.forEach(function (el) { io.observe(el); });

        // Anything jumped past (an anchor, a fast fling) is revealed too, not left blank above the fold.
        var ticking = false;
        function sweep() {
            ticking = false;
            for (var j = pending.length - 1; j >= 0; j--) {
                var el = pending[j];
                if (el.classList.contains('is-in')) { pending.splice(j, 1); continue; }
                if (el.getBoundingClientRect().bottom < 0) { el.classList.add('is-in'); io.unobserve(el); pending.splice(j, 1); }
            }
            if (!pending.length) window.removeEventListener('scroll', onScroll);
        }
        function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(sweep); } }
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.ECReveal = { init: init };
})();
