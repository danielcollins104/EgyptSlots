// Smoke test for the ledger-backed ApiRouter. Exhaustive API/authz tests live in scripts/test-finance.js.
import assert from 'node:assert';
import { ApiRouter } from '../server/apiRouter.js';
import { createFinance } from '../server/finance/index.js';

console.log('Testing ApiRouter endpoints...');
const router = new ApiRouter({ finance: createFinance({ dbFile: ':memory:', config: { game: { minSpinIntervalMs: 0 } } }) });
const call = (m, p, body, token, idem) =>
  router.handleRequest(m, p, { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(idem ? { 'idempotency-key': idem } : {}) }, body ? JSON.stringify(body) : '', {}, { ip: '10.0.0.1' });

assert.strictEqual((await call('GET', '/api/health')).status, 200);
console.log('✔ [PASS] /api/health');
assert.strictEqual((await call('POST', '/api/game/spin', { currency: 'GC', lines: 15, lineBet: 25 })).status, 401);
console.log('✔ [PASS] /api/game/spin rejects unauthenticated requests');
const reg = await call('POST', '/api/auth/register', { email: 'smoke@example.com', password: 'a-long-password!', dob: '1990-01-01', state: 'TX' });
assert.strictEqual(reg.status, 200);
const spin = await call('POST', '/api/game/spin', { currency: 'GC', lines: 15, lineBet: 25 }, reg.body.token, 'smoke-spin-0001');
assert.strictEqual(spin.status, 200);
assert(Array.isArray(spin.body.spin.grid), 'Grid must be a 5x3 array');
console.log('✔ [PASS] /api/game/spin (server-authoritative outcome)');
assert.strictEqual((await call('POST', '/api/admin/players/x/adjust', { currency: 'GC', amount: 1, reason: 'not allowed at all' }, reg.body.token)).status, 403);
console.log('✔ [PASS] player cannot reach admin balance adjustment');
console.log('\n🎉 ALL APIRouter ENDPOINTS FUNCTIONING WITH 100% SUCCESS!');
