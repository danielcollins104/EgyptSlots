import fs from 'node:fs';
import path from 'node:path';
import { ApiRouter } from './apiRouter.js';

function loadEnvLocal() {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) return {};
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    const out = {};
    for (const line of lines) {
      const idx = line.indexOf('=');
      if (idx > 0) {
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        out[key] = val;
        if (!process.env[key]) process.env[key] = val;
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Vite Dev Server Middleware Plugin
 * Directly mounts the DC Enterprises Server-Authoritative Security Engine into Vite
 */
export function securityApiPlugin() {
  const envLocal = loadEnvLocal();
  const router = new ApiRouter({
    stripeSecretKey: envLocal.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '',
  });

  return {
    name: 'security-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';
        if (url.startsWith('/api/')) {
          const urlObj = new URL(url, 'http://localhost');
          const pathname = urlObj.pathname;

          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            try {
              const response = await router.handleRequest(req.method, pathname, req.headers, body);
              res.statusCode = response.status;
              for (const [k, v] of Object.entries(response.headers)) {
                res.setHeader(k, v);
              }
              if (response.body !== null) {
                res.end(JSON.stringify(response.body));
              } else {
                res.end();
              }
            } catch (err) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}
