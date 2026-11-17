/**
 * Cloudflare Worker entry: STATIC ASSETS ONLY.
 *
 * The financial API (wallets, ledger, payments, redemptions, spins) needs a durable transactional store and
 * runs on the Node server (`npm run server`, see docs/payments-and-security.md). Workers isolates are
 * ephemeral, so serving money routes from here would silently lose balances; they fail closed instead.
 * Point the client at the Node API origin and add that origin to DC_CORS_ORIGINS if you split hosting.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return new Response(
        JSON.stringify({ success: false, error: { code: 'API_UNAVAILABLE', message: 'Financial API is not served from this edge deployment.' } }),
        { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }

    if (env && env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      const newHeaders = new Headers(assetRes.headers);
      newHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      newHeaders.set('X-Content-Type-Options', 'nosniff');
      newHeaders.set('X-Frame-Options', 'SAMEORIGIN');
      newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      return new Response(assetRes.body, { status: assetRes.status, statusText: assetRes.statusText, headers: newHeaders });
    }

    return new Response('Not Found', { status: 404 });
  },
};
