import crypto from 'node:crypto';
import { SlotMathEngine } from '../../src/engine/math/SlotMathEngine.js';
import { spinPhysicalReels } from '../../src/engine/math/ReelStripModel.js';
import { LINE_OPTIONS, LINE_BET_TIERS_GC, LINE_BET_TIERS_SC } from '../../src/config/slotConfig.js';
import { ServerRNG } from '../engine/ServerRNG.js';
import { AppError, bad, conflict, newId, nowIso, notFound } from './ledger.js';

const CLIENT_SEED_RE = /^[A-Za-z0-9_-]{1,64}$/;

/** Pure, deterministic outcome derivation - shared by the live spin and the public verifier. */
export function deriveOutcome(engine, { serverSeed, clientSeed, nonce, lines, lineBetUnits }) {
  let cursor = 0;
  const rng = () => ServerRNG.provablyFairFloat(serverSeed, clientSeed, nonce, ++cursor);
  const { stops, grid, peeksAbove, peeksBelow } = spinPhysicalReels(rng);
  const outcome = engine.evaluateGrid(grid, 1, { stops, peeksAbove, peeksBelow }, lines);
  const winUnits = Math.round(outcome.totalWin * lineBetUnits); // GC: coins, SC: cents
  return {
    stops,
    grid: grid.map((col) => col.map((c) => (typeof c === 'string' ? c : c.id))),
    winUnits,
    scatterCount: outcome.scatterCount,
    wins: outcome.winningLines.map((w) => ({ symbolId: w.symbolId, matchCount: w.matchCount, lineWin: w.lineWin, rows: w.line?.rows })),
  };
}

/**
 * Server-authoritative slot spins (base game).
 * Every spin: validate -> reserve bet -> derive outcome from committed per-player server seed -> credit win
 * -> persist the full record, ALL inside one DB transaction (atomic, replay-safe via Idempotency-Key).
 */
export class SpinService {
  constructor({ db, ledger, accounts, config }) {
    Object.assign(this, { db, ledger, accounts, config });
    this.engine = new SlotMathEngine();
    this.lastSpin = new Map();
  }

  _activeSeed(userId) {
    let s = this.db.get('SELECT * FROM seeds WHERE user_id = ? AND revealed_at IS NULL ORDER BY epoch DESC LIMIT 1', userId);
    if (!s) {
      const prev = this.db.get('SELECT MAX(epoch) e FROM seeds WHERE user_id = ?', userId).e ?? 0;
      const seed = ServerRNG.generateSeed();
      this.db.run('INSERT INTO seeds (user_id,epoch,server_seed,server_seed_hash) VALUES (?,?,?,?)', userId, prev + 1, seed, ServerRNG.hashSeed(seed));
      s = this.db.get('SELECT * FROM seeds WHERE user_id = ? AND epoch = ?', userId, prev + 1);
    }
    return s;
  }

  commitment(userId) {
    const s = this.db.tx(() => this._activeSeed(userId));
    return { epoch: s.epoch, serverSeedHash: s.server_seed_hash, nextNonce: s.nonce + 1, algorithm: 'HMAC-SHA256(serverSeed, clientSeed:nonce:cursor)' };
  }

  /** Reveals the active server seed (so all its spins become verifiable) and starts a fresh committed seed. */
  rotateSeed(userId) {
    return this.db.tx(() => {
      const s = this._activeSeed(userId);
      this.db.run('UPDATE seeds SET revealed_at = ? WHERE user_id = ? AND epoch = ?', nowIso(), userId, s.epoch);
      const next = this._activeSeed(userId);
      return { revealed: { epoch: s.epoch, serverSeed: s.server_seed, serverSeedHash: s.server_seed_hash, spins: s.nonce }, next: { epoch: next.epoch, serverSeedHash: next.server_seed_hash } };
    });
  }

  spin(user, { currency, lines, lineBet, clientSeed, idempotencyKey }) {
    this.accounts.assertCanPlay(user);
    if (currency !== 'GC' && currency !== 'SC') throw bad('INVALID_CURRENCY', 'Invalid currency.');
    if (currency === 'SC' && !this.config.game.scPlayEnabled) throw new AppError(503, 'SC_PLAY_DISABLED', 'Sweeps Coin play is not enabled yet.');
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(String(idempotencyKey || ''))) throw bad('IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key is required.');
    if (!LINE_OPTIONS.includes(lines)) throw bad('INVALID_LINES', 'Invalid line count.');
    const tiers = currency === 'SC' ? LINE_BET_TIERS_SC : LINE_BET_TIERS_GC;
    if (typeof lineBet !== 'number' || !tiers.includes(lineBet)) throw bad('INVALID_BET', 'Invalid bet level.');
    const cSeed = clientSeed === undefined || clientSeed === null ? crypto.randomBytes(8).toString('hex') : String(clientSeed);
    if (!CLIENT_SEED_RE.test(cSeed)) throw bad('INVALID_CLIENT_SEED', 'Invalid client seed.');

    const units = currency === 'SC' ? Math.round(lineBet * 100) : lineBet; // cents | coins
    const bet = units * lines;

    return this.db.tx(() => {
      const dup = this.db.get('SELECT * FROM spins WHERE user_id = ? AND idempotency_key = ?', user.id, idempotencyKey);
      if (dup) {
        if (dup.currency !== currency || dup.lines !== lines || dup.line_bet !== String(lineBet)) throw conflict('IDEMPOTENCY_MISMATCH', 'Idempotency key reused with different parameters.');
        return { ...this._present(dup), replayed: true };
      }
      const now = Date.now();
      if (now - (this.lastSpin.get(user.id) || 0) < this.config.game.minSpinIntervalMs) throw new AppError(429, 'TOO_FAST', 'Please slow down.');
      this.lastSpin.set(user.id, now);

      const seed = this._activeSeed(user.id);
      const nonce = seed.nonce + 1;
      this.db.run('UPDATE seeds SET nonce = ? WHERE user_id = ? AND epoch = ?', nonce, user.id, seed.epoch);
      const spinId = newId('sp');

      this.ledger.post({
        userId: user.id, type: 'BET', currency, amount: -bet, idempotencyKey: `spin:${spinId}:bet`, refType: 'spin', refId: spinId,
        unplayedDelta: currency === 'SC' ? -bet : 0, metadata: { lines, lineBet },
      });
      const out = deriveOutcome(this.engine, { serverSeed: seed.server_seed, clientSeed: cSeed, nonce, lines, lineBetUnits: units });
      if (out.winUnits > 0) {
        this.ledger.post({ userId: user.id, type: 'WIN', currency, amount: out.winUnits, idempotencyKey: `spin:${spinId}:win`, refType: 'spin', refId: spinId, metadata: { scatterCount: out.scatterCount } });
      }
      const row = {
        id: spinId, user_id: user.id, currency, lines, line_bet: String(lineBet), bet, win: out.winUnits, epoch: seed.epoch, nonce,
        client_seed: cSeed, server_seed_hash: seed.server_seed_hash, stops: JSON.stringify(out.stops),
        result: JSON.stringify({ grid: out.grid, wins: out.wins, scatterCount: out.scatterCount }), idempotency_key: idempotencyKey, created_at: nowIso(),
      };
      this.db.run(
        'INSERT INTO spins (id,user_id,currency,lines,line_bet,bet,win,epoch,nonce,client_seed,server_seed_hash,stops,result,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        ...Object.values(row)
      );
      return { ...this._present(row), replayed: false };
    });
  }

  _present(r) {
    const isSC = r.currency === 'SC';
    const f = (u) => (isSC ? u / 100 : u);
    const w = this.ledger.getWallet(r.user_id);
    const result = JSON.parse(r.result);
    return {
      spinId: r.id, currency: r.currency, lines: r.lines, lineBet: Number(r.line_bet), bet: f(r.bet), win: f(r.win),
      grid: result.grid, wins: result.wins, scatterCount: result.scatterCount, stops: JSON.parse(r.stops),
      fairness: { epoch: r.epoch, nonce: r.nonce, clientSeed: r.client_seed, serverSeedHash: r.server_seed_hash },
      balance: { gc: w.gc, sc: w.sc / 100 },
      createdAt: r.created_at,
    };
  }

  history(userId, limit = 50) {
    return this.db.all('SELECT * FROM spins WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', userId, Math.min(limit | 0 || 50, 200))
      .map((r) => ({ spinId: r.id, currency: r.currency, bet: r.currency === 'SC' ? r.bet / 100 : r.bet, win: r.currency === 'SC' ? r.win / 100 : r.win, nonce: r.nonce, epoch: r.epoch, createdAt: r.created_at }));
  }

  /** Re-derives a past spin once its server seed has been revealed by rotation. */
  verifySpin(userId, spinId) {
    const r = this.db.get('SELECT * FROM spins WHERE id = ? AND user_id = ?', spinId, userId);
    if (!r) throw notFound('NOT_FOUND', 'Spin not found.');
    const seed = this.db.get('SELECT * FROM seeds WHERE user_id = ? AND epoch = ?', userId, r.epoch);
    if (!seed.revealed_at) return { verifiable: false, reason: 'Rotate your seed to reveal the server seed for this spin.' };
    if (ServerRNG.hashSeed(seed.server_seed) !== r.server_seed_hash) return { verifiable: true, valid: false, reason: 'seed hash mismatch' };
    const units = r.currency === 'SC' ? Math.round(Number(r.line_bet) * 100) : Number(r.line_bet);
    const out = deriveOutcome(this.engine, { serverSeed: seed.server_seed, clientSeed: r.client_seed, nonce: r.nonce, lines: r.lines, lineBetUnits: units });
    const stored = JSON.parse(r.stops);
    return { verifiable: true, valid: out.winUnits === r.win && out.stops.every((s, i) => s === stored[i]), recomputed: { stops: out.stops, win: out.winUnits } };
  }
}
