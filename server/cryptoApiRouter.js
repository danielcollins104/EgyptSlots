import { SecurityServer } from './SecurityServer.js';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';
import {
  verifyCryptoDeposit,
  getLiveWalletBalancesStatus,
} from '../src/services/cryptoVerifierService.js';
import {
  cryptoGateway,
  isValidCryptoAddress,
  verifyGatewayIpn,
} from './cryptoGateway.js';

/**
 * LEGACY API Request Handler for DC Enterprises Casino (SecurityServer-based).
 * Mounted by server/apiRouter.js as a fallback for routes the finance backend
 * does not own: /api/spin, /api/orders*, /api/crypto/*, /api/redeem,
 * /api/redemptions/update, /api/provably-fair/*, /api/ledger/user,
 * legacy /api/admin/login|verify|adjust-balance|ledger.
 * Do not add new features here — new work goes into the finance backend.
 *
 * LIVE CRYPTO (v3.1.0):
 *   Deposits : POST /api/crypto/invoice           -> create live gateway invoice (NOWPayments-compatible)
 *              POST /api/crypto/gateway-ipn       -> signed payment webhook -> idempotent auto-credit
 *              GET  /api/crypto/invoice-status    -> cashier polling
 *   Payouts  : POST /api/crypto/payout-request    -> validated payout order (queued, idempotent)
 *              GET  /api/crypto/payouts           -> operator queue (ADMIN)
 *              POST /api/crypto/payouts/process   -> auto-send via gateway OR manual txHash (ADMIN, idempotent)
 */
export class CryptoApiRouter {
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
    this.cryptoPayoutQueue = [];
    this.gatewayInvoices = new Map(); // paymentId -> { orderId, userId, packageId }
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

  // =========================================================================
  // LIVE CRYPTO RAILS (gateway invoices + automated payouts)
  // =========================================================================

  /**
   * Creates a live deposit invoice through the configured crypto gateway.
   * Also creates a reconcilable deposit order tied to the gateway payment id.
   */
  async createCryptoInvoice({ packageId = '', customAmountUsd = null, userId = 'guest', payCurrency = 'usdt' } = {}) {
    const pkg = this.resolvePackage(packageId, customAmountUsd);
    if (!pkg) throw new Error('Unknown package.');
    const order = this.createDepositOrder({
      packageId: pkg.id,
      processorId: 'crypto_gateway',
      orderRef: '', // filled with paymentId after gateway responds
      userId,
    });
    const invoice = await cryptoGateway.createDepositInvoice({
      priceUsd: pkg.priceUsd,
      packageId: pkg.id,
      orderRef: order.id,
      payCurrency,
      userId,
    });
    // Bind gateway payment id <-> our order for IPN reconciliation
    const idx = this.ordersQueue.findIndex((o) => o.id === order.id);
    if (idx !== -1) {
      this.ordersQueue[idx] = { ...this.ordersQueue[idx], orderRef: String(invoice.paymentId), status: 'awaiting_gateway_payment' };
    }
    this.gatewayInvoices.set(String(invoice.paymentId), {
      orderId: order.id,
      userId,
      packageId: pkg.id,
      createdAt: new Date().toISOString(),
    });
    return { order: this.ordersQueue[idx] || order, invoice };
  }

  /**
   * Handles a signed gateway IPN. Two event shapes:
   *  - payment    (deposit finished/confirmed) -> idempotent order confirmation + server-wallet credit
   *  - withdrawal (payout finished)            -> mark payout completed with TX reference
   */
  async handleGatewayIpn(rawBody, signatureHeader) {
    const event = verifyGatewayIpn(rawBody, signatureHeader);
    const eventId = `gateway:${event?.payment_id || event?.withdrawal_id || event?.id || 'unknown'}`;

    if (event?.payment_id && event?.order_id) {
      // DEPOSIT IPN
      const status = String(event.payment_status || '').toLowerCase();
      if (status !== 'finished' && status !== 'confirmed' && status !== 'partially_paid') {
        return { received: true, action: 'ignored', reason: `payment_status=${status}` };
      }
      const order = this.ordersQueue.find((o) => o.orderRef === String(event.order_id) || o.id === String(event.order_id));
      if (!order) return { received: true, action: 'unknown_order', orderId: event.order_id };
      const result = await this.confirmDepositOrder(order.id, `gateway-ipn:${eventId}`);
      return { received: true, action: 'credited', orderId: order.id, alreadyConfirmed: result.alreadyConfirmed };
    }

    if (event?.withdrawal_id || (event?.type === 'payout' && event?.id)) {
      // PAYOUT IPN
      const withdrawalId = String(event.withdrawal_id || event.id);
      const status = String(event.status || event.withdrawal_status || '').toLowerCase();
      const idx = this.cryptoPayoutQueue.findIndex((p) => p.withdrawalId === withdrawalId || p.id === withdrawalId);
      if (idx === -1) return { received: true, action: 'unknown_payout', withdrawalId };
      if (status === 'finished' || status === 'confirmed' || status === 'completed') {
        if (this.cryptoPayoutQueue[idx].status !== 'completed') {
          this.cryptoPayoutQueue[idx] = {
            ...this.cryptoPayoutQueue[idx],
            status: 'completed',
            completedAt: new Date().toISOString(),
            txHashOrReceipt: event.tx_hash || event.hash || this.cryptoPayoutQueue[idx].txHashOrReceipt,
          };
        }
      } else {
        this.cryptoPayoutQueue[idx] = { ...this.cryptoPayoutQueue[idx], gatewayStatus: status };
      }
      return { received: true, action: 'payout_updated', withdrawalId, status };
    }

    return { received: true, action: 'unrecognized_event' };
  }

  /**
   * Creates a validated crypto payout order. Client balances are authoritative in this
   * deployment (hybrid client/server wallet), so the SC debit happens client-side when the
   * player submits; this endpoint validates the destination and queues an operator/auto send.
   */
  createCryptoPayoutRequest({ redemptionId = '', userId = 'guest', amountSC = 0, currency = 'USDT_SOL', address = '' } = {}) {
    const cleanCurrency = String(currency || '').toUpperCase();
    const cleanAddress = String(address || '').trim();
    const amount = Number(amountSC) || 0;
    const minSC = Number(SWEEPSTAKES_CONFIG.minRedemptionSC) || 50;

    if (!(amount >= minSC)) {
      throw new Error(`Minimum crypto payout is ${minSC.toFixed(2)} SC.`);
    }
    if (!isValidCryptoAddress(cleanCurrency, cleanAddress)) {
      throw new Error(`Invalid ${cleanCurrency} payout address format.`);
    }

    const id = redemptionId || `pay_${Date.now().toString(36).toUpperCase()}_${Math.floor(Math.random() * 999)}`;
    const existing = this.cryptoPayoutQueue.find((p) => p.id === id);
    if (existing) return { payout: existing, alreadyQueued: true }; // idempotent retry

    const entry = {
      id,
      userId: String(userId || 'guest'),
      method: 'crypto',
      cryptoAsset: cleanCurrency,
      destination: cleanAddress,
      destinationMasked: `${cleanAddress.slice(0, 6)}…${cleanAddress.slice(-4)}`,
      amountSC: Number(amount.toFixed(2)),
      amountUsd: Number(amount.toFixed(2)), // 1 SC = $1.00
      status: 'processing',
      withdrawalId: null,
      txHashOrReceipt: '',
      createdAt: new Date().toISOString(),
      autoSend: cryptoGateway.env().payoutsEnabled,
    };
    this.cryptoPayoutQueue.unshift(entry);
    this.cryptoPayoutQueue = this.cryptoPayoutQueue.slice(0, 100);

    if (this.server?.ledger) {
      this.server.ledger.append({
        userId: entry.userId,
        type: 'CRYPTO_PAYOUT_REQUESTED',
        currency: 'SC',
        amount: -entry.amountSC,
        balanceBefore: 0,
        balanceAfter: 0,
        metadata: {
          payoutId: entry.id,
          cryptoAsset: cleanCurrency,
          destinationMasked: entry.destinationMasked,
          amountSC: entry.amountSC,
        },
      });
    }
    return { payout: entry, alreadyQueued: false };
  }

  /**
   * ADMIN: sends (or records) a payout. Idempotent per payout id.
   *   mode 'auto'   -> sends via gateway using the payout id as idempotency key
   *   mode 'manual' -> records operator's on-chain tx hash as receipt
   */
  async processCryptoPayout(payoutId, { mode = 'manual', txHash = '', authToken = '' } = {}) {
    this.server.authService.validateSession(authToken, 'ADMIN');
    const idx = this.cryptoPayoutQueue.findIndex((p) => p.id === payoutId);
    if (idx === -1) throw new Error(`Payout not found: ${payoutId}`);
    const payout = this.cryptoPayoutQueue[idx];
    if (payout.status === 'completed') {
      return { payout, alreadyCompleted: true };
    }

    if (mode === 'auto') {
      if (!cryptoGateway.env().payoutsEnabled) {
        throw new Error('Automated payouts are not enabled. Set CRYPTO_GATEWAY_PAYOUTS_ENABLED=true and provide API keys.');
      }
      const sent = await cryptoGateway.createPayout({
        address: payout.destination,
        currency: payout.cryptoAsset,
        amountUsd: payout.amountUsd,
        idempotencyKey: payout.id,
      });
      this.cryptoPayoutQueue[idx] = {
        ...payout,
        withdrawalId: sent.withdrawalId,
        status: 'sending',
        sentAt: new Date().toISOString(),
      };
      return { payout: this.cryptoPayoutQueue[idx], sent: true };
    }

    // manual mode
    const receipt = String(txHash || '').trim();
    if (receipt.length < 8) throw new Error('A TX hash or receipt reference is required for manual payout completion.');
    this.cryptoPayoutQueue[idx] = {
      ...payout,
      status: 'completed',
      txHashOrReceipt: receipt,
      completedAt: new Date().toISOString(),
      completedBy: 'manual_operator',
    };
    if (this.server?.ledger) {
      this.server.ledger.append({
        userId: payout.userId,
        type: 'CRYPTO_PAYOUT_COMPLETED',
        currency: 'SC',
        amount: 0,
        balanceBefore: 0,
        balanceAfter: 0,
        metadata: { payoutId: payout.id, txHashOrReceipt: receipt, mode: 'manual' },
      });
    }
    return { payout: this.cryptoPayoutQueue[idx], sent: false };
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
    let rawBodyString = '';
    try {
      if (typeof body === 'string' && body.length > 0) {
        rawBodyString = body;
        parsedBody = JSON.parse(body);
      } else {
        parsedBody = body || {};
        rawBodyString = JSON.stringify(parsedBody);
      }
    } catch {
      parsedBody = {};
      rawBodyString = typeof body === 'string' ? body : '';
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

      // 5.5 LIVE CRYPTO GATEWAY — DEPOSITS
      // POST /api/crypto/invoice — create a live gateway invoice for a package
      if (path === '/api/crypto/invoice' && method === 'POST') {
        const gatewayEnv = cryptoGateway.env();
        if (!gatewayEnv.configured) {
          return {
            status: 503,
            headers: corsHeaders,
            body: { error: 'Crypto gateway is not configured on the server (CRYPTO_GATEWAY_API_KEY missing).' },
          };
        }
        const { order, invoice } = await this.createCryptoInvoice({
          packageId: parsedBody.packageId,
          customAmountUsd: parsedBody.customAmountUsd ?? null,
          userId: parsedBody.userId || 'guest',
          payCurrency: parsedBody.payCurrency || 'usdt',
        });
        return {
          status: 201,
          headers: corsHeaders,
          body: {
            success: true,
            order,
            invoice: {
              paymentId: invoice.paymentId,
              payAddress: invoice.payAddress,
              payAmount: invoice.payAmount,
              payCurrency: invoice.payCurrency,
              status: invoice.status,
              expiresAt: invoice.expiresAt,
            },
          },
        };
      }

      // POST /api/crypto/gateway-ipn — signed payment/payout webhook (gateway -> server)
      if (path === '/api/crypto/gateway-ipn' && method === 'POST') {
        const signature = headers['x-nowpayments-sig'] || headers['x-gateway-sig'] || headers['X-Nowpayments-Sig'] || '';
        const result = await this.handleGatewayIpn(rawBodyString, signature);
        return { status: 200, headers: corsHeaders, body: { success: true, ...result } };
      }

      // GET/POST /api/crypto/invoice-status — cashier polling for a payment id
      if (path === '/api/crypto/invoice-status' && (method === 'GET' || method === 'POST')) {
        const paymentId = parsedBody.paymentId || new URLSearchParams(String(headers['x-query-string'] || '')).get('paymentId') || '';
        if (!paymentId) {
          return { status: 400, headers: corsHeaders, body: { error: 'paymentId is required' } };
        }
        if (!cryptoGateway.env().configured) {
          // Fall back to locally-tracked invoice map so the cashier can still show queued state
          const local = this.gatewayInvoices.get(String(paymentId));
          return { status: 200, headers: corsHeaders, body: { success: true, paymentId, status: local ? 'waiting' : 'unknown', local: true } };
        }
        const status = await cryptoGateway.getInvoiceStatus(paymentId);
        return { status: 200, headers: corsHeaders, body: { success: true, ...status } };
      }

      // 5.6 LIVE CRYPTO GATEWAY — PAYOUTS
      // POST /api/crypto/payout-request — player submits a validated crypto payout order
      if (path === '/api/crypto/payout-request' && method === 'POST') {
        const { payout, alreadyQueued } = this.createCryptoPayoutRequest({
          redemptionId: parsedBody.redemptionId || '',
          userId: parsedBody.userId || 'guest',
          amountSC: parsedBody.amountSC,
          currency: parsedBody.currency || parsedBody.cryptoAsset || 'USDT_SOL',
          address: parsedBody.address || parsedBody.destination || '',
        });
        return {
          status: alreadyQueued ? 200 : 201,
          headers: corsHeaders,
          body: { success: true, alreadyQueued, payout: { ...payout, destination: payout.destinationMasked } },
        };
      }

      // GET /api/crypto/payouts — operator queue (ADMIN)
      if (path === '/api/crypto/payouts' && method === 'GET') {
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        this.server.authService.validateSession(token, 'ADMIN');
        return { status: 200, headers: corsHeaders, body: { success: true, payouts: this.cryptoPayoutQueue } };
      }

      // POST /api/crypto/payouts/process — admin auto-send (gateway) or manual txHash (idempotent)
      if (path === '/api/crypto/payouts/process' && method === 'POST') {
        if (!token) {
          return { status: 401, headers: corsHeaders, body: { error: 'Admin token required' } };
        }
        const result = await this.processCryptoPayout(parsedBody.payoutId || parsedBody.id, {
          mode: parsedBody.mode || 'manual',
          txHash: parsedBody.txHash || '',
          authToken: token,
        });
        return { status: 200, headers: corsHeaders, body: { success: true, ...result } };
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
          body: {
            status: 'healthy',
            version: '3.1.0-live-crypto-gateway',
            cryptoGateway: cryptoGateway.env(),
            timestamp: new Date().toISOString(),
          },
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
