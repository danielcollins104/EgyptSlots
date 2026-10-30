import { ApiRouter } from './apiRouter.js';

/**
 * Vite Dev Server Middleware Plugin
 * Directly mounts the DC Enterprises Server-Authoritative Security Engine into Vite
 */
export function securityApiPlugin() {
  const router = new ApiRouter();

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
