#!/usr/bin/env node
/*
 * lock-scrapbook.js — encrypts the scrapbook test app at /scrapbook.
 *
 * Same idea as lock.js for /work, with two differences that suit a big single-page app:
 *   - the page (about 4 MB, every picture inlined) is gzipped before it's encrypted,
 *   - the ciphertext is a binary file (locked.bin), so it isn't inflated by base64.
 *
 * Plaintext lives here and is NEVER committed (.gitignore):
 *   scrapbook/_src/index.html      the full app (built by Claude from the prototype)
 *   scrapbook/_src/password.txt    the password testers type, on one line
 *
 * Generated and committed:
 *   scrapbook/locked.json          salt, IVs and the wrapped key (no secrets)
 *   scrapbook/locked.bin           the encrypted, gzipped app
 *
 * Usage:  node scripts/lock-scrapbook.js
 * The browser side is in scrapbook/index.html (PBKDF2-SHA256 -> AES-256-GCM, then gunzip).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { webcrypto, randomBytes } = require('crypto');
const subtle = webcrypto.subtle;

const DIR = path.resolve(__dirname, '..', 'scrapbook');
const SRC = path.join(DIR, '_src');
const ITERATIONS = 250000;
const b64 = (buf) => Buffer.from(buf).toString('base64');

(async () => {
  const page = fs.readFileSync(path.join(SRC, 'index.html'));
  const password = fs.readFileSync(path.join(SRC, 'password.txt'), 'utf8').trim();
  if (!password) throw new Error('scrapbook/_src/password.txt is empty');

  const content = randomBytes(32), iv = randomBytes(12);
  const contentKey = await subtle.importKey('raw', content, 'AES-GCM', false, ['encrypt']);
  const gz = zlib.gzipSync(page, { level: 9 });
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, contentKey, gz);

  const salt = randomBytes(16), kiv = randomBytes(12);
  const base = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const kek = await subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const wk = await subtle.encrypt({ name: 'AES-GCM', iv: kiv }, kek, content);

  fs.writeFileSync(path.join(DIR, 'locked.bin'), Buffer.from(ct));
  fs.writeFileSync(path.join(DIR, 'locked.json'), JSON.stringify({
    v: 1, iter: ITERATIONS, iv: b64(iv), gzip: true, bytes: ct.byteLength,
    keys: [{ salt: b64(salt), iv: b64(kiv), wk: b64(wk) }]
  }, null, 2) + '\n');
  console.log(`scrapbook: ${(page.length / 1e6).toFixed(2)} MB -> ${(ct.byteLength / 1e6).toFixed(2)} MB encrypted`);
})().catch((e) => { console.error(e.message); process.exit(1); });
