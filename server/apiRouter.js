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
    this.redemptionQueue = [];
    this.ordersQueue = [];
  }

  /**
   * Resolves a store/custom package for order creation (custom amounts computed server-side
   * to match the client-side calculateCustomPackage economics).
   */
  resolvePackage(packageId, customAmountUsd = null, goldCoins = null, freeSweepsCoins = null) {
    const allPackages = [
      ...(SWEEPSTAKES_CONFIG.storePackages || []),
      ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
      ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
      ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
    ];
    let pkg = allPackages.find((p) => p.id === packageId);

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
      pkg = {
        id: packageId || `pkg_custom_${priceUsd}`,
        priceUsd,
        goldCoins: Number(goldCoins) > 0 ? Math.round(Number(goldCoins)) : Math.round(priceUsd * gcPerDollar),
        freeSweepsCoins:
          Number(freeSweepsCoins) > 0
            ? Number(Number(freeSweepsCoins).toFixed(2))
            : Number((priceUsd * (1 + bonusRate)).toFixed(2)),
        isCustom: true,
      };
    }

    return pkg || SWEEPSTAKES_CONFIG.storePackages[2] || null;
  }

  /**
   * Creates a reconcilable deposit order (Cash App P2P / manual bank / crypto-by-reference).
   * The operator confirms the funds arrived via /api/orders/update, which credits the player.
   */
  createDepositOrder({
    packageId = '',
    customAmountUsd = null,
    goldCoins = null,
    freeSweepsCoins = null,
    processorId = 'cashapp',
    orderRef = '',
    userId = '',
    senderTag = '',
  } = {}) {
    const pkg = this.resolvePackage(packageId, customAmountUsd, goldCoins, freeSweepsCoins);
    if (!pkg) throw new Error('Unknown package.');
    const entry = {
      id: `ord_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 999)}`,
      packageId: pkg.id,
      amountUsd: pkg.priceUsd,
      goldCoins: pkg.goldCoins,
      freeSweepsCoins: pkg.freeSweepsCoins,
      processorId,
      orderRef: orderRef || '',
      userId: userId || 'guest',
      senderTag: senderTag || '',
      status: 'awaiting_confirmation',
      createdAt: new Date().toISOString(),
    };
    this.ordersQueue.unshift(entry);
    this.ordersQueue = this.ordersQueue.slice(0, 200);
    if (this.server?.ledger) {
      this.server.ledger.append({
        userId: entry.userId,
        type: 'DEPOSIT_ORDER_CREATED',
        currency: 'USD',
        amount: entry.amountUsd,
        balanceBefore: 0,
        balanceAfter: 0,
        metadata: { orderId: entry.id, orderRef, processorId, packageId: pkg.id },
      });
    }
    return entry;
  }

  /**
   * Operator confirmation of a deposit order -> credits player wallet.
   * Idempotent: confirming the same order twice is a no-op.
   */
  async confirmDepositOrder(orderId, operatorNote = '') {
    const idx = this.ordersQueue.findIndex((o) => o.id === orderId);
    if (idx === -1) throw new Error(`Order not found: ${orderId}`);
    const order = this.ordersQueue[idx];
    if (order.status === 'confirmed') {
      return { order, alreadyConfirmed: true };
    }
    if (order.status === 'rejected') {
      throw new Error('Order was already rejected.');
    }
    const credit = await this.server.wallet.processPurchaseCredit(order.userId, {
      goldCoinsToAdd: order.goldCoins,
      freeSweepsCoinsToAdd: order.freeSweepsCoins,
      packageId: order.packageId,
      paymentRef: `${order.processorId}:${order.orderRef || order.id}`,
    });
    this.ordersQueue[idx] = {
      ...order,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      operatorNote: operatorNote || '',
      credit,
    };
    return { order: this.ordersQueue[idx], alreadyConfirmed: false };
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
    // Standard CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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

      // 5. DEPOSIT ORDERS (Cash App P2P / manual rails — operator-confirmed crediting)
      if (path === '/api/orders' && method === 'POST') {
        const entry = this.createDepositOrder({
          packageId: parsedBody.packageId,
          customAmountUsd: parsedBody.amountUsd ?? parsedBody.customAmountUsd ?? null,
          goldCoins: parsedBody.goldCoins ?? null,
          freeSweepsCoins: parsedBody.freeSweepsCoins ?? null,
          processorId: parsedBody.processorId || 'cashapp',
          orderRef: parsedBody.orderRef || '',
          userId: parsedBody.userId || parsedBody.playerEmail || 'guest',
          senderTag: parsedBody.senderTag || '',
        });
        return { status: 201, headers: corsHeaders, body: { success: true, order: entry } };
      }

      if (path === '/api/orders' && method === 'GET') {
        // Order queue may contain player identifiers — ADMIN role required
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        this.server.authService.validateSession(token, 'ADMIN');
        return { status: 200, headers: corsHeaders, body: { success: true, orders: this.ordersQueue } };
      }

      if (path === '/api/orders/update' && method === 'POST') {
        // Confirming deposits credits real player balances — ADMIN role required
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        this.server.authService.validateSession(token, 'ADMIN');
        const { orderId, action, operatorNote } = parsedBody;
        if (action === 'confirm') {
          const res = await this.confirmDepositOrder(orderId, operatorNote || '');
          return { status: 200, headers: corsHeaders, body: { success: true, ...res } };
        }
        const idx = this.ordersQueue.findIndex((o) => o.id === orderId);
        if (idx !== -1) {
          this.ordersQueue[idx] = { ...this.ordersQueue[idx], status: action === 'reject' ? 'rejected' : this.ordersQueue[idx].status, operatorNote: operatorNote || '' };
        }
        return { status: 200, headers: corsHeaders, body: { success: true, orderId, action } };
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

      // 8. PAYMENT STATUS CALLBACKS (reserved for processor webhooks — Skrill status URL, etc.)
      // Crypto deposits are verified on-chain via /api/crypto/verify; Cash App orders are
      // confirmed by the operator via /api/orders/update. Processor-specific callbacks
      // (e.g. Skrill) plug in here when those rails are enabled.
      if (path === '/api/payments/status' && method === 'POST') {
        return {
          status: 200,
          headers: corsHeaders,
          body: { success: true, received: true, timestamp: new Date().toISOString() },
        };
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
          body: { status: 'healthy', version: '3.0.0-multi-rail-cashier', timestamp: new Date().toISOString() },
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
