import { ApiRouter } from './apiRouter.js';

let routerInstance = null;

function getRouter(env) {
  if (!routerInstance) {
    routerInstance = new ApiRouter({
      stripeSecretKey: env?.STRIPE_SECRET_KEY || '',
      stripeWebhookSecret: env?.STRIPE_WEBHOOK_SECRET || '',
      ledgerSecret: env?.DC_LEDGER_SECRET,
      signingKey: env?.DC_SPIN_SIGNING_KEY,
      adminSecret: env?.DC_ADMIN_SECRET,
    });
  }
  return routerInstance;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const router = getRouter(env);
      const headers = Object.fromEntries(request.headers.entries());
      const body =
        request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS'
          ? await request.text()
          : '';

      const response = await router.handleRequest(request.method, url.pathname, headers, body, env);
      return new Response(response.body !== null ? JSON.stringify(response.body) : null, {
        status: response.status,
        headers: response.headers,
      });
    }

    // Pass-through to Cloudflare Workers static assets binding if available
    if (env && env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetRes.headers);
      newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      newHeaders.set('X-Content-Type-Options', 'nosniff');
      newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return new Response(assetRes.body, {
        status: assetRes.status,
        statusText: assetRes.statusText,
        headers: newHeaders,
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
