import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ApiRouter } from './apiRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = process.env.PORT || 3001;
const MAX_BODY = 256 * 1024;

const router = new ApiRouter();
const { config, gateway, payments } = router.f;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

// CSP: scripts are same-origin plus the exact hashes of the inline scripts/handlers found in the built index.html.
function buildCsp() {
  const hashes = [];
  const handlerHashes = [];
  try {
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
    const h = (t) => `'sha256-${crypto.createHash('sha256').update(t, 'utf8').digest('base64')}'`;
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) if (m[1].trim()) hashes.push(h(m[1]));
    for (const m of html.matchAll(/\son(?:load|error|click)="([^"]*)"/gi)) handlerHashes.push(h(m[1]));
  } catch { /* dist not built yet */ }
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'", ...hashes, ...(handlerHashes.length ? ["'unsafe-hashes'", ...handlerHashes] : [])].join(' ');
  return [
    "default-src 'self'", `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:", "media-src 'self' data: blob:", "worker-src 'self' blob:",
    // The browser talks only to this origin (plus an optional split API origin); no third-party RPC/payment calls.
    `connect-src 'self' ${config.corsOrigins.filter((o) => o.startsWith('https://')).join(' ')}`.trim(),
    "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
}

const STATIC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': buildCsp(),
};
if (config.isProd) STATIC_HEADERS['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

function clientIp(req) {
  if (config.trustProxy) {
    const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || 'unknown';
}

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  if (pathname.startsWith('/api/')) {
    const chunks = [];
    let size = 0;
    let aborted = false;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end('{"success":false,"error":{"code":"TOO_LARGE","message":"Payload too large."}}');
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', async () => {
      if (aborted) return;
      const response = await router.handleRequest(req.method, pathname, req.headers, Buffer.concat(chunks).toString('utf8'), {}, { ip: clientIp(req) });
      res.writeHead(response.status, response.headers);
      res.end(response.body !== null ? JSON.stringify(response.body) : undefined);
    });
    return;
  }

  // Static assets (production SPA fallback). Path traversal guarded by resolve + prefix check.
  let filePath = path.resolve(DIST_DIR, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!filePath.startsWith(DIST_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream', ...STATIC_HEADERS });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found - run npm run build first.');
  }
});

// Background jobs: on-chain deposit scanning + intent expiry. Failures are logged, never fatal.
if (gateway.enabled) {
  setInterval(async () => {
    for (const n of Object.keys(gateway.networks)) {
      try { await gateway.scanNetwork(n); } catch (e) { console.error(`[crypto-scan:${n}]`, e.message); }
    }
  }, 30000).unref();
}
setInterval(() => { try { payments.expireStale(); } catch (e) { console.error('[expire]', e.message); } }, 60000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Casino server on http://localhost:${PORT} (${config.nodeEnv})`);
  console.log(`Providers: ${[...payments.providers.keys()].join(', ') || 'none'} | Crypto: ${Object.keys(gateway.networks).join(', ') || 'disabled'}`);
});

export default server;
