// ============================================================================
// PERSISTENT STORE — single source of truth for all money state
// ============================================================================
// Two interchangeable backends with an identical API:
//
//   SqlStore    — SQLite. Used in production inside the CasinoCore Durable
//                 Object (ctx.storage.sql) and by the Node server (node:sqlite).
//                 All multi-row money mutations run inside store.transaction()
//                 which maps to ctx.storage.transactionSync() / BEGIN..COMMIT,
//                 so a wallet debit and its ledger row commit or roll back
//                 together.
//   MemoryStore — pure JS Maps. Used by unit tests and local tooling only.
//
// Data model: a generic document table keyed by (collection, id) with two
// indexed lookup columns (k1, k2) per collection, plus an append-only ledger.
// ============================================================================

/** Index column mapping per collection: doc -> { k1, k2 } */
const COLLECTIONS = {
  users: (d) => ({ k1: d.email || null, k2: d.role || null }),
  sessions: (d) => ({ k1: d.userId || null, k2: String(d.expiresAt || '') }),
  accounts: () => ({ k1: null, k2: null }),
  orders: (d) => ({ k1: d.status || null, k2: d.userId || null }),
  redemptions: (d) => ({ k1: d.status || null, k2: d.userId || null }),
  deposits: (d) => ({ k1: d.status || null, k2: d.userId || null }),
  card_charges: (d) => ({ k1: d.status || null, k2: d.userId || null }),
  claimed_tx: (d) => ({ k1: d.kind || null, k2: d.refId || null }),
  kyc: (d) => ({ k1: d.status || null, k2: d.identityKey || null }),
  meta: () => ({ k1: null, k2: null }),
};

function indexFor(collection, doc) {
  const fn = COLLECTIONS[collection];
  if (!fn) throw new Error(`Unknown store collection: ${collection}`);
  return fn(doc);
}

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// SQL drivers (adapt DO storage.sql and node:sqlite to one tiny interface)
// ---------------------------------------------------------------------------

/** Cloudflare Durable Object SQLite storage driver */
export function createDurableObjectDriver(storage) {
  const sql = storage.sql;
  return {
    all: (q, ...b) => sql.exec(q, ...b).toArray(),
    get: (q, ...b) => sql.exec(q, ...b).toArray()[0] || null,
    run: (q, ...b) => {
      sql.exec(q, ...b).toArray();
    },
    exec: (q) => {
      sql.exec(q);
    },
    transaction: (fn) => storage.transactionSync(fn),
  };
}

/** node:sqlite (DatabaseSync) driver — Node server & SQL-path tests */
export function createNodeSqliteDriver(db) {
  return {
    all: (q, ...b) => db.prepare(q).all(...b),
    get: (q, ...b) => db.prepare(q).get(...b) || null,
    run: (q, ...b) => {
      db.prepare(q).run(...b);
    },
    exec: (q) => db.exec(q),
    transaction: (fn) => {
      db.exec('BEGIN IMMEDIATE');
      try {
        const out = fn();
        db.exec('COMMIT');
        return out;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// SqlStore
// ---------------------------------------------------------------------------
export class SqlStore {
  constructor(driver) {
    this.driver = driver;
    this._txDepth = 0;
    this.kind = 'sql';
    this._migrate();
  }

  _migrate() {
    this.driver.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        coll TEXT NOT NULL,
        id TEXT NOT NULL,
        k1 TEXT,
        k2 TEXT,
        created_at INTEGER NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (coll, id)
      );
      CREATE INDEX IF NOT EXISTS docs_k1 ON docs (coll, k1, created_at);
      CREATE INDEX IF NOT EXISTS docs_k2 ON docs (coll, k2, created_at);
      CREATE INDEX IF NOT EXISTS docs_created ON docs (coll, created_at);
      CREATE TABLE IF NOT EXISTS ledger (
        idx INTEGER PRIMARY KEY,
        id TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ledger_user ON ledger (user_id, idx);
    `);
  }

  /** Run fn atomically. Nested calls join the outer transaction. */
  transaction(fn) {
    if (this._txDepth > 0) return fn();
    this._txDepth++;
    try {
      return this.driver.transaction(fn);
    } finally {
      this._txDepth--;
    }
  }

  get(collection, id) {
    const row = this.driver.get('SELECT data FROM docs WHERE coll = ? AND id = ?', collection, String(id));
    return row ? JSON.parse(row.data) : null;
  }

  /** Insert or replace a document */
  put(collection, id, doc) {
    const { k1, k2 } = indexFor(collection, doc);
    const existing = this.driver.get('SELECT created_at FROM docs WHERE coll = ? AND id = ?', collection, String(id));
    const createdAt = existing ? existing.created_at : Date.now();
    this.driver.run(
      'INSERT OR REPLACE INTO docs (coll, id, k1, k2, created_at, data) VALUES (?, ?, ?, ?, ?, ?)',
      collection,
      String(id),
      k1,
      k2,
      createdAt,
      JSON.stringify(doc)
    );
    return doc;
  }

  /** Insert only — throws if the id already exists (used for idempotency keys) */
  insert(collection, id, doc) {
    const { k1, k2 } = indexFor(collection, doc);
    try {
      this.driver.run(
        'INSERT INTO docs (coll, id, k1, k2, created_at, data) VALUES (?, ?, ?, ?, ?, ?)',
        collection,
        String(id),
        k1,
        k2,
        Date.now(),
        JSON.stringify(doc)
      );
    } catch (err) {
      if (/UNIQUE|constraint/i.test(String(err?.message))) {
        const e = new Error(`Duplicate ${collection} id: ${id}`);
        e.code = 'DUPLICATE';
        throw e;
      }
      throw err;
    }
    return doc;
  }

  delete(collection, id) {
    this.driver.run('DELETE FROM docs WHERE coll = ? AND id = ?', collection, String(id));
  }

  /**
   * Query by optional k1/k2 equality, newest first.
   * @param {object} q - { k1?, k2?, limit?, before? (created_at ms) }
   */
  find(collection, { k1, k2, limit = 100 } = {}) {
    const where = ['coll = ?'];
    const binds = [collection];
    if (k1 !== undefined) {
      where.push('k1 = ?');
      binds.push(k1);
    }
    if (k2 !== undefined) {
      where.push('k2 = ?');
      binds.push(k2);
    }
    const rows = this.driver.all(
      `SELECT data FROM docs WHERE ${where.join(' AND ')} ORDER BY created_at DESC, id DESC LIMIT ?`,
      ...binds,
      Math.max(1, Math.min(1000, Number(limit) || 100))
    );
    return rows.map((r) => JSON.parse(r.data));
  }

  /** Delete sessions whose expiresAt (k2) is in the past */
  purgeExpiredSessions(nowMs = Date.now()) {
    const rows = this.driver.all("SELECT id, data FROM docs WHERE coll = 'sessions'");
    for (const r of rows) {
      const s = JSON.parse(r.data);
      if (Number(s.expiresAt) < nowMs) this.delete('sessions', r.id);
    }
  }

  // ---- Ledger --------------------------------------------------------------
  ledgerLast() {
    const row = this.driver.get('SELECT data FROM ledger ORDER BY idx DESC LIMIT 1');
    return row ? JSON.parse(row.data) : null;
  }

  ledgerAppend(entry) {
    this.driver.run(
      'INSERT INTO ledger (idx, id, user_id, type, data) VALUES (?, ?, ?, ?, ?)',
      entry.index,
      entry.id,
      entry.userId,
      entry.type,
      JSON.stringify(entry)
    );
    return entry;
  }

  ledgerCount() {
    const row = this.driver.get('SELECT COUNT(*) AS n FROM ledger');
    return Number(row?.n || 0);
  }

  ledgerTail(limit = 100) {
    return this.driver
      .all('SELECT data FROM ledger ORDER BY idx DESC LIMIT ?', Math.max(1, Number(limit) || 100))
      .map((r) => JSON.parse(r.data));
  }

  ledgerForUser(userId, limit = 50) {
    return this.driver
      .all('SELECT data FROM ledger WHERE user_id = ? ORDER BY idx DESC LIMIT ?', userId, Math.max(1, Number(limit) || 50))
      .map((r) => JSON.parse(r.data));
  }

  /** Ascending page of ledger entries starting at idx >= fromIdx */
  ledgerPage(fromIdx = 0, limit = 500) {
    return this.driver
      .all('SELECT data FROM ledger WHERE idx >= ? ORDER BY idx ASC LIMIT ?', fromIdx, limit)
      .map((r) => JSON.parse(r.data));
  }

  /** Test hook only: overwrite a ledger row (used to prove tamper detection) */
  _ledgerOverwrite(entry) {
    this.driver.run('UPDATE ledger SET data = ? WHERE idx = ?', JSON.stringify(entry), entry.index);
  }
}

// ---------------------------------------------------------------------------
// MemoryStore — same API, Maps underneath (tests / tooling)
// ---------------------------------------------------------------------------
export class MemoryStore {
  constructor() {
    this.kind = 'memory';
    this.colls = new Map();
    this.ledger = [];
    this._seq = 0;
  }

  _coll(name) {
    indexFor(name, {}); // validates collection name
    if (!this.colls.has(name)) this.colls.set(name, new Map());
    return this.colls.get(name);
  }

  /**
   * Snapshot-based transaction: on throw, every collection and the ledger are
   * restored, giving the same all-or-nothing semantics as SQLite.
   */
  transaction(fn) {
    if (this._inTx) return fn();
    const snapshot = {
      colls: new Map([...this.colls].map(([k, m]) => [k, new Map(m)])),
      ledgerLen: this.ledger.length,
    };
    this._inTx = true;
    try {
      return fn();
    } catch (err) {
      this.colls = snapshot.colls;
      this.ledger.length = snapshot.ledgerLen;
      throw err;
    } finally {
      this._inTx = false;
    }
  }

  get(collection, id) {
    const rec = this._coll(collection).get(String(id));
    return rec ? clone(rec.doc) : null;
  }

  put(collection, id, doc) {
    const m = this._coll(collection);
    const prev = m.get(String(id));
    m.set(String(id), {
      doc: clone(doc),
      createdAt: prev ? prev.createdAt : Date.now(),
      seq: prev ? prev.seq : ++this._seq,
      ...indexFor(collection, doc),
    });
    return doc;
  }

  insert(collection, id, doc) {
    if (this._coll(collection).has(String(id))) {
      const e = new Error(`Duplicate ${collection} id: ${id}`);
      e.code = 'DUPLICATE';
      throw e;
    }
    return this.put(collection, id, doc);
  }

  delete(collection, id) {
    this._coll(collection).delete(String(id));
  }

  find(collection, { k1, k2, limit = 100 } = {}) {
    return [...this._coll(collection).values()]
      .filter((r) => (k1 === undefined || r.k1 === k1) && (k2 === undefined || r.k2 === k2))
      .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)
      .slice(0, Math.max(1, Math.min(1000, Number(limit) || 100)))
      .map((r) => clone(r.doc));
  }

  purgeExpiredSessions(nowMs = Date.now()) {
    for (const [id, r] of this._coll('sessions')) {
      if (Number(r.doc.expiresAt) < nowMs) this._coll('sessions').delete(id);
    }
  }

  ledgerLast() {
    return this.ledger.length ? clone(this.ledger[this.ledger.length - 1]) : null;
  }

  ledgerAppend(entry) {
    this.ledger.push(clone(entry));
    return entry;
  }

  ledgerCount() {
    return this.ledger.length;
  }

  ledgerTail(limit = 100) {
    return this.ledger.slice(-limit).reverse().map(clone);
  }

  ledgerForUser(userId, limit = 50) {
    return this.ledger.filter((e) => e.userId === userId).slice(-limit).reverse().map(clone);
  }

  ledgerPage(fromIdx = 0, limit = 500) {
    return this.ledger.filter((e) => e.index >= fromIdx).slice(0, limit).map(clone);
  }

  _ledgerOverwrite(entry) {
    this.ledger[entry.index] = clone(entry);
  }
}
