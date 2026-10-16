// carousel.js — the case-study carousel, for any number of slides.
// Markup: figure.cs-carousel > .cs-carousel-track > .cs-slide[data-caption] ... plus
// .cs-carousel-bar with .cs-carousel-caption and two .cs-arrow[data-dir="-1"|"1"] buttons.
// While on screen it cycles: the arrow that will turn the page (.is-filling) fills with rose, and the
// page turns when the fill ends, so the two never drift apart. Clicking an arrow, or scrolling a
// slide, stops the cycle for good. Under Reduce Motion it never cycles. data-dwell sets ms per slide.
(function () {
    'use strict';
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setup(root) {
        var slides = root.querySelectorAll('.cs-slide');
        var prev = root.querySelector('.cs-arrow[data-dir="-1"]');
        var next = root.querySelector('.cs-arrow[data-dir="1"]');
        var caption = root.querySelector('.cs-carousel-caption');
        if (!slides.length || !prev || !next) return;
        var dwell = parseInt(root.getAttribute('data-dwell'), 10) || 7000;
        var current = 0, playing = false, stopped = false;
        root.style.setProperty('--cs-dwell', dwell + 'ms');

        // Auto-play walks forward, then back to the first slide from the last
        function autoTarget() { return current === slides.length - 1 ? 0 : current + 1; }

        function show(i) {
            current = i;
            slides.forEach(function (s, k) {
                var on = k === i;
                s.classList.toggle('is-active', on);
                s.setAttribute('aria-hidden', on ? 'false' : 'true');
                s.querySelectorAll('a, button, video[controls]').forEach(function (el) { el.tabIndex = on ? 0 : -1; });
            });
            prev.disabled = i === 0;
            next.disabled = i === slides.length - 1;
            var forward = autoTarget() > current;
            next.classList.toggle('is-filling', forward && !next.disabled);
            prev.classList.toggle('is-filling', !forward && !prev.disabled);
            if (caption) caption.textContent = slides[i].getAttribute('data-caption') || '';
            if (playing) restartFill();
        }

        function restartFill() {
            root.classList.remove('is-playing');
            void root.offsetWidth; // restart the CSS animation
            root.classList.add('is-playing');
        }

        root.addEventListener('animationend', function (e) {
            if (e.animationName === 'cs-arrow-fill' && playing) show(autoTarget());
        });

        function play() { if (!stopped && !playing) { playing = true; restartFill(); } }
        function pause() { playing = false; root.classList.remove('is-playing'); }
        function stop() { stopped = true; pause(); }

        [prev, next].forEach(function (btn) {
            btn.addEventListener('click', function () {
                stop();
                var to = current + parseInt(btn.getAttribute('data-dir'), 10);
                if (to >= 0 && to < slides.length) show(to);
                if (btn.disabled) (btn === next ? prev : next).focus(); // keep focus on a usable arrow
            });
        });

        root.querySelectorAll('.cs-wide, .cs-scroll').forEach(function (w) {
            w.addEventListener('scroll', stop, { passive: true });
        });

        show(0);
        if (reduce) return;

        // Only cycle while the carousel is on screen, so nobody misses the first slide
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { e.isIntersecting ? play() : pause(); });
            }, { threshold: 0.5 }).observe(root);
        } else {
            play();
        }
    }

    function init() { document.querySelectorAll('.cs-carousel').forEach(setup); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
