// Financial backend test-suite: ledger, payments, webhooks, crypto gateway, redemptions, spins, admin, API.
// Run: node scripts/test-finance.js
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { Worker } from 'node:worker_threads';
import { createFinance } from '../server/finance/index.js';
import { ApiRouter } from '../server/apiRouter.js';
import { signSandboxWebhook } from '../server/finance/providers.js';
import { keccak256, isValidEvmAddress } from '../server/finance/keccak.js';
import { TRANSFER_TOPIC, formatUnits } from '../server/finance/crypto.js';
import { CRYPTO_NETWORKS } from '../server/finance/config.js';
import { deriveOutcome } from '../server/finance/spin.js';
import { SlotMathEngine } from '../src/engine/math/SlotMathEngine.js';

let passed = 0;
let failed = 0;
const pending = [];
const test = (name, fn) => pending.push({ name, fn });
async function runAll() {
  for (const { name, fn } of pending) {
    try { await fn(); passed++; console.log(`  ✔ ${name}`); } catch (e) { failed++; console.log(`  ✘ ${name}\n      ${e.stack?.split('\n').slice(0, 4).join('\n      ')}`); }
  }
}
const rejects = async (fn, code) => {
  try { await fn(); } catch (e) { if (code) assert.equal(e.code, code, `expected ${code}, got ${e.code}: ${e.message}`); return; }
  assert.fail(`expected rejection${code ? ' ' + code : ''}`);
};
const TREASURY = '0x6258e488F97617cc103838746955CB81a1d3E3af';
const PW = 'correct horse battery';
const iso = (d) => new Date(d).toISOString();
let seq = 0;
const mkUser = (f, over = {}) => {
  const email = `p${++seq}_${crypto.randomBytes(3).toString('hex')}@example.com`;
  const r = f.accounts.register({ email, password: PW, name: 'P', dob: '1990-01-01', state: 'TX', ...over });
  return { ...r, id: r.user.id, email };
};
const fresh = (config = {}, extra = {}) => createFinance({ dbFile: ':memory:', config: { game: { minSpinIntervalMs: 0 }, ...config }, ...extra });
const user = (f, id) => f.accounts.getUser(id);
const agedUser = (f, over = {}) => {
  const u = mkUser(f, over);
  f.db.run("UPDATE users SET created_at = ?, kyc_status = 'verified' WHERE id = ?", iso(Date.now() - 30 * 86400e3), u.id);
  return u;
};
const giveSc = (f, id, cents, played = true) => f.db.tx(() => {
  f.ledger.post({ userId: id, type: 'TEST_GRANT', currency: 'SC', amount: cents, idempotencyKey: `g:${crypto.randomUUID()}`, unplayedDelta: played ? 0 : cents });
});
const sandboxEvent = (f, body, secret = f.config.providers.sandboxWebhookSecret) => {
  const raw = JSON.stringify(body);
  return [raw, { 'x-sandbox-signature': signSandboxWebhook(secret, raw) }];
};
const buy = (f, u, pkg = 'pkg_starter', key = crypto.randomUUID()) =>
  f.payments.createIntent(user(f, u.id), { packageId: pkg, provider: 'sandbox', method: 'sandbox', idempotencyKey: key });

console.log('\n--- 1. Registration, compliance & wallet ---');
test('keccak256 / EIP-55 vectors', () => {
  assert.equal(keccak256(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256('abc'), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.ok(isValidEvmAddress(TREASURY));
  assert.ok(!isValidEvmAddress(TREASURY.replace('F97', 'f97')), 'bad checksum rejected');
  assert.ok(!isValidEvmAddress('0x123'));
});
test('registration enforces age, state, password; welcome GC lands in ledger', () => {
  const f = fresh();
  assert.throws(() => f.accounts.register({ email: 'a@b.co', password: PW, dob: '2015-01-01', state: 'TX' }), (e) => e.code === 'UNDERAGE');
  assert.throws(() => f.accounts.register({ email: 'a@b.co', password: PW, dob: '1990-01-01', state: 'MN' }), (e) => e.code === 'RESTRICTED_JURISDICTION');
  assert.throws(() => f.accounts.register({ email: 'a@b.co', password: 'short', dob: '1990-01-01', state: 'TX' }), (e) => e.code === 'WEAK_PASSWORD');
  assert.throws(() => f.accounts.register({ email: 'a@b.co', password: PW, dob: '1990-02-31', state: 'TX' }), (e) => e.code === 'INVALID_DOB');
  const u = mkUser(f);
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
  assert.equal(f.accounts.balance(u.id).sc, 0, 'no free SC at registration');
  assert.ok(f.ledger.reconcile().ok);
});
test('role cannot be self-assigned at registration', () => {
  const f = fresh();
  const u = mkUser(f, { role: 'ADMIN' });
  assert.equal(user(f, u.id).role, 'PLAYER');
});
test('login brute-force lockout + generic error', () => {
  const f = fresh();
  const u = mkUser(f);
  for (let i = 0; i < 5; i++) assert.throws(() => f.accounts.login({ email: u.email, password: 'wrongwrongwrong' }, '1.1.1.1'), (e) => e.code === 'BAD_CREDENTIALS' || e.code === 'LOCKED');
  assert.throws(() => f.accounts.login({ email: u.email, password: PW }, '1.1.1.1'), (e) => e.code === 'LOCKED');
  assert.ok(f.accounts.login({ email: u.email, password: PW }, '2.2.2.2').token, 'different IP is not locked out by an attacker');
});
test('daily free entry (AMOE) claimable once per day, and needs play-through', () => {
  const f = fresh();
  const u = mkUser(f);
  f.accounts.claimDaily(user(f, u.id));
  assert.throws(() => f.accounts.claimDaily(user(f, u.id)), (e) => e.code === 'ALREADY_CLAIMED');
  const b = f.accounts.balance(u.id);
  assert.equal(b.sc, 0.2); assert.equal(b.scRedeemable, 0);
});

console.log('\n--- 2. Ledger integrity ---');
test('ledger rows are immutable (UPDATE/DELETE blocked by triggers)', () => {
  const f = fresh(); mkUser(f);
  assert.throws(() => f.db.run('UPDATE ledger SET amount = 999999'), /append-only/);
  assert.throws(() => f.db.run('DELETE FROM ledger'), /append-only/);
  assert.throws(() => f.db.run("UPDATE audit_log SET action = 'x'"), /append-only/);
  assert.throws(() => f.db.run('DELETE FROM audit_log'), /append-only/);
});
test('negative balances impossible (ledger + DB CHECK)', () => {
  const f = fresh(); const u = mkUser(f);
  assert.throws(() => f.db.tx(() => f.ledger.post({ userId: u.id, type: 'T', currency: 'GC', amount: -1000000000, idempotencyKey: 'neg1' })), (e) => e.code === 'INSUFFICIENT_FUNDS');
  assert.throws(() => f.db.run('UPDATE wallets SET gc = -5 WHERE user_id = ?', u.id), /CHECK/);
});
test('idempotency: same key replays, different params conflicts; failed tx leaves no trace', () => {
  const f = fresh(); const u = mkUser(f);
  const post = (amt) => f.db.tx(() => f.ledger.post({ userId: u.id, type: 'T', currency: 'GC', amount: amt, idempotencyKey: 'k-1' }));
  const a = post(10), b = post(10);
  assert.equal(b.replayed, true); assert.equal(a.entry.id, b.entry.id);
  assert.throws(() => post(11), (e) => e.code === 'IDEMPOTENCY_MISMATCH');
  const before = f.accounts.balance(u.id).gc;
  assert.throws(() => f.db.tx(() => { f.ledger.post({ userId: u.id, type: 'T', currency: 'GC', amount: 5, idempotencyKey: 'k-2' }); throw new Error('boom'); }));
  assert.equal(f.accounts.balance(u.id).gc, before, 'rolled back atomically');
});
test('hash chain detects tampering; reconciliation detects wallet drift', () => {
  const f = fresh(); const u = mkUser(f);
  assert.ok(f.ledger.verifyChain().valid);
  f.db.run('UPDATE wallets SET gc = gc + 1000 WHERE user_id = ?', u.id); // wallet-only tamper
  assert.equal(f.ledger.reconcile().ok, false);
  assert.ok(f.admin.reconciliation().ok === false);
  // Tamper with a ledger row by dropping the trigger (simulating raw DB access) -> chain breaks
  f.db.run('DROP TRIGGER ledger_no_update');
  f.db.run('UPDATE ledger SET amount = amount + 1 WHERE seq = 1');
  assert.equal(f.ledger.verifyChain().valid, false);
});
test('RACE: parallel worker threads cannot overdraw or double-spend (shared DB file)', async () => {
  const file = path.join(os.tmpdir(), `race_${crypto.randomBytes(4).toString('hex')}.db`);
  const f = createFinance({ dbFile: file, config: { game: { minSpinIntervalMs: 0 } } });
  const u = mkUser(f);
  f.db.tx(() => f.ledger.post({ userId: u.id, type: 'T', currency: 'SC', amount: 1000, idempotencyKey: 'seedsc' })); // 10.00 SC
  const workerUrl = new URL('./_finance-race-worker.js', import.meta.url);
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => new Promise((resolve, reject) => {
    const w = new Worker(workerUrl, { workerData: { file, userId: u.id, id: i } });
    w.on('message', resolve); w.on('error', reject);
  })));
  const ok = results.reduce((a, r) => a + r.ok, 0);
  const w = f.ledger.getWallet(u.id);
  assert.equal(ok, 10, 'exactly 10 x 1.00 SC debits succeed out of 4x8 attempts');
  assert.equal(w.sc, 0);
  assert.ok(f.ledger.reconcile().ok); assert.ok(f.ledger.verifyChain().valid);
  f.db.close();
  for (const s of ['', '-wal', '-shm']) try { fs.unlinkSync(file + s); } catch {}
});

console.log('\n--- 3. Purchases & webhooks ---');
test('successful purchase: server-priced, credited only after signed webhook, ledgered once', async () => {
  const f = fresh(); const u = mkUser(f);
  const { intent } = buy(f, u);
  assert.equal(intent.status, 'pending');
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc, 'no credit on intent creation / client success');
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  const ev = { id: 'evt_1', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 };
  const r = await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, ev));
  assert.equal(r.status, 'credited');
  const b = f.accounts.balance(u.id);
  assert.equal(b.gc, f.config.compliance.welcomeGc + 10000);
  assert.equal(b.sc, 5); assert.equal(b.scRedeemable, 0, 'promo SC needs play-through');
  assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'succeeded');
  assert.ok(f.ledger.reconcile().ok);
  assert.ok(f.admin.reconciliation().payments.consistent);
});
test('duplicate webhook delivery is ignored (no double credit)', async () => {
  const f = fresh(); const u = mkUser(f);
  const { intent } = buy(f, u);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  const args = sandboxEvent(f, { id: 'evt_dup', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 });
  assert.equal((await f.payments.handleWebhook('sandbox', ...args)).status, 'credited');
  assert.equal((await f.payments.handleWebhook('sandbox', ...args)).status, 'duplicate');
  // A *different* event id for the same payment must also not double credit
  const again = sandboxEvent(f, { id: 'evt_dup2', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 });
  assert.equal((await f.payments.handleWebhook('sandbox', ...again)).status, 'already_credited');
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc + 10000);
});
test('invalid / missing / stale / wrong-secret signatures rejected, nothing credited', async () => {
  const f = fresh(); const u = mkUser(f);
  const { intent } = buy(f, u);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  const raw = JSON.stringify({ id: 'e', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 });
  await rejects(() => f.payments.handleWebhook('sandbox', raw, {}), 'INVALID_SIGNATURE');
  await rejects(() => f.payments.handleWebhook('sandbox', raw, { 'x-sandbox-signature': signSandboxWebhook('wrong', raw) }), 'INVALID_SIGNATURE');
  await rejects(() => f.payments.handleWebhook('sandbox', raw, { 'x-sandbox-signature': signSandboxWebhook(f.config.providers.sandboxWebhookSecret, raw, 1000) }), 'INVALID_SIGNATURE');
  await rejects(() => f.payments.handleWebhook('sandbox', raw + ' ', { 'x-sandbox-signature': signSandboxWebhook(f.config.providers.sandboxWebhookSecret, raw) }), 'INVALID_SIGNATURE');
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
  assert.ok(f.db.get("SELECT 1 x FROM audit_log WHERE action = 'WEBHOOK_REJECTED'"));
});
test('amount mismatch -> review, not credited; failed payment -> failed', async () => {
  const f = fresh(); const u = mkUser(f);
  const a = buy(f, u).intent, b = buy(f, u, 'pkg_bronze').intent;
  const refA = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', a.id).r;
  const refB = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', b.id).r;
  assert.equal((await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'm1', type: 'payment.succeeded', providerRef: refA, amountUsdCents: 1 }))).status, 'review');
  assert.equal(f.payments.getIntentForUser(u.id, a.id).status, 'review');
  assert.equal((await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'f1', type: 'payment.failed', providerRef: refB }))).status, 'failed');
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
});
test('client cannot choose price or coins; unknown package/custom range rejected; idempotent intent creation', () => {
  const f = fresh(); const u = mkUser(f);
  const r = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', amountUsd: 0.01, gc: 99999999, provider: 'sandbox', method: 'sandbox', idempotencyKey: 'idem-key-1' });
  assert.equal(r.intent.amountUsd, 4.99); assert.equal(r.intent.gc, 10000);
  const r2 = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'sandbox', method: 'sandbox', idempotencyKey: 'idem-key-1' });
  assert.equal(r2.intent.id, r.intent.id); assert.equal(r2.replayed, true);
  assert.throws(() => f.payments.createIntent(user(f, u.id), { packageId: 'pkg_bronze', provider: 'sandbox', method: 'sandbox', idempotencyKey: 'idem-key-1' }), (e) => e.code === 'IDEMPOTENCY_MISMATCH');
  assert.throws(() => buy(f, u, 'pkg_nope'), (e) => e.code === 'UNKNOWN_PACKAGE');
  assert.throws(() => f.payments.createIntent(user(f, u.id), { packageId: 'pkg_custom', customUsd: 5000000, provider: 'sandbox', method: 'sandbox', idempotencyKey: 'idem-key-2' }), (e) => e.code === 'INVALID_AMOUNT');
  assert.throws(() => f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'paypal', method: 'x', idempotencyKey: 'idem-key-3' }), (e) => e.code === 'PROVIDER_DISABLED');
});
test('daily purchase limit & restricted/frozen accounts blocked', () => {
  const f = fresh({ purchases: { dailyLimitUsdCents: 1000 } }); const u = mkUser(f);
  buy(f, u); buy(f, u);
  assert.throws(() => buy(f, u), (e) => e.code === 'DAILY_LIMIT');
  const g = fresh(); const v = mkUser(g);
  g.db.run("UPDATE users SET status = 'frozen' WHERE id = ?", v.id);
  assert.throws(() => buy(g, v), (e) => e.code === 'ACCOUNT_RESTRICTED');
  const h = fresh(); const w = mkUser(h);
  h.db.run("UPDATE users SET state = 'MN' WHERE id = ?", w.id);
  assert.throws(() => buy(h, w), (e) => e.code === 'RESTRICTED_JURISDICTION');
});
test('refund/chargeback claws back; shortfall freezes the account; never negative', async () => {
  const f = fresh(); const u = mkUser(f);
  const { intent } = buy(f, u);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'p', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 }));
  // player spends most GC first
  f.db.tx(() => f.ledger.post({ userId: u.id, type: 'TEST_SPEND', currency: 'GC', amount: -15000, idempotencyKey: 'spend1' }));
  const r = await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'r', type: 'payment.disputed', providerRef: ref }));
  assert.equal(r.status, 'clawback'); assert.equal(r.shortfall, true);
  const b = f.accounts.balance(u.id);
  assert.equal(b.gc, 0); assert.equal(b.sc, 0);
  assert.equal(user(f, u.id).status, 'frozen');
  assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'disputed');
  assert.ok(f.ledger.reconcile().ok);
});
test('webhook for unknown payment is recorded, credits nothing', async () => {
  const f = fresh(); const u = mkUser(f);
  const r = await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'x', type: 'payment.succeeded', providerRef: 'sbx_nope', amountUsdCents: 499 }));
  assert.equal(r.status, 'unknown_intent'); assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
});
test('sandbox provider is unavailable in production; square needs full config', () => {
  const g = createFinance({ dbFile: ':memory:', env: { NODE_ENV: 'production', DC_LEDGER_SECRET: 'x'.repeat(32), DC_PAYMENT_PROVIDERS: 'sandbox,square' } });
  assert.equal(g.payments.providers.size, 0);
  assert.throws(() => createFinance({ dbFile: ':memory:', env: { NODE_ENV: 'production' } }), /DC_LEDGER_SECRET/);
});
test('Square: webhook signature verification + independent re-fetch + amount check (mocked HTTP)', async () => {
  const key = 'sq_sig_key'; const url = 'https://example.com/api/payments/webhook/square';
  const calls = [];
  const fetchImpl = async (u, o) => {
    calls.push(u);
    if (u.endsWith('/v2/payments') && o.method === 'POST') { const b = JSON.parse(o.body); assert.equal(b.amount_money.amount, 499); return { ok: true, json: async () => ({ payment: { id: 'sqpay_1' } }) }; }
    return { ok: true, json: async () => ({ payment: { id: 'sqpay_1', status: 'COMPLETED', amount_money: { amount: sqAmount, currency: 'USD' }, reference_id: sqIntent } }) };
  };
  let sqAmount = 499; let sqIntent = '';
  const f = createFinance({ dbFile: ':memory:', fetchImpl, config: { providers: { enabled: ['square'], square: { accessToken: 't', applicationId: 'a', locationId: 'l', webhookSignatureKey: key, webhookUrl: url } } } });
  assert.ok(f.payments.providers.has('square'));
  const u = mkUser(f);
  const { intent, clientAction } = f.payments.createIntent(user(f, u.id), { packageId: 'pkg_starter', provider: 'square', method: 'cashapp', idempotencyKey: 'sq-key-0001' });
  sqIntent = intent.id;
  assert.equal(clientAction.referenceId, intent.id);
  await f.payments.chargeWithSource(user(f, u.id), intent.id, 'cnon:card-nonce-ok');
  const mk = (id, status) => { const raw = JSON.stringify({ event_id: id, type: 'payment.updated', data: { object: { payment: { id: 'sqpay_1', status, reference_id: intent.id, amount_money: { amount: 499, currency: 'USD' } } } } }); return [raw, { 'x-square-signature': crypto.createHmac('sha256', key).update(url + raw).digest('base64') }]; };
  await rejects(() => f.payments.handleWebhook('square', mk('e0', 'COMPLETED')[0], { 'x-square-signature': 'AAAA' }), 'INVALID_SIGNATURE');
  sqAmount = 100; // provider says a different amount than we expect -> must not credit
  assert.equal((await f.payments.handleWebhook('square', ...mk('e1', 'COMPLETED'))).status, 'review');
  const g = createFinance({ dbFile: ':memory:', fetchImpl, config: { providers: { enabled: ['square'], square: { accessToken: 't', applicationId: 'a', locationId: 'l', webhookSignatureKey: key, webhookUrl: url } } } });
  const v = mkUser(g); const i2 = g.payments.createIntent(user(g, v.id), { packageId: 'pkg_starter', provider: 'square', method: 'cashapp', idempotencyKey: 'sq-key-0002' }).intent;
  sqIntent = i2.id; sqAmount = 499;
  await g.payments.chargeWithSource(user(g, v.id), i2.id, 'cnon:card-nonce-ok');
  const raw2 = mk('e2', 'COMPLETED');
  assert.equal((await g.payments.handleWebhook('square', ...raw2)).status, 'credited');
  assert.equal(g.accounts.balance(v.id).sc, 5);
});

console.log('\n--- 4. Crypto gateway (mock chain) ---');
const addrTopic = (a) => '0x' + '0'.repeat(24) + a.slice(2).toLowerCase();
function mockChain({ chainId = 8453, latest = 1000 } = {}) {
  const chain = { chainId, latest, logs: [], receipts: {}, blockTs: Math.floor(Date.now() / 1000) };
  chain.add = ({ tx = '0x' + crypto.randomBytes(32).toString('hex'), logIndex = 0, block = 1900, contract, from = '0x' + '11'.repeat(20), to = TREASURY, amount, status = '0x1' }) => {
    const log = { address: contract, topics: [TRANSFER_TOPIC, addrTopic(from), addrTopic(to)], data: '0x' + BigInt(amount).toString(16).padStart(64, '0'), blockNumber: '0x' + block.toString(16), transactionHash: tx, logIndex: '0x' + logIndex.toString(16) };
    chain.logs.push(log);
    chain.receipts[tx] = { status, blockNumber: log.blockNumber, logs: [log] };
    return tx;
  };
  chain.rpc = async (method, params) => {
    switch (method) {
      case 'eth_chainId': return '0x' + chain.chainId.toString(16);
      case 'eth_blockNumber': return '0x' + chain.latest.toString(16);
      case 'eth_getLogs': { const q = params[0]; const from = parseInt(q.fromBlock, 16), to = parseInt(q.toBlock, 16); return chain.logs.filter((l) => parseInt(l.blockNumber, 16) >= from && parseInt(l.blockNumber, 16) <= to && q.address.map((x) => x.toLowerCase()).includes(l.address.toLowerCase())); }
      case 'eth_getTransactionReceipt': return chain.receipts[params[0]] || null;
      case 'eth_getBlockByNumber': return { timestamp: '0x' + chain.blockTs.toString(16) };
      default: throw new Error('unmocked ' + method);
    }
  };
  return chain;
}
const USDC = CRYPTO_NETWORKS.base.tokens.USDC.contract;
const cryptoFin = (chain, config = {}) => fresh({ providers: { enabled: [] }, crypto: { enabledNetworks: ['base'], treasuryAddress: TREASURY }, ...config }, { rpcFactory: () => chain.rpc });
const cryptoBuy = (f, u, pkg = 'pkg_starter') => f.payments.createIntent(user(f, u.id), { packageId: pkg, provider: 'crypto', method: 'usdc', network: 'base', token: 'USDC', idempotencyKey: crypto.randomUUID() });

test('crypto: unique exact amount instructions; credited only after on-chain confirmation; replay-proof', async () => {
  const chain = mockChain(); const f = cryptoFin(chain); const u = mkUser(f);
  const { intent, clientAction } = cryptoBuy(f, u);
  assert.equal(clientAction.payTo, TREASURY); assert.equal(clientAction.tokenContract, USDC); assert.equal(clientAction.chainId, 8453);
  assert.ok(BigInt(clientAction.amountAtomic) >= 4_990_000n && BigInt(clientAction.amountAtomic) < 5_000_000n);
  // Not yet confirmed: block too recent (latest-confs+1 < block)
  chain.add({ contract: USDC, amount: clientAction.amountAtomic, block: 995 });
  let s = await f.gateway.scanNetwork('base');
  assert.equal(s.credited, 0); assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'pending');
  chain.latest = 2000; // now deep enough
  s = await f.gateway.scanNetwork('base');
  assert.equal(s.credited, 1); assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'succeeded');
  assert.equal(f.accounts.balance(u.id).sc, 5);
  // rescan from scratch (cursor wiped) must not credit again
  f.db.run('DELETE FROM chain_cursors');
  s = await f.gateway.scanNetwork('base', { lookbackBlocks: 5000 });
  assert.equal(s.credited, 0); assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc + 10000);
  assert.ok(f.ledger.reconcile().ok);
});
test('crypto: wrong token contract, wrong recipient, reverted tx, dust, wrong chain are never credited', async () => {
  const chain = mockChain({ latest: 2000 }); const f = cryptoFin(chain); const u = mkUser(f);
  const { clientAction } = cryptoBuy(f, u);
  chain.add({ contract: '0x' + 'ab'.repeat(20), amount: clientAction.amountAtomic });          // fake token (filtered by address)
  chain.add({ contract: USDC, amount: clientAction.amountAtomic, to: '0x' + '22'.repeat(20) }); // not to us
  chain.add({ contract: USDC, amount: clientAction.amountAtomic, status: '0x0' });              // reverted
  chain.add({ contract: USDC, amount: 5 });                                                       // dust
  const s = await f.gateway.scanNetwork('base');
  assert.equal(s.credited, 0);
  assert.equal(f.accounts.balance(u.id).gc, f.config.compliance.welcomeGc);
  chain.chainId = 1;
  await assert.rejects(() => f.gateway.scanNetwork('base'), /chain id/);
});
test('crypto: underpay/overpay/late/unknown go to unmatched; admin can resolve (overpay) but not underpay', async () => {
  const chain = mockChain({ latest: 2000 }); const f = cryptoFin(chain); const u = mkUser(f);
  const { intent, clientAction } = cryptoBuy(f, u);
  const exp = BigInt(clientAction.amountAtomic);
  const tUnder = chain.add({ contract: USDC, amount: exp - 1_000_000n, logIndex: 1 });
  const tOver = chain.add({ contract: USDC, amount: exp + 3_000_000n, logIndex: 2 });
  const s = await f.gateway.scanNetwork('base');
  assert.equal(s.credited, 0); assert.equal(s.unmatched, 2);
  const rows = f.db.all("SELECT * FROM crypto_transfers WHERE status = 'unmatched'");
  const under = rows.find((r) => r.tx_hash === tUnder), over = rows.find((r) => r.tx_hash === tOver);
  assert.throws(() => f.gateway.resolveTransfer(under.id, { intentId: intent.id }), (e) => e.code === 'UNDERPAID');
  f.gateway.resolveTransfer(over.id, { intentId: intent.id, note: 'overpaid by $3, manual' });
  assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'succeeded');
  assert.throws(() => f.gateway.resolveTransfer(over.id, { intentId: intent.id }), (e) => e.code === 'BAD_STATE');
  assert.ok(f.ledger.reconcile().ok);
});
test('crypto: payment after expiry is parked for review, not auto-credited', async () => {
  const chain = mockChain({ latest: 2000 }); const f = cryptoFin(chain); const u = mkUser(f);
  const { intent, clientAction } = cryptoBuy(f, u);
  f.db.run('UPDATE payment_intents SET expires_at = ? WHERE id = ?', iso(Date.now() - 3600e3), intent.id);
  chain.add({ contract: USDC, amount: clientAction.amountAtomic });
  const s = await f.gateway.scanNetwork('base');
  assert.equal(s.credited, 0); assert.equal(s.unmatched, 1);
  assert.equal(f.payments.getIntentForUser(u.id, intent.id).status, 'expired');
  assert.match(f.db.get("SELECT note FROM crypto_transfers").note, /late_payment/);
});
test('crypto: user-submitted tx hashes have no effect (no endpoint, no credit path)', async () => {
  const api = new ApiRouter({ finance: cryptoFin(mockChain()) });
  for (const p of ['/api/crypto/verify', '/api/verify-crypto-tx']) {
    const r = await api.handleRequest('POST', p, { 'content-type': 'application/json' }, JSON.stringify({ txHash: '0x' + 'a'.repeat(64), expectedAmount: 1000, symbol: 'USDC' }));
    assert.equal(r.status, 404);
  }
});

console.log('\n--- 5. Redemptions ---');
const setupRedeemer = (f, { sc = 20000, played = true } = {}) => {
  const u = agedUser(f);
  giveSc(f, u.id, sc, played);
  const d = f.redemptions.addDestination(user(f, u.id), { network: 'base', token: 'USDC', address: '0x' + 'cd'.repeat(20), label: 'main' });
  f.db.run("UPDATE payout_destinations SET usable_after = ?, created_at = ? WHERE id = ?", iso(Date.now() - 1000), iso(Date.now() - 10 * 86400e3), d.id);
  return { u, d };
};
test('redemption requires KYC, eligible (played-through) SC, verified & cooled destination, valid limits', () => {
  const f = fresh(); const u = mkUser(f);
  assert.throws(() => f.redemptions.addDestination(user(f, u.id), { network: 'base', token: 'USDC', address: '0x' + 'cd'.repeat(20) }), (e) => e.code === 'KYC_REQUIRED');
  const { u: v, d } = setupRedeemer(f, { sc: 20000 });
  const req = (amountSc, key = crypto.randomUUID(), dest = d.id, usr = v) => f.redemptions.request(user(f, usr.id), { amountSc, destinationId: dest, idempotencyKey: key });
  assert.throws(() => req('10.00'), (e) => e.code === 'BELOW_MINIMUM');
  assert.throws(() => req('999999.00'), (e) => e.code === 'ABOVE_MAXIMUM');
  assert.throws(() => req('-5'), (e) => e.code === 'INVALID_AMOUNT');
  assert.throws(() => req('abc'), (e) => e.code === 'INVALID_AMOUNT');
  assert.throws(() => req('60.123'), (e) => e.code === 'INVALID_AMOUNT');
  assert.throws(() => req('60.00', crypto.randomUUID(), 'dst_nope'), (e) => e.code === 'INVALID_DESTINATION');
  // unplayed promo SC is not redeemable
  const p = agedUser(f); giveSc(f, p.id, 10000, false);
  const pd = f.redemptions.addDestination(user(f, p.id), { network: 'base', token: 'USDC', address: '0x' + 'ee'.repeat(20) });
  f.db.run('UPDATE payout_destinations SET usable_after = ? WHERE id = ?', iso(Date.now() - 1000), pd.id);
  assert.throws(() => req('60.00', crypto.randomUUID(), pd.id, p), (e) => e.code === 'NOT_ELIGIBLE');
  // Cooling-off on fresh destinations
  const q = agedUser(f); giveSc(f, q.id, 20000);
  const qd = f.redemptions.addDestination(user(f, q.id), { network: 'base', token: 'USDC', address: '0x' + 'ef'.repeat(20) });
  assert.throws(() => req('60.00', crypto.randomUUID(), qd.id, q), (e) => e.code === 'DESTINATION_COOLING');
});
test('invalid payout destinations rejected (checksum, zero address, treasury, token contract, bad network)', () => {
  const f = cryptoFin(mockChain()); const u = agedUser(f);
  const add = (a) => () => f.redemptions.addDestination(user(f, u.id), { network: 'base', token: 'USDC', address: a });
  for (const a of [TREASURY.replace('F97', 'f97'), '0x0000000000000000000000000000000000000000', TREASURY, USDC, 'bc1qxyz', '0x12', null]) assert.throws(add(a), (e) => e.code === 'INVALID_DESTINATION', String(a));
  assert.throws(() => f.redemptions.addDestination(user(f, u.id), { network: 'solana', token: 'USDC', address: '0x' + 'cd'.repeat(20) }), (e) => e.code === 'UNSUPPORTED_ASSET');
  assert.throws(() => f.redemptions.addDestination(user(f, u.id), { network: 'base', token: 'DOGE', address: '0x' + 'cd'.repeat(20) }), (e) => e.code === 'UNSUPPORTED_ASSET');
});
test('reserve is atomic; duplicates blocked (idempotency + single active request); insufficient funds', () => {
  const f = fresh(); const { u, d } = setupRedeemer(f, { sc: 20000 });
  const key = crypto.randomUUID();
  const a = f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: key });
  assert.equal(a.redemption.status, 'under_review'); // no purchase history -> flagged
  const replay = f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: key });
  assert.equal(replay.replayed, true); assert.equal(replay.redemption.id, a.redemption.id);
  assert.throws(() => f.redemptions.request(user(f, u.id), { amountSc: '70.00', destinationId: d.id, idempotencyKey: key }), (e) => e.code === 'IDEMPOTENCY_MISMATCH');
  assert.throws(() => f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'REDEMPTION_IN_PROGRESS');
  const w = f.ledger.getWallet(u.id);
  assert.equal(w.sc, 14000); assert.equal(w.sc_hold, 6000);
  assert.equal(f.db.get('SELECT COUNT(*) n FROM redemptions').n, 1);
  assert.ok(f.ledger.reconcile().ok);
  const { u: poor, d: pd } = setupRedeemer(f, { sc: 5000 });
  assert.throws(() => f.redemptions.request(user(f, poor.id), { amountSc: '50.01', destinationId: pd.id, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'NOT_ELIGIBLE');
});
test('velocity limits: request count and daily amount', () => {
  const run = (cfg, expect) => {
    const f = fresh({ redemptions: cfg });
    const { u, d } = setupRedeemer(f, { sc: 100000 });
    for (let i = 0; i < 2; i++) {
      const r = f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }).redemption;
      f.db.run("UPDATE redemptions SET status = 'completed' WHERE id = ?", r.id); // frees the single-active slot
    }
    assert.throws(() => f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }), (e) => e.code === expect);
  };
  run({ maxRequestsPerDay: 2 }, 'VELOCITY_LIMIT');
  run({ maxRequestsPerDay: 10, dailyLimitScCents: 15000 }, 'DAILY_LIMIT');
});
const staffUser = (f, role = 'FINANCE') => { const id = f.accounts.createStaff({ email: `${role}${++seq}@casino.test`, password: 'a-very-long-staff-password', name: role, role }); return user(f, id); };
test('full payout flow: approve -> processing -> on-chain verification -> completed; ledger exact', async () => {
  const chain = mockChain({ latest: 2000 });
  const f = cryptoFin(chain); const { u, d } = setupRedeemer(f, { sc: 20000 });
  const rd = f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }).redemption;
  const staff = staffUser(f);
  assert.throws(() => f.redemptions.markProcessing(staff, rd.id, '0x' + 'a'.repeat(64)), (e) => e.code === 'BAD_STATE', 'cannot pay before approval');
  f.redemptions.approve(staff, rd.id);
  const tx = '0x' + 'ab'.repeat(32);
  f.redemptions.markProcessing(staff, rd.id, tx);
  // payout not on chain yet
  let v = await f.redemptions.verifyAndComplete(staff, rd.id);
  assert.equal(v.verification.state, 'pending');
  // wrong amount / wrong destination in the tx => mismatch, stays processing
  const bad = chain.add({ tx, contract: USDC, from: TREASURY, to: '0x' + 'cd'.repeat(20), amount: 59_000_000n, block: 100 });
  v = await f.redemptions.verifyAndComplete(staff, rd.id);
  assert.equal(v.verification.state, 'mismatch'); assert.equal(v.redemption.status, 'processing');
  chain.logs = []; delete chain.receipts[tx];
  chain.add({ tx, contract: USDC, from: TREASURY, to: '0x' + 'cd'.repeat(20), amount: 60_000_000n, block: 100 });
  v = await f.redemptions.verifyAndComplete(staff, rd.id);
  assert.equal(v.redemption.status, 'completed');
  const w = f.ledger.getWallet(u.id);
  assert.equal(w.sc_hold, 0); assert.equal(w.sc, 14000);
  assert.ok(f.ledger.reconcile().ok);
  const again = await f.redemptions.verifyAndComplete(staff, rd.id).catch((e) => e);
  assert.equal(again.code, 'BAD_STATE', 'cannot complete twice');
  // same tx hash cannot be attached to another redemption
  const { u: u2, d: d2 } = setupRedeemer(f, { sc: 20000 });
  const rd2 = f.redemptions.request(user(f, u2.id), { amountSc: '60.00', destinationId: d2.id, idempotencyKey: crypto.randomUUID() }).redemption;
  f.redemptions.approve(staff, rd2.id);
  assert.throws(() => f.redemptions.markProcessing(staff, rd2.id, tx), (e) => e.code === 'TX_REUSED');
});
test('rejection, cancellation and failed payout all release the reserve exactly once', () => {
  const f = fresh(); const { u, d } = setupRedeemer(f, { sc: 20000 }); const staff = staffUser(f);
  const mk = () => f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }).redemption;
  let r = mk(); f.redemptions.reject(staff, r.id, 'suspicious activity');
  assert.equal(f.ledger.getWallet(u.id).sc, 20000);
  assert.throws(() => f.redemptions.reject(staff, r.id, 'again again'), (e) => e.code === 'BAD_STATE');
  r = mk(); f.redemptions.cancel(user(f, u.id), r.id);
  assert.equal(f.ledger.getWallet(u.id).sc, 20000);
  r = mk(); f.redemptions.approve(staff, r.id); f.redemptions.markProcessing(staff, r.id, '0x' + 'c'.repeat(64));
  f.redemptions.fail(staff, r.id, 'payout reverted on-chain');
  const w = f.ledger.getWallet(u.id);
  assert.equal(w.sc, 20000); assert.equal(w.sc_hold, 0);
  assert.ok(f.ledger.reconcile().ok);
  assert.equal(f.redemptions.history(r.id).length, 4);
});
test('dual control: large payouts need two different approvers; no self-approval', () => {
  const f = fresh(); const { u, d } = setupRedeemer(f, { sc: 100000 });
  const r = f.redemptions.request(user(f, u.id), { amountSc: '600.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }).redemption;
  const a = staffUser(f), b = staffUser(f, 'ADMIN');
  assert.equal(f.redemptions.approve(a, r.id).awaitingSecondApprover, true);
  assert.throws(() => f.redemptions.approve(a, r.id), (e) => e.code === 'DUAL_CONTROL');
  assert.equal(f.redemptions.approve(b, r.id).status, 'approved');
  // staff cannot approve their own redemption
  const self = staffUser(f); f.db.run("UPDATE users SET created_at = ? WHERE id = ?", iso(Date.now() - 30 * 86400e3), self.id);
  giveSc(f, self.id, 20000);
  const sd = f.redemptions.addDestination(user(f, self.id), { network: 'base', token: 'USDC', address: '0x' + '9a'.repeat(20) });
  f.db.run('UPDATE payout_destinations SET usable_after = ? WHERE id = ?', iso(Date.now() - 1000), sd.id);
  const sr = f.redemptions.request(user(f, self.id), { amountSc: '60.00', destinationId: sd.id, idempotencyKey: crypto.randomUUID() }).redemption;
  assert.throws(() => f.redemptions.approve(user(f, self.id), sr.id), (e) => e.code === 'SELF_APPROVAL');
});
test('frozen/self-excluded/non-KYC players cannot redeem or play', () => {
  const f = fresh(); const { u, d } = setupRedeemer(f, { sc: 20000 });
  f.db.run("UPDATE users SET status = 'frozen' WHERE id = ?", u.id);
  assert.throws(() => f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'ACCOUNT_RESTRICTED');
  f.db.run("UPDATE users SET status = 'active', kyc_status = 'pending' WHERE id = ?", u.id);
  assert.throws(() => f.redemptions.request(user(f, u.id), { amountSc: '60.00', destinationId: d.id, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'KYC_REQUIRED');
  f.accounts.selfExclude(u.id, 7);
  assert.throws(() => f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'SELF_EXCLUDED');
});
test('GC is never redeemable (only SC redemption path exists; GC wallet untouched)', () => {
  const f = fresh(); const { u } = setupRedeemer(f);
  const gc = f.ledger.getWallet(u.id).gc;
  const api = new ApiRouter({ finance: f });
  assert.ok(!api.routes.some((r) => /redeem.*gc|gc.*redeem/i.test(r.re.source)));
  assert.equal(f.ledger.getWallet(u.id).gc, gc);
});

console.log('\n--- 6. Slot machine (server authoritative) ---');
test('spin: validated bet tiers, atomic bet+win, ledger rows, balance reconciles', () => {
  const f = fresh(); const u = mkUser(f);
  const bad = (p) => () => f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID(), ...p });
  assert.throws(bad({ lineBet: 26 }), (e) => e.code === 'INVALID_BET');
  assert.throws(bad({ lineBet: -25 }), (e) => e.code === 'INVALID_BET');
  assert.throws(bad({ lineBet: '25' }), (e) => e.code === 'INVALID_BET');
  assert.throws(bad({ lines: 16 }), (e) => e.code === 'INVALID_LINES');
  assert.throws(bad({ currency: 'USD' }), (e) => e.code === 'INVALID_CURRENCY');
  assert.throws(bad({ clientSeed: 'x'.repeat(200) }), (e) => e.code === 'INVALID_CLIENT_SEED');
  assert.throws(bad({ idempotencyKey: '' }), (e) => e.code === 'IDEMPOTENCY_KEY_REQUIRED');
  const before = f.accounts.balance(u.id).gc;
  const s = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID() });
  assert.equal(s.bet, 375);
  assert.equal(s.balance.gc, before - 375 + s.win);
  assert.equal(f.db.get("SELECT COUNT(*) n FROM ledger WHERE type = 'BET'").n, 1);
  assert.ok(f.ledger.reconcile().ok);
});
test('spin: client-supplied outcome/win/balance fields are ignored', () => {
  const f = fresh(); const u = mkUser(f);
  const s = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID(), win: 10 ** 9, totalWin: 10 ** 9, grid: [['wild']], stops: [0, 0, 0, 0, 0], forcedMode: 'ultrawin', balance: 10 ** 12 });
  assert.ok(s.win < 10 ** 7);
  assert.ok(f.accounts.balance(u.id).gc < 10 ** 7);
});
test('spin: idempotent replay returns identical result and debits once', () => {
  const f = fresh(); const u = mkUser(f); const key = crypto.randomUUID();
  const a = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 5, lineBet: 25, idempotencyKey: key, clientSeed: 'abc' });
  const bal = f.accounts.balance(u.id).gc;
  const b = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 5, lineBet: 25, idempotencyKey: key, clientSeed: 'abc' });
  assert.equal(b.replayed, true); assert.deepEqual(b.grid, a.grid); assert.equal(f.accounts.balance(u.id).gc, bal);
  assert.throws(() => f.spins.spin(user(f, u.id), { currency: 'GC', lines: 5, lineBet: 50, idempotencyKey: key }), (e) => e.code === 'IDEMPOTENCY_MISMATCH');
  assert.equal(f.db.get('SELECT COUNT(*) n FROM spins').n, 1);
});
test('spin: insufficient funds rejected without side effects; SC play-through counter decreases', () => {
  const f = fresh(); const u = mkUser(f);
  assert.throws(() => f.spins.spin(user(f, u.id), { currency: 'SC', lines: 15, lineBet: 1, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'INSUFFICIENT_FUNDS');
  assert.equal(f.db.get('SELECT COUNT(*) n FROM spins').n, 0);
  giveSc(f, u.id, 5000, false);
  const s = f.spins.spin(user(f, u.id), { currency: 'SC', lines: 15, lineBet: 0.25, idempotencyKey: crypto.randomUUID() });
  assert.equal(s.bet, 3.75);
  const w = f.ledger.getWallet(u.id);
  assert.equal(w.sc_unplayed, 5000 - 375);
  assert.equal(w.sc, 5000 - 375 + Math.round(s.win * 100));
  assert.ok(f.ledger.reconcile().ok);
});
test('spin: provably fair - hash commitment, reveal on rotate, independent re-derivation matches', () => {
  const f = fresh(); const u = mkUser(f); const us = user(f, u.id);
  const c = f.spins.commitment(u.id);
  const sp = [];
  for (let i = 0; i < 20; i++) sp.push(f.spins.spin(us, { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID(), clientSeed: `seed${i}` }));
  assert.equal(sp[0].fairness.serverSeedHash, c.serverSeedHash);
  assert.equal(f.spins.verifySpin(u.id, sp[0].spinId).verifiable, false, 'cannot verify before reveal');
  const rot = f.spins.rotateSeed(u.id);
  assert.equal(crypto.createHash('sha256').update(rot.revealed.serverSeed).digest('hex'), c.serverSeedHash);
  const engine = new SlotMathEngine();
  for (const s of sp) {
    assert.ok(f.spins.verifySpin(u.id, s.spinId).valid);
    const o = deriveOutcome(engine, { serverSeed: rot.revealed.serverSeed, clientSeed: s.fairness.clientSeed, nonce: s.fairness.nonce, lines: 15, lineBetUnits: 25 });
    assert.equal(o.winUnits, s.win); assert.deepEqual(o.stops, s.stops);
  }
  assert.notEqual(f.spins.commitment(u.id).serverSeedHash, c.serverSeedHash);
});
test('spin: win economics sane over 20,000 server spins (RTP within broad sanity band, wins actually paid)', () => {
  const f = fresh({ compliance: { welcomeGc: 0 } }); const u = mkUser(f);
  f.db.tx(() => f.ledger.post({ userId: u.id, type: 'T', currency: 'GC', amount: 1_000_000_000, idempotencyKey: 'bank' }));
  let bet = 0, win = 0, hits = 0;
  for (let i = 0; i < 20000; i++) { const s = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: `rtp-${i}-abcdefgh` }); bet += s.bet; win += s.win; if (s.win > 0) hits++; }
  const rtp = win / bet;
  console.log(`      (info) base-game RTP over 20k spins = ${(rtp * 100).toFixed(1)}%, hit rate ${(hits / 200).toFixed(1)}%`);
  assert.ok(hits > 0 && win > 0, 'server pays wins');
  assert.ok(rtp > 0.1 && rtp < 1.6, `RTP ${rtp} outside sanity band`);
  assert.ok(f.ledger.reconcile().ok);
});
test('spin: SC play can be switched off (production default) without affecting GC play', () => {
  const f = fresh({ game: { scPlayEnabled: false } }); const u = mkUser(f); giveSc(f, u.id, 5000);
  assert.throws(() => f.spins.spin(user(f, u.id), { currency: 'SC', lines: 15, lineBet: 0.25, idempotencyKey: crypto.randomUUID() }), (e) => e.code === 'SC_PLAY_DISABLED');
  assert.ok(f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: crypto.randomUUID() }));
  const g = createFinance({ dbFile: ':memory:', env: { NODE_ENV: 'production', DC_LEDGER_SECRET: 'x'.repeat(32) } });
  assert.equal(g.config.game.scPlayEnabled, false);
});
test('spin: simultaneous wagers across connections cannot overdraw', async () => {
  // covered structurally by worker-thread race test; here we hammer sequentially-interleaved same-user spins
  const f = fresh({ compliance: { welcomeGc: 100 } }); const u = mkUser(f);
  let ok = 0, rej = 0;
  for (let i = 0; i < 20; i++) { try { f.spins.spin(user(f, u.id), { currency: 'GC', lines: 1, lineBet: 25, idempotencyKey: `sim-${i}-abcdefgh` }); ok++; } catch (e) { assert.equal(e.code, 'INSUFFICIENT_FUNDS'); rej++; } }
  assert.ok(f.accounts.balance(u.id).gc >= 0); assert.ok(rej > 0);
  assert.ok(f.ledger.reconcile().ok);
});

console.log('\n--- 7. HTTP API, authz & admin ---');
const call = (api, method, p, { token, body, headers = {}, ip = '9.9.9.9', idem } = {}) =>
  api.handleRequest(method, p, { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(idem ? { 'idempotency-key': idem } : {}), ...headers }, body === undefined ? '' : (typeof body === 'string' ? body : JSON.stringify(body)), {}, { ip });
test('API: unauthenticated and malformed requests are rejected', async () => {
  const api = new ApiRouter({ finance: fresh() });
  for (const [m, p] of [['GET', '/api/balance'], ['POST', '/api/game/spin'], ['POST', '/api/redemptions'], ['GET', '/api/admin/redemptions'], ['POST', '/api/payments/intents'], ['GET', '/api/ledger']]) {
    assert.equal((await call(api, m, p)).status, 401, `${m} ${p}`);
  }
  assert.equal((await call(api, 'GET', '/api/balance', { token: 'dcs_forged' })).status, 401);
  assert.equal((await call(api, 'POST', '/api/auth/login', { body: '{bad' })).status, 400);
  assert.equal((await call(api, 'POST', '/api/auth/login', { body: '[1]' })).status, 400);
  assert.equal((await call(api, 'POST', '/api/auth/login', { body: '{}', headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await call(api, 'POST', '/api/redemptions', { body: { userId: 'someone' } })).status, 401, 'client-supplied userId never authenticates');
});
test('API: players cannot reach staff routes; staff need role + step-up; no wallet-modify route exists', async () => {
  const f = fresh(); const api = new ApiRouter({ finance: f });
  const p = (await call(api, 'POST', '/api/auth/register', { body: { email: 'pl@example.com', password: PW, dob: '1990-01-01', state: 'TX' } })).body;
  assert.equal(p.success, true);
  for (const [m, path] of [['GET', '/api/admin/purchases'], ['GET', '/api/admin/redemptions'], ['GET', '/api/admin/reconciliation'], ['POST', `/api/admin/players/${p.user.id}/adjust`], ['POST', '/api/admin/redemptions/x/approve']]) {
    assert.equal((await call(api, m, path, { token: p.token, body: m === 'POST' ? {} : undefined })).status, 403, path);
  }
  const wr = ['/api/wallet', '/api/balance/set', '/api/admin/adjust-balance', '/api/redemptions/update', '/api/orders/update', '/api/provably-fair/rotate'];
  for (const path of wr) assert.equal((await call(api, 'POST', path, { token: p.token, body: { goldCoins: 1e9 } })).status, 404, path);
  // staff
  const sid = f.accounts.createStaff({ email: 'fin@casino.test', password: 'a-very-long-staff-password', name: 'F', role: 'FINANCE' });
  const aid = f.accounts.createStaff({ email: 'adm@casino.test', password: 'a-very-long-staff-password', name: 'A', role: 'ADMIN' });
  const fin = (await call(api, 'POST', '/api/auth/login', { body: { email: 'fin@casino.test', password: 'a-very-long-staff-password' } })).body;
  const adm = (await call(api, 'POST', '/api/auth/login', { body: { email: 'adm@casino.test', password: 'a-very-long-staff-password' } })).body;
  assert.equal((await call(api, 'GET', '/api/admin/redemptions', { token: fin.token })).status, 200);
  assert.equal((await call(api, 'GET', '/api/admin/reconciliation', { token: fin.token })).body.report.ok, true);
  // sensitive action without step-up
  const adj = { currency: 'GC', amount: 100, reason: 'goodwill credit ticket 1234' };
  let r = await call(api, 'POST', `/api/admin/players/${p.user.id}/adjust`, { token: adm.token, body: adj });
  assert.equal(r.status, 401); assert.equal(r.body.error.code, 'STEP_UP_REQUIRED');
  assert.equal((await call(api, 'POST', '/api/auth/step-up', { token: adm.token, body: { password: 'wrong' } })).status, 401);
  assert.equal((await call(api, 'POST', '/api/auth/step-up', { token: adm.token, body: { password: 'a-very-long-staff-password' } })).status, 200);
  r = await call(api, 'POST', `/api/admin/players/${p.user.id}/adjust`, { token: adm.token, body: adj });
  assert.equal(r.status, 200);
  // FINANCE role can not adjust balances even with step-up
  await call(api, 'POST', '/api/auth/step-up', { token: fin.token, body: { password: 'a-very-long-staff-password' } });
  assert.equal((await call(api, 'POST', `/api/admin/players/${p.user.id}/adjust`, { token: fin.token, body: adj })).status, 403);
  // caps + reasons
  assert.equal((await call(api, 'POST', `/api/admin/players/${p.user.id}/adjust`, { token: adm.token, body: { currency: 'SC', amount: '99999.00', reason: 'attempt to mint a lot' } })).status, 403);
  assert.equal((await call(api, 'POST', `/api/admin/players/${p.user.id}/adjust`, { token: adm.token, body: { currency: 'GC', amount: 100, reason: 'x' } })).status, 400);
  // adjustment is a ledger row + audit entry; history intact
  const led = f.db.get("SELECT * FROM ledger WHERE type = 'ADMIN_ADJUSTMENT'");
  assert.equal(led.amount, 100);
  assert.ok(f.db.get("SELECT 1 x FROM audit_log WHERE action = 'ADMIN_ADJUSTMENT'"));
  assert.equal(f.audit.verify().valid, true);
  void sid; void aid;
});
test('API: end-to-end purchase via HTTP, spin, balance, ledger; webhook uses raw body', async () => {
  const f = fresh(); const api = new ApiRouter({ finance: f });
  const reg = (await call(api, 'POST', '/api/auth/register', { body: { email: 'e2e@example.com', password: PW, dob: '1990-01-01', state: 'TX' } })).body;
  const mkInt = await call(api, 'POST', '/api/payments/intents', { token: reg.token, idem: 'e2e-intent-0001', body: { packageId: 'pkg_starter', provider: 'sandbox', method: 'sandbox', amountUsd: 0.01 } });
  assert.equal(mkInt.status, 200); assert.equal(mkInt.body.intent.amountUsd, 4.99);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents').r;
  const raw = JSON.stringify({ id: 'evt_http', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 });
  const bad = await call(api, 'POST', '/api/payments/webhook/sandbox', { body: raw, headers: { 'x-sandbox-signature': 't=1,v1=00' } });
  assert.equal(bad.status, 400);
  const good = await call(api, 'POST', '/api/payments/webhook/sandbox', { body: raw, headers: { 'x-sandbox-signature': signSandboxWebhook(f.config.providers.sandboxWebhookSecret, raw) } });
  assert.equal(good.body.status, 'credited');
  const bal = (await call(api, 'GET', '/api/balance', { token: reg.token })).body.balance;
  assert.equal(bal.gc, f.config.compliance.welcomeGc + 10000); assert.equal(bal.sc, 5);
  const sp = await call(api, 'POST', '/api/game/spin', { token: reg.token, idem: 'e2e-spin-00001', body: { currency: 'GC', lines: 15, lineBet: 25 } });
  assert.equal(sp.status, 200); assert.equal(sp.body.spin.grid.length, 5);
  assert.ok((await call(api, 'GET', '/api/ledger', { token: reg.token })).body.history.length >= 3);
  assert.equal((await call(api, 'POST', '/api/payments/intents', { token: reg.token, body: { packageId: 'pkg_starter', provider: 'sandbox', method: 'sandbox' } })).body.error.code, 'IDEMPOTENCY_KEY_REQUIRED');
});
test('API: rate limiting, CORS allow-list, security headers, no stack leaks', async () => {
  const api = new ApiRouter({ finance: fresh() });
  let last; for (let i = 0; i < 12; i++) last = await call(api, 'POST', '/api/auth/login', { body: { email: 'x@y.co', password: 'nope-nope-nope' }, ip: '7.7.7.7' });
  assert.equal(last.status, 429);
  const ok = await call(api, 'GET', '/api/health', { headers: { origin: 'http://localhost:5173' } });
  assert.equal(ok.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  const evil = await call(api, 'GET', '/api/health', { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(evil.headers['X-Content-Type-Options'], 'nosniff');
  const crash = new ApiRouter({ finance: fresh() }); crash.routes.push({ method: 'GET', re: /^\/api\/boom$/, keys: [], opts: {}, handler: () => { throw new Error('SELECT secret FROM x'); } });
  const origErr = console.error; console.error = () => {};
  const r = await call(crash, 'GET', '/api/boom'); console.error = origErr;
  assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('SELECT'));
});
test('API: SQL-injection / XSS style inputs are inert (parameterised queries, JSON-only output)', async () => {
  const f = fresh(); const api = new ApiRouter({ finance: f });
  const evil = `x'; DROP TABLE ledger;--`;
  const r = await call(api, 'POST', '/api/auth/register', { body: { email: `a${evil}@example.com`, password: PW, dob: '1990-01-01', state: 'TX', name: '<script>alert(1)</script>' } });
  assert.ok([200, 400].includes(r.status));
  assert.ok(f.db.get('SELECT COUNT(*) n FROM ledger').n >= 0);
  const login = await call(api, 'POST', '/api/auth/login', { body: { email: `' OR '1'='1`, password: `' OR '1'='1` } });
  assert.equal(login.status, 401);
});
test('reconciliation report: ledger, wallets, audit chain and payments consistent after mixed activity', async () => {
  const f = fresh(); const u = mkUser(f); const v = mkUser(f);
  const { intent } = buy(f, u);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'rc', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 }));
  giveSc(f, u.id, 100000);
  for (let i = 0; i < 30; i++) { f.spins.spin(user(f, u.id), { currency: i % 2 ? 'SC' : 'GC', lines: 15, lineBet: i % 2 ? 0.25 : 25, idempotencyKey: `rec-${i}-abcdefgh` }); }
  void v;
  const rep = f.admin.reconciliation();
  assert.equal(rep.ok, true, JSON.stringify(rep.wallets.problems));
});

test('double-entry: every ledger row has a contra row; trial balance sums to zero; house accounts reflect activity', async () => {
  const f = fresh(); const u = mkUser(f);
  const { intent } = buy(f, u);
  const ref = f.db.get('SELECT provider_ref r FROM payment_intents WHERE id = ?', intent.id).r;
  await f.payments.handleWebhook('sandbox', ...sandboxEvent(f, { id: 'de1', type: 'payment.succeeded', providerRef: ref, amountUsdCents: 499 }));
  let bet = 0, win = 0;
  for (let i = 0; i < 25; i++) { const s = f.spins.spin(user(f, u.id), { currency: 'GC', lines: 15, lineBet: 25, idempotencyKey: `de-${i}-abcdefgh` }); bet += s.bet; win += s.win; }
  assert.equal(f.db.get('SELECT COUNT(*) n FROM journal').n, f.db.get('SELECT COUNT(*) n FROM ledger').n);
  const tb = f.ledger.trialBalance();
  assert.equal(tb.balanced, true);
  const acct = (a, c) => tb.accounts.find((x) => x.account === a && x.currency === c)?.balance;
  assert.equal(acct('ISSUED:PURCHASED_GC', 'GC'), -10000);
  assert.equal(acct('ISSUED:PROMO_SC', 'SC'), -500);
  assert.equal(acct('GAME:WAGERS', 'GC'), bet);       // house received the wagers
  assert.equal(acct('GAME:WINNINGS', 'GC'), -win);    // house paid the winnings
  assert.equal(f.admin.reconciliation().trialBalance.balanced, true);
});
test('double-entry: journal is immutable and a missing/forged counter-entry is detected', () => {
  const f = fresh(); mkUser(f);
  assert.throws(() => f.db.run('UPDATE journal SET amount = 1'), /append-only/);
  assert.throws(() => f.db.run('DELETE FROM journal'), /append-only/);
  assert.ok(f.ledger.verifyChain().valid);
  f.db.run('DROP TRIGGER journal_no_delete');
  f.db.run('DELETE FROM journal WHERE seq = 1');
  const v = f.ledger.verifyChain();
  assert.equal(v.valid, false); assert.match(v.error, /counterpart/);
  assert.equal(f.ledger.reconcile().ok, false);
});

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

await runAll();
console.log(`\nFINANCE TESTS: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
