import { SecurityServer } from './SecurityServer.js';

/**
 * Universal API Request Handler for DC Enterprises Casino
 * Can be mounted on Node http, Express, Vite middleware, or Cloudflare Workers
 */
export class ApiRouter {
  constructor(options = {}) {
    this.server = new SecurityServer({
      ledgerSecret: process.env.DC_LEDGER_SECRET || 'dc_kemet_ledger_master_secret_2026_salt_99x',
      signingKey: process.env.DC_SPIN_SIGNING_KEY || 'dc_spin_master_signing_key_kemet_777',
      adminSecret: process.env.DC_ADMIN_SECRET || 'dc_admin_super_secret_kemet_999!',
      initialAccounts: options.initialAccounts || {},
    });
  }

  /**
   * Universal Dispatcher
   * @param {string} method - 'GET' | 'POST' | 'OPTIONS'
   * @param {string} path - URL path (e.g. '/api/spin')
   * @param {object} headers - HTTP request headers
   * @param {object|string} body - Parsed JSON body or raw string
   * @returns {Promise<{ status: number, headers: object, body: any }>}
   */
  async handleRequest(method, path, headers = {}, body = {}) {
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

    const parsedBody = typeof body === 'string' && body.length > 0 ? JSON.parse(body) : (body || {});

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

      // 5. ADMINISTRATOR ENDPOINTS
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

      // 6. PROVABLY FAIR PUBLIC COMMITMENT
      if (path === '/api/provably-fair' && method === 'GET') {
        const commitment = this.server.getProvablyFairCommitment();
        return { status: 200, headers: corsHeaders, body: { success: true, ...commitment } };
      }

      // 7. STRIPE PAYMENT WEBHOOK
      if (path === '/api/webhooks/stripe' && method === 'POST') {
        const signature = headers['stripe-signature'] || headers['Stripe-Signature'];
        const res = await this.server.handlePaymentWebhook(parsedBody, signature);
        return { status: 200, headers: corsHeaders, body: res };
      }

      // 8. HEALTH CHECK
      if (path === '/api/health') {
        return {
          status: 200,
          headers: corsHeaders,
          body: { status: 'healthy', version: '2.0.0-hardened', timestamp: new Date().toISOString() },
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
