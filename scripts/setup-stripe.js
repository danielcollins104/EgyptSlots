#!/usr/bin/env node
// Local-only Stripe key setup form.
//
// Run:  npm run setup:stripe
// Then open the printed http://127.0.0.1:4848/?t=... link in your browser.
//
// Security model:
//  - Binds to 127.0.0.1 only (not reachable from your network or the internet).
//  - Requires a random one-time token in the URL + form, and rejects foreign
//    Origin/Host headers, so other websites can't post keys to it.
//  - Keys are NEVER logged and NEVER sent anywhere except api.stripe.com (to verify).
//  - Secret keys are written to .env.local WITHOUT the VITE_ prefix, so Vite never
//    bundles them into the browser build. .env.local is gitignored (.env.*).
//  - The server shuts itself down after a successful save.

import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOST = '127.0.0.1';
const PORT = Number(process.env.SETUP_PORT || 4848);
const TOKEN = crypto.randomBytes(24).toString('hex');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENV_FILE = path.join(ROOT, '.env.local');
const MAX_BODY = 8 * 1024;

const PATTERNS = {
  publishable: /^pk_(live|test)_[A-Za-z0-9]{10,}$/,
  secret: /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/,
  webhook: /^whsec_[A-Za-z0-9]{10,}$/,
};

const modeOf = (key) => (key.includes('_live_') ? 'live' : 'test');
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mask = (k) => (k ? `${k.slice(0, 8)}…${k.slice(-4)}` : '(not set)');

function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return [];
  return fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
}

function currentValue(name) {
  const line = readEnvFile().find((l) => l.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1) : '';
}

function writeEnvValues(values) {
  const lines = readEnvFile().filter((l) => l !== '');
  for (const [name, value] of Object.entries(values)) {
    if (!value) continue;
    const idx = lines.findIndex((l) => l.startsWith(`${name}=`));
    const entry = `${name}=${value}`;
    if (idx >= 0) lines[idx] = entry;
    else lines.push(entry);
  }
  fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
}

async function verifySecretKey(secret) {
  try {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.status === 200) {
      const data = await res.json();
      return { ok: true, note: `Verified with Stripe (${data.livemode ? 'LIVE' : 'TEST'} mode).` };
    }
    if (res.status === 401) return { ok: false, note: 'Stripe rejected this secret key (401 invalid key).' };
    if (res.status === 403) {
      return { ok: true, note: 'Key is valid but restricted (no balance read permission) — accepted.' };
    }
    return { ok: false, note: `Unexpected Stripe response: HTTP ${res.status}.` };
  } catch (err) {
    return { ok: null, note: `Could not reach Stripe to verify (${err.code || err.message}). Saved without verification.` };
  }
}

function page({ message = '', isError = false, done = false } = {}) {
  const pk = currentValue('VITE_STRIPE_PUBLISHABLE_KEY');
  const sk = currentValue('STRIPE_SECRET_KEY');
  const wh = currentValue('STRIPE_WEBHOOK_SECRET');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>Stripe Key Setup (local)</title>
<style>
  body{font-family:system-ui,Segoe UI,sans-serif;background:#0c0414;color:#f1f5f9;margin:0;padding:32px;display:flex;justify-content:center}
  .card{width:min(560px,100%);background:#160a26;border:1px solid #f59e0b;border-radius:14px;padding:28px;box-shadow:0 10px 40px #000a}
  h1{margin:0 0 6px;font-size:1.3rem;color:#fde047}
  p.sub{margin:0 0 20px;color:#94a3b8;font-size:.85rem;line-height:1.45}
  label{display:block;font-weight:700;font-size:.82rem;margin:16px 0 6px}
  small{display:block;color:#94a3b8;font-weight:400;margin-top:3px}
  input{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:8px;border:1px solid #475569;background:#0b0616;color:#fff;font-family:ui-monospace,Consolas,monospace;font-size:.85rem}
  input:focus{outline:2px solid #fbbf24;border-color:transparent}
  .cur{font-family:ui-monospace,Consolas,monospace;color:#34d399}
  button{margin-top:22px;width:100%;padding:12px;border:0;border-radius:10px;background:linear-gradient(135deg,#d97706,#b45309);color:#fff;font-weight:800;font-size:.95rem;cursor:pointer}
  .msg{margin-top:18px;padding:12px;border-radius:8px;font-size:.85rem;white-space:pre-line}
  .ok{background:#064e3b;border:1px solid #10b981}.err{background:#450a0a;border:1px solid #ef4444}
  .warn{margin-top:18px;font-size:.75rem;color:#fca5a5;line-height:1.45}
</style></head>
<body><div class="card">
  <h1>Stripe Key Setup</h1>
  <p class="sub">Runs only on this computer (127.0.0.1). Keys are saved to <code>.env.local</code>, which is git-ignored.
  The secret key is stored without the <code>VITE_</code> prefix so it is never shipped to players' browsers.</p>
  ${done ? '' : `<form method="POST" action="/save" autocomplete="off">
    <input type="hidden" name="t" value="${TOKEN}" />
    <label>Publishable key <small>Starts with pk_live_ or pk_test_. Safe to be public. Current: <span class="cur">${escapeHtml(mask(pk))}</span></small></label>
    <input name="publishable" placeholder="pk_live_..." spellcheck="false" />
    <label>Secret key <small>Starts with sk_live_ / rk_live_ (restricted key recommended). Server-only. Current: <span class="cur">${escapeHtml(mask(sk))}</span></small></label>
    <input name="secret" type="password" placeholder="sk_live_... or rk_live_..." spellcheck="false" />
    <label>Webhook signing secret (optional) <small>Starts with whsec_. Needed later for server-side payment confirmation. Current: <span class="cur">${escapeHtml(mask(wh))}</span></small></label>
    <input name="webhook" type="password" placeholder="whsec_..." spellcheck="false" />
    <button type="submit">Save keys</button>
  </form>`}
  ${message ? `<div class="msg ${isError ? 'err' : 'ok'}">${escapeHtml(message)}</div>` : ''}
  <p class="warn">Never paste the secret key into the game's in-app "Keys" tab, into chat, or into any file that starts with VITE_. Leave any field blank to keep its current value.</p>
</div></body></html>`;
}

function send(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
  });
  res.end(html);
}

function sameOrigin(req) {
  const allowedHosts = [`${HOST}:${PORT}`, `localhost:${PORT}`];
  if (!allowedHosts.includes(req.headers.host)) return false;
  const origin = req.headers.origin;
  if (origin && !allowedHosts.some((h) => origin === `http://${h}`)) return false;
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  if (!sameOrigin(req)) return send(res, 403, 'Forbidden');

  if (req.method === 'GET' && url.pathname === '/') {
    if (url.searchParams.get('t') !== TOKEN) return send(res, 403, 'Missing or invalid setup token. Use the link printed in your terminal.');
    return send(res, 200, page());
  }

  if (req.method === 'POST' && url.pathname === '/save') {
    let body = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on('end', async () => {
      if (tooBig) return;
      const form = new URLSearchParams(body);
      if (form.get('t') !== TOKEN) return send(res, 403, 'Invalid setup token.');

      const publishable = (form.get('publishable') || '').trim();
      const secret = (form.get('secret') || '').trim();
      const webhook = (form.get('webhook') || '').trim();

      const errors = [];
      if (!publishable && !secret && !webhook) errors.push('Enter at least one key.');
      if (publishable && !PATTERNS.publishable.test(publishable)) errors.push('Publishable key must start with pk_live_ or pk_test_.');
      if (secret && !PATTERNS.secret.test(secret)) errors.push('Secret key must start with sk_live_, sk_test_, rk_live_ or rk_test_.');
      if (webhook && !PATTERNS.webhook.test(webhook)) errors.push('Webhook secret must start with whsec_.');
      if (secret.startsWith('pk_') || publishable.startsWith('sk_') || publishable.startsWith('rk_')) {
        errors.push('Looks like the publishable and secret keys are swapped.');
      }

      const effectivePk = publishable || currentValue('VITE_STRIPE_PUBLISHABLE_KEY');
      const effectiveSk = secret || currentValue('STRIPE_SECRET_KEY');
      if (effectivePk && effectiveSk && modeOf(effectivePk) !== modeOf(effectiveSk)) {
        errors.push(`Mode mismatch: publishable key is ${modeOf(effectivePk).toUpperCase()} but secret key is ${modeOf(effectiveSk).toUpperCase()}.`);
      }
      if (errors.length) return send(res, 400, page({ message: errors.join('\n'), isError: true }));

      const notes = [];
      if (secret) {
        const check = await verifySecretKey(secret);
        if (check.ok === false) return send(res, 400, page({ message: check.note, isError: true }));
        notes.push(check.note);
      }

      writeEnvValues({
        VITE_STRIPE_PUBLISHABLE_KEY: publishable,
        STRIPE_SECRET_KEY: secret,
        STRIPE_WEBHOOK_SECRET: webhook,
      });

      notes.unshift(`Saved to .env.local:\n• Publishable: ${mask(effectivePk)}\n• Secret: ${mask(effectiveSk)}${webhook ? `\n• Webhook: ${mask(webhook)}` : ''}`);
      notes.push('This setup server is now shutting down. You can close this tab.');
      send(res, 200, page({ message: notes.join('\n\n'), done: true }));
      console.log('\n✓ Stripe keys saved to .env.local (values not shown). Shutting down setup server.');
      setTimeout(() => server.close(() => process.exit(0)), 500);
    });
    return;
  }

  send(res, 404, 'Not found');
});

server.listen(PORT, HOST, () => {
  console.log('\nStripe key setup form (local only)');
  console.log(`Open: http://${HOST}:${PORT}/?t=${TOKEN}\n`);
  console.log('Press Ctrl+C to cancel.');
});
