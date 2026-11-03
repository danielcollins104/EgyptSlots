import { SecurityServer } from './SecurityServer.js';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';

/**
 * Universal API Request Handler for DC Enterprises Casino
 * Can be mounted on Node http, Express, Vite middleware, or Cloudflare Workers
 */
export class ApiRouter {
  constructor(options = {}) {
    this.server = new SecurityServer({
      ledgerSecret:
        options.ledgerSecret ||
        (typeof process !== 'undefined' && process.env?.DC_LEDGER_SECRET) ||
        'dc_kemet_ledger_master_secret_2026_salt_99x',
      signingKey:
        options.signingKey ||
        (typeof process !== 'undefined' && process.env?.DC_SPIN_SIGNING_KEY) ||
        'dc_spin_master_signing_key_kemet_777',
      adminSecret:
        options.adminSecret ||
        (typeof process !== 'undefined' && process.env?.DC_ADMIN_SECRET) ||
        'dc_admin_super_secret_kemet_999!',
      initialAccounts: options.initialAccounts || {},
    });
    this.stripeSecretKey =
      options.stripeSecretKey ||
      (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) ||
      '';
  }

  /**
   * Creates a live Stripe Checkout Session via the Stripe REST API (fetch-based, 100% Cloudflare Workers & Node compatible)
   */
  async createStripeCheckoutSession({ packageId, paymentMethod = 'card', origin = 'https://oopsiwon.com', customerEmail = '', userId = '' }) {
    const allPackages = [
      ...(SWEEPSTAKES_CONFIG.storePackages || []),
      ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
      ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
    ];
    const pkg = allPackages.find((p) => p.id === packageId) || SWEEPSTAKES_CONFIG.storePackages[2];
    const secretKey =
      this.stripeSecretKey ||
      (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) ||
      '';

    const cleanOrigin = origin.replace(/\/$/, '');
    const successUrl = `${cleanOrigin}/?payment_success=true&pkg=${encodeURIComponent(pkg.id)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${cleanOrigin}/?payment_cancelled=true&pkg=${encodeURIComponent(pkg.id)}`;

    // If Stripe Secret Key is available, create a real Stripe Checkout Session via api.stripe.com
    if (secretKey && (secretKey.startsWith('sk_') || secretKey.startsWith('rk_'))) {
      try {
        const params = new URLSearchParams();
        params.append('mode', 'payment');
        params.append('success_url', successUrl);
        params.append('cancel_url', cancelUrl);
        params.append('client_reference_id', pkg.id);

        // Use dedicated Payment Method Configuration so:
        // - 'cashapp' opens the Cash App Pay ONLY checkout (pmc_1UXhpsPDpwmSIl1L5VgVrY0C)
        // - 'card' opens the Card ONLY checkout (pmc_1UXhqOPDpwmSIl1LZIkmCt4R)
        // and Stripe Link passkey prompts are completely disabled on both!
        if (paymentMethod === 'cashapp') {
          params.append('payment_method_configuration', 'pmc_1UXhpsPDpwmSIl1L5VgVrY0C');
        } else {
          params.append('payment_method_configuration', 'pmc_1UXhqOPDpwmSIl1LZIkmCt4R');
        }

        const unitAmountCents = Math.round(Number(pkg.priceUsd) * 100);
        params.append('line_items[0][price_data][currency]', 'usd');
        params.append('line_items[0][price_data][unit_amount]', String(unitAmountCents));
        params.append(
          'line_items[0][price_data][product_data][name]',
          `${pkg.goldCoins.toLocaleString()} Gold Coins + ${pkg.freeSweepsCoins.toFixed(2)} Free SC Bonus`
        );
        params.append(
          'line_items[0][price_data][product_data][description]',
          `Crowns of Kemet Social Casino Bundle — Includes ${pkg.goldCoins.toLocaleString()} Gold Coins (GC) + ${pkg.freeSweepsCoins.toFixed(2)} Free Promotional Sweeps Coins (SC)`
        );
        params.append('line_items[0][quantity]', '1');

        params.append('metadata[packageId]', pkg.id);
        params.append('metadata[goldCoins]', String(pkg.goldCoins));
        params.append('metadata[freeSweepsCoins]', String(pkg.freeSweepsCoins));
        params.append('metadata[paymentMethod]', paymentMethod);
        if (userId) {
          params.append('metadata[userId]', userId);
        }

        const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params.toString(),
        });

        const sessionData = await stripeRes.json();
        if (stripeRes.ok && sessionData.url) {
          return {
            success: true,
            url: sessionData.url,
            sessionId: sessionData.id,
            mode: 'stripe_checkout_session',
            package: pkg,
          };
        }
      } catch (err) {
        console.warn('[Stripe Checkout Session Error]:', err.message);
      }
    }

    // Fallback to dedicated Cash App Pay or Card Stripe Payment Link with return_url
    const fallbackLink =
      paymentMethod === 'cashapp'
        ? pkg.cashAppStripePaymentLink || pkg.stripePaymentLink || ''
        : pkg.stripePaymentLink || '';
    const sep = fallbackLink.includes('?') ? '&' : '?';
    const url = fallbackLink
      ? `${fallbackLink}${sep}client_reference_id=${encodeURIComponent(pkg.id)}`
      : `${cleanOrigin}/?payment_success=true&pkg=${encodeURIComponent(pkg.id)}`;

    return {
      success: true,
      url,
      sessionId: `cs_link_${Date.now()}`,
      mode: 'payment_link',
      package: pkg,
    };
  }

  /**
   * Universal Dispatcher
   * @param {string} method - 'GET' | 'POST' | 'OPTIONS'
   * @param {string} path - URL path (e.g. '/api/spin')
   * @param {object} headers - HTTP request headers
   * @param {object|string} body - Parsed JSON body or raw string
   * @param {object} env - Optional Cloudflare Worker env bindings
   * @returns {Promise<{ status: number, headers: object, body: any }>}
   */
  async handleRequest(method, path, headers = {}, body = {}, env = {}) {
    if (env && env.STRIPE_SECRET_KEY && !this.stripeSecretKey) {
      this.stripeSecretKey = env.STRIPE_SECRET_KEY;
    }

    // Standard CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Stripe-Signature',
      'Content-Type': 'application/json',
    };

    if (method === 'OPTIONS') {
      return { status: 204, headers: corsHeaders, body: null };
    }

    // Extract Bearer token
    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : (authHeader || null);

    let parsedBody = {};
    try {
      parsedBody = typeof body === 'string' && body.length > 0 ? JSON.parse(body) : (body || {});
    } catch {
      parsedBody = {};
    }

    try {
      // 1. GAME OUTCOME & SPIN
      if (path === '/api/spin' && method === 'POST') {
        let activeToken = token;
        if (!activeToken) {
          // Guest session auto-creation with guest scope
          const guestSession = this.server.authService.createSession({
            id: parsedBody.userId || 'usr_guest_' + Date.now().toString(36),
            role: 'PLAYER',
            name: 'Guest Player',
            email: 'guest@oopsiwon.com',
          });
          activeToken = guestSession.token;
        }

        const result = await this.server.handleSpinRequest(activeToken, {
          currencyMode: parsedBody.currencyMode || 'GC',
          betLevel: parsedBody.betLevel || 1,
          clientSeed: parsedBody.clientSeed,
          currentBetSC: parsedBody.currentBetSC,
        });

        return {
          status: 200,
          headers: corsHeaders,
          body: { success: true, ...result, token: activeToken },
        };
      }

      // 2. GET USER BALANCE
      if (path === '/api/balance' && (method === 'GET' || method === 'POST')) {
        let activeToken = token;
        if (!activeToken && parsedBody.userId) {
          const s = this.server.authService.createSession({ id: parsedBody.userId, role: 'PLAYER' });
          activeToken = s.token;
        }
        if (!activeToken) {
          return { status: 401, headers: corsHeaders, body: { error: 'Authentication required' } };
        }
        const balance = await this.server.getBalance(activeToken);
        return { status: 200, headers: corsHeaders, body: { success: true, balance } };
      }

      // 3. PRIZE REDEMPTION
      if (path === '/api/redeem' && method === 'POST') {
        if (!token) return { status: 401, headers: corsHeaders, body: { error: 'Authentication required' } };
        const res = await this.server.handleRedemptionRequest(token, parsedBody);
        return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
      }

      // 4. PLAYER AUTHENTICATION
      if (path === '/api/auth/register' && method === 'POST') {
        const { email, password, name } = parsedBody;
        const res = this.server.authService.registerUser({ email, password, name });
        // Initialize balance in server wallet
        this.server.wallet.getAccount(res.user.id);
        return { status: 201, headers: corsHeaders, body: { success: true, ...res } };
      }

      if (path === '/api/auth/login' && method === 'POST') {
        const { email, password } = parsedBody;
        const res = this.server.authService.loginUser(email, password);
        return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
      }

      if (path === '/api/auth/logout' && method === 'POST') {
        if (token) this.server.authService.revokeSession(token);
        return { status: 200, headers: corsHeaders, body: { success: true, message: 'Logged out' } };
      }

      // 5. STRIPE CHECKOUT SESSION CREATION
      if ((path === '/api/checkout/create-session' || path === '/api/stripe/create-checkout-session') && method === 'POST') {
        const reqOrigin = headers['origin'] || headers['Origin'] || parsedBody.origin || 'https://oopsiwon.com';
        const sessionRes = await this.createStripeCheckoutSession({
          packageId: parsedBody.packageId,
          paymentMethod: parsedBody.paymentMethod || 'card',
          origin: reqOrigin,
          customerEmail: parsedBody.email || '',
          userId: parsedBody.userId || '',
        });
        return { status: 200, headers: corsHeaders, body: sessionRes };
      }

      // 6. ADMINISTRATOR ENDPOINTS
      if (path === '/api/admin/login' && method === 'POST') {
        const { adminKey } = parsedBody;
        const res = this.server.adminLogin(adminKey);
        return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
      }

      if (path === '/api/admin/adjust-balance' && method === 'POST') {
        if (!token) return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        const res = await this.server.adminAdjustBalance(token, parsedBody);
        return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
      }

      if (path === '/api/admin/ledger' && method === 'GET') {
        if (!token) return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        const chain = this.server.adminGetFullLedger(token, 100);
        const integrity = this.server.verifyLedgerIntegrity(token);
        return { status: 200, headers: corsHeaders, body: { success: true, chain, integrity } };
      }

      // 7. PROVABLY FAIR PUBLIC COMMITMENT
      if (path === '/api/provably-fair' && method === 'GET') {
        const commitment = this.server.getProvablyFairCommitment();
        return { status: 200, headers: corsHeaders, body: { success: true, ...commitment } };
      }

      // 8. STRIPE PAYMENT WEBHOOK
      if (path === '/api/webhooks/stripe' && method === 'POST') {
        const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
        const res = await this.server.handleStripeWebhook({
          eventId: parsedBody.id || parsedBody.eventId || `evt_${Date.now()}`,
          eventType: parsedBody.type || parsedBody.eventType || 'checkout.session.completed',
          dataObject: parsedBody.data?.object || parsedBody.dataObject || {},
          signatureHeader: signature,
        });
        return { status: 200, headers: corsHeaders, body: res };
      }

      // 9. HEALTH CHECK
      if (path === '/api/health') {
        return {
          status: 200,
          headers: corsHeaders,
          body: { status: 'healthy', version: '2.1.0-stripe-cashier', timestamp: new Date().toISOString() },
        };
      }

      return { status: 404, headers: corsHeaders, body: { error: `Endpoint not found: ${path}` } };
    } catch (err) {
      console.error(`[API ERROR] ${path}:`, err.message);
      const isAuth = err.message.includes('Unauthorized') || err.message.includes('Forbidden');
      return {
        status: isAuth ? 403 : 400,
        headers: corsHeaders,
        body: { error: err.message, timestamp: new Date().toISOString() },
      };
    }
  }
}
