#!/usr/bin/env node
/*
 * version-assets.js — stamps every stylesheet and script reference with a short hash of the
 * file's contents (e.g. /work/work.css?v=a1b2c3d), so a changed asset gets a new URL and
 * Cloudflare's long cache never serves a stale copy. Runs from the pre-commit hook before
 * lock.js, so the plaintext pages under work/_src pick up the new URLs before encryption.
 *
 *   node scripts/version-assets.js            rewrite references in place
 *   node scripts/version-assets.js --stage    same, then `git add` the files it changed
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = ['style.css', 'site.js', 'analytics.js', 'cursor.js', 'reveal.js', 'copy-email.js', 'work/work.css', 'work/locked.js'];
function listPages() {
    const pages = ['index.html', 'work/index.html', 'scripts/lock.js'];
    const work = path.join(ROOT, 'work');
    for (const d of fs.readdirSync(work)) {
        if (d === '_src') continue;
        const f = path.join('work', d, 'index.html');
        if (fs.existsSync(path.join(ROOT, f))) pages.push(f);
    }
    const src = path.join(work, '_src');
    if (fs.existsSync(src)) {
        for (const d of fs.readdirSync(src)) {
            if (d.startsWith('_')) continue; // _archive
            const f = path.join('work', '_src', d, 'index.html');
            if (fs.existsSync(path.join(ROOT, f))) pages.push(f);
        }
    }
    return pages;
}
const PAGES = listPages();

const versions = {};
for (const a of ASSETS) {
    const f = path.join(ROOT, a);
    if (!fs.existsSync(f)) continue;
    versions['/' + a] = crypto.createHash('sha1').update(fs.readFileSync(f)).digest('hex').slice(0, 7);
}

const changed = [];
for (const p of PAGES) {
    const f = path.join(ROOT, p);
    if (!fs.existsSync(f)) continue;
    let s = fs.readFileSync(f, 'utf8');
    const before = s;
    for (const [url, v] of Object.entries(versions)) {
        // matches href="/x.css", href="x.css" (root pages), and any existing ?v=...
        const re = new RegExp('((?:href|src)=")(/?' + url.replace(/^\//, '').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + ')(\\?v=[0-9a-f]+)?(")', 'g');
        s = s.replace(re, (m, pre, file, _old, post) => pre + file + '?v=' + v + post);
    }
    if (s !== before) { fs.writeFileSync(f, s); changed.push(p); }
}

if (process.argv.includes('--stage') && changed.length) {
    // plaintext sources are gitignored; only stage tracked files
    const tracked = changed.filter(p => !p.startsWith('work/_src/'));
    if (tracked.length) execFileSync('git', ['add', '--', ...tracked], { cwd: ROOT, stdio: 'inherit' });
}
if (!process.argv.includes('--quiet')) console.log(changed.length ? 'versioned: ' + changed.join(', ') : 'asset versions unchanged');
