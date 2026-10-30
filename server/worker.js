import { ApiRouter } from './apiRouter.js';

let routerInstance = null;

function getRouter() {
  if (!routerInstance) {
    routerInstance = new ApiRouter();
  }
  return routerInstance;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      const router = getRouter();
      const headers = Object.fromEntries(request.headers.entries());
      const body = (request.method !== 'GET' && request.method !== 'HEAD' && request.method !== 'OPTIONS')
        ? await request.text()
        : '';

      const response = await router.handleRequest(request.method, url.pathname, headers, body);
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
