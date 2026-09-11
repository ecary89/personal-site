#!/usr/bin/env node
/*
 * lock.js — encrypts the password-protected pages under /work.
 *
 * How the gate works
 *   /work/               one password field. Tries the password against every entry
 *                        page listed in work/manifest.json and opens the one that unlocks.
 *   /work/<page>/        a tiny shell page (index.html) that fetches locked.json and
 *                        decrypts it in the browser (PBKDF2 + AES-GCM via WebCrypto).
 *                        The password is remembered for the tab session only.
 *
 * Two kinds of page share one mechanism:
 *   entry pages   named by audience (b2b, shop, ...). One password each; the password is
 *                 what gets handed out per company.
 *   project pages (the-yes, pinterest-shopping, ...). Shared case studies. Each one is
 *                 openable by every entry password that links to it, so a visitor who
 *                 unlocked /work/shop/ can follow a tile to /work/the-yes/ without a prompt.
 *
 * Plaintext lives here and is NEVER committed (.gitignore):
 *   work/_src/passwords.json
 *     {
 *       "passwords": { "b2b": "<password>", "shop": "<password>" },
 *       "pages":     { "b2b": ["b2b"], "shop": ["shop"], "the-yes": ["b2b", "shop"], ... }
 *     }
 *     "pages" maps every page to the entry passwords that open it. (The old flat
 *     { "<page>": "<password>" } form still works: each page opens with its own password.)
 *   work/_src/<page>/index.html       the full page a visitor sees after the gate
 *
 * Generated and committed:
 *   work/<page>/locked.json           the encrypted page
 *   work/<page>/index.html            the shell (written once if missing, then left alone)
 *   work/manifest.json                the entry pages the gate tries
 *
 * Payload format (v2): the page is encrypted once with a random content key. That key is
 * then wrapped (encrypted) once per allowed password, each with its own PBKDF2 salt. The
 * browser tries the entered password against each wrapped key; a wrong password simply
 * fails to unwrap. So a page with two passwords is still one ciphertext.
 *
 * Usage
 *   node scripts/lock.js              encrypt every page (skips pages whose payload is current)
 *   node scripts/lock.js --unlock     recover plaintext into work/_src from locked.json (needs the passwords)
 *   node scripts/lock.js --stage      same as default, then `git add` whatever it wrote (used by the hook)
 *
 * Automatic re-encrypt on commit: install the hook once per clone
 *   cp scripts/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit
 * After that, editing work/_src/<page>/index.html and committing is all Erika has to do.
 *
 * Adding a page: add it to "pages" (and to "passwords" if it is a new entry page), create
 * work/_src/<page>/index.html, run this script (or just commit).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { webcrypto, randomBytes } = require('crypto');
const subtle = webcrypto.subtle;

const ROOT = path.resolve(__dirname, '..');
const WORK = path.join(ROOT, 'work');
const SRC = path.join(WORK, '_src');
const PASSWORDS = path.join(SRC, 'passwords.json');
const ITERATIONS = 250000; // PBKDF2 rounds; ~0.2s per attempt in a browser

const args = new Set(process.argv.slice(2));
const quiet = args.has('--quiet');
const log = (...m) => { if (!quiet) console.log(...m); };

// Returns { passwords: {entry: password}, pages: {page: [entry, ...]} }
function readConfig() {
    if (!fs.existsSync(PASSWORDS)) {
        console.error(`Missing ${path.relative(ROOT, PASSWORDS)} — see the header of scripts/lock.js for the format.`);
        process.exit(1);
    }
    const raw = JSON.parse(fs.readFileSync(PASSWORDS, 'utf8'));
    if (raw.passwords && raw.pages) return raw;
    // Old flat form: { "<page>": "<password>" }
    const pages = {};
    for (const name of Object.keys(raw)) pages[name] = [name];
    return { passwords: raw, pages };
}

function passwordsFor(config, page) {
    const entries = config.pages[page] || [];
    const list = [];
    for (const entry of entries) {
        if (!config.passwords[entry]) { console.error(`Page "${page}" refers to unknown entry "${entry}".`); process.exit(1); }
        list.push(config.passwords[entry]);
    }
    return list;
}

async function kek(password, salt, usage) {
    const base = await subtle.importKey('raw', Buffer.from(password, 'utf8'), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
        base,
        { name: 'AES-GCM', length: 256 },
        false,
        [usage]
    );
}

async function encrypt(plaintext, passwords) {
    const contentKey = randomBytes(32);
    const iv = randomBytes(12);
    const key = await subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['encrypt']);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, Buffer.from(plaintext, 'utf8'));
    const keys = [];
    for (const password of passwords) {
        const salt = randomBytes(16);
        const wiv = randomBytes(12);
        const wrapped = await subtle.encrypt({ name: 'AES-GCM', iv: wiv }, await kek(password, salt, 'encrypt'), contentKey);
        keys.push({ salt: salt.toString('base64'), iv: wiv.toString('base64'), wk: Buffer.from(wrapped).toString('base64') });
    }
    return {
        v: 2,
        kdf: 'PBKDF2-SHA256',
        iter: ITERATIONS,
        iv: iv.toString('base64'),
        ct: Buffer.from(ct).toString('base64'),
        keys
    };
}

// Returns the plaintext, or null if the password doesn't open this payload.
async function decrypt(payload, password) {
    try {
        if (payload.v === 2) {
            for (const k of payload.keys) {
                let contentKey;
                try {
                    contentKey = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(k.iv, 'base64') },
                        await kek(password, Buffer.from(k.salt, 'base64'), 'decrypt'), Buffer.from(k.wk, 'base64'));
                } catch (e) { continue; }
                const key = await subtle.importKey('raw', contentKey, { name: 'AES-GCM' }, false, ['decrypt']);
                const pt = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(payload.iv, 'base64') }, key, Buffer.from(payload.ct, 'base64'));
                return Buffer.from(pt).toString('utf8');
            }
            return null;
        }
        // v1: page encrypted directly under one password
        const key = await kek(password, Buffer.from(payload.salt, 'base64'), 'decrypt');
        const pt = await subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(payload.iv, 'base64') }, key, Buffer.from(payload.ct, 'base64'));
        return Buffer.from(pt).toString('utf8');
    } catch (e) {
        return null;
    }
}

// True when the committed payload already holds this exact page for exactly these passwords.
async function isCurrent(payload, plaintext, passwords) {
    if (payload.v !== 2 || payload.keys.length !== passwords.length) return false;
    for (const password of passwords) {
        if ((await decrypt(payload, password)) !== plaintext) return false;
    }
    return true;
}

// The shell every locked page uses. Same markup as work/index.html, page mode.
function shellHtml(page) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Erika Cary — Work</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/work/work.css">
</head>
<body class="lock-body">
<!-- Generated by scripts/lock.js for "${page}". The real page is in locked.json and is decrypted in the browser. -->

<p class="lock-status" id="lock-status" hidden>Opening…</p>

<div class="lock" id="lock" hidden>
    <a class="lock-home" href="/">Erika Cary</a>
    <p class="lock-eyebrow">Selected work</p>
    <h1 class="lock-title">This work is shared by invitation.</h1>
    <form class="lock-form" id="lock-form" autocomplete="off" novalidate>
        <label class="visually-hidden" for="lock-input">Password</label>
        <input class="lock-input" id="lock-input" type="password" placeholder="Password" autocomplete="current-password" required>
        <button class="btn btn-primary" id="lock-submit" type="submit">Open</button>
    </form>
    <p class="lock-error" id="lock-error" role="alert" aria-live="polite"></p>
</div>

<noscript><p class="lock-status">This page needs JavaScript to open.</p></noscript>

<script src="/work/locked.js"></script>
<script>ECLock.init({ mode: 'page' });</script>
</body>
</html>
`;
}

function gitAdd(files) {
    if (!files.length) return;
    execFileSync('git', ['add', '--', ...files], { cwd: ROOT, stdio: 'inherit' });
}

async function lock() {
    const config = readConfig();
    const pages = Object.keys(config.pages).sort();
    const written = [];

    for (const page of pages) {
        const passwords = passwordsFor(config, page);
        const srcFile = path.join(SRC, page, 'index.html');
        if (!fs.existsSync(srcFile)) {
            console.error(`Skipping "${page}": no ${path.relative(ROOT, srcFile)}.`);
            continue;
        }
        if (!passwords.length) {
            console.error(`Skipping "${page}": no passwords listed for it.`);
            continue;
        }
        const plaintext = fs.readFileSync(srcFile, 'utf8');
        const outDir = path.join(WORK, page);
        const lockedFile = path.join(outDir, 'locked.json');
        const shellFile = path.join(outDir, 'index.html');
        fs.mkdirSync(outDir, { recursive: true });

        // Skip when the committed payload is already current, so the pre-commit hook
        // doesn't churn a fresh salt/iv into every commit.
        if (fs.existsSync(lockedFile)) {
            const existing = JSON.parse(fs.readFileSync(lockedFile, 'utf8'));
            if (await isCurrent(existing, plaintext, passwords)) {
                log(`${page}: unchanged`);
                if (!fs.existsSync(shellFile)) { fs.writeFileSync(shellFile, shellHtml(page)); written.push(shellFile); }
                continue;
            }
        }

        const payload = await encrypt(plaintext, passwords);
        fs.writeFileSync(lockedFile, JSON.stringify(payload) + '\n');
        written.push(lockedFile);
        if (!fs.existsSync(shellFile)) { fs.writeFileSync(shellFile, shellHtml(page)); written.push(shellFile); }
        log(`${page}: encrypted ${plaintext.length} chars for ${passwords.length} password(s) -> ${path.relative(ROOT, lockedFile)}`);
    }

    // The gate only tries entry pages (the ones that have their own password).
    const entries = Object.keys(config.passwords).sort().filter(e => fs.existsSync(path.join(WORK, e, 'locked.json')));
    const manifestFile = path.join(WORK, 'manifest.json');
    const manifest = JSON.stringify({ pages: entries }, null, 2) + '\n';
    if (!fs.existsSync(manifestFile) || fs.readFileSync(manifestFile, 'utf8') !== manifest) {
        fs.writeFileSync(manifestFile, manifest);
        written.push(manifestFile);
    }

    if (args.has('--stage')) gitAdd(written.map(f => path.relative(ROOT, f)));
    return written;
}

async function unlock() {
    const config = readConfig();
    for (const page of Object.keys(config.pages)) {
        const lockedFile = path.join(WORK, page, 'locked.json');
        if (!fs.existsSync(lockedFile)) { console.error(`${page}: no locked.json`); continue; }
        const payload = JSON.parse(fs.readFileSync(lockedFile, 'utf8'));
        let plaintext = null;
        for (const password of passwordsFor(config, page)) {
            plaintext = await decrypt(payload, password);
            if (plaintext !== null) break;
        }
        if (plaintext === null) { console.error(`${page}: none of its passwords open locked.json`); continue; }
        const srcFile = path.join(SRC, page, 'index.html');
        if (fs.existsSync(srcFile) && !args.has('--force')) { log(`${page}: ${path.relative(ROOT, srcFile)} exists, use --force to overwrite`); continue; }
        fs.mkdirSync(path.dirname(srcFile), { recursive: true });
        fs.writeFileSync(srcFile, plaintext);
        log(`${page}: recovered -> ${path.relative(ROOT, srcFile)}`);
    }
}

(args.has('--unlock') ? unlock() : lock()).catch(err => { console.error(err); process.exit(1); });
