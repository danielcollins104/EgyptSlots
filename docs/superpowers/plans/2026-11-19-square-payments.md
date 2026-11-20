# Square Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing server-authoritative payment backend to Square end-to-end — Web Payments SDK checkout (card / Apple Pay / Google Pay / Cash App Pay), programmatic Catalog product sync, Orders + Customers enrichment, Refunds API, verified webhooks, and admin payment management — production-ready but gated behind Square's approval of the GC/SC sweepstakes model.

**Architecture:** The backend (`server/finance/`) already owns pricing, intents, the ledger, and webhook crediting. This plan extends the existing `squareProvider` adapter (REST via `fetchImpl`, no new npm dependency), adds a `squareCatalog` sync service, and adds one client component (`SquareCheckout.jsx`) that loads the official Square Web Payments SDK from Square's CDN, tokenizes, and posts only the single-use `sourceId` to the existing `POST /api/payments/intents/:id/charge` route. Coins are credited ONLY by the existing verified-webhook path — never by the browser.

**Tech Stack:** Node 22 (`node:sqlite`), React 18 + Vite 6, Square Web Payments SDK (`web.squarecdn.com/v1/square.js`), Square REST APIs (`Square-Version` default `2024-10-17`). Zero new runtime dependencies.

## Global Constraints

- Square seller policy restricts gambling-type businesses: `SQUARE_ENVIRONMENT=production` and `DC_PAYMENT_PROVIDERS=square` may be enabled ONLY after Square expressly approves the GC/SC model in writing. Sandbox is used for all testing. Never misrepresent the business or substitute product descriptions.
- No new npm dependencies. Square is reached via CDN script + server-side `fetch` (injectable `fetchImpl` for tests).
- Secrets (`SQUARE_ACCESS_TOKEN`, `SQUARE_WEBHOOK_SIGNATURE_KEY`) stay server-side only, never `VITE_`-prefixed, never committed. `SQUARE_APPLICATION_ID` + `SQUARE_LOCATION_ID` are public by design and safe to send to the browser via `clientAction`.
- Prices and coin amounts are resolved ONLY by `server/finance/payments.js#resolvePackage` from `src/config/sweepstakesConfig.js`. The browser submits a `packageId`, never a price.
- Crediting happens ONLY in `PaymentService.creditIntent`, called from the verified webhook path. A browser redirect or SDK callback never credits coins.
- Crypto deposits already have a working self-hosted receive-only gateway (`server/finance/crypto.js`, USDC/USDT on Base/Polygon/Ethereum). Do NOT rebuild it. A third-party crypto processor (BTCPay Server / Coinbase Commerce) is a separate future decision requiring provider approval.
- Repo rules from `AGENTS.md`: after any `src/` change run `npm run build` (postbuild runs `cap sync`); `npm run test:all` (256 tests) and `npm run test:bonuses` (185 tests) must stay green.
- Test gates: `node scripts/test-finance.js`, `node scripts/test-security-audit.js`, `npm run test:all`, `npm run test:bonuses`, `npm run build`.
- Commit after every task; `git add` ONLY the files the task touched (the working tree has unrelated uncommitted changes — never sweep them in).
- Legacy files (`src/components/PaymentModal.jsx`, `src/payments/*`, `src/services/paymentService.js` purchase paths) are unused by `App.jsx` (which lazy-loads `CashierModal`). Do not touch them in this plan.

---

### Task 1: Square API version + provider methods config

**Files:**
- Modify: `server/finance/config.js` (providers.square block, ~line 116)
- Modify: `server/finance/providers.js` (`squareProvider`, ~lines 62-73)
- Modify: `.env.example` (Square block)
- Test: `scripts/test-finance.js` (append at end before final summary)

**Interfaces:**
- Consumes: `loadConfig(env, overrides)` existing shape.
- Produces: `config.providers.square.apiVersion` (string, default `'2024-10-17'`); `squareProvider(...).methods` becomes `['card', 'applepay', 'googlepay', 'cashapp']`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 12. Square configuration ---');
test('SQUARE_API_VERSION env is honoured and defaults pinned', () => {
  const f1 = fresh({ providers: { square: { apiVersion: '2024-10-17' } } });
  assert.equal(f1.config.providers.square.apiVersion, '2024-10-17');
  const f2 = createFinance({ dbFile: ':memory:', env: { ...process.env, SQUARE_API_VERSION: '2025-01-23' } });
  assert.equal(f2.config.providers.square.apiVersion, '2025-01-23');
});
test('square provider exposes all four Web Payments SDK methods and is unconfigured without secrets', () => {
  const f = fresh({ providers: { enabled: ['square'], square: { environment: 'sandbox', accessToken: 't', applicationId: 'a', locationId: 'l', webhookSignatureKey: 'k', webhookUrl: 'https://x.test/api/payments/webhook/square' } } });
  const sq = f.payments.providers.get('square');
  assert.deepEqual(sq.methods, ['card', 'applepay', 'googlepay', 'cashapp']);
  assert.equal(sq.configured, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `apiVersion` undefined / methods `['cashapp','card']`.

- [ ] **Step 3: Implement**

In `server/finance/config.js`, inside the `square:` object, add one line after `webhookUrl`:

```js
        apiVersion: env.SQUARE_API_VERSION || '2024-10-17',
```

In `server/finance/providers.js`, inside `squareProvider`, change:

```js
    'Square-Version': '2024-10-17',
```
to
```js
    'Square-Version': c.apiVersion || '2024-10-17',
```
and change:
```js
    methods: ['cashapp', 'card'],
```
to
```js
    methods: ['card', 'applepay', 'googlepay', 'cashapp'],
```

In `.env.example`, in the Square block after `SQUARE_WEBHOOK_URL=...`, add:

```bash
# Pinned Square API version (see https://developer.squareup.com/docs/build-basics/versioning-overview)
SQUARE_API_VERSION=2024-10-17
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-finance.js`
Expected: PASS (all prior tests still green).

- [ ] **Step 5: Commit**

```bash
git add server/finance/config.js server/finance/providers.js .env.example scripts/test-finance.js
git commit -m "feat(square): configurable SQUARE_API_VERSION, expose card/applepay/googlepay/cashapp methods"
```

---

### Task 2: Catalog mapping table

**Files:**
- Modify: `server/finance/db.js` (SCHEMA const, append before closing backtick, ~line 337)
- Test: `scripts/test-finance.js`

**Interfaces:**
- Produces: table `square_catalog_items(package_id TEXT PRIMARY KEY, catalog_item_id TEXT, variation_id TEXT, version INTEGER, variation_version INTEGER, price_cents INTEGER, synced_at TEXT)`. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
test('square_catalog_items table persists package->catalog mapping with upsert', () => {
  const f = fresh();
  f.db.run("INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at) VALUES ('pkg_starter','ITM1','VAR1',1,1,499,'2026-11-19T00:00:00.000Z')");
  f.db.run("INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at) VALUES ('pkg_starter','ITM1','VAR1',2,2,499,'2026-11-19T01:00:00.000Z') ON CONFLICT(package_id) DO UPDATE SET version=excluded.version, synced_at=excluded.synced_at");
  const row = f.db.get("SELECT * FROM square_catalog_items WHERE package_id = 'pkg_starter'");
  assert.equal(row.catalog_item_id, 'ITM1');
  assert.equal(row.version, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `no such table: square_catalog_items`.

- [ ] **Step 3: Implement**

In `server/finance/db.js`, append to `SCHEMA` (before the closing backtick):

```sql
CREATE TABLE IF NOT EXISTS square_catalog_items (
  package_id TEXT PRIMARY KEY,
  catalog_item_id TEXT NOT NULL,
  variation_id TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0,
  variation_version INTEGER NOT NULL DEFAULT 0,
  price_cents INTEGER NOT NULL,
  synced_at TEXT NOT NULL
);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-finance.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/finance/db.js scripts/test-finance.js
git commit -m "feat(square): square_catalog_items mapping table (package -> catalog object ids)"
```

---

### Task 3: Square Catalog sync service + CLI + admin endpoint

Programmatic package creation/updates — the operator never keys packages into the Square Dashboard by hand.

**Files:**
- Create: `server/finance/squareCatalog.js`
- Modify: `server/finance/index.js` (compose `squareCatalog`)
- Modify: `server/apiRouter.js` (admin route)
- Create: `scripts/square-sync-catalog.js`
- Modify: `package.json` (add `"square:sync"` script)
- Test: `scripts/test-finance.js`

**Interfaces:**
- Consumes: `config.providers.square`, `square_catalog_items` (Task 2), `SWEEPSTAKES_CONFIG` package lists, `audit.record({action, targetType, targetId, details})`.
- Produces:
  - `createSquareCatalog({ config, fetchImpl, audit }) -> { configured: boolean, sync(db) -> Promise<{ synced: string[], count: number, at: string }> }`
  - `f.squareCatalog` on the finance composition root.
  - Route `POST /api/admin/payments/catalog/sync` (role FINANCE + step-up) -> `{ success: true, result }`.
- Square REST used: `POST /v2/catalog/batch-retrieve`, `POST /v2/catalog/batch-upsert`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 13. Square catalog sync ---');
const squareCfg = { environment: 'sandbox', accessToken: 't', applicationId: 'a', locationId: 'l', webhookSignatureKey: 'k', webhookUrl: 'https://x.test/w', apiVersion: '2024-10-17' };
test('catalog sync batch-upserts every store package with server prices and records mapping', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    if (url.endsWith('/v2/catalog/batch-upsert')) {
      const mappings = [];
      for (const o of opts.body ? JSON.parse(opts.body).batches[0].objects : []) {
        mappings.push({ client_object_id: o.id, object_id: `SQ_${o.id.slice(1)}` });
        for (const v of o.item_data.variations) mappings.push({ client_object_id: v.id, object_id: `SQ_${v.id.slice(1)}` });
      }
      return { ok: true, json: async () => ({ id_mappings: mappings }) };
    }
    return { ok: true, json: async () => ({ objects: [] }) };
  };
  const f = fresh({ providers: { square: squareCfg } }, { fetchImpl });
  const res = await f.squareCatalog.sync(f.db);
  assert.ok(res.count >= 12, `expected >=12 packages, got ${res.count}`);
  const row = f.db.get("SELECT * FROM square_catalog_items WHERE package_id = 'pkg_starter'");
  assert.equal(row.catalog_item_id, 'SQ_pkg_starter');
  assert.equal(row.price_cents, 499);
  const upsert = calls.find((c) => c.url.endsWith('batch-upsert'));
  const starter = upsert.body.batches[0].objects.find((o) => o.id === '#pkg_starter');
  assert.equal(starter.item_data.variations[0].item_variation_data.price_money.amount, 499);
  assert.equal(starter.item_data.variations[0].item_variation_data.price_money.currency, 'USD');
  const auditRow = f.db.get("SELECT * FROM audit_log WHERE action = 'SQUARE_CATALOG_SYNC'");
  assert.ok(auditRow, 'sync is audit-logged');
});
test('second sync updates existing catalog objects instead of duplicating', async () => {
  const upserts = [];
  const fetchImpl = async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : {};
    if (url.endsWith('/v2/catalog/batch-retrieve')) {
      return { ok: true, json: async () => ({ objects: (body.object_ids || []).map((id) => ({ id, version: 7, type: 'ITEM', item_data: { variations: [{ id: id.replace('SQ_', 'SQ_') + '_var', version: 3 }] } })) }) };
    }
    if (url.endsWith('/v2/catalog/batch-upsert')) { upserts.push(body); return { ok: true, json: async () => ({ id_mappings: [] }) }; }
    return { ok: true, json: async () => ({}) };
  };
  const f = fresh({ providers: { square: squareCfg } }, { fetchImpl });
  f.db.run("INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at) VALUES ('pkg_starter','SQ_pkg_starter','SQ_pkg_starter_var',1,1,499,'2026-11-19T00:00:00.000Z')");
  // shrink package list influence: sync must reuse stored id for pkg_starter
  const { createSquareCatalog } = await import('../server/finance/squareCatalog.js');
  const cat = createSquareCatalog({ config: f.config, fetchImpl, audit: f.audit, packages: [{ id: 'pkg_starter', tierTitle: 'Root Chakra Royal Scepter Pack', priceUsd: 4.99, goldCoins: 10000, freeSweepsCoins: 5 }] });
  await cat.sync(f.db);
  const obj = upserts[0].batches[0].objects[0];
  assert.equal(obj.id, 'SQ_pkg_starter', 'uses stored catalog id (update, not duplicate)');
  assert.equal(obj.version, 7, 'sends current version from batch-retrieve');
  assert.equal(obj.item_data.variations[0].id, 'SQ_pkg_starter_var');
});
test('catalog sync fails closed without credentials', async () => {
  const f = fresh();
  await assert.rejects(() => f.squareCatalog.sync(f.db), /credentials|SQUARE_ACCESS_TOKEN/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `f.squareCatalog` undefined / module not found.

- [ ] **Step 3: Implement**

Create `server/finance/squareCatalog.js`:

```js
import crypto from 'node:crypto';
import { SWEEPSTAKES_CONFIG } from '../../src/config/sweepstakesConfig.js';

/** Every purchasable package, from the same server-side source of truth the cashier uses. */
export const allPackages = () => [
  ...(SWEEPSTAKES_CONFIG.storePackages || []),
  ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
  ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
  ...(SWEEPSTAKES_CONFIG.rescuePackages || []),
];

/**
 * Square Catalog sync. Creates or updates one Catalog ITEM (+ one FIXED-price ITEM_VARIATION)
 * per game package. Mapping (package_id -> catalog ids) is persisted in square_catalog_items so
 * re-runs UPDATE in place and never create duplicates. Product copy is honest: Gold Coins are
 * described as social-play items with no cash value — do not change wording to disguise the model.
 */
export function createSquareCatalog({ config, fetchImpl = globalThis.fetch, audit = null, packages = null }) {
  const c = config.providers.square;
  const base = c.environment === 'production' ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const headers = () => ({
    Authorization: `Bearer ${c.accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': c.apiVersion || '2024-10-17',
  });
  const api = async (method, path, body) => {
    const res = await fetchImpl(`${base}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error(`Square catalog request failed (${res.status})`);
      e.details = json.errors;
      throw e;
    }
    return json;
  };

  return {
    configured: Boolean(c.accessToken && c.locationId),

    async sync(db) {
      if (!this.configured) throw new Error('Square catalog sync requires SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID credentials');
      const list = packages || allPackages();
      const stored = new Map(db.all('SELECT * FROM square_catalog_items').map((r) => [r.package_id, r]));

      // Refresh current versions for previously-synced items so updates don't version-conflict.
      const known = list.filter((p) => stored.has(p.id));
      if (known.length) {
        const got = await api('POST', '/v2/catalog/batch-retrieve', { object_ids: known.map((p) => stored.get(p.id).catalog_item_id) });
        for (const obj of got.objects || []) {
          const pkg = known.find((p) => stored.get(p.id).catalog_item_id === obj.id);
          if (!pkg) continue;
          const variation = (obj.item_data?.variations || []).find((v) => v.id === stored.get(pkg.id).variation_id);
          db.run('UPDATE square_catalog_items SET version = ?, variation_version = ? WHERE package_id = ?',
            obj.version ?? 0, variation?.version ?? 0, pkg.id);
          stored.get(pkg.id).version = obj.version ?? 0;
          stored.get(pkg.id).variation_version = variation?.version ?? 0;
        }
      }

      const objects = list.map((pkg) => {
        const s = stored.get(pkg.id);
        const priceCents = Math.round(pkg.priceUsd * 100);
        return {
          type: 'ITEM',
          id: s ? s.catalog_item_id : `#${pkg.id}`,
          ...(s ? { version: s.version } : {}),
          present_at_all_locations: true,
          item_data: {
            name: String(pkg.tierTitle || pkg.id).slice(0, 255),
            description: `${Number(pkg.goldCoins).toLocaleString('en-US')} Gold Coins for social play. Gold Coins have no cash value and cannot be redeemed.`.slice(0, 1024),
            variations: [{
              type: 'ITEM_VARIATION',
              id: s ? s.variation_id : `#${pkg.id}_var`,
              ...(s ? { version: s.variation_version } : {}),
              item_variation_data: {
                ...(s ? {} : { item_id: `#${pkg.id}` }),
                name: 'Standard',
                pricing_type: 'FIXED',
                price_money: { amount: priceCents, currency: 'USD' },
              },
            }],
          },
        };
      });

      const res = await api('POST', '/v2/catalog/batch-upsert', { idempotency_key: crypto.randomUUID(), batches: [{ objects }] });
      const idMap = new Map((res.id_mappings || []).map((m) => [m.client_object_id, m.object_id]));
      const now = new Date().toISOString();
      const synced = [];
      for (const pkg of list) {
        const s = stored.get(pkg.id);
        const itemId = s ? s.catalog_item_id : idMap.get(`#${pkg.id}`);
        const varId = s ? s.variation_id : idMap.get(`#${pkg.id}_var`);
        if (!itemId || !varId) throw new Error(`Square did not return catalog object ids for ${pkg.id}`);
        db.run(
          `INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(package_id) DO UPDATE SET catalog_item_id=excluded.catalog_item_id, variation_id=excluded.variation_id,
             price_cents=excluded.price_cents, synced_at=excluded.synced_at`,
          pkg.id, itemId, varId, s ? s.version : 0, s ? s.variation_version : 0, Math.round(pkg.priceUsd * 100), now
        );
        synced.push(pkg.id);
      }
      audit?.record({ action: 'SQUARE_CATALOG_SYNC', targetType: 'provider', targetId: 'square', details: { count: synced.length, packages: synced } });
      return { synced, count: synced.length, at: now };
    },
  };
}
```

In `server/finance/index.js`: add import and wiring.

```js
import { createSquareCatalog } from './squareCatalog.js';
```
and after the `admin` line in `createFinance`:
```js
  const squareCatalog = createSquareCatalog({ config, fetchImpl: opts.fetchImpl, audit });
```
and add `squareCatalog` to the returned object.

In `server/apiRouter.js` `_define()`, after the reconciliation route line add:

```js
    this._r('POST', '/api/admin/payments/catalog/sync', FS, async ({ f, user }) => {
      const result = await f.squareCatalog.sync(f.db);
      return { result };
    });
    this._r('GET', '/api/admin/payments/catalog', S, ({ f }) => ({ items: f.db.all('SELECT * FROM square_catalog_items ORDER BY price_cents') }));
```

Create `scripts/square-sync-catalog.js`:

```js
// Sync game packages into the Square Catalog (uses SQUARE_* env; sandbox unless SQUARE_ENVIRONMENT=production).
import { createFinance } from '../server/finance/index.js';

const f = createFinance();
try {
  const res = await f.squareCatalog.sync(f.db);
  console.log(`[square:sync] ${res.count} packages synced (${f.config.providers.square.environment}) at ${res.at}`);
} finally {
  f.db.close();
}
```

In `package.json` scripts, add:

```json
    "square:sync": "node scripts/square-sync-catalog.js",
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-finance.js`
Expected: PASS (3 new tests green).

- [ ] **Step 5: Commit**

```bash
git add server/finance/squareCatalog.js server/finance/index.js server/apiRouter.js scripts/square-sync-catalog.js package.json scripts/test-finance.js
git commit -m "feat(square): programmatic Catalog sync (batch-upsert, id mapping, audit) + CLI + admin route"
```

---

### Task 4: Orders + Customers enrichment on the charge path

Square payments get a `customer_id` and a catalog-backed `order_id` when available. Enrichment is best-effort and NEVER blocks or alters the charge amount (which always comes from the DB intent).

**Files:**
- Modify: `server/finance/providers.js` (`squareProvider`)
- Modify: `server/finance/payments.js` (`chargeWithSource`)
- Test: `scripts/test-finance.js`

**Interfaces:**
- Consumes: `square_catalog_items.variation_id` (Task 2/3).
- Produces:
  - `squareProvider(...).findOrCreateCustomer({ email }) -> Promise<string>` (customer id)
  - `squareProvider(...).createOrder({ intent, itemVariationId, customerId }) -> Promise<string>` (order id)
  - `squareProvider(...).charge({ intent, sourceId, orderId, customerId })` — `orderId`/`customerId` optional.
  - `PaymentService.chargeWithSource(user, intentId, sourceId)` unchanged signature; on Square intents it enriches and stores `{ square: { orderId, customerId } }` in `payment_intents.metadata`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 14. Square charge enrichment (orders + customers) ---');
test('square charge includes order_id + customer_id when catalog synced; amount always from DB', async () => {
  let paymentBody = null;
  const fetchImpl = async (url, opts) => {
    if (url.endsWith('/v2/customers/search')) return { ok: true, json: async () => ({ customers: [{ id: 'CUST1' }] }) };
    if (url.endsWith('/v2/orders')) return { ok: true, json: async () => ({ order: { id: 'ORD1' } }) };
    if (url.endsWith('/v2/payments')) { paymentBody = JSON.parse(opts.body); return { ok: true, json: async () => ({ payment: { id: 'PAY1' } }) }; }
    return { ok: true, json: async () => ({}) };
  };
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl });
  f.db.run("INSERT INTO square_catalog_items (package_id, catalog_item_id, variation_id, version, variation_version, price_cents, synced_at) VALUES ('pkg_starter','SQ_pkg_starter','SQ_pkg_starter_var',1,1,499,'2026-11-19T00:00:00.000Z')");
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const r = await f.payments.chargeWithSource(user(f, u.id), intent.id, 'cnon:card-nonce-ok');
  assert.equal(r.status, 'processing');
  assert.equal(paymentBody.amount_money.amount, 499, 'server-side package price, never client input');
  assert.equal(paymentBody.order_id, 'ORD1');
  assert.equal(paymentBody.customer_id, 'CUST1');
  assert.equal(paymentBody.idempotency_key, intent.id);
  const row = f.db.get('SELECT metadata FROM payment_intents WHERE id = ?', intent.id);
  assert.equal(JSON.parse(row.metadata).square.orderId, 'ORD1');
});
test('charge still succeeds when order/customer enrichment fails (best-effort)', async () => {
  let paymentBody = null;
  const fetchImpl = async (url, opts) => {
    if (url.endsWith('/v2/payments')) { paymentBody = JSON.parse(opts.body); return { ok: true, json: async () => ({ payment: { id: 'PAY2' } }) }; }
    return { ok: false, status: 500, json: async () => ({ errors: [{ code: 'BOOM' }] }) };
  };
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl });
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const r = await f.payments.chargeWithSource(user(f, u.id), intent.id, 'cnon:card-nonce-ok');
  assert.equal(r.status, 'processing');
  assert.equal(paymentBody.order_id, undefined);
  assert.ok(f.db.get("SELECT 1 x FROM audit_log WHERE action = 'SQUARE_ORDER_ENRICHMENT_FAILED' AND target_id = ?", intent.id));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `createOrder`/`findOrCreateCustomer` not functions; no enrichment.

- [ ] **Step 3: Implement**

In `server/finance/providers.js` `squareProvider`, add these methods (after `charge`, before `parseWebhook`), and update `charge`:

```js
    /** Square Customers API: reuse an existing customer by email, else create. */
    async findOrCreateCustomer({ email }) {
      const s = await fetchImpl(`${base}/v2/customers/search`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ query: { filter: { email_address: { exact: String(email).toLowerCase() } } }, limit: 1 }),
      });
      const sb = await s.json();
      if (s.ok && sb.customers?.[0]?.id) return sb.customers[0].id;
      const cr = await fetchImpl(`${base}/v2/customers`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ idempotency_key: crypto.randomUUID(), email_address: String(email).toLowerCase() }),
      });
      const cb = await cr.json();
      if (!cr.ok || !cb.customer?.id) throw new Error('Square customer creation failed');
      return cb.customer.id;
    },
    /** Square Orders API: one line item referencing the synced catalog variation when available. */
    async createOrder({ intent, itemVariationId, customerId }) {
      const line = itemVariationId
        ? { catalog_object_id: itemVariationId, quantity: '1' }
        : { name: intent.package_id, quantity: '1', base_price_money: { amount: intent.amount_usd_cents, currency: 'USD' } };
      const res = await fetchImpl(`${base}/v2/orders`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          idempotency_key: `order:${intent.id}`,
          order: {
            location_id: c.locationId,
            reference_id: intent.id,
            ...(customerId ? { customer_id: customerId } : {}),
            line_items: [line],
          },
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.order?.id) throw new Error('Square order creation failed');
      return body.order.id;
    },
```

Change `charge` to accept and forward the optional ids:

```js
    async charge({ intent, sourceId, orderId = null, customerId = null }) {
      const res = await fetchImpl(`${base}/v2/payments`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          source_id: sourceId,
          idempotency_key: intent.id,
          amount_money: { amount: intent.amount_usd_cents, currency: 'USD' }, // amount comes from OUR db, never the client
          location_id: c.locationId,
          reference_id: intent.id,
          autocomplete: true,
          ...(orderId ? { order_id: orderId } : {}),
          ...(customerId ? { customer_id: customerId } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.payment?.id) throw new Error('Provider declined or errored');
      return { providerRef: body.payment.id };
    },
```

In `server/finance/payments.js`, replace the whole `chargeWithSource` method with:

```js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-finance.js`
Expected: PASS (2 new tests green).

- [ ] **Step 5: Commit**

```bash
git add server/finance/providers.js server/finance/payments.js scripts/test-finance.js
git commit -m "feat(square): Orders + Customers enrichment on charge path (best-effort, amount stays server-side)"
```

---

### Task 5: Square Refunds API + admin refund action

Refunds go through Square's Refunds API; the coin clawback still happens ONLY via the existing verified `refund.updated` webhook path. No financial record is ever deleted.

**Files:**
- Modify: `server/finance/providers.js` (`squareProvider`)
- Modify: `server/finance/payments.js` (`PaymentService`)
- Modify: `server/apiRouter.js` (admin route)
- Test: `scripts/test-finance.js`

**Interfaces:**
- Produces:
  - `squareProvider(...).refundPayment({ providerRef, amountUsdCents, reason }) -> Promise<{ refundId, status }>`
  - `PaymentService.refundIntent(intentId, { reason, actor }) -> Promise<{ refundId, status: 'processing' }>` (throws `ALREADY_REFUNDED` / `BAD_STATE` / `NOT_REFUNDABLE`)
  - Route `POST /api/admin/payments/:id/refund` (role FINANCE + step-up), body `{ reason? }`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 15. Square refunds ---');
const creditViaWebhook = async (f, intent, paymentId = 'PAYW') => {
  const raw = JSON.stringify({ event_id: `ev_${crypto.randomUUID()}`, type: 'payment.updated', data: { object: { payment: { id: paymentId, status: 'COMPLETED', reference_id: intent.id, amount_money: { amount: intent.amountUsdCents ?? 499, currency: 'USD' } } } } });
  const sig = crypto.createHmac('sha256', squareCfg.webhookSignatureKey).update(squareCfg.webhookUrl + raw).digest('base64');
  return f.payments.handleWebhook('square', raw, { 'x-square-signature': sig });
};
const squareFetchWithPayment = (paymentId, extra = {}) => async (url, opts) => {
  if (url.includes('/v2/payments/') && !opts?.method) return { ok: true, json: async () => ({ payment: { id: paymentId, status: 'COMPLETED', amount_money: { amount: 499, currency: 'USD' }, reference_id: extra.intentId } }) };
  if (url.endsWith('/v2/refunds')) { extra.refundBody = JSON.parse(opts.body); return { ok: true, json: async () => ({ refund: { id: 'RFD1', status: 'PENDING' } }) }; }
  return { ok: true, json: async () => ({}) };
};
test('admin refund goes through Square Refunds API once; clawback happens on webhook', async () => {
  const extra = {};
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl: async (url, opts) => {
    if (url.endsWith('/v2/refunds')) { extra.refundBody = JSON.parse(opts.body); return { ok: true, json: async () => ({ refund: { id: 'RFD1', status: 'PENDING' } }) }; }
    return { ok: true, json: async () => ({}) };
  } });
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  f.db.run("UPDATE payment_intents SET provider_ref = 'PAYR', status = 'succeeded', credited_at = ? WHERE id = ?", new Date().toISOString(), intent.id);
  f.db.tx(() => f.payments.creditIntent(intent.id, 'test-setup'));
  const before = f.accounts.balance(u.id);
  assert.ok(before.gc >= 10000);

  const r = await f.payments.refundIntent(intent.id, { reason: 'Customer request', actor: 'admin1' });
  assert.equal(r.refundId, 'RFD1');
  assert.equal(extra.refundBody.payment_id, 'PAYR');
  assert.equal(extra.refundBody.amount_money.amount, 499);
  await assert.rejects(() => f.payments.refundIntent(intent.id, { reason: 'again', actor: 'admin1' }), (e) => e.code === 'ALREADY_REFUNDED');
  assert.ok(f.db.get("SELECT 1 x FROM audit_log WHERE action = 'REFUND_INITIATED' AND target_id = ?", intent.id));
  // Coins are NOT clawed back until the verified refund.updated webhook arrives:
  const still = f.accounts.balance(u.id);
  assert.equal(still.gc, before.gc);
});
test('refundIntent rejects non-succeeded and non-refundable intents', async () => {
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl: async () => ({ ok: true, json: async () => ({}) }) });
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  await assert.rejects(() => f.payments.refundIntent(intent.id, { actor: 'a' }), (e) => e.code === 'BAD_STATE');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `refundIntent` / `refundPayment` undefined.

- [ ] **Step 3: Implement**

In `server/finance/providers.js` `squareProvider`, add this method before the closing `};` of the returned object (after the `verifyPayment(...)` block):

```js
    /** Square Refunds API: full refund of a captured payment. Idempotent per payment id. */
    async refundPayment({ providerRef, amountUsdCents, reason }) {
      const res = await fetchImpl(`${base}/v2/refunds`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({
          idempotency_key: `refund:${providerRef}`,
          payment_id: providerRef,
          amount_money: { amount: amountUsdCents, currency: 'USD' },
          reason: String(reason || 'Customer refund').slice(0, 192),
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.refund?.id) {
        const e = new Error('Square refund failed');
        e.details = body.errors;
        throw e;
      }
      return { refundId: body.refund.id, status: body.refund.status };
    },
```

In `server/finance/payments.js`, add this method to `PaymentService` (after `clawback`):

```js
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
```

In `server/apiRouter.js`, after the catalog sync route, add:

```js
    this._r('POST', '/api/admin/payments/:id/refund', FS, async ({ f, user, params, body }) => ({ refund: await f.payments.refundIntent(params.id, { reason: body.reason, actor: user.id }) }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node scripts/test-finance.js`
Expected: PASS (2 new tests green).

- [ ] **Step 5: Commit**

```bash
git add server/finance/providers.js server/finance/payments.js server/apiRouter.js scripts/test-finance.js
git commit -m "feat(square): Refunds API + admin refund action (clawback stays webhook-verified)"
```

---

### Task 6: Square Web Payments SDK loader + SquareCheckout component

The ONLY client code that touches Square. It loads the official SDK from Square's CDN, tokenizes, optionally runs `verifyBuyer` (SCA/3DS), and posts the single-use token to the existing charge route. Raw card data never touches our servers or our DOM (Square iframes it).

**Files:**
- Create: `src/services/squareSdk.js`
- Create: `src/components/SquareCheckout.jsx`
- Modify: `src/services/cashierApi.js` (add `chargePayment`)
- Test: `scripts/test-finance.js` (API-surface tests only; the SDK itself is exercised in the manual sandbox checklist, Task 10)

**Interfaces:**
- Consumes: `clientAction` from `PaymentService.createIntent` (`{ type: 'square_web_payments', applicationId, locationId, referenceId, environment }`), `api.chargePayment`, existing intent polling in `CashierModal`.
- Produces:
  - `loadSquareSdk(environment: 'production'|'sandbox') -> Promise<window.Square>` (memoized; `onerror` resets the memo so a retry is possible).
  - `api.chargePayment(intentId: string, sourceId: string) -> Promise<{ status: 'processing' }>`
  - `<SquareCheckout intent clientAction method onError />` — renders exactly one method's UI: `card` | `applepay` | `googlepay` | `cashapp`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 16. Square client API surface ---');
test('charge route accepts a source token and marks the intent via provider', async () => {
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl: async (url, opts) => {
    if (url.endsWith('/v2/payments')) return { ok: true, json: async () => ({ payment: { id: 'PAYC' } }) };
    return { ok: true, json: async () => ({}) };
  } });
  const router = new ApiRouter({ finance: f });
  const u = mkUser(f);
  const login = f.accounts.login({ email: u.email, password: PW }, '9.9.9.9');
  const created = await router.handleRequest('POST', '/api/payments/intents', { authorization: `Bearer ${login.token}`, 'content-type': 'application/json', 'idempotency-key': crypto.randomUUID() }, JSON.stringify({ packageId: 'pkg_starter', provider: 'square', method: 'card' }));
  const intentId = JSON.parse(created.body).intent.id;
  const bad = await router.handleRequest('POST', `/api/payments/intents/${intentId}/charge`, { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' }, JSON.stringify({ sourceId: 'x' }));
  assert.equal(bad.status, 400);
  const ok = await router.handleRequest('POST', `/api/payments/intents/${intentId}/charge`, { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' }, JSON.stringify({ sourceId: 'cnon:card-nonce-ok' }));
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(ok.body).status, 'processing');
  const again = await router.handleRequest('POST', `/api/payments/intents/${intentId}/charge`, { authorization: `Bearer ${login.token}`, 'content-type': 'application/json' }, JSON.stringify({ sourceId: 'cnon:card-nonce-ok' }));
  assert.equal(again.status, 409, 'non-pending intent cannot be re-charged');
});
test('charge route requires auth', async () => {
  const f = fresh({ providers: { enabled: ['square'], square: squareCfg } });
  const router = new ApiRouter({ finance: f });
  const res = await router.handleRequest('POST', '/api/payments/intents/pi_x/charge', { 'content-type': 'application/json' }, JSON.stringify({ sourceId: 'cnon:card-nonce-ok' }));
  assert.equal(res.status, 401);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: The charge-route tests likely PASS already (route exists) — that is fine; TDD here guards regressions. The failing part is client-side and verified by build in Step 4 (`cashierApi.chargePayment` missing → `SquareCheckout.jsx` cannot import it). Verify: `node -e "import('./src/services/cashierApi.js').then(m=>console.log(typeof m.api.chargePayment))"` prints `undefined`.

- [ ] **Step 3: Implement**

In `src/services/cashierApi.js`, add to the `api` object after `payment:` line:

```js
  chargePayment: (id, sourceId) => request('POST', `/api/payments/intents/${encodeURIComponent(id)}/charge`, { sourceId }),
```

Create `src/services/squareSdk.js`:

```js
// Loads the official Square Web Payments SDK from Square's CDN (never bundled, never self-hosted).
const SDK_URLS = {
  production: 'https://web.squarecdn.com/v1/square.js',
  sandbox: 'https://sandbox.web.squarecdn.com/v1/square.js',
};

let loading = null;

export function loadSquareSdk(environment = 'sandbox') {
  if (typeof window !== 'undefined' && window.Square) return Promise.resolve(window.Square);
  if (loading) return loading;
  const src = SDK_URLS[environment] || SDK_URLS.sandbox;
  loading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => (window.Square ? resolve(window.Square) : reject(new Error('Square SDK did not initialise.')));
    s.onerror = () => { loading = null; reject(new Error('Could not load the secure payment form. Check your connection and try again.')); };
    document.head.appendChild(s);
  });
  return loading;
}
```

Create `src/components/SquareCheckout.jsx`:

```jsx
import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { loadSquareSdk } from '../services/squareSdk';
import { api, ApiError } from '../services/cashierApi';

/**
 * Square Web Payments SDK checkout for ONE payment intent and ONE method.
 * Tokenises in Square's iframes and posts only the single-use source token to our
 * charge endpoint. Coins are credited later by the verified webhook; this component
 * only starts the charge and surfaces errors — the parent keeps polling the intent.
 */
export default function SquareCheckout({ intent, clientAction, method, onError }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletReady, setWalletReady] = useState(false);
  const inst = useRef(null); // { payments, card|null, wallet|null }

  const fail = (e) => {
    const msg = e instanceof ApiError ? e.message : (e?.message || 'Payment could not be completed.');
    setErr(msg);
    onError?.(e);
  };

  const charge = async (sourceId) => {
    setBusy(true);
    setErr('');
    try {
      await api.chargePayment(intent.id, sourceId);
      // Parent's poller watches the intent and shows success once the webhook credits coins.
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const Square = await loadSquareSdk(clientAction.environment);
        const payments = Square.payments(clientAction.applicationId, clientAction.locationId);
        const total = { amount: Number(intent.amountUsd).toFixed(2), label: 'Gold Coin package' };
        const mkRequest = () => payments.paymentRequest({ countryCode: 'US', currencyCode: 'USD', total });
        const next = { payments, card: null, wallet: null };

        if (method === 'card') {
          next.card = await payments.card();
          await next.card.attach('#sq-card-container');
        } else if (method === 'applepay') {
          try {
            next.wallet = await payments.applePay(mkRequest());
            await next.wallet.attach('#sq-apple-pay', { buttonColor: 'white', buttonType: 'plain' });
            next.wallet.addEventListener('ontokenization', (e) => {
              if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
              else setErr('Apple Pay could not verify this card.');
            });
          } catch {
            if (!dead) setErr('Apple Pay is not available on this device/browser. Please choose another method.');
          }
        } else if (method === 'googlepay') {
          try {
            next.wallet = await payments.googlePay(mkRequest());
            await next.wallet.attach('#sq-google-pay', { buttonColor: 'white', buttonType: 'long', buttonSizeMode: 'fill' });
            next.wallet.addEventListener('ontokenization', (e) => {
              if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
              else setErr('Google Pay could not verify this card.');
            });
          } catch {
            if (!dead) setErr('Google Pay is not available in this browser. Please choose another method.');
          }
        } else if (method === 'cashapp') {
          next.wallet = await payments.cashAppPay(mkRequest(), {
            redirectURL: window.location.href,
            referenceId: intent.id,
          });
          await next.wallet.attach('#sq-cash-app-pay', { shape: 'semiround', width: 'full' });
          next.wallet.addEventListener('ontokenization', (e) => {
            if (e.detail.tokenResult.status === 'OK') charge(e.detail.tokenResult.token);
            else setErr('Cash App Pay authorization did not complete.');
          });
        }

        if (!dead) { inst.current = next; setWalletReady(true); }
      } catch (e) {
        if (!dead) fail(e);
      }
    })();
    return () => {
      dead = true;
      const cur = inst.current;
      inst.current = null;
      (async () => { try { await cur?.card?.destroy?.(); } catch { /* detach best-effort */ } try { await cur?.wallet?.destroy?.(); } catch { /* detach best-effort */ } })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payWithCard = async () => {
    const { payments, card } = inst.current || {};
    if (!card) return;
    setBusy(true);
    setErr('');
    try {
      const tok = await card.tokenize();
      if (tok.status !== 'OK') throw new Error('Please check your card details.');
      let sourceId = tok.token;
      // Strong Customer Authentication (3-D Secure) when Square requires it.
      if (payments.verifyBuyer) {
        const verified = await payments.verifyBuyer(sourceId, {
          amount: Number(intent.amountUsd).toFixed(2),
          currencyCode: 'USD',
          intent: 'CHARGE',
        });
        if (verified?.token) sourceId = verified.token;
      }
      await charge(sourceId);
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  return (
    <div style={{ margin: '12px 0' }}>
      {method === 'card' && (
        <>
          <div id="sq-card-container" style={{ minHeight: 90, background: '#120a22', borderRadius: 10, padding: 8 }} />
          <button
            type="button"
            className="cx-btn"
            style={{ width: '100%', marginTop: 10 }}
            disabled={!walletReady || busy}
            onClick={payWithCard}
          >
            {busy ? (<><Loader2 size={16} className="sc-spin" /> Processing…</>) : (<><Lock size={14} /> Pay ${Number(intent.amountUsd).toFixed(2)} securely</>)}
          </button>
        </>
      )}
      {method === 'applepay' && <div id="sq-apple-pay" style={{ minHeight: 48 }} />}
      {method === 'googlepay' && <div id="sq-google-pay" style={{ minHeight: 48 }} />}
      {method === 'cashapp' && <div id="sq-cash-app-pay" style={{ minHeight: 48 }} />}
      {err && <div className="cx-err">{err}</div>}
      <p className="cx-note"><Lock size={12} /> Card details are entered into Square's encrypted fields — they never touch our servers. Coins are credited after Square confirms the payment.</p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests + build**

Run: `node scripts/test-finance.js`
Expected: PASS (charge-route tests green).

Run: `npm run build`
Expected: clean build, zero errors (`cap sync` runs via postbuild).

- [ ] **Step 5: Commit**

```bash
git add src/services/squareSdk.js src/components/SquareCheckout.jsx src/services/cashierApi.js scripts/test-finance.js
git commit -m "feat(square): Web Payments SDK loader + SquareCheckout (card/Apple Pay/Google Pay/Cash App Pay)"
```

---

### Task 7: CashierModal integration

Wire the new component into the existing server-authoritative cashier; update method labels so all four Square methods show with honest labels.

**Files:**
- Modify: `src/components/CashierModal.jsx` (StorePanel options map ~line 204; active-payment view ~line 255)

**Interfaces:**
- Consumes: `<SquareCheckout>` (Task 6), existing `active.clientAction` / `startPolling`.

- [ ] **Step 1: Update the method label map**

In `src/components/CashierModal.jsx`, replace:

```js
      for (const m of p.methods) out.push({ key: `${p.provider}:${m}`, provider: p.provider, method: m, label: p.provider === 'square' ? (m === 'cashapp' ? 'Cash App Pay' : 'Card') : p.label });
```

with:

```js
      const SQUARE_LABELS = { card: 'Credit / Debit Card', applepay: 'Apple Pay', googlepay: 'Google Pay', cashapp: 'Cash App Pay' };
      for (const m of p.methods) out.push({ key: `${p.provider}:${m}`, provider: p.provider, method: m, label: p.provider === 'square' ? (SQUARE_LABELS[m] || 'Card') : p.label });
```

- [ ] **Step 2: Render SquareCheckout for square intents**

Add the import at the top of `src/components/CashierModal.jsx`:

```js
import SquareCheckout from './SquareCheckout';
```

Replace:

```jsx
        {a.type === 'square_web_payments' && <p className="cx-note">Complete the secure Cash App Pay / card step in the provider window. Coins are credited only after the provider confirms the payment.</p>}
```

with:

```jsx
        {a.type === 'square_web_payments' && status?.status === 'pending' && (
          <SquareCheckout intent={active.intent} clientAction={a} method={active.intent.method} />
        )}
```

- [ ] **Step 3: Build + full test gates**

Run: `npm run build`
Expected: clean build.

Run: `node scripts/test-finance.js && node scripts/test-security-audit.js`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/CashierModal.jsx
git commit -m "feat(square): wire SquareCheckout into CashierModal; label all four Square methods"
```

---

### Task 8: CSP for Square + Apple Pay domain association

The Node server CSP currently whitelists `'self'` scripts only — the Square SDK and its PCI iframes would be blocked. Environment-aware (sandbox vs production hosts).

**Files:**
- Modify: `server/server.js` (`buildCsp`, ~lines 26-40)
- Create: `public/.well-known/README.md` (Apple Pay verification file instructions)
- Test: `scripts/test-finance.js` (header assertions via ApiRouter-independent import of server.js is heavy — assert via a tiny exported helper instead: export `buildCsp` from server.js)

**Interfaces:**
- Produces: `buildCsp(config)` exported (pure; takes config, returns CSP string). Server keeps calling it internally.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js`:

```js
console.log('\n--- 17. Content-Security-Policy allows Square (env-aware) ---');
test('CSP allows Square CDN/PCI hosts for the configured environment only', async () => {
  const { buildCsp } = await import('../server/server.js');
  const sandbox = buildCsp({ ...fresh().config, providers: { ...fresh().config.providers, square: { environment: 'sandbox' } }, corsOrigins: [] });
  assert.ok(sandbox.includes('https://sandbox.web.squarecdn.com'));
  assert.ok(!sandbox.includes('https://web.squarecdn.com/v1') && !sandbox.match(/script-src[^;]*https:\/\/web\.squarecdn\.com/), 'prod CDN not whitelisted in sandbox');
  assert.ok(/connect-src[^;]*pci-connect\.squareupsandbox\.com/.test(sandbox));
  assert.ok(/frame-src[^;]*pci-connect\.squareupsandbox\.com/.test(sandbox));
  const prod = buildCsp({ ...fresh().config, providers: { ...fresh().config.providers, square: { environment: 'production' } }, corsOrigins: [] });
  assert.ok(/script-src[^;]*https:\/\/web\.squarecdn\.com/.test(prod));
  assert.ok(/connect-src[^;]*pci-connect\.squareup\.com/.test(prod));
  assert.ok(!prod.includes('sandbox.web.squarecdn.com'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node scripts/test-finance.js`
Expected: FAIL — `buildCsp` not exported / no squarecdn in CSP.

- [ ] **Step 3: Implement**

In `server/server.js`, change `buildCsp` to accept config, whitelist Square hosts per environment, and export it:

```js
// CSP: scripts are same-origin plus Square's official Web Payments SDK CDN (env-specific) plus the
// exact hashes of the inline scripts/handlers found in the built index.html.
export function buildCsp(cfg = config) {
  const hashes = [];
  const handlerHashes = [];
  try {
    const html = fs.readFileSync(path.join(DIST_DIR, 'index.html'), 'utf8');
    const h = (t) => `'sha256-${crypto.createHash('sha256').update(t, 'utf8').digest('base64')}'`;
    for (const m of html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) if (m[1].trim()) hashes.push(h(m[1]));
    for (const m of html.matchAll(/\son(?:load|error|click)="([^"]*)"/gi)) handlerHashes.push(h(m[1]));
  } catch { /* dist not built yet */ }
  const prod = cfg.providers?.square?.environment === 'production';
  const sqJs = prod ? 'https://web.squarecdn.com' : 'https://sandbox.web.squarecdn.com';
  const sqApi = prod ? 'https://connect.squareup.com' : 'https://connect.squareupsandbox.com';
  const sqPci = prod ? 'https://pci-connect.squareup.com' : 'https://pci-connect.squareupsandbox.com';
  const scriptSrc = ["'self'", "'wasm-unsafe-eval'", sqJs, ...hashes, ...(handlerHashes.length ? ["'unsafe-hashes'", ...handlerHashes] : [])].join(' ');
  return [
    "default-src 'self'", `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob:", "media-src 'self' data: blob:", "worker-src 'self' blob:",
    // The browser talks to this origin, optional split API origins, and Square's tokenisation endpoints.
    `connect-src 'self' ${cfg.corsOrigins.filter((o) => o.startsWith('https://')).join(' ')} ${sqApi} ${sqPci}`.replace(/\s+/g, ' ').trim(),
    // Square's card/Apple Pay/Google Pay/Cash App Pay fields run inside Square-hosted iframes.
    `frame-src 'self' ${sqJs} ${sqPci}`,
    "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'", "object-src 'none'",
  ].join('; ');
}
```

Update the two usages below it: `STATIC_HEADERS` stays the same shape (`'Content-Security-Policy': buildCsp(),` — the default parameter covers it).

Note: `buildCsp` previously referenced the module-level `config`; it now takes `cfg = config`, so behaviour is unchanged for the server and the constant is still defined after imports (function hoisting keeps `export function` valid; ensure `config` is referenced only at call time, which it already is since `buildCsp()` runs after `router`/`config` init).

Create `public/.well-known/README.md`:

```markdown
# Apple Pay domain verification

To enable Apple Pay with Square in PRODUCTION:

1. In the Square Dashboard → your application → Apple Pay, register this site's domain.
2. Download Square's `apple-developer-merchantid-domain-association` file.
3. Place it in THIS directory (`public/.well-known/apple-developer-merchantid-domain-association`)
   and redeploy (`npm run build` copies `public/` into `dist/`, and the Node server serves it).
4. Verify it is publicly reachable at:
   `https://YOUR_DOMAIN/.well-known/apple-developer-merchantid-domain-association`

The file content comes from Square — never edit it, never commit a placeholder under that name.
```

- [ ] **Step 4: Run tests**

Run: `node scripts/test-finance.js`
Expected: PASS (CSP test green, all prior tests still green — watch for `config` reference-order issues).

Run: `npm run build && node -e "import('./server/server.js').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"` — wait, importing server.js starts listening. Instead just run: `npm run build` then `timeout 5 node server/server.js || true` is awkward on Windows — skip server boot; the unit test already imports the module. NOTE: importing `server/server.js` in the test starts the HTTP listener. Mitigation: the test process exits after the suite; `server.listen` keeps the loop alive. Add `.unref()`-friendly guard in server.js: wrap the listen in `if (process.env.DC_SERVER_NO_LISTEN !== '1') { server.listen(...) }` and set `process.env.DC_SERVER_NO_LISTEN = '1'` at the top of the CSP test before importing. Implement that guard as part of this step.

- [ ] **Step 5: Commit**

```bash
git add server/server.js public/.well-known/README.md scripts/test-finance.js
git commit -m "feat(square): env-aware CSP for Square SDK/PCI iframes; Apple Pay domain-verification scaffolding"
```

---

### Task 9: Square webhook end-to-end tests (forge / replay / refund-clawback)

The Square webhook parser already exists and is HMAC-verified (`x-square-signature` over `webhookUrl + rawBody`). This task locks it in with adversarial tests using real signatures.

**Files:**
- Test: `scripts/test-finance.js`

**Interfaces:**
- Consumes: existing `handleWebhook`, `creditIntent`, `clawback`.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-finance.js` (uses `squareCfg` and `creditViaWebhook` helpers from Task 5's block — if a helper name collides, rename locally):

```js
console.log('\n--- 18. Square webhook adversarial tests ---');
const sqSign = (raw, key = squareCfg.webhookSignatureKey, url = squareCfg.webhookUrl) =>
  crypto.createHmac('sha256', key).update(url + raw).digest('base64');
const sqPaymentEvent = ({ eventId, paymentId, intentId, amount = 499, status = 'COMPLETED' }) =>
  JSON.stringify({ event_id: eventId, type: 'payment.updated', data: { object: { payment: { id: paymentId, status, reference_id: intentId, amount_money: { amount, currency: 'USD' } } } } });
const mkSquare = (verifyStatus = 'COMPLETED') => fresh({ providers: { enabled: ['square'], square: squareCfg } }, { fetchImpl: async (url) => {
  if (url.includes('/v2/payments/')) return { ok: true, json: async () => ({ payment: { id: 'PAYT', status: verifyStatus, amount_money: { amount: 499, currency: 'USD' }, reference_id: verifyStatus._intentId } }) };
  return { ok: true, json: async () => ({}) };
} });

test('valid Square webhook credits coins once; replay is deduped', async () => {
  const f = mkSquare();
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const raw = sqPaymentEvent({ eventId: 'evt_1', paymentId: 'PAYT', intentId: intent.id });
  const h = { 'x-square-signature': sqSign(raw) };
  const r1 = await f.payments.handleWebhook('square', raw, h);
  assert.equal(r1.status, 'credited');
  const b1 = f.accounts.balance(u.id);
  assert.equal(b1.gc, f.config.compliance.welcomeGc + 10000);
  const r2 = await f.payments.handleWebhook('square', raw, h);
  assert.equal(r2.status, 'duplicate');
  assert.equal(f.accounts.balance(u.id).gc, b1.gc, 'no double credit');
});
test('forged signature is rejected and audited', async () => {
  const f = mkSquare();
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const raw = sqPaymentEvent({ eventId: 'evt_forged', paymentId: 'PAYT', intentId: intent.id });
  await assert.rejects(() => f.payments.handleWebhook('square', raw, { 'x-square-signature': 'AAAA' }), (e) => e.code === 'INVALID_SIGNATURE');
  await assert.rejects(() => f.payments.handleWebhook('square', raw, { 'x-square-signature': sqSign(raw, 'wrong-key') }), (e) => e.code === 'INVALID_SIGNATURE');
  await assert.rejects(() => f.payments.handleWebhook('square', raw, { 'x-square-signature': sqSign(raw, squareCfg.webhookSignatureKey, 'https://evil.test/w') }), (e) => e.code === 'INVALID_SIGNATURE');
  assert.ok(f.db.get("SELECT 1 x FROM audit_log WHERE action = 'WEBHOOK_REJECTED'"));
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc, 'forged webhook credits nothing');
});
test('amount mismatch parks intent in review and credits nothing', async () => {
  const f = mkSquare();
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const raw = sqPaymentEvent({ eventId: 'evt_mm', paymentId: 'PAYT', intentId: intent.id, amount: 1 });
  const r = await f.payments.handleWebhook('square', raw, { 'x-square-signature': sqSign(raw) });
  assert.equal(r.status, 'review');
  assert.equal(f.db.get('SELECT status FROM payment_intents WHERE id = ?', intent.id).status, 'review');
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
});
test('refund.updated webhook claws back credited coins exactly once', async () => {
  const f = mkSquare();
  const u = mkUser(f);
  const { intent } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'card', idempotencyKey: crypto.randomUUID() });
  const payRaw = sqPaymentEvent({ eventId: 'evt_p', paymentId: 'PAYT', intentId: intent.id });
  await f.payments.handleWebhook('square', payRaw, { 'x-square-signature': sqSign(payRaw) });
  const credited = f.accounts.balance(u.id).gc;
  const refRaw = JSON.stringify({ event_id: 'evt_r', type: 'refund.updated', data: { object: { refund: { id: 'RFD1', status: 'COMPLETED', payment_id: 'PAYT' } } } });
  const r = await f.payments.handleWebhook('square', refRaw, { 'x-square-signature': sqSign(refRaw) });
  assert.equal(r.status, 'clawback');
  assert.equal(f.accounts.balance(u.id).gc, credited - 10000);
  assert.equal(f.db.get('SELECT status FROM payment_intents WHERE id = ?', intent.id).status, 'refunded');
});
```

- [ ] **Step 2: Run test to verify**

Run: `node scripts/test-finance.js`
Expected: These assert EXISTING behaviour — if any fails, fix the providers/payments code minimally (do not weaken signature checks). Known risk: `verifyPayment` mock shape (`mkSquare` fetch) must match the real re-fetch contract (`p.status === 'COMPLETED'` and USD currency) — align the mock, not the code.

- [ ] **Step 3: Fix failures (if any), then re-run until green**

Run: `node scripts/test-finance.js`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/test-finance.js
git commit -m "test(square): adversarial webhook coverage (forge/replay/mismatch/refund-clawback)"
```

---

### Task 10: Documentation, deployment checklist, and final gates

**Files:**
- Create: `docs/square-payments-setup.md`
- Modify: `docs/payments-and-security.md` (update section 3 Square row + section 5 env vars)
- Modify: `.env.example` (comments only, if not already done in Task 1)

- [ ] **Step 1: Write `docs/square-payments-setup.md`**

Content (create with exactly this structure; fill each section):

```markdown
# Square Payments — Setup & Production Checklist

Status date: 2026-11-19. Square is integrated but DISABLED by default. Enable only per the gate below.

## 1. Architecture
Browser → Square Web Payments SDK (tokenise, Square-hosted iframes) → `POST /api/payments/intents/:id/charge`
(single-use source token; amount from OUR database) → Square Payments API → signed webhook
`/api/payments/webhook/square` (HMAC verified, deduped, independently re-fetched) → ledger credit.
Refunds: admin → Square Refunds API → `refund.updated` webhook → one-time clawback.

## 2. Credentials (server env only — never commit, never VITE_-prefix)
| Variable | Where to get it |
|---|---|
| SQUARE_APPLICATION_ID | Square Developer Dashboard → your app → Credentials |
| SQUARE_ACCESS_TOKEN | Same page (Production vs Sandbox toggle). Treat as a password. |
| SQUARE_LOCATION_ID | Dashboard → Locations (or `GET /v2/locations`) |
| SQUARE_ENVIRONMENT | `sandbox` while testing; `production` only after approval |
| SQUARE_WEBHOOK_SIGNATURE_KEY | Dashboard → Webhooks → your subscription → signature key |
| SQUARE_WEBHOOK_URL | `https://YOUR_DOMAIN/api/payments/webhook/square` — must EXACTLY match the registered subscription URL (it is part of the HMAC) |
| SQUARE_API_VERSION | Pinned, default `2024-10-17` |

## 3. Webhook subscription
Dashboard → Webhooks → add endpoint URL above → subscribe to:
`payment.created`, `payment.updated`, `refund.created`, `refund.updated`,
`dispute.created`, `dispute.state.updated`.

## 4. Package / product sync
`npm run square:sync` (uses env credentials) or admin console → Payments → "Sync catalog".
Creates/updates one Catalog item per package; mapping stored in `square_catalog_items`.
Descriptions honestly state Gold Coins are social-play items with no cash value — do not edit to disguise the model.

## 5. Payment methods
- Card: works once the SDK loads (CSP is env-aware).
- Apple Pay: register the domain, place Square's verification file in `public/.well-known/` (see its README), redeploy, verify the public URL.
- Google Pay: no extra config; button appears only on eligible browsers.
- Cash App Pay: enable the method in the Square Dashboard; requires Square approval on the account. Crediting happens via webhook after authorization — never on redirect.

## 6. Sandbox end-to-end test (required before production)
1. `SQUARE_ENVIRONMENT=sandbox` + sandbox credentials; `DC_PAYMENT_PROVIDERS=square`.
2. `npm run square:sync` → expect "N packages synced (sandbox)".
3. Buy `pkg_starter` with Square sandbox test card (`4111 1111 1111 1111` via the SDK form; sandbox nonce flow).
4. Expect intent `pending` → webhook → `succeeded`; wallet credited; `GET /api/admin/reconciliation` consistent.
5. Refund from admin console → expect `refund.updated` → clawback → status `refunded`.

## 7. PRODUCTION GO-LIVE GATE — all must be YES
- [ ] Square has expressly approved THIS business (Gold Coin purchases with free promotional Sweeps Coins) in writing
- [ ] Legal counsel sign-off on sweepstakes model + blocked-state list
- [ ] Production credentials set in the host's secret manager (not in files/chat)
- [ ] Production webhook URL registered; signature key matches
- [ ] `npm run square:sync` run against production
- [ ] Apple Pay domain verified (if enabling Apple Pay)
- [ ] Cash App Pay enabled by Square on the account (if enabling)
- [ ] Sandbox end-to-end test (section 6) passed
- [ ] `node scripts/test-finance.js && node scripts/test-security-audit.js && npm run test:all && npm run test:bonuses` all green
- [ ] DB backups operational; reconciliation endpoint returns consistent
- [ ] One small AUTHORIZED real-money purchase + refund dry run, then monitoring

## 8. Troubleshooting
- Webhook `INVALID_SIGNATURE`: URL mismatch (must equal `SQUARE_WEBHOOK_URL` byte-for-byte, incl. https) or wrong signature key.
- Payment stuck `pending`: webhook not delivered → re-send from Dashboard; coins still credit via verified path.
- `verification_failed`: payment not COMPLETED at re-fetch (e.g. canceled); safe — nothing credited.
```

- [ ] **Step 2: Update `docs/payments-and-security.md`**

Replace the Square row in section 3's table with:

```markdown
| Square (card / Apple Pay / Google Pay / Cash App Pay) | **Implemented**: Web Payments SDK checkout, server-side charge of server-priced amounts, Orders + Customers enrichment, programmatic Catalog sync (`npm run square:sync`), Refunds API, HMAC-verified + deduped + re-fetched webhooks, adversarial tests in `test-finance.js`. Tested with mocked HTTP; awaiting sandbox credentials, then live approval. See `docs/square-payments-setup.md`. |
```

Add to section 5 env var list: `SQUARE_API_VERSION` (pinned, default 2024-10-17).

- [ ] **Step 3: Final gates**

Run, in order, all must pass:

```bash
node scripts/test-finance.js
node scripts/test-security-audit.js
npm run test:all
npm run test:bonuses
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add docs/square-payments-setup.md docs/payments-and-security.md .env.example
git commit -m "docs(square): setup guide + production go-live gate; update payments status"
```

---

## Self-review notes (completed)

- Spec §1 (Square as primary processor, cards/Apple Pay/Google Pay/Cash App Pay): Tasks 1, 6, 7. Crypto (§5 last): already implemented self-hosted; third-party processor explicitly deferred (decision needs provider approval) — flagged, not silently dropped.
- Spec §3 (env config): Tasks 1, 10. `SQUARE_API_VERSION` added.
- Spec §4 (programmatic Catalog sync, update-not-duplicate, DB mapping, admin sync, logging): Tasks 2, 3, 5(admin route), 10.
- Spec §5 (checkout UI, SDK tokenization, eligibility-gated wallets, SCA): Tasks 6, 7, 8.
- Spec §6 (secure transaction flow): pre-existing (intents, idempotency, webhook-verified crediting); hardened by Task 9 tests.
- Spec §7 (wallet/ledger): pre-existing; untouched.
- Spec §8 (refunds): Task 5 + existing webhook clawback; admin review exists in AdminFinanceConsole (purchases/failed tabs) — a "refund" button UI hook can call the new route; console UI wiring is intentionally minimal (route + docs), full console polish is out of scope.
- Spec §9 (admin dashboard): pre-existing console covers purchases/failed/reconciliation; catalog status added via `GET /api/admin/payments/catalog` (Task 3).
- Spec §10 (webhooks): pre-existing + Task 9 tests.
- Spec §11/13 (checklist, docs): Task 10.
- Spec §12 (security audit): Task 9 + existing `test-security-audit.js` gate in Task 10.
- Type consistency: `createSquareCatalog({config, fetchImpl, audit, packages})`, `findOrCreateCustomer({email})`, `createOrder({intent, itemVariationId, customerId})`, `charge({intent, sourceId, orderId, customerId})`, `refundPayment({providerRef, amountUsdCents, reason})`, `refundIntent(intentId, {reason, actor})`, `loadSquareSdk(environment)`, `api.chargePayment(id, sourceId)`, `buildCsp(cfg)` — used consistently across tasks.
- No placeholders: every code step has complete code.
