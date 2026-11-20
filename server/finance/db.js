import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * Thin synchronous SQLite wrapper.
 *
 * All money-moving code runs inside `tx()` (BEGIN IMMEDIATE) and must be
 * synchronous: network calls happen BEFORE or AFTER a transaction, never inside.
 * That makes every wallet mutation atomic and serialised, even across processes.
 */
export class Db {
  constructor(file = ':memory:') {
    if (file !== ':memory:') {
      fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    }
    this.sql = new DatabaseSync(file);
    this.sql.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.depth = 0;
    this.sql.exec(SCHEMA);
    if (file !== ':memory:') {
      try { fs.chmodSync(file, 0o600); } catch { /* best effort */ }
    }
  }

  run(sql, ...params) {
    return this.sql.prepare(sql).run(...params);
  }
  get(sql, ...params) {
    return this.sql.prepare(sql).get(...params);
  }
  all(sql, ...params) {
    return this.sql.prepare(sql).all(...params);
  }
  get inTx() {
    return this.depth > 0;
  }

  /** Runs fn atomically. Nested calls use savepoints. Throwing rolls back. */
  tx(fn) {
    if (this.depth === 0) {
      this.sql.exec('BEGIN IMMEDIATE');
      this.depth = 1;
      try {
        const out = fn();
        this.sql.exec('COMMIT');
        return out;
      } catch (e) {
        try { this.sql.exec('ROLLBACK'); } catch { /* already rolled back */ }
        throw e;
      } finally {
        this.depth = 0;
      }
    }
    const sp = `sp_${this.depth++}`;
    this.sql.exec(`SAVEPOINT ${sp}`);
    try {
      const out = fn();
      this.sql.exec(`RELEASE ${sp}`);
      return out;
    } catch (e) {
      this.sql.exec(`ROLLBACK TO ${sp}; RELEASE ${sp}`);
      throw e;
    } finally {
      this.depth--;
    }
  }

  close() {
    this.sql.close();
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER','SUPPORT','FINANCE','ADMIN')),
  dob TEXT,
  state TEXT,
  kyc_status TEXT NOT NULL DEFAULT 'none' CHECK (kyc_status IN ('none','pending','verified','rejected')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','frozen','closed')),
  self_excluded_until TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_step_up_at TEXT,
  ip TEXT
);

CREATE TABLE IF NOT EXISTS auth_throttle (
  key TEXT PRIMARY KEY,
  fails INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);

CREATE TABLE IF NOT EXISTS wallets (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  gc INTEGER NOT NULL DEFAULT 0 CHECK (gc >= 0),
  sc INTEGER NOT NULL DEFAULT 0 CHECK (sc >= 0),
  sc_hold INTEGER NOT NULL DEFAULT 0 CHECK (sc_hold >= 0),
  sc_unplayed INTEGER NOT NULL DEFAULT 0 CHECK (sc_unplayed >= 0),
  version INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ledger (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('GC','SC')),
  bucket TEXT NOT NULL CHECK (bucket IN ('AVAILABLE','HOLD')),
  amount INTEGER NOT NULL,
  balance_before INTEGER NOT NULL,
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  status TEXT NOT NULL DEFAULT 'posted',
  ref_type TEXT,
  ref_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, seq);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger
BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;

-- Double-entry counterpart: every ledger row has exactly one contra row on a named system account,
-- so for each currency SUM(ledger.amount) + SUM(journal.amount) = 0 at all times.
CREATE TABLE IF NOT EXISTS journal (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  ledger_id TEXT NOT NULL UNIQUE REFERENCES ledger(id),
  account TEXT NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('GC','SC')),
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_journal_account ON journal(account, currency);
CREATE TRIGGER IF NOT EXISTS journal_no_update BEFORE UPDATE ON journal
BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;
CREATE TRIGGER IF NOT EXISTS journal_no_delete BEFORE DELETE ON journal
BEGIN SELECT RAISE(ABORT, 'journal is append-only'); END;

CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  actor_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  created_at TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;
CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit_log
BEGIN SELECT RAISE(ABORT, 'audit log is append-only'); END;

CREATE TABLE IF NOT EXISTS payment_intents (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  provider TEXT NOT NULL,
  method TEXT NOT NULL,
  package_id TEXT NOT NULL,
  amount_usd_cents INTEGER NOT NULL CHECK (amount_usd_cents > 0),
  gc INTEGER NOT NULL CHECK (gc > 0),
  sc_bonus_cents INTEGER NOT NULL CHECK (sc_bonus_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('created','pending','succeeded','failed','expired','refunded','disputed','review')),
  provider_ref TEXT,
  idempotency_key TEXT NOT NULL,
  failure_reason TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  credited_at TEXT,
  UNIQUE (user_id, idempotency_key)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_intent_provider_ref ON payment_intents(provider, provider_ref) WHERE provider_ref IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  intent_id TEXT,
  type TEXT NOT NULL,
  outcome TEXT NOT NULL,
  raw TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE (provider, event_id)
);
CREATE TRIGGER IF NOT EXISTS pevents_no_delete BEFORE DELETE ON payment_events
BEGIN SELECT RAISE(ABORT, 'payment events are append-only'); END;

CREATE TABLE IF NOT EXISTS crypto_intents (
  intent_id TEXT PRIMARY KEY REFERENCES payment_intents(id),
  network TEXT NOT NULL,
  chain_id INTEGER NOT NULL,
  token TEXT NOT NULL,
  token_contract TEXT NOT NULL,
  decimals INTEGER NOT NULL,
  treasury_address TEXT NOT NULL,
  expected_atomic TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_crypto_intent_amt ON crypto_intents(network, token, expected_atomic);

CREATE TABLE IF NOT EXISTS crypto_transfers (
  id TEXT PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  tx_hash TEXT NOT NULL,
  log_index INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  token_contract TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount_atomic TEXT NOT NULL,
  intent_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('credited','unmatched','resolved','rejected')),
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (chain_id, tx_hash, log_index)
);

CREATE TABLE IF NOT EXISTS chain_cursors (
  network TEXT PRIMARY KEY,
  last_block INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payout_destinations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  method TEXT NOT NULL,
  network TEXT NOT NULL,
  token TEXT NOT NULL,
  address TEXT NOT NULL,
  label TEXT,
  created_at TEXT NOT NULL,
  usable_after TEXT NOT NULL,
  revoked_at TEXT,
  UNIQUE (user_id, network, token, address)
);

CREATE TABLE IF NOT EXISTS redemptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  amount_sc_cents INTEGER NOT NULL CHECK (amount_sc_cents > 0),
  method TEXT NOT NULL,
  network TEXT NOT NULL,
  token TEXT NOT NULL,
  token_contract TEXT NOT NULL,
  destination_id TEXT NOT NULL REFERENCES payout_destinations(id),
  destination_address TEXT NOT NULL,
  amount_atomic TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','under_review','approved','processing','completed','rejected','failed','cancelled')),
  risk_flags TEXT NOT NULL DEFAULT '[]',
  first_approver TEXT,
  approved_by TEXT,
  tx_hash TEXT UNIQUE,
  reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
-- At most one non-terminal redemption per player (duplicate redemption protection).
CREATE UNIQUE INDEX IF NOT EXISTS idx_redemption_one_active ON redemptions(user_id)
  WHERE status IN ('pending','under_review','approved','processing');

CREATE TABLE IF NOT EXISTS redemption_events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  redemption_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);
CREATE TRIGGER IF NOT EXISTS revents_no_update BEFORE UPDATE ON redemption_events
BEGIN SELECT RAISE(ABORT, 'append-only'); END;
CREATE TRIGGER IF NOT EXISTS revents_no_delete BEFORE DELETE ON redemption_events
BEGIN SELECT RAISE(ABORT, 'append-only'); END;

CREATE TABLE IF NOT EXISTS seeds (
  user_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  server_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  nonce INTEGER NOT NULL DEFAULT 0,
  revealed_at TEXT,
  PRIMARY KEY (user_id, epoch)
);

CREATE TABLE IF NOT EXISTS spins (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  currency TEXT NOT NULL,
  lines INTEGER NOT NULL,
  line_bet TEXT NOT NULL,
  bet INTEGER NOT NULL,
  win INTEGER NOT NULL,
  epoch INTEGER NOT NULL,
  nonce INTEGER NOT NULL,
  client_seed TEXT NOT NULL,
  server_seed_hash TEXT NOT NULL,
  stops TEXT NOT NULL,
  result TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, idempotency_key)
);
CREATE TRIGGER IF NOT EXISTS spins_no_update BEFORE UPDATE ON spins
BEGIN SELECT RAISE(ABORT, 'spins are append-only'); END;
CREATE TRIGGER IF NOT EXISTS spins_no_delete BEFORE DELETE ON spins
BEGIN SELECT RAISE(ABORT, 'spins are append-only'); END;

CREATE TABLE IF NOT EXISTS promo_claims (
  user_id TEXT NOT NULL,
  promo_id TEXT NOT NULL,
  period_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, promo_id, period_key)
);

CREATE TABLE IF NOT EXISTS square_catalog_items (
  package_id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL,
  variation_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  variation_version INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);
`;
