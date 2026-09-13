// cursor.js — a rose dot that follows the pointer, with a ring that grows over anything clickable.
// Fine-pointer devices only; off under Reduce Motion; the native cursor stays for text fields.
// Exposes ECCursor.mount() so a page that swaps its body (the /work gate) can put it back.
(function () {
    'use strict';
    var fine = window.matchMedia && matchMedia('(pointer: fine)').matches;
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) { window.ECCursor = { mount: function () {} }; return; }

    var root = document.documentElement;
    var dot, ring, raf = null;
    var x = -100, y = -100, rx = -100, ry = -100;

    function make(id, cls) {
        var el = document.createElement('div');
        el.id = id; el.className = cls; el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
        return el;
    }

    function mount() {
        if (!document.body) return;
        if (!document.getElementById('ec-cur-dot')) {
            dot = make('ec-cur-dot', 'cur-dot');
            ring = make('ec-cur-ring', 'cur-ring');
        }
        root.classList.add('has-cursor');
        place();
    }

    function place() {
        if (!dot) return;
        dot.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) translate(-50%,-50%)';
        ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0) translate(-50%,-50%)';
    }

    function tick() {
        rx += (x - rx) * 0.2;
        ry += (y - ry) * 0.2;
        place();
        raf = (Math.abs(x - rx) > 0.2 || Math.abs(y - ry) > 0.2) ? requestAnimationFrame(tick) : null;
    }

    document.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        x = e.clientX; y = e.clientY;
        if (!dot || !dot.isConnected) mount();
        root.classList.add('cur-visible');
        var t = e.target && e.target.closest ? e.target : null;
        var text = t && t.closest('input, textarea, select, [contenteditable="true"]');
        var link = t && t.closest('a, button, [role="button"], label, summary');
        root.classList.toggle('cur-text', !!text);
        root.classList.toggle('cur-active', !!link && !text);
        if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });

    document.addEventListener('pointerleave', function () { root.classList.remove('cur-visible'); });
    document.addEventListener('pointerenter', function () { root.classList.add('cur-visible'); });
    document.addEventListener('pointerdown', function () { root.classList.add('cur-down'); });
    document.addEventListener('pointerup', function () { root.classList.remove('cur-down'); });

    if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
    window.ECCursor = { mount: mount };
})();
