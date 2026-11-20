import { SWEEPSTAKES_CONFIG, calculateCustomPackage } from '../../src/config/sweepstakesConfig.js';
import { AppError, bad, conflict, forbidden, notFound, newId, nowIso } from './ledger.js';
import { WebhookSignatureError, sandboxProvider, squareProvider } from './providers.js';

const ALL_PACKAGES = () => [
  ...(SWEEPSTAKES_CONFIG.storePackages || []),
  ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
  ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
  ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
];

/** Prices/coin amounts are ALWAYS resolved here from server-side config - never from the request. */
export function resolvePackage(packageId, customUsd, maxUsdCents) {
  let pkg = ALL_PACKAGES().find((p) => p.id === packageId);
  if (!pkg && String(packageId || '').startsWith('pkg_custom')) {
    const usd = Number(customUsd);
    if (!Number.isFinite(usd) || usd < 1 || usd * 100 > maxUsdCents) throw bad('INVALID_AMOUNT', 'Custom amount out of range.');
    pkg = calculateCustomPackage(usd);
  }
  if (!pkg) throw bad('UNKNOWN_PACKAGE', 'Unknown package.');
  return {
    id: pkg.id,
    title: pkg.tierTitle || pkg.tagline || pkg.id,
    amountUsdCents: Math.round(pkg.priceUsd * 100),
    gc: Math.round(pkg.goldCoins),
    scBonusCents: Math.round(pkg.freeSweepsCoins * 100),
  };
}

export class PaymentService {
  constructor({ db, ledger, audit, accounts, config, fetchImpl }) {
    Object.assign(this, { db, ledger, audit, accounts, config });
    this.providers = new Map();
    const enabled = config.providers.enabled;
    if (enabled.includes('sandbox') && !config.isProd) this.providers.set('sandbox', sandboxProvider(config));
    if (enabled.includes('square')) {
      const sq = squareProvider(config, fetchImpl);
      if (sq.configured) this.providers.set('square', sq);
    }
    this.crypto = null; // set by CryptoGateway when enabled
  }

  registerProvider(p) { this.providers.set(p.id, p); }

  listPackages() {
    return ALL_PACKAGES().map((p) => ({
      id: p.id, title: p.tierTitle, priceUsd: p.priceUsd, gc: p.goldCoins, sc: p.freeSweepsCoins, badge: p.badge,
    }));
  }

  listMethods() {
    return [...this.providers.values()].map((p) => ({ provider: p.id, label: p.label, methods: p.methods }));
  }

  createIntent(user, { packageId, customUsd, provider, method, network, token, idempotencyKey }) {
    this.accounts.assertCanPurchase(user);
    if (!idempotencyKey || !/^[A-Za-z0-9_-]{8,80}$/.test(String(idempotencyKey))) throw bad('IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required.');
    const prov = this.providers.get(provider);
    if (!prov) throw bad('PROVIDER_DISABLED', 'This payment method is not available.');
    if (!prov.methods.includes(method)) throw bad('METHOD_UNSUPPORTED', 'Unsupported payment method.');
    const pkg = resolvePackage(packageId, customUsd, this.config.purchases.maxUsdCents);
    const p = this.config.purchases;
    if (pkg.amountUsdCents < p.minUsdCents || pkg.amountUsdCents > p.maxUsdCents) throw bad('INVALID_AMOUNT', 'Amount outside allowed range.');

    return this.db.tx(() => {
      const dup = this.db.get('SELECT * FROM payment_intents WHERE user_id = ? AND idempotency_key = ?', user.id, idempotencyKey);
      if (dup) {
        if (dup.package_id !== pkg.id || dup.provider !== provider) throw conflict('IDEMPOTENCY_MISMATCH', 'Idempotency key reused with different parameters.');
        return { intent: this.publicIntent(dup), clientAction: JSON.parse(dup.metadata).clientAction, replayed: true };
      }
      const since = new Date(Date.now() - 86400e3).toISOString();
      const spent = this.db.get(
        "SELECT COALESCE(SUM(amount_usd_cents),0) s FROM payment_intents WHERE user_id = ? AND created_at >= ? AND status IN ('created','pending','succeeded')",
        user.id, since
      ).s;
      if (spent + pkg.amountUsdCents > p.dailyLimitUsdCents) throw forbidden('DAILY_LIMIT', 'Daily purchase limit reached.');

      const id = newId('pi');
      const now = nowIso();
      const row = {
        id, user_id: user.id, provider, method, package_id: pkg.id, amount_usd_cents: pkg.amountUsdCents, gc: pkg.gc,
        sc_bonus_cents: pkg.scBonusCents, status: 'pending', idempotency_key: idempotencyKey, created_at: now, updated_at: now,
        expires_at: new Date(Date.now() + p.intentTtlMinutes * 60e3).toISOString(),
      };
      let session;
      if (provider === 'crypto') {
        if (!this.crypto) throw bad('PROVIDER_DISABLED', 'Crypto payments are not enabled.');
        session = this.crypto.allocate(row, { network, token });
      } else {
        session = prov.createSession({ intent: row });
      }
      this.db.run(
        `INSERT INTO payment_intents (id,user_id,provider,method,package_id,amount_usd_cents,gc,sc_bonus_cents,status,provider_ref,idempotency_key,metadata,created_at,updated_at,expires_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        row.id, row.user_id, provider, method, row.package_id, row.amount_usd_cents, row.gc, row.sc_bonus_cents, 'pending',
        session.providerRef ?? null, idempotencyKey, JSON.stringify({ clientAction: session.clientAction }), now, now, row.expires_at
      );
      if (provider === 'crypto') this.crypto.persist(row.id, session);
      return { intent: this.publicIntent(this.db.get('SELECT * FROM payment_intents WHERE id = ?', id)), clientAction: session.clientAction, replayed: false };
    });
  }

  /** Square: exchange a single-use source token for a server-side charge of OUR stored amount. */
  async chargeWithSource(user, intentId, sourceId) {
    const intent = this.getIntentForUser(user.id, intentId);
    const prov = this.providers.get(intent.provider);
    if (!prov?.charge) throw bad('NOT_CHARGEABLE', 'This intent is not chargeable.');
    if (intent.status !== 'pending') throw conflict('BAD_STATE', 'Payment is not pending.');
    if (typeof sourceId !== 'string' || sourceId.length < 8 || sourceId.length > 200) throw bad('INVALID_SOURCE', 'Invalid payment source.');

    // Best-effort enrichment (Square customer + catalog-backed order). Never blocks the charge;
    // never changes the amount, which always comes from our DB intent.
    let orderId = null, customerId = null;
    if (intent.provider === 'square') {
      try {
        if (prov.findOrCreateCustomer && user.email) customerId = await prov.findOrCreateCustomer({ email: user.email });
        const cat = this.db.get('SELECT variation_id FROM square_catalog_items WHERE package_id = ?', intent.package_id);
        if (prov.createOrder) orderId = await prov.createOrder({ intent, itemVariationId: cat?.variation_id || null, customerId });
      } catch (e) {
        this.audit.record({ action: 'SQUARE_ORDER_ENRICHMENT_FAILED', targetType: 'payment_intent', targetId: intent.id, details: { message: e.message } });
      }
    }

    try {
      const { providerRef } = await prov.charge({ intent, sourceId, orderId, customerId });
      this.db.run('UPDATE payment_intents SET provider_ref = ?, updated_at = ? WHERE id = ? AND provider_ref IS NULL', providerRef, nowIso(), intent.id);
      if (orderId || customerId) {
        const meta = JSON.parse(intent.metadata || '{}');
        meta.square = { orderId, customerId };
        this.db.run('UPDATE payment_intents SET metadata = ? WHERE id = ?', JSON.stringify(meta), intent.id);
      }
    } catch {
      this.db.run("UPDATE payment_intents SET status = 'failed', failure_reason = 'charge_declined', updated_at = ? WHERE id = ? AND status = 'pending'", nowIso(), intent.id);
      throw new AppError(402, 'PAYMENT_FAILED', 'Payment could not be completed.');
    }
    // NOTE: coins are credited only when the verified provider webhook arrives.
    return { status: 'processing' };
  }

  publicIntent(r) {
    return {
      id: r.id, provider: r.provider, method: r.method, packageId: r.package_id, amountUsd: r.amount_usd_cents / 100,
      gc: r.gc, sc: r.sc_bonus_cents / 100, status: r.status, failureReason: r.failure_reason, createdAt: r.created_at, expiresAt: r.expires_at, creditedAt: r.credited_at,
    };
  }

  getIntentForUser(userId, id) {
    const r = this.db.get('SELECT * FROM payment_intents WHERE id = ? AND user_id = ?', id, userId);
    if (!r) throw notFound('NOT_FOUND', 'Payment not found.');
    return r;
  }

  listForUser(userId) {
    return this.db.all('SELECT * FROM payment_intents WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId).map((r) => this.publicIntent(r));
  }

  expireStale() {
    return this.db.run("UPDATE payment_intents SET status = 'expired', updated_at = ? WHERE status IN ('created','pending') AND expires_at < ?", nowIso(), nowIso()).changes;
  }

  /** Credits GC + promotional SC exactly once. Must be called inside a transaction. */
  creditIntent(intentId, source) {
    const i = this.db.get('SELECT * FROM payment_intents WHERE id = ?', intentId);
    if (!i) throw notFound('NOT_FOUND', 'Intent not found.');
    if (i.status === 'succeeded') return { alreadyCredited: true };
    if (!['created', 'pending', 'expired', 'review'].includes(i.status)) throw conflict('BAD_STATE', `Cannot credit intent in state ${i.status}`);
    const meta = { intentId, packageId: i.package_id, provider: i.provider, source, amountUsdCents: i.amount_usd_cents };
    this.ledger.post({ userId: i.user_id, type: 'PURCHASE_GC', currency: 'GC', amount: i.gc, idempotencyKey: `purchase:${intentId}:GC`, refType: 'payment_intent', refId: intentId, metadata: meta });
    if (i.sc_bonus_cents > 0) {
      this.ledger.post({ userId: i.user_id, type: 'PROMO_SC', currency: 'SC', amount: i.sc_bonus_cents, unplayedDelta: i.sc_bonus_cents, idempotencyKey: `purchase:${intentId}:SC`, refType: 'payment_intent', refId: intentId, metadata: { ...meta, note: 'Promotional sweepstakes entries included with GC purchase' } });
    }
    this.db.run("UPDATE payment_intents SET status = 'succeeded', credited_at = ?, updated_at = ? WHERE id = ?", nowIso(), nowIso(), intentId);
    return { alreadyCredited: false };
  }

  /** Reverses a purchase after refund/chargeback. Never drives balances negative; shortfall freezes the account. */
  clawback(intentId, reason) {
    const i = this.db.get('SELECT * FROM payment_intents WHERE id = ?', intentId);
    if (!i || i.status !== 'succeeded') return { skipped: true };
    const w = this.ledger.getWallet(i.user_id);
    const gcTake = Math.min(i.gc, w.gc);
    const scTake = Math.min(i.sc_bonus_cents, w.sc);
    const k = `clawback:${intentId}`;
    if (gcTake > 0) this.ledger.post({ userId: i.user_id, type: 'CLAWBACK_GC', currency: 'GC', amount: -gcTake, idempotencyKey: `${k}:GC`, refType: 'payment_intent', refId: intentId, metadata: { reason } });
    if (scTake > 0) this.ledger.post({ userId: i.user_id, type: 'CLAWBACK_SC', currency: 'SC', amount: -scTake, unplayedDelta: -scTake, idempotencyKey: `${k}:SC`, refType: 'payment_intent', refId: intentId, metadata: { reason } });
    const shortfall = gcTake < i.gc || scTake < i.sc_bonus_cents;
    if (shortfall) {
      this.db.run("UPDATE users SET status = 'frozen' WHERE id = ? AND role = 'PLAYER'", i.user_id);
      this.audit.record({ action: 'CLAWBACK_SHORTFALL', targetType: 'user', targetId: i.user_id, details: { intentId, reason, gcShort: i.gc - gcTake, scShortCents: i.sc_bonus_cents - scTake } });
    }
    return { gcTake, scTake, shortfall };
  }

  /**
   * Initiate a provider-side refund. Does NOT claw back coins: the existing verified
   * refund.updated webhook handler performs the clawback exactly once. Nothing is deleted.
   */
  async refundIntent(intentId, { reason, actor } = {}) {
    const i = this.db.get('SELECT * FROM payment_intents WHERE id = ?', intentId);
    if (!i) throw notFound('NOT_FOUND', 'Intent not found.');
    if (i.status !== 'succeeded') throw conflict('BAD_STATE', 'Only succeeded payments can be refunded.');
    const prov = this.providers.get(i.provider);
    if (!prov?.refundPayment) throw bad('NOT_REFUNDABLE', 'This provider does not support API refunds.');
    if (!i.provider_ref) throw conflict('BAD_STATE', 'Payment has no provider reference.');
    const dup = this.db.get("SELECT 1 x FROM audit_log WHERE action = 'REFUND_INITIATED' AND target_type = 'payment_intent' AND target_id = ?", intentId);
    if (dup) throw conflict('ALREADY_REFUNDED', 'A refund was already initiated for this payment.');
    const { refundId, status } = await prov.refundPayment({ providerRef: i.provider_ref, amountUsdCents: i.amount_usd_cents, reason });
    this.audit.record({ action: 'REFUND_INITIATED', targetType: 'payment_intent', targetId: intentId, details: { refundId, provider: i.provider, reason: reason || null, actor: actor || null } });
    return { refundId, status: status === 'COMPLETED' ? 'completed' : 'processing' };
  }

  /**
   * Webhook entry point. Order of operations:
   *  1. verify provider signature   2. dedupe event id   3. independent provider confirmation
   *  4. match intent + amount       5. atomic credit + event record
   */
  async handleWebhook(providerId, rawBody, headers) {
    const prov = this.providers.get(providerId);
    if (!prov) throw notFound('NOT_FOUND', 'Unknown provider.');
    let event;
    try {
      event = prov.parseWebhook({ rawBody, headers });
    } catch (e) {
      this.audit.record({ action: 'WEBHOOK_REJECTED', targetType: 'provider', targetId: providerId, details: { reason: e instanceof WebhookSignatureError ? e.message : 'malformed' } });
      throw new AppError(400, 'INVALID_SIGNATURE', 'Webhook rejected.');
    }
    if (event.type === 'ignored') return { status: 'ignored' };

    // Cheap pre-check so duplicates never hit the provider API.
    if (this.db.get('SELECT 1 x FROM payment_events WHERE provider = ? AND event_id = ?', providerId, event.eventId)) {
      return { status: 'duplicate' };
    }

    let verified = null;
    if (event.type === 'payment.succeeded' && prov.verifyPayment) {
      verified = await prov.verifyPayment(event);
      if (!verified.ok) {
        this._recordEvent(providerId, event, null, 'verification_failed', rawBody);
        this.audit.record({ action: 'PAYMENT_VERIFICATION_FAILED', targetType: 'provider', targetId: providerId, details: { providerRef: event.providerRef } });
        return { status: 'verification_failed' };
      }
    }

    return this.db.tx(() => {
      let intent = event.providerRef
        ? this.db.get('SELECT * FROM payment_intents WHERE provider = ? AND provider_ref = ?', providerId, event.providerRef)
        : null;
      if (!intent && (event.intentId || verified?.intentId)) {
        intent = this.db.get('SELECT * FROM payment_intents WHERE provider = ? AND id = ?', providerId, event.intentId || verified.intentId);
        if (intent && !intent.provider_ref && event.providerRef) {
          this.db.run('UPDATE payment_intents SET provider_ref = ? WHERE id = ?', event.providerRef, intent.id);
        }
      }
      const ins = (outcome) => this._recordEvent(providerId, event, intent?.id ?? null, outcome, rawBody);
      if (!intent) { ins('unknown_intent'); return { status: 'unknown_intent' }; }

      if (event.type === 'payment.succeeded') {
        const paid = verified?.amountUsdCents ?? event.amountUsdCents;
        if (paid !== intent.amount_usd_cents || event.currency !== 'USD') {
          this.db.run("UPDATE payment_intents SET status = 'review', failure_reason = 'amount_mismatch', updated_at = ? WHERE id = ? AND status IN ('created','pending','expired')", nowIso(), intent.id);
          this.audit.record({ action: 'PAYMENT_AMOUNT_MISMATCH', targetType: 'payment_intent', targetId: intent.id, details: { expected: intent.amount_usd_cents, paid } });
          ins('amount_mismatch');
          return { status: 'review' };
        }
        const r = this.creditIntent(intent.id, `webhook:${providerId}:${event.eventId}`);
        ins(r.alreadyCredited ? 'already_credited' : 'credited');
        return { status: r.alreadyCredited ? 'already_credited' : 'credited', intentId: intent.id };
      }
      if (event.type === 'payment.failed') {
        this.db.run("UPDATE payment_intents SET status = 'failed', failure_reason = 'provider_failed', updated_at = ? WHERE id = ? AND status IN ('created','pending')", nowIso(), intent.id);
        ins('failed');
        return { status: 'failed' };
      }
      if (event.type === 'payment.refunded' || event.type === 'payment.disputed') {
        const res = this.clawback(intent.id, event.type);
        if (!res.skipped) {
          this.db.run('UPDATE payment_intents SET status = ?, updated_at = ? WHERE id = ?', event.type === 'payment.refunded' ? 'refunded' : 'disputed', nowIso(), intent.id);
        }
        ins('clawback');
        return { status: 'clawback', ...res };
      }
      ins('ignored');
      return { status: 'ignored' };
    });
  }

  _recordEvent(provider, event, intentId, outcome, raw) {
    this.db.run(
      'INSERT OR IGNORE INTO payment_events (provider,event_id,intent_id,type,outcome,raw,received_at) VALUES (?,?,?,?,?,?,?)',
      provider, event.eventId, intentId, event.type, outcome, raw.slice(0, 20000), nowIso()
    );
  }

  /** Provider-side reconciliation: payments we think are pending vs. what happened. */
  reconciliationReport() {
    const stale = this.db.all("SELECT id,provider,amount_usd_cents,created_at,status FROM payment_intents WHERE status IN ('pending','created') AND expires_at < ?", nowIso());
    const review = this.db.all("SELECT id,provider,amount_usd_cents,failure_reason FROM payment_intents WHERE status = 'review'");
    const totals = this.db.all("SELECT provider, status, COUNT(*) n, SUM(amount_usd_cents) usd_cents FROM payment_intents GROUP BY provider, status");
    const credited = this.db.get("SELECT COUNT(*) n FROM payment_intents WHERE status IN ('succeeded','refunded','disputed')").n;
    const ledgerPurchases = this.db.get("SELECT COUNT(*) n FROM ledger WHERE type = 'PURCHASE_GC'").n;
    return { stale, review, totals, creditedIntents: credited, ledgerPurchaseEntries: ledgerPurchases, consistent: credited === ledgerPurchases };
  }
}
