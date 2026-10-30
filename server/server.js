import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiRouter } from './apiRouter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = process.env.PORT || 3001;
const router = new ApiRouter();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  // 1. API Route handling
  if (pathname.startsWith('/api/')) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // DoS protection: limit request payload to 1MB
      if (body.length > 1e6) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      const response = await router.handleRequest(req.method, pathname, req.headers, body);
      res.writeHead(response.status, response.headers);
      if (response.body !== null) {
        res.end(JSON.stringify(response.body));
      } else {
        res.end();
      }
    });
    return;
  }

  // 2. Static Asset Serving (Production SPA Fallback)
  let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found — Run npm run build first.');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================================================`);
  console.log(`🔒 DC ENTERPRISES HARDENED CASINO SERVER RUNNING`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🛡️  Server-Authoritative RNG: CSPRNG (Crypto RandomBytes Active)`);
  console.log(`📊 Audit Ledger: Merkle Hash-Chained SHA-256 Storage Active`);
  console.log(`💼 Wallet: Strict Invariant Guards & Atomic Concurrency Active`);
  console.log(`=================================================================`);
});

export default server;
