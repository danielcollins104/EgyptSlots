import { SecurityServer } from './SecurityServer.js';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';
import {
  verifyCryptoDeposit,
  getLiveWalletBalancesStatus,
} from '../src/services/cryptoVerifierService.js';

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
        'dc_pharaoh_chakra_ledger_master_secret_2026_salt_99x',
      signingKey:
        options.signingKey ||
        (typeof process !== 'undefined' && process.env?.DC_SPIN_SIGNING_KEY) ||
        'dc_spin_master_signing_key_pharaoh_777',
      adminSecret:
        options.adminSecret ||
        (typeof process !== 'undefined' && process.env?.DC_ADMIN_SECRET) ||
        null,
      initialAccounts: options.initialAccounts || {},
    });
    this.stripeSecretKey =
      options.stripeSecretKey ||
      (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) ||
      '';
    this.stripeWebhookSecret =
      options.stripeWebhookSecret ||
      (typeof process !== 'undefined' && process.env?.STRIPE_WEBHOOK_SECRET) ||
      '';
    this.redemptionQueue = [];
  }

  /**
   * Creates a live Stripe Checkout Session via the Stripe REST API (fetch-based, 100% Cloudflare Workers & Node compatible)
   */
  async createStripeCheckoutSession({
    packageId,
    customAmountUsd = null,
    goldCoins = null,
    freeSweepsCoins = null,
    paymentMethod = 'card',
    origin = 'https://oopsiwon.com',
    customerEmail = '',
    userId = '',
  }) {
    const allPackages = [
      ...(SWEEPSTAKES_CONFIG.storePackages || []),
      ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
      ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
      ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
    ];
    let pkg = allPackages.find((p) => p.id === packageId);

    // Support Custom Amount packages dynamically
    if (!pkg && (String(packageId || '').startsWith('pkg_custom') || Number(customAmountUsd) >= 1)) {
      const priceUsd = Number(Math.max(1, Math.min(1000000, Number(customAmountUsd) || 25)).toFixed(2));
      const bonusRate =
        priceUsd >= 50000
          ? 0.25
          : priceUsd >= 10000
          ? 0.18
          : priceUsd >= 100
          ? 0.15
          : priceUsd >= 20
          ? 0.10
          : priceUsd >= 10
          ? 0.05
          : 0;
      const gcPerDollar =
        priceUsd >= 100 ? 4000 : priceUsd >= 50 ? 3500 : priceUsd >= 20 ? 3000 : priceUsd >= 10 ? 2500 : 2000;
      const computedGC = Number(goldCoins) > 0 ? Math.round(Number(goldCoins)) : Math.round(priceUsd * gcPerDollar);
      const computedSC =
        Number(freeSweepsCoins) > 0
          ? Number(Number(freeSweepsCoins).toFixed(2))
          : Number((priceUsd * (1 + bonusRate)).toFixed(2));

      pkg = {
        id: packageId || `pkg_custom_${priceUsd}`,
        priceUsd,
        goldCoins: computedGC,
        freeSweepsCoins: computedSC,
        isCustom: true,
      };
    }

    if (!pkg) {
      pkg = SWEEPSTAKES_CONFIG.storePackages[2];
    }

    const secretKey =
      this.stripeSecretKey ||
      (typeof process !== 'undefined' && process.env?.STRIPE_SECRET_KEY) ||
      '';

    const cleanOrigin = origin.replace(/\/$/, '');
    const successUrl = `${cleanOrigin}/?payment_success=true&pkg=${encodeURIComponent(pkg.id)}&amount=${encodeURIComponent(pkg.priceUsd)}&gc=${encodeURIComponent(pkg.goldCoins)}&sc=${encodeURIComponent(pkg.freeSweepsCoins)}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${cleanOrigin}/?payment_cancelled=true&pkg=${encodeURIComponent(pkg.id)}`;

    // For Cash App Pay, route directly to the live $Cashtag payment link ($Daniel-Collins-168/<amount>)
    if (paymentMethod === 'cashapp') {
      const cashAppDirectUrl =
        pkg.cashAppPaymentLink ||
        `https://cash.app/$Daniel-Collins-168/${Number(pkg.priceUsd) % 1 === 0 ? Number(pkg.priceUsd) : Number(pkg.priceUsd).toFixed(2)}`;
      return {
        success: true,
        url: cashAppDirectUrl,
        sessionId: `cs_live_cashapp_${Date.now()}`,
        mode: 'cashapp_live',
        package: pkg,
      };
    }

    // If Stripe Secret Key is available, create a real Stripe Checkout Session via api.stripe.com
    let stripeErrorMessage = '';
    if (secretKey && (secretKey.startsWith('sk_') || secretKey.startsWith('rk_'))) {
      try {
        const params = new URLSearchParams();
        params.append('mode', 'payment');
        params.append('success_url', successUrl);
        params.append('cancel_url', cancelUrl);
        params.append('client_reference_id', pkg.id);

        const unitAmountCents = Math.round(Number(pkg.priceUsd) * 100);
        params.append('line_items[0][price_data][currency]', 'usd');
        params.append('line_items[0][price_data][unit_amount]', String(unitAmountCents));
        params.append(
          'line_items[0][price_data][product_data][name]',
          `${pkg.goldCoins.toLocaleString()} Gold Coins + ${pkg.freeSweepsCoins.toFixed(2)} Free SC Bonus`
        );
        params.append(
          'line_items[0][price_data][product_data][description]',
          `Pharaoh's Chakra Dynasty Social Casino Bundle — Includes ${pkg.goldCoins.toLocaleString()} Gold Coins (GC) + ${pkg.freeSweepsCoins.toFixed(2)} Free Promotional Sweeps Coins (SC)`
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
        if (sessionData && sessionData.error && sessionData.error.message) {
          stripeErrorMessage = sessionData.error.message;
        }
      } catch (err) {
        console.warn('[Stripe Checkout Session Error]:', err.message);
      }
    }

    // Fallback to dedicated Card Stripe Payment Link (always live)
    const fallbackLink = pkg.stripePaymentLink || 'https://buy.stripe.com/28EdR893bcAz0XGezQ8ww04';
    const sep = fallbackLink.includes('?') ? '&' : '?';
    const url = `${fallbackLink}${sep}client_reference_id=${encodeURIComponent(pkg.id)}`;

    return {
      success: true,
      url,
      sessionId: `cs_link_${Date.now()}`,
      mode: 'payment_link',
      stripeWarning: stripeErrorMessage || undefined,
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
    if (env && env.STRIPE_WEBHOOK_SECRET && !this.stripeWebhookSecret) {
      this.stripeWebhookSecret = env.STRIPE_WEBHOOK_SECRET;
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

      // 3. PRIZE REDEMPTION & ADMIN PAYOUT QUEUE
      if (path === '/api/redeem' && method === 'POST') {
        if (!token) return { status: 401, headers: corsHeaders, body: { error: 'Authentication required' } };
        const res = await this.server.handleRedemptionRequest(token, parsedBody);
        return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
      }

      if (path === '/api/redemptions' && method === 'GET') {
        // Payout queue contains player payout destinations (PII) — ADMIN role required
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        this.server.authService.validateSession(token, 'ADMIN');
        return {
          status: 200,
          headers: corsHeaders,
          body: { success: true, redemptions: this.redemptionQueue },
        };
      }

      if (path === '/api/redemptions' && method === 'POST') {
        const entry = {
          id: parsedBody.id || `rdm_${Date.now().toString(36).toUpperCase()}`,
          timestamp: parsedBody.timestamp || new Date().toISOString(),
          status: parsedBody.status || 'processing',
          ...parsedBody,
        };
        this.redemptionQueue.unshift(entry);
        this.redemptionQueue = this.redemptionQueue.slice(0, 100);
        if (this.server && this.server.ledger) {
          this.server.ledger.append({
            userId: entry.userId || entry.playerEmail || 'SYSTEM_REDEMPTION_QUEUE',
            type: 'REDEMPTION_QUEUED',
            currency: 'SC',
            amount: -(Number(entry.amountSC) || 0),
            balanceBefore: Number(entry.balanceBefore) || 0,
            balanceAfter: Number(entry.balanceAfter) || 0,
            metadata: {
              redemptionId: entry.id,
              amountSC: entry.amountSC,
              amountUsd: entry.amountUsd,
              method: entry.method,
              destinationMasked: entry.destinationMasked,
            },
          });
        }
        return { status: 200, headers: corsHeaders, body: { success: true, redemption: entry } };
      }

      if (path === '/api/redemptions/update' && method === 'POST') {
        // Approving / rejecting payouts moves real money — ADMIN role required
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        this.server.authService.validateSession(token, 'ADMIN');
        const { redemptionId, action, updated } = parsedBody;
        const idx = this.redemptionQueue.findIndex((r) => r.id === redemptionId);
        if (idx !== -1 && updated) {
          this.redemptionQueue[idx] = { ...this.redemptionQueue[idx], ...updated };
        } else if (updated) {
          this.redemptionQueue.unshift(updated);
        }
        if (this.server && this.server.ledger) {
          this.server.ledger.append({
            userId: updated?.userId || 'ADMIN_OPERATOR',
            type: 'REDEMPTION_UPDATED',
            currency: 'SC',
            amount: 0,
            balanceBefore: 0,
            balanceAfter: 0,
            metadata: {
              redemptionId,
              action,
              status: updated?.status,
              txHashOrReceipt: updated?.txHashOrReceipt,
            },
          });
        }
        return { status: 200, headers: corsHeaders, body: { success: true, redemptionId, action } };
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
          customAmountUsd: parsedBody.customAmountUsd,
          goldCoins: parsedBody.goldCoins,
          freeSweepsCoins: parsedBody.freeSweepsCoins,
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

      if (path === '/api/admin/verify' && method === 'GET') {
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        const session = this.server.authService.validateSession(token, 'ADMIN');
        return {
          status: 200,
          headers: corsHeaders,
          body: {
            success: true,
            user: { id: session.userId, name: session.name, email: session.email, role: session.role },
            expiresAt: session.expiresAt,
          },
        };
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

      // 7. PROVABLY FAIR PUBLIC COMMITMENT, SEED ROTATION & SPIN VERIFIER
      if (path === '/api/provably-fair' && method === 'GET') {
        const commitment = this.server.getProvablyFairCommitment();
        return { status: 200, headers: corsHeaders, body: { success: true, ...commitment } };
      }

      if (path === '/api/provably-fair/rotate' && method === 'POST') {
        const rotated = this.server.rotateProvablyFairSeed();
        return { status: 200, headers: corsHeaders, body: { success: true, ...rotated } };
      }

      if (path === '/api/provably-fair/verify' && method === 'POST') {
        const verification = this.server.verifyProvablyFairSpin(parsedBody);
        return { status: 200, headers: corsHeaders, body: { success: true, ...verification } };
      }

      // 7.5 USER PERSONAL AUDIT LEDGER
      if (path === '/api/ledger/user' && (method === 'GET' || method === 'POST')) {
        if (!token) return { status: 401, headers: corsHeaders, body: { error: 'Authentication required' } };
        const history = this.server.getUserAuditHistory(token, Number(parsedBody?.limit) || 50);
        return { status: 200, headers: corsHeaders, body: { success: true, history } };
      }

      // 8. STRIPE PAYMENT WEBHOOK
      if ((path === '/api/webhooks/stripe' || path === '/api/stripe/webhook') && method === 'POST') {
        const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
        const rawBody = typeof body === 'string' ? body : '';
        const webhookSecret =
          this.stripeWebhookSecret ||
          env?.STRIPE_WEBHOOK_SECRET ||
          (typeof process !== 'undefined' && process.env?.STRIPE_WEBHOOK_SECRET) ||
          '';
        const res = await this.server.handleStripeWebhook({
          eventId: parsedBody.id || parsedBody.eventId || `evt_${Date.now()}`,
          eventType: parsedBody.type || parsedBody.eventType || 'checkout.session.completed',
          dataObject: parsedBody.data?.object || parsedBody.dataObject || {},
          signatureHeader: signature,
          webhookSecret,
          rawBody,
        });
        return { status: 200, headers: corsHeaders, body: res };
      }

      // 8.5 LIVE ON-CHAIN CRYPTO VERIFICATION & WALLET STATUS
      if ((path === '/api/crypto/verify' || path === '/api/verify-crypto-tx') && method === 'POST') {
        const verification = await verifyCryptoDeposit({
          symbol: parsedBody.symbol || 'USDT',
          expectedAmount: Number(parsedBody.expectedAmount) || 0,
          txHash: parsedBody.txHash || '',
          minTimestampSec: Number(parsedBody.minTimestampSec) || 0,
        });
        return {
          status: 200,
          headers: corsHeaders,
          body: {
            success: verification.verified,
            ...verification,
            timestamp: new Date().toISOString(),
          },
        };
      }

      if (path === '/api/crypto/wallets-status' && (method === 'GET' || method === 'POST')) {
        const status = await getLiveWalletBalancesStatus();
        return {
          status: 200,
          headers: corsHeaders,
          body: {
            success: true,
            ...status,
          },
        };
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
