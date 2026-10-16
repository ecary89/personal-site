#!/usr/bin/env node
/*
 * build-tokens.js — writes tokens.json (W3C design tokens format) from tokens.css.
 * tokens.css is the source; run this after editing it so Figma and the site never disagree:
 *
 *   node design-system/build-tokens.js
 *
 * Fluid sizes export their largest (desktop) value; the CSS and the smallest value ride in $extensions.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const css = fs.readFileSync(path.join(DIR, 'tokens.css'), 'utf8');
const root = css.slice(css.indexOf(':root'));

// --name: value;  /* comment */
const raw = {};
const notes = {};
for (const m of root.matchAll(/--([\w-]+):\s*([^;]+);[ \t]*(?:\/\*\s*(.*?)\s*\*\/)?/g)) {
    raw[m[1]] = m[2].trim();
    if (m[3]) notes[m[1]] = m[3];
}

const resolve = v => v.replace(/var\(--([\w-]+)\)/g, (_, n) => resolve(raw[n]));
const px = v => { const n = [...v.matchAll(/(-?[\d.]+)px/g)].map(x => parseFloat(x[1])); return n; };

function dimension(name) {
    const v = raw[name];
    const t = { $type: 'dimension', $value: v };
    const nums = px(v);
    if (/^(clamp|min)\(/.test(v)) {
        t.$value = Math.max(...nums) + 'px';
        t.$extensions = { css: v, min: Math.min(...nums) + 'px' };
    }
    if (notes[name]) t.$description = notes[name];
    return t;
}

function hexAlpha(rgba) {
    const [r, g, b, a] = rgba.match(/[\d.]+/g).map(Number);
    const h = n => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
    return '#' + h(r) + h(g) + h(b) + (a === undefined ? '' : h(a * 255));
}

function shadow(name) {
    const v = resolve(raw[name]);
    const [x, y, blur, spread = '0px'] = v.replace(/rgba\([^)]*\)/, '').trim().split(/\s+/).map(s => (s === '0' ? '0px' : s));
    return { $type: 'shadow', $value: { color: hexAlpha(v.match(/rgba\([^)]*\)/)[0]), offsetX: x, offsetY: y, blur, spread }, $description: notes[name] };
}

const out = {
    $description: 'erikacary.com portfolio tokens. Generated from tokens.css by build-tokens.js. Do not edit by hand.',
    color: {}, gradient: {}, font: { family: {}, weight: {} }, size: {}, lineHeight: {}, letterSpacing: {},
    space: {}, layout: {}, radius: {}, borderWidth: {}, shadow: {}, zIndex: {}, easing: {}, duration: {}, typography: {}
};

for (const [name, v] of Object.entries(raw)) {
    const desc = notes[name];
    const add = (group, key, token) => { if (desc && !token.$description) token.$description = desc; group[key] = token; };
    if (/-rgb$/.test(name) || name.startsWith('focus-')) continue;
    if (name === 'wash-gradient') {
        add(out.gradient, 'wash', { $type: 'gradient', $value: [{ color: '{color.wash}', position: 0 }, { color: '{color.wash-deep}', position: 1 }], $extensions: { angle: '135deg' } });
    } else if (/^#|^rgba/.test(v) || /^var\(--(border|wash|muted)\)$/.test(v)) {
        const value = v.startsWith('var(') ? '{color.' + v.slice(6, -1) + '}' : v.startsWith('rgba') ? hexAlpha(v) : v;
        add(out.color, name, { $type: 'color', $value: value });
    } else if (name.startsWith('font-')) {
        add(out.font.family, name.slice(5), { $type: 'fontFamily', $value: v.split(',').map(s => s.trim().replace(/'/g, '')) });
    } else if (name.startsWith('weight-')) {
        add(out.font.weight, name.slice(7), { $type: 'fontWeight', $value: Number(v) });
    } else if (name.startsWith('size-')) {
        out.size[name.slice(5)] = dimension(name);
    } else if (name.startsWith('leading-')) {
        add(out.lineHeight, name.slice(8), { $type: 'number', $value: Number(v) });
    } else if (name.startsWith('tracking-')) {
        add(out.letterSpacing, name.slice(9), { $type: 'dimension', $value: v });
    } else if (name.startsWith('space-') || name === 'gap-columns') {
        out.space[name.replace(/^space-/, '')] = dimension(name);
    } else if (/-max$|^pad-x$|^fact-label$/.test(name)) {
        out.layout[name] = dimension(name);
    } else if (name.startsWith('radius-')) {
        add(out.radius, name.slice(7), { $type: 'dimension', $value: v });
    } else if (name.startsWith('border-width')) {
        add(out.borderWidth, name.replace(/^border-width-?/, '') || 'default', { $type: 'dimension', $value: v });
    } else if (name.startsWith('shadow-') || name.startsWith('halo-')) {
        out.shadow[name.replace(/^shadow-/, '')] = shadow(name);
    } else if (name.startsWith('z-')) {
        add(out.zIndex, name.slice(2), { $type: 'number', $value: Number(v) });
    } else if (name.startsWith('ease-')) {
        add(out.easing, name.slice(5), { $type: 'cubicBezier', $value: v.match(/[\d.]+/g).map(Number) });
    } else if (name.startsWith('dur-') || name === 'stagger' || name === 'dwell') {
        add(out.duration, name.replace(/^dur-/, ''), { $type: 'duration', $value: v });
    } else if (name.startsWith('rise')) {
        add(out.space, name, { $type: 'dimension', $value: v });
    } else {
        throw new Error('No group for --' + name);
    }
}

// Text styles: one per role, as Figma text styles. Line height "normal" exports as 1.2.
const T = (family, size, weight, leading, tracking, extra) => Object.assign({
    $type: 'typography',
    $value: {
        fontFamily: '{font.family.' + family + '}',
        fontSize: '{size.' + size + '}',
        fontWeight: '{font.weight.' + weight + '}',
        lineHeight: leading === 'normal' ? 1.2 : '{lineHeight.' + leading + '}',
        letterSpacing: tracking ? '{letterSpacing.' + tracking + '}' : '0em'
    }
}, extra || {});
Object.assign(out.typography, {
    // Display
    hero: T('display', 'hero', 'black', 'hero', 'display'),
    title: T('display', 'title', 'black', 'title', 'display'),
    heading: T('display', 'heading', 'bold', 'heading', 'heading'),
    'footer-headline': T('display', 'heading', 'semibold', 'snug', 'heading-sm'),
    subheading: T('display', 'subheading', 'medium', 'snug', 'sub'),
    quote: T('display', 'subheading', 'medium', 'quote', 'sub'),
    wordmark: T('display', 'wordmark', 'black', 'normal', 'display'),
    // Text
    statement: T('text', 'heading', 'regular', 'statement', 'statement'),
    lede: T('text', 'subheading', 'regular', 'text'),
    'home-role': T('text', 'subheading', 'medium', 'normal'),
    'body-lg': T('text', 'body-lg', 'regular', 'read'),
    body: T('text', 'body', 'regular', 'relaxed'),
    button: T('text', 'body', 'semibold', 'text'),
    small: T('text', 'small', 'regular', 'text'),
    label: T('text', 'small', 'semibold', 'text'),
    fine: T('text', 'fine', 'regular', 'normal')
});

fs.writeFileSync(path.join(DIR, 'tokens.json'), JSON.stringify(out, null, 2) + '\n');
console.log('tokens.json: ' + Object.keys(raw).length + ' CSS tokens, ' + Object.keys(out.typography).length + ' text styles');
