import { CRYPTO_NETWORKS } from './config.js';
import { AppError, bad, conflict, forbidden, newId, nowIso, notFound, parseScToCents } from './ledger.js';
import { isValidEvmAddress } from './keccak.js';

const TERMINAL = ['completed', 'rejected', 'failed', 'cancelled'];
const ACTIVE = ['pending', 'under_review', 'approved', 'processing'];
const ZERO = '0x0000000000000000000000000000000000000000';

/**
 * Redemption (prize payout) workflow.
 *   pending -> under_review -> approved -> processing -> completed
 *   any non-terminal -> rejected | cancelled(player, before approval) ; approved/processing -> failed
 * Funds are RESERVED (AVAILABLE -> HOLD) at request time and only leave the HOLD bucket when the payout is
 * verified on-chain. Rejections/failures/cancellations return the hold to AVAILABLE through new ledger rows.
 */
export class RedemptionService {
  constructor({ db, ledger, audit, accounts, config, gateway }) {
    Object.assign(this, { db, ledger, audit, accounts, config, gateway });
  }

  methods() {
    const r = this.config.redemptions;
    return {
      enabledMethods: r.enabledMethods,
      crypto: r.enabledMethods.includes('crypto')
        ? Object.entries(CRYPTO_NETWORKS).flatMap(([n, v]) => Object.keys(v.tokens).map((t) => ({ network: n, token: t })))
        : [],
      coolingHours: r.destinationCoolingHours, minSc: r.minScCents / 100, maxSc: r.maxScCentsPerRequest / 100, dailyLimitSc: r.dailyLimitScCents / 100,
      notes: 'Only Sweeps Coins are redeemable, only after 1x play-through, to a verified payout address.',
    };
  }

  // ---- payout destinations -------------------------------------------------
  addDestination(user, { network, token, address, label }) {
    this.accounts.assertCanRedeem(user);
    if (!this.config.redemptions.enabledMethods.includes('crypto')) throw bad('METHOD_DISABLED', 'Crypto payouts are not enabled.');
    const net = CRYPTO_NETWORKS[network];
    const T = String(token || '').toUpperCase();
    if (!net || !net.tokens[T]) throw bad('UNSUPPORTED_ASSET', 'Unsupported network or token.');
    if (!isValidEvmAddress(address) || address.toLowerCase() === ZERO) throw bad('INVALID_DESTINATION', 'Invalid wallet address (checksum or format error).');
    const treasury = this.config.crypto.treasuryAddress;
    if (treasury && address.toLowerCase() === treasury.toLowerCase()) throw bad('INVALID_DESTINATION', 'Destination cannot be the casino wallet.');
    if (Object.values(net.tokens).some((t) => t.contract.toLowerCase() === address.toLowerCase())) {
      throw bad('INVALID_DESTINATION', 'Destination cannot be a token contract.');
    }
    const id = newId('dst');
    const usable = new Date(Date.now() + this.config.redemptions.destinationCoolingHours * 3600e3).toISOString();
    try {
      this.db.run(
        'INSERT INTO payout_destinations (id,user_id,method,network,token,address,label,created_at,usable_after) VALUES (?,?,?,?,?,?,?,?,?)',
        id, user.id, 'crypto', network, T, address.toLowerCase(), String(label || '').slice(0, 40), nowIso(), usable
      );
    } catch (e) {
      if (/UNIQUE/.test(e.message)) throw conflict('DUPLICATE_DESTINATION', 'Address already saved.');
      throw e;
    }
    this.audit.record({ actorId: user.id, actorRole: user.role, action: 'DESTINATION_ADDED', targetType: 'destination', targetId: id, details: { network, token: T, address: address.toLowerCase() } });
    return { id, usableAfter: usable };
  }

  listDestinations(userId) {
    return this.db.all('SELECT id,method,network,token,address,label,created_at,usable_after FROM payout_destinations WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC', userId);
  }

  removeDestination(userId, id) {
    const r = this.db.run('UPDATE payout_destinations SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL', nowIso(), id, userId);
    if (r.changes !== 1) throw notFound('NOT_FOUND', 'Destination not found.');
    return { removed: true };
  }

  // ---- player requests -----------------------------------------------------
  request(user, { amountSc, destinationId, idempotencyKey }) {
    const rc = this.config.redemptions;
    this.accounts.assertCanRedeem(user);
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(idempotencyKey || ''))) throw bad('IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required.');
    const cents = parseScToCents(amountSc);
    if (cents < rc.minScCents) throw bad('BELOW_MINIMUM', `Minimum redemption is ${rc.minScCents / 100} SC.`);
    if (cents > rc.maxScCentsPerRequest) throw bad('ABOVE_MAXIMUM', `Maximum per request is ${rc.maxScCentsPerRequest / 100} SC.`);

    return this.db.tx(() => {
      const dup = this.db.get('SELECT * FROM redemptions WHERE user_id = ? AND idempotency_key = ?', user.id, idempotencyKey);
      if (dup) {
        if (dup.amount_sc_cents !== cents || dup.destination_id !== destinationId) throw conflict('IDEMPOTENCY_MISMATCH', 'Idempotency key reused with different parameters.');
        return { redemption: this.publicRedemption(dup), replayed: true };
      }
      const dest = this.db.get('SELECT * FROM payout_destinations WHERE id = ? AND user_id = ? AND revoked_at IS NULL', destinationId, user.id);
      if (!dest) throw bad('INVALID_DESTINATION', 'Select a saved payout address.');
      if (dest.usable_after > nowIso()) throw forbidden('DESTINATION_COOLING', `New payout addresses can be used after ${dest.usable_after}.`);
      if (this.db.get(`SELECT 1 x FROM redemptions WHERE user_id = ? AND status IN ('pending','under_review','approved','processing')`, user.id)) {
        throw conflict('REDEMPTION_IN_PROGRESS', 'You already have a redemption in progress.');
      }
      const since = new Date(Date.now() - 86400e3).toISOString();
      const recent = this.db.get(
        "SELECT COUNT(*) n, COALESCE(SUM(amount_sc_cents),0) s FROM redemptions WHERE user_id = ? AND created_at >= ? AND status NOT IN ('rejected','failed','cancelled')",
        user.id, since
      );
      if (recent.n >= rc.maxRequestsPerDay) throw forbidden('VELOCITY_LIMIT', 'Daily redemption request limit reached.');
      if (recent.s + cents > rc.dailyLimitScCents) throw forbidden('DAILY_LIMIT', 'Daily redemption limit reached.');

      const w = this.ledger.getWallet(user.id);
      const redeemable = Math.max(0, w.sc - w.sc_unplayed);
      if (cents > redeemable) throw new AppError(402, 'NOT_ELIGIBLE', `Only ${redeemable / 100} SC is eligible (1x play-through required on promotional SC).`);

      const flags = [];
      if (cents >= rc.reviewScCents) flags.push('large_amount');
      if (Date.now() - Date.parse(user.created_at) < 7 * 86400e3) flags.push('new_account');
      if (Date.now() - Date.parse(dest.created_at) < 72 * 3600e3) flags.push('new_destination');
      if (this.db.get('SELECT 1 x FROM payout_destinations WHERE address = ? AND user_id != ?', dest.address, user.id)) flags.push('address_shared_with_other_user');
      if (!this.db.get("SELECT 1 x FROM payment_intents WHERE user_id = ? AND status = 'succeeded'", user.id)) flags.push('no_purchase_history');

      const tok = CRYPTO_NETWORKS[dest.network].tokens[dest.token];
      const id = newId('rd');
      const now = nowIso();
      const status = flags.length ? 'under_review' : 'pending';
      this.db.run(
        `INSERT INTO redemptions (id,user_id,amount_sc_cents,method,network,token,token_contract,destination_id,destination_address,amount_atomic,status,risk_flags,idempotency_key,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        id, user.id, cents, 'crypto', dest.network, dest.token, tok.contract.toLowerCase(), dest.id, dest.address,
        (BigInt(cents) * 10n ** BigInt(tok.decimals - 2)).toString(), status, JSON.stringify(flags), idempotencyKey, now, now
      );
      this.ledger.post({ userId: user.id, type: 'REDEMPTION_RESERVE', currency: 'SC', bucket: 'AVAILABLE', amount: -cents, idempotencyKey: `redeem:${id}:reserve:out`, refType: 'redemption', refId: id });
      this.ledger.post({ userId: user.id, type: 'REDEMPTION_RESERVE', currency: 'SC', bucket: 'HOLD', amount: cents, idempotencyKey: `redeem:${id}:reserve:in`, refType: 'redemption', refId: id });
      this._event(id, null, status, user.id, flags.join(',') || 'auto_checks_passed');
      return { redemption: this.publicRedemption(this.db.get('SELECT * FROM redemptions WHERE id = ?', id)), replayed: false };
    });
  }

  cancel(user, id) {
    return this.db.tx(() => {
      const r = this._own(user.id, id);
      if (!['pending', 'under_review'].includes(r.status)) throw conflict('BAD_STATE', 'Only unapproved requests can be cancelled.');
      this._transition(r, 'cancelled', user.id, 'cancelled_by_player');
      this._release(r, 'cancel');
      return this.publicRedemption(this.db.get('SELECT * FROM redemptions WHERE id = ?', id));
    });
  }

  listForUser(userId) {
    return this.db.all('SELECT * FROM redemptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100', userId).map((r) => this.publicRedemption(r));
  }

  publicRedemption(r) {
    return {
      id: r.id, amountSc: r.amount_sc_cents / 100, method: r.method, network: r.network, token: r.token,
      destination: `${r.destination_address.slice(0, 6)}…${r.destination_address.slice(-4)}`, status: r.status,
      txHash: r.tx_hash, reason: r.status === 'rejected' ? r.reason : null, createdAt: r.created_at, updatedAt: r.updated_at,
    };
  }

  // ---- staff actions (callers enforce role + step-up) ----------------------
  queue(statuses = ['pending', 'under_review', 'approved', 'processing']) {
    const marks = statuses.map(() => '?').join(',');
    return this.db.all(`SELECT r.*, u.email, u.kyc_status FROM redemptions r JOIN users u ON u.id = r.user_id WHERE r.status IN (${marks}) ORDER BY r.created_at`, ...statuses)
      .map((r) => ({ ...r, risk_flags: JSON.parse(r.risk_flags) }));
  }

  approve(staff, id) {
    const rc = this.config.redemptions;
    return this.db.tx(() => {
      const r = this._get(id);
      if (!['pending', 'under_review'].includes(r.status)) throw conflict('BAD_STATE', `Cannot approve from ${r.status}.`);
      if (r.user_id === staff.id) throw forbidden('SELF_APPROVAL', 'You cannot approve your own redemption.');
      const user = this.accounts.getUser(r.user_id);
      if (user.kyc_status !== 'verified' || user.status !== 'active') throw forbidden('USER_NOT_ELIGIBLE', 'Player is not eligible for payout.');
      if (r.amount_sc_cents >= rc.dualControlScCents && !r.first_approver) {
        this.db.run('UPDATE redemptions SET first_approver = ?, updated_at = ? WHERE id = ?', staff.id, nowIso(), id);
        this._event(id, r.status, r.status, staff.id, 'first_approval (dual control)');
        this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'REDEMPTION_FIRST_APPROVAL', targetType: 'redemption', targetId: id });
        return { ...this.publicRedemption(this._get(id)), awaitingSecondApprover: true };
      }
      if (r.first_approver && r.first_approver === staff.id) throw forbidden('DUAL_CONTROL', 'A different administrator must give the second approval.');
      this._transition(r, 'approved', staff.id, 'approved');
      this.db.run('UPDATE redemptions SET approved_by = ? WHERE id = ?', staff.id, id);
      this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'REDEMPTION_APPROVED', targetType: 'redemption', targetId: id, details: { amountScCents: r.amount_sc_cents } });
      return this.publicRedemption(this._get(id));
    });
  }

  reject(staff, id, reason) {
    if (!reason || String(reason).length < 5) throw bad('REASON_REQUIRED', 'A reason is required.');
    return this.db.tx(() => {
      const r = this._get(id);
      if (!['pending', 'under_review', 'approved'].includes(r.status)) throw conflict('BAD_STATE', `Cannot reject from ${r.status}.`);
      this._transition(r, 'rejected', staff.id, reason);
      this.db.run('UPDATE redemptions SET reason = ? WHERE id = ?', String(reason).slice(0, 300), id);
      this._release(r, 'reject');
      this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'REDEMPTION_REJECTED', targetType: 'redemption', targetId: id, details: { reason } });
      return this.publicRedemption(this._get(id));
    });
  }

  /** Staff record the tx hash of a payout signed OUTSIDE this app. It is not trusted until verified on-chain. */
  markProcessing(staff, id, txHash) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash || ''))) throw bad('INVALID_TX_HASH', 'Invalid transaction hash.');
    return this.db.tx(() => {
      const r = this._get(id);
      if (r.status !== 'approved') throw conflict('BAD_STATE', 'Redemption must be approved first.');
      try {
        this.db.run('UPDATE redemptions SET tx_hash = ? WHERE id = ?', txHash.toLowerCase(), id);
      } catch (e) {
        if (/UNIQUE/.test(e.message)) throw conflict('TX_REUSED', 'This transaction hash is already attached to another redemption.');
        throw e;
      }
      this._transition(r, 'processing', staff.id, `payout tx recorded ${txHash}`);
      this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'REDEMPTION_PROCESSING', targetType: 'redemption', targetId: id, details: { txHash } });
      return this.publicRedemption(this._get(id));
    });
  }

  /** Verifies the payout on-chain, then completes (ledger) or reports state. */
  async verifyAndComplete(staff, id) {
    const r = this._get(id);
    if (r.status !== 'processing') throw conflict('BAD_STATE', 'Redemption is not processing.');
    const v = await this.gateway.verifyPayout(r, r.tx_hash);
    if (v.state === 'confirmed') {
      this.db.tx(() => {
        const cur = this._get(id);
        if (cur.status !== 'processing') return;
        this.ledger.post({ userId: r.user_id, type: 'REDEMPTION_PAID', currency: 'SC', bucket: 'HOLD', amount: -r.amount_sc_cents, idempotencyKey: `redeem:${id}:paid`, refType: 'redemption', refId: id, metadata: { txHash: r.tx_hash } });
        this._transition(cur, 'completed', staff?.id || 'system', `verified on-chain (${v.confirmations} confirmations)`);
      });
      this.audit.record({ actorId: staff?.id || 'system', actorRole: staff?.role || 'SYSTEM', action: 'REDEMPTION_COMPLETED', targetType: 'redemption', targetId: id, details: { txHash: r.tx_hash } });
    }
    return { verification: v, redemption: this.publicRedemption(this._get(id)) };
  }

  /** Failed payout recovery: release the reserve back to the player after the failure is confirmed. */
  fail(staff, id, reason) {
    if (!reason || String(reason).length < 5) throw bad('REASON_REQUIRED', 'A reason is required.');
    return this.db.tx(() => {
      const r = this._get(id);
      if (!['approved', 'processing'].includes(r.status)) throw conflict('BAD_STATE', `Cannot fail from ${r.status}.`);
      this._transition(r, 'failed', staff.id, reason);
      this.db.run('UPDATE redemptions SET reason = ? WHERE id = ?', String(reason).slice(0, 300), id);
      this._release(r, 'fail');
      this.audit.record({ actorId: staff.id, actorRole: staff.role, action: 'REDEMPTION_FAILED', targetType: 'redemption', targetId: id, details: { reason } });
      return this.publicRedemption(this._get(id));
    });
  }

  // ---- internals -----------------------------------------------------------
  _get(id) {
    const r = this.db.get('SELECT * FROM redemptions WHERE id = ?', id);
    if (!r) throw notFound('NOT_FOUND', 'Redemption not found.');
    return r;
  }
  _own(userId, id) {
    const r = this._get(id);
    if (r.user_id !== userId) throw notFound('NOT_FOUND', 'Redemption not found.');
    return r;
  }
  _transition(r, to, actor, note) {
    const res = this.db.run('UPDATE redemptions SET status = ?, updated_at = ? WHERE id = ? AND status = ?', to, nowIso(), r.id, r.status);
    if (res.changes !== 1) throw conflict('BAD_STATE', 'Redemption changed concurrently.');
    this._event(r.id, r.status, to, actor, note);
  }
  _event(id, from, to, actor, note) {
    this.db.run('INSERT INTO redemption_events (redemption_id,from_status,to_status,actor_id,note,created_at) VALUES (?,?,?,?,?,?)', id, from, to, actor, note ?? null, nowIso());
  }
  _release(r, why) {
    this.ledger.post({ userId: r.user_id, type: 'REDEMPTION_RELEASE', currency: 'SC', bucket: 'HOLD', amount: -r.amount_sc_cents, idempotencyKey: `redeem:${r.id}:${why}:out`, refType: 'redemption', refId: r.id });
    this.ledger.post({ userId: r.user_id, type: 'REDEMPTION_RELEASE', currency: 'SC', bucket: 'AVAILABLE', amount: r.amount_sc_cents, idempotencyKey: `redeem:${r.id}:${why}:in`, refType: 'redemption', refId: r.id });
  }

  history(id) {
    return this.db.all('SELECT * FROM redemption_events WHERE redemption_id = ? ORDER BY seq', id);
  }
}

export { TERMINAL, ACTIVE };
