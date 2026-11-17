import { bad, forbidden, notFound, parseScToCents } from './ledger.js';

/**
 * Staff-facing financial operations. Callers (the router) enforce role + password step-up;
 * every mutation below writes to the hash-chained audit log, and ALL balance changes go through the ledger
 * as new rows - historical records can never be edited or deleted (enforced by DB triggers).
 */
export class AdminService {
  constructor({ db, ledger, audit, accounts, payments, redemptions, gateway, config }) {
    Object.assign(this, { db, ledger, audit, accounts, payments, redemptions, gateway, config });
  }

  purchases({ status, limit = 100 } = {}) {
    const q = status ? ['SELECT * FROM payment_intents WHERE status = ? ORDER BY created_at DESC LIMIT ?', status, limit] : ['SELECT * FROM payment_intents ORDER BY created_at DESC LIMIT ?', limit];
    return this.db.all(...q).map((r) => ({ ...r, metadata: undefined }));
  }

  redemptionList({ status, limit = 200 } = {}) {
    return status ? this.redemptions.queue([status]) : this.db.all('SELECT * FROM redemptions ORDER BY created_at DESC LIMIT ?', limit);
  }

  failedPayments() {
    return this.db.all("SELECT * FROM payment_intents WHERE status IN ('failed','expired','review','disputed','refunded') ORDER BY updated_at DESC LIMIT 200");
  }

  cryptoTransfers(status) {
    return this.db.all(`SELECT * FROM crypto_transfers ${status ? 'WHERE status = ?' : ''} ORDER BY created_at DESC LIMIT 200`, ...(status ? [status] : []));
  }

  playerLedger(userId, limit = 200) {
    if (!this.accounts.getUser(userId)) throw notFound('NOT_FOUND', 'Player not found.');
    return this.ledger.history(userId, limit);
  }

  playerOverview(userId) {
    const u = this.accounts.getUser(userId);
    if (!u) throw notFound('NOT_FOUND', 'Player not found.');
    return {
      user: { ...this.accounts.publicUser(u), createdAt: u.created_at },
      balance: this.accounts.balance(userId),
      purchases: this.payments.listForUser(userId),
      redemptions: this.redemptions.listForUser(userId),
      recentAudit: this.db.all("SELECT action, created_at, actor_id FROM audit_log WHERE target_id = ? OR actor_id = ? ORDER BY seq DESC LIMIT 50", userId, userId),
    };
  }

  reconciliation() {
    const ledgerChain = this.ledger.verifyChain();
    const wallets = this.ledger.reconcile();
    const auditChain = this.audit.verify();
    const payments = this.payments.reconciliationReport();
    const unmatched = this.db.get("SELECT COUNT(*) n FROM crypto_transfers WHERE status = 'unmatched'").n;
    const liabilities = this.db.get('SELECT COALESCE(SUM(sc),0) sc, COALESCE(SUM(sc_hold),0) hold, COALESCE(SUM(gc),0) gc FROM wallets');
    return {
      ok: ledgerChain.valid && wallets.ok && auditChain.valid && payments.consistent,
      ledgerChain, wallets, auditChain, payments, trialBalance: this.ledger.trialBalance(), unmatchedCryptoTransfers: unmatched,
      scLiabilityUsd: (liabilities.sc + liabilities.hold) / 100, gcOutstanding: liabilities.gc,
      generatedAt: new Date().toISOString(),
    };
  }

  setKyc(staff, userId, status, note) {
    if (!['none', 'pending', 'verified', 'rejected'].includes(status)) throw bad('INVALID_STATUS', 'Invalid KYC status.');
    const u = this.accounts.getUser(userId);
    if (!u) throw notFound('NOT_FOUND', 'Player not found.');
    if (u.id === staff.id) throw forbidden('SELF_ACTION', 'Staff cannot change their own verification.');
    this.db.run('UPDATE users SET kyc_status = ? WHERE id = ?', status, userId);
    this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'KYC_SET', targetType: 'user', targetId: userId, details: { from: u.kyc_status, to: status, note } });
    return { userId, kycStatus: status };
  }

  setAccountStatus(staff, userId, status, reason) {
    if (!['active', 'frozen', 'closed'].includes(status)) throw bad('INVALID_STATUS', 'Invalid status.');
    if (!reason || String(reason).length < 5) throw bad('REASON_REQUIRED', 'A reason is required.');
    const u = this.accounts.getUser(userId);
    if (!u || u.role !== 'PLAYER') throw notFound('NOT_FOUND', 'Player not found.');
    this.db.run('UPDATE users SET status = ? WHERE id = ?', status, userId);
    this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'ACCOUNT_STATUS', targetType: 'user', targetId: userId, details: { from: u.status, to: status, reason } });
    return { userId, status };
  }

  /** Corrections are NEW ledger rows (never edits), capped, reasoned, and audited. ADMIN role only. */
  adjustBalance(staff, { userId, currency, amount, reason }) {
    if (staff.role !== 'ADMIN') throw forbidden('FORBIDDEN', 'Administrator role required.');
    if (!reason || String(reason).length < 10) throw bad('REASON_REQUIRED', 'A detailed reason (10+ chars) is required.');
    if (userId === staff.id) throw forbidden('SELF_ACTION', 'You cannot adjust your own wallet.');
    const u = this.accounts.getUser(userId);
    if (!u) throw notFound('NOT_FOUND', 'Player not found.');
    let units;
    if (currency === 'SC') {
      const neg = typeof amount === 'string' ? amount.startsWith('-') : Number(amount) < 0;
      units = parseScToCents(String(amount).replace('-', '')) * (neg ? -1 : 1);
      if (Math.abs(units) > this.config.admin.adjustMaxScCents) throw forbidden('LIMIT_EXCEEDED', 'Adjustment exceeds the per-action cap.');
    } else if (currency === 'GC') {
      units = Number(amount);
      if (!Number.isSafeInteger(units)) throw bad('INVALID_AMOUNT', 'GC amount must be an integer.');
      if (Math.abs(units) > this.config.admin.adjustMaxGc) throw forbidden('LIMIT_EXCEEDED', 'Adjustment exceeds the per-action cap.');
    } else throw bad('INVALID_CURRENCY', 'Invalid currency.');
    if (units === 0) throw bad('INVALID_AMOUNT', 'Amount cannot be zero.');

    return this.db.tx(() => {
      const key = `admin-adjust:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      const { entry } = this.ledger.post({ userId, type: 'ADMIN_ADJUSTMENT', currency, amount: units, idempotencyKey: key, refType: 'admin', refId: staff.id, metadata: { reason, adminId: staff.id } });
      this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'ADMIN_ADJUSTMENT', targetType: 'user', targetId: userId, details: { currency, units, reason, ledgerId: entry.id } });
      return { ledgerId: entry.id, balanceAfter: entry.balance_after };
    });
  }

  resolveCryptoTransfer(staff, transferId, body) {
    const res = this.gateway.resolveTransfer(transferId, body || {});
    this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'CRYPTO_TRANSFER_RESOLVED', targetType: 'crypto_transfer', targetId: transferId, details: { ...body, result: res.status } });
    return res;
  }

  auditTrail(limit) { return this.audit.list(limit); }
}
