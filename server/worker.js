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
      return env.ASSETS.fetch(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
