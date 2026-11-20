import { createFinance } from './finance/index.js';
import { AppError, bad } from './finance/ledger.js';

/** Fixed-window in-memory limiter (single-process). Use an edge/WAF limiter in multi-instance deployments. */
export class RateLimiter {
  constructor() { this.buckets = new Map(); }
  hit(key, limit, windowMs) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || now > b.reset) { this.buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
    b.n++;
    if (this.buckets.size > 50000) this.buckets.clear();
    return b.n <= limit;
  }
}

const SECURITY_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
};

/**
 * HTTP API for the server-authoritative casino back office.
 * Clients only REQUEST actions; every balance, outcome and approval is decided here.
 * Auth: Bearer session tokens (no cookies => no CSRF surface). POST bodies must be JSON objects.
 */
export class ApiRouter {
  constructor(options = {}) {
    this.f = options.finance || createFinance(options);
    this.limiter = new RateLimiter();
    this.routes = [];
    this._define();
  }

  // ---- routing helpers -------------------------------------------------------
  _r(method, pattern, opts, handler) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/:([a-zA-Z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '$');
    this.routes.push({ method, re, keys, opts, handler });
  }

  _cors(headers) {
    const origin = headers.origin || headers.Origin;
    const allowed = this.f.config.corsOrigins;
    const out = { ...SECURITY_HEADERS, Vary: 'Origin' };
    if (origin && allowed.includes(origin)) {
      out['Access-Control-Allow-Origin'] = origin;
      out['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
      out['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Idempotency-Key';
      out['Access-Control-Max-Age'] = '600';
    }
    return out;
  }

  /**
   * @param {string} method @param {string} path @param {object} headers (lower-case keys)
   * @param {string|object} body raw string (preferred) @param {object} [_env] unused (Node only)
   * @param {{ip?:string}} [ctx]
   */
  async handleRequest(method, path, headers = {}, body = '', _env = {}, ctx = {}) {
    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const outHeaders = this._cors(h);
    const ip = ctx.ip || 'unknown';
    const reply = (status, payload) => ({ status, headers: outHeaders, body: payload });
    if (method === 'OPTIONS') return { status: 204, headers: outHeaders, body: null };

    try {
      const route = this.routes.find((r) => r.method === method && r.re.test(path));
      if (!route) return reply(404, { success: false, error: { code: 'NOT_FOUND', message: 'Not found.' } });

      const cls = route.opts.limit || 'general';
      const [limit, win] = { auth: [10, 60000], webhook: [300, 60000], spin: [8, 1000], general: [180, 60000] }[cls];
      if (!this.limiter.hit(`${cls}:${ip}`, limit, win)) throw new AppError(429, 'RATE_LIMITED', 'Too many requests.');

      const rawBody = typeof body === 'string' ? body : JSON.stringify(body || {});
      let json = {};
      if (method === 'POST' && !route.opts.raw && rawBody.length > 0) {
        if (!String(h['content-type'] || '').toLowerCase().startsWith('application/json')) throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'JSON required.');
        try { json = JSON.parse(rawBody); } catch { throw bad('INVALID_JSON', 'Malformed JSON.'); }
        if (json === null || typeof json !== 'object' || Array.isArray(json)) throw bad('INVALID_JSON', 'JSON object required.');
      }

      const m = route.re.exec(path);
      const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
      const authz = String(h.authorization || '');
      const token = authz.startsWith('Bearer ') ? authz.slice(7).trim() : null;

      const ctxObj = { f: this.f, params, body: json, rawBody, headers: h, ip, token, idem: h['idempotency-key'] || json.idempotencyKey };
      if (route.opts.auth) {
        const a = this.f.accounts.authenticate(token, route.opts.role || null);
        ctxObj.user = a.user;
        ctxObj.session = a.session;
        if (route.opts.stepUp) this.f.accounts.requireStepUp(a.session);
      }
      const data = await route.handler(ctxObj);
      return reply(200, { success: true, ...data });
    } catch (e) {
      if (e instanceof AppError) {
        return { status: e.status, headers: outHeaders, body: { success: false, error: { code: e.code, message: e.message } } };
      }
      console.error(`[API ERROR] ${method} ${path}:`, e?.stack || e);
      return { status: 500, headers: outHeaders, body: { success: false, error: { code: 'INTERNAL', message: 'Internal error.' } } };
    }
  }

  // ---- route table -----------------------------------------------------------
  _define() {
    const P = { auth: true };
    const S = { auth: true, role: 'SUPPORT' };
    const F = { auth: true, role: 'FINANCE' };
    const FS = { auth: true, role: 'FINANCE', stepUp: true };
    const AS = { auth: true, role: 'ADMIN', stepUp: true };

    this._r('GET', '/api/health', {}, () => ({ status: 'healthy', version: '4.0.0-ledger' }));

    // Auth
    this._r('POST', '/api/auth/register', { limit: 'auth' }, ({ f, body, ip }) => f.accounts.register(body, ip));
    this._r('POST', '/api/auth/login', { limit: 'auth' }, ({ f, body, ip }) => f.accounts.login(body, ip));
    this._r('POST', '/api/auth/logout', P, ({ f, token }) => { f.accounts.logout(token); return {}; });
    this._r('POST', '/api/auth/step-up', { ...P, limit: 'auth' }, ({ f, token, body }) => f.accounts.stepUp(token, body.password));
    this._r('GET', '/api/me', P, ({ f, user }) => ({ user: f.accounts.publicUser(user), balance: f.accounts.balance(user.id) }));
    this._r('GET', '/api/balance', P, ({ f, user }) => ({ balance: f.accounts.balance(user.id) }));
    this._r('GET', '/api/ledger', P, ({ f, user }) => ({ history: f.ledger.history(user.id, 100) }));
    this._r('POST', '/api/promo/daily', P, ({ f, user }) => ({ granted: f.accounts.claimDaily(user), balance: f.accounts.balance(user.id) }));
    this._r('POST', '/api/account/self-exclude', P, ({ f, user, body }) => f.accounts.selfExclude(user.id, Number(body.days)));

    // Cashier
    this._r('GET', '/api/payments/packages', {}, ({ f }) => ({ packages: f.payments.listPackages() }));
    this._r('GET', '/api/payments/methods', {}, ({ f }) => ({ providers: f.payments.listMethods(), crypto: f.gateway.options() }));
    this._r('POST', '/api/payments/intents', P, ({ f, user, body, idem }) => f.payments.createIntent(user, { ...body, idempotencyKey: idem }));
    this._r('GET', '/api/payments/intents', P, ({ f, user }) => ({ payments: f.payments.listForUser(user.id) }));
    this._r('GET', '/api/payments/intents/:id', P, ({ f, user, params }) => ({ payment: f.payments.publicIntent(f.payments.getIntentForUser(user.id, params.id)) }));
    this._r('POST', '/api/payments/intents/:id/charge', P, async ({ f, user, params, body }) => f.payments.chargeWithSource(user, params.id, body.sourceId));
    this._r('POST', '/api/payments/webhook/:provider', { raw: true, limit: 'webhook' }, async ({ f, params, rawBody, headers }) => f.payments.handleWebhook(params.provider, rawBody, headers));

    // Game
    this._r('POST', '/api/game/spin', { ...P, limit: 'spin' }, ({ f, user, body, idem }) => ({ spin: f.spins.spin(user, { ...body, idempotencyKey: idem }) }));
    this._r('GET', '/api/game/seed', P, ({ f, user }) => ({ commitment: f.spins.commitment(user.id) }));
    this._r('POST', '/api/game/seed/rotate', P, ({ f, user }) => f.spins.rotateSeed(user.id));
    this._r('GET', '/api/game/history', P, ({ f, user }) => ({ spins: f.spins.history(user.id) }));
    this._r('GET', '/api/game/verify/:id', P, ({ f, user, params }) => ({ verification: f.spins.verifySpin(user.id, params.id) }));

    // Redemption center
    this._r('GET', '/api/redemptions/methods', {}, ({ f }) => ({ methods: f.redemptions.methods() }));
    this._r('GET', '/api/redemptions/destinations', P, ({ f, user }) => ({ destinations: f.redemptions.listDestinations(user.id) }));
    this._r('POST', '/api/redemptions/destinations', { ...P, stepUp: true }, ({ f, user, body }) => f.redemptions.addDestination(user, body));
    this._r('DELETE', '/api/redemptions/destinations/:id', P, ({ f, user, params }) => f.redemptions.removeDestination(user.id, params.id));
    this._r('POST', '/api/redemptions', P, ({ f, user, body, idem }) => f.redemptions.request(user, { ...body, idempotencyKey: idem }));
    this._r('GET', '/api/redemptions', P, ({ f, user }) => ({ redemptions: f.redemptions.listForUser(user.id) }));
    this._r('POST', '/api/redemptions/:id/cancel', P, ({ f, user, params }) => ({ redemption: f.redemptions.cancel(user, params.id) }));

    // Staff / admin
    this._r('GET', '/api/admin/purchases', S, ({ f, headers }) => ({ purchases: f.admin.purchases({}) }));
    this._r('GET', '/api/admin/failed-payments', S, ({ f }) => ({ payments: f.admin.failedPayments() }));
    this._r('GET', '/api/admin/redemptions', F, ({ f }) => ({ redemptions: f.admin.redemptionList({}) }));
    this._r('GET', '/api/admin/crypto-transfers', F, ({ f }) => ({ transfers: f.admin.cryptoTransfers() }));
    this._r('GET', '/api/admin/players/:id', S, ({ f, params }) => f.admin.playerOverview(params.id));
    this._r('GET', '/api/admin/players/:id/ledger', S, ({ f, params }) => ({ ledger: f.admin.playerLedger(params.id) }));
    this._r('GET', '/api/admin/reconciliation', F, ({ f }) => ({ report: f.admin.reconciliation() }));
    this._r('POST', '/api/admin/payments/catalog/sync', FS, async ({ f }) => ({ result: await f.squareCatalog.sync(f.db) }));
    this._r('GET', '/api/admin/payments/catalog', S, ({ f }) => ({ items: f.db.all('SELECT * FROM square_catalog_items ORDER BY price_cents') }));
    this._r('GET', '/api/admin/audit', F, ({ f }) => ({ audit: f.admin.auditTrail(200) }));
    this._r('POST', '/api/admin/redemptions/:id/approve', FS, ({ f, user, params }) => ({ redemption: f.redemptions.approve(user, params.id) }));
    this._r('POST', '/api/admin/redemptions/:id/reject', FS, ({ f, user, params, body }) => ({ redemption: f.redemptions.reject(user, params.id, body.reason) }));
    this._r('POST', '/api/admin/redemptions/:id/processing', FS, ({ f, user, params, body }) => ({ redemption: f.redemptions.markProcessing(user, params.id, body.txHash) }));
    this._r('POST', '/api/admin/redemptions/:id/verify', FS, async ({ f, user, params }) => f.redemptions.verifyAndComplete(user, params.id));
    this._r('POST', '/api/admin/redemptions/:id/fail', FS, ({ f, user, params, body }) => ({ redemption: f.redemptions.fail(user, params.id, body.reason) }));
    this._r('POST', '/api/admin/players/:id/kyc', FS, ({ f, user, params, body }) => f.admin.setKyc(user, params.id, body.status, body.note));
    this._r('POST', '/api/admin/players/:id/status', AS, ({ f, user, params, body }) => f.admin.setAccountStatus(user, params.id, body.status, body.reason));
    this._r('POST', '/api/admin/players/:id/adjust', AS, ({ f, user, params, body }) => f.admin.adjustBalance(user, { ...body, userId: params.id }));
    this._r('POST', '/api/admin/crypto-transfers/:id/resolve', FS, ({ f, user, params, body }) => f.admin.resolveCryptoTransfer(user, params.id, body));
    this._r('POST', '/api/admin/crypto/scan', FS, async ({ f, body }) => {
      const out = {};
      for (const n of Object.keys(f.gateway.networks)) if (!body.network || body.network === n) out[n] = await f.gateway.scanNetwork(n);
      return { scanned: out };
    });
  }
}
