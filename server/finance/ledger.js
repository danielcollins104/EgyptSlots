import crypto from 'node:crypto';

/** Error carrying an HTTP status + machine code; messages are safe to show to clients. */
export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const bad = (code, msg) => new AppError(400, code, msg);
export const forbidden = (code, msg) => new AppError(403, code, msg);
export const notFound = (code, msg) => new AppError(404, code, msg);
export const conflict = (code, msg) => new AppError(409, code, msg);

export const nowIso = () => new Date().toISOString();
export const newId = (prefix) => `${prefix}_${crypto.randomBytes(12).toString('hex')}`;

/** Strict SC parser: "12.34" | 12.34 -> integer cents. Rejects NaN, negatives, >2dp. */
export function parseScToCents(v) {
  const s = typeof v === 'number' ? String(v) : v;
  if (typeof s !== 'string' || !/^\d{1,9}(\.\d{1,2})?$/.test(s)) throw bad('INVALID_AMOUNT', 'Invalid SC amount.');
  const [w, f = ''] = s.split('.');
  return Number(w) * 100 + Number(f.padEnd(2, '0'));
}
export const centsToSc = (c) => Number((c / 100).toFixed(2));

/** Contra (house/system) account for each transaction type - the other side of the double entry. */
const CONTRA = {
  WELCOME_GC: 'ISSUED:WELCOME_GC', AMOE_GC: 'ISSUED:AMOE_GC', AMOE_SC: 'ISSUED:AMOE_SC',
  PURCHASE_GC: 'ISSUED:PURCHASED_GC', PROMO_SC: 'ISSUED:PROMO_SC',
  BET: 'GAME:WAGERS', WIN: 'GAME:WINNINGS',
  CLAWBACK_GC: 'ISSUED:CLAWBACKS', CLAWBACK_SC: 'ISSUED:CLAWBACKS',
  REDEMPTION_RESERVE: 'TRANSIT:REDEMPTIONS', REDEMPTION_RELEASE: 'TRANSIT:REDEMPTIONS',
  REDEMPTION_PAID: 'PAYOUTS:PRIZES_PAID', ADMIN_ADJUSTMENT: 'ADJUSTMENTS:ADMIN',
};
export const contraAccount = (type) => CONTRA[type] || 'OTHER:UNCLASSIFIED';

const COLUMN = { 'GC:AVAILABLE': 'gc', 'SC:AVAILABLE': 'sc', 'SC:HOLD': 'sc_hold' };

/**
 * Append-only, hash-chained ledger + wallet projection.
 * - Wallet columns are a cache; the ledger is the source of truth (see reconcile()).
 * - Every entry carries before/after balance, a unique idempotency key and an HMAC chain hash.
 * - post() MUST be called inside db.tx().
 */
export class Ledger {
  constructor(db, secret) {
    this.db = db;
    this.secret = secret;
  }

  _hash(e) {
    const p = [e.prev_hash, e.id, e.user_id, e.type, e.currency, e.bucket, e.amount, e.balance_before,
      e.balance_after, e.ref_type ?? '', e.ref_id ?? '', e.idempotency_key, e.created_at, e.metadata].join('|');
    return crypto.createHmac('sha256', this.secret).update(p).digest('hex');
  }

  createWallet(userId) {
    this.db.run('INSERT OR IGNORE INTO wallets (user_id) VALUES (?)', userId);
  }

  getWallet(userId) {
    const w = this.db.get('SELECT * FROM wallets WHERE user_id = ?', userId);
    if (!w) throw new AppError(404, 'NO_WALLET', 'Wallet not found.');
    return w;
  }

  /**
   * @param {{userId:string,type:string,currency:'GC'|'SC',bucket?:'AVAILABLE'|'HOLD',amount:number,
   *   idempotencyKey:string,refType?:string,refId?:string,metadata?:object,unplayedDelta?:number}} e
   * @returns {{entry:object, replayed:boolean}}
   */
  post(e) {
    if (!this.db.inTx) throw new Error('Ledger.post must run inside a transaction');
    const bucket = e.bucket || 'AVAILABLE';
    const col = COLUMN[`${e.currency}:${bucket}`];
    if (!col) throw new Error('Unsupported currency/bucket');
    if (!Number.isSafeInteger(e.amount) || e.amount === 0) throw bad('INVALID_AMOUNT', 'Ledger amount must be a non-zero integer.');
    if (!e.idempotencyKey) throw new Error('idempotencyKey required');

    const existing = this.db.get('SELECT * FROM ledger WHERE idempotency_key = ?', e.idempotencyKey);
    if (existing) {
      if (existing.user_id !== e.userId || existing.type !== e.type || existing.amount !== e.amount) {
        throw conflict('IDEMPOTENCY_MISMATCH', 'Idempotency key reused with different parameters.');
      }
      return { entry: existing, replayed: true };
    }

    const w = this.getWallet(e.userId);
    const before = w[col];
    const after = before + e.amount;
    if (after < 0) throw new AppError(402, 'INSUFFICIENT_FUNDS', `Insufficient ${e.currency} balance.`);

    let unplayed = w.sc_unplayed;
    if (e.unplayedDelta) unplayed = Math.max(0, unplayed + e.unplayedDelta);

    const upd = this.db.run(
      `UPDATE wallets SET ${col} = ?, sc_unplayed = ?, version = version + 1 WHERE user_id = ? AND version = ?`,
      after, unplayed, e.userId, w.version
    );
    if (upd.changes !== 1) throw conflict('WALLET_CONFLICT', 'Concurrent wallet modification.');

    const last = this.db.get('SELECT entry_hash FROM ledger ORDER BY seq DESC LIMIT 1');
    const row = {
      id: newId('tx'),
      user_id: e.userId,
      type: e.type,
      currency: e.currency,
      bucket,
      amount: e.amount,
      balance_before: before,
      balance_after: after,
      status: 'posted',
      ref_type: e.refType ?? null,
      ref_id: e.refId ?? null,
      idempotency_key: e.idempotencyKey,
      metadata: JSON.stringify({ ...(e.metadata || {}), ...(e.unplayedDelta ? { unplayedAfter: unplayed } : {}) }),
      created_at: nowIso(),
      prev_hash: last ? last.entry_hash : '0'.repeat(64),
    };
    row.entry_hash = this._hash(row);
    this.db.run(
      `INSERT INTO ledger (id,user_id,type,currency,bucket,amount,balance_before,balance_after,status,ref_type,ref_id,
        idempotency_key,metadata,created_at,prev_hash,entry_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      row.id, row.user_id, row.type, row.currency, row.bucket, row.amount, row.balance_before, row.balance_after,
      row.status, row.ref_type, row.ref_id, row.idempotency_key, row.metadata, row.created_at, row.prev_hash, row.entry_hash
    );
    const contra = { ledger_id: row.id, account: contraAccount(e.type), currency: e.currency, amount: -e.amount, created_at: row.created_at };
    contra.entry_hash = this._jhash(row.entry_hash, contra);
    this.db.run('INSERT INTO journal (ledger_id,account,currency,amount,created_at,entry_hash) VALUES (?,?,?,?,?,?)',
      contra.ledger_id, contra.account, contra.currency, contra.amount, contra.created_at, contra.entry_hash);
    return { entry: row, replayed: false };
  }

  _jhash(ledgerHash, j) {
    return crypto.createHmac('sha256', this.secret).update(`${ledgerHash}|${j.account}|${j.currency}|${j.amount}|${j.created_at}`).digest('hex');
  }

  /** Balances of every system account, per currency (house P&L view). Player wallets are the other side. */
  trialBalance() {
    const accounts = this.db.all('SELECT account, currency, SUM(amount) balance, COUNT(*) entries FROM journal GROUP BY account, currency ORDER BY account');
    const totals = this.db.all(`SELECT currency, SUM(a) s FROM (
        SELECT currency, SUM(amount) a FROM ledger GROUP BY currency UNION ALL SELECT currency, SUM(amount) a FROM journal GROUP BY currency
      ) GROUP BY currency`);
    return { accounts, balanced: totals.every((t) => t.s === 0), totals };
  }

  history(userId, limit = 50, offset = 0) {
    return this.db.all(
      'SELECT id,type,currency,bucket,amount,balance_before,balance_after,status,ref_type,ref_id,metadata,created_at FROM ledger WHERE user_id = ? ORDER BY seq DESC LIMIT ? OFFSET ?',
      userId, Math.min(Math.max(1, limit | 0), 200), Math.max(0, offset | 0)
    );
  }

  verifyChain() {
    let prev = '0'.repeat(64);
    for (const r of this.db.all('SELECT * FROM ledger ORDER BY seq ASC')) {
      if (r.prev_hash !== prev) return { valid: false, brokenAt: r.seq, error: 'prev_hash mismatch' };
      if (this._hash(r) !== r.entry_hash) return { valid: false, brokenAt: r.seq, error: 'entry hash mismatch' };
      prev = r.entry_hash;
    }
    const missing = this.db.get('SELECT l.seq FROM ledger l LEFT JOIN journal j ON j.ledger_id = l.id WHERE j.ledger_id IS NULL LIMIT 1');
    if (missing) return { valid: false, brokenAt: missing.seq, error: 'ledger entry without double-entry counterpart' };
    const byId = new Map(this.db.all('SELECT id, entry_hash FROM ledger').map((r) => [r.id, r.entry_hash]));
    for (const j of this.db.all('SELECT * FROM journal')) {
      if (this._jhash(byId.get(j.ledger_id), j) !== j.entry_hash) return { valid: false, brokenAt: j.seq, error: 'journal hash mismatch' };
    }
    return { valid: true, lastHash: prev };
  }

  /** Σ(ledger) must equal each wallet bucket, and before/after must be continuous. */
  reconcile() {
    const problems = [];
    const sums = this.db.all('SELECT user_id, currency, bucket, SUM(amount) s FROM ledger GROUP BY user_id, currency, bucket');
    const byUser = new Map();
    for (const s of sums) {
      byUser.set(s.user_id, { ...(byUser.get(s.user_id) || {}), [`${s.currency}:${s.bucket}`]: s.s });
    }
    for (const w of this.db.all('SELECT * FROM wallets')) {
      const l = byUser.get(w.user_id) || {};
      for (const [k, col] of Object.entries(COLUMN)) {
        if ((l[k] || 0) !== w[col]) {
          problems.push({ userId: w.user_id, bucket: k, ledger: l[k] || 0, wallet: w[col] });
        }
      }
    }
    const cont = new Map();
    for (const r of this.db.all('SELECT seq,user_id,currency,bucket,balance_before,balance_after FROM ledger ORDER BY seq')) {
      const k = `${r.user_id}:${r.currency}:${r.bucket}`;
      const prev = cont.get(k) ?? 0;
      if (r.balance_before !== prev) problems.push({ userId: r.user_id, seq: r.seq, error: 'balance discontinuity' });
      cont.set(k, r.balance_after);
    }
    const tb = this.trialBalance();
    if (!tb.balanced) problems.push({ error: 'trial balance does not sum to zero', totals: tb.totals });
    return { ok: problems.length === 0, problems };
  }
}

/** Hash-chained, append-only audit trail for all administrative and security events. */
export class AuditLog {
  constructor(db, secret) {
    this.db = db;
    this.secret = secret;
  }
  record({ actorId = null, actorRole = null, action, targetType = null, targetId = null, details = {}, ip = null }) {
    return this.db.tx(() => {
      const last = this.db.get('SELECT entry_hash FROM audit_log ORDER BY seq DESC LIMIT 1');
      const row = {
        id: newId('aud'), actor_id: actorId, actor_role: actorRole, action, target_type: targetType, target_id: targetId,
        details: JSON.stringify(details), ip, created_at: nowIso(), prev_hash: last ? last.entry_hash : '0'.repeat(64),
      };
      row.entry_hash = this._hash(row);
      this.db.run(
        'INSERT INTO audit_log (id,actor_id,actor_role,action,target_type,target_id,details,ip,created_at,prev_hash,entry_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        row.id, row.actor_id, row.actor_role, row.action, row.target_type, row.target_id, row.details, row.ip,
        row.created_at, row.prev_hash, row.entry_hash
      );
      return row;
    });
  }
  _hash(r) {
    const p = [r.prev_hash, r.id, r.actor_id ?? '', r.actor_role ?? '', r.action, r.target_type ?? '', r.target_id ?? '', r.details, r.ip ?? '', r.created_at].join('|');
    return crypto.createHmac('sha256', this.secret).update(p).digest('hex');
  }
  verify() {
    let prev = '0'.repeat(64);
    for (const r of this.db.all('SELECT * FROM audit_log ORDER BY seq')) {
      if (r.prev_hash !== prev || this._hash(r) !== r.entry_hash) return { valid: false, brokenAt: r.seq };
      prev = r.entry_hash;
    }
    return { valid: true };
  }
  list(limit = 100) {
    return this.db.all('SELECT * FROM audit_log ORDER BY seq DESC LIMIT ?', Math.min(limit | 0 || 100, 500));
  }
}
