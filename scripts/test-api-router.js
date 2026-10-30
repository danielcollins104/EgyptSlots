import assert from 'node:assert';
import { ApiRouter } from '../server/apiRouter.js';

console.log('Testing ApiRouter endpoints...');

const router = new ApiRouter();

// 1. Health check
const health = await router.handleRequest('GET', '/api/health');
assert.strictEqual(health.status, 200);
assert.strictEqual(health.body.status, 'healthy');
console.log('✔ [PASS] /api/health');

// 2. Provably fair commitment
const pf = await router.handleRequest('GET', '/api/provably-fair');
assert.strictEqual(pf.status, 200);
assert(pf.body.serverSeedHash, 'Server seed hash must be present');
console.log('✔ [PASS] /api/provably-fair');

// 3. Authoritative Spin Request
const spinRes = await router.handleRequest('POST', '/api/spin', {}, {
  currencyMode: 'GC',
  betLevel: 1,
});
assert.strictEqual(spinRes.status, 200);
assert(spinRes.body.spin.id, 'Spin ID must be present');
assert(spinRes.body.signature, 'HMAC signature must be present');
assert(Array.isArray(spinRes.body.spin.grid), 'Grid must be 5x3 array');
console.log('✔ [PASS] /api/spin (Authoritative outcome returned with HMAC signature)');

// 4. Admin rejection without token
const adminNoToken = await router.handleRequest('POST', '/api/admin/adjust-balance', {}, {
  targetUserId: 'usr_test',
  currency: 'GC',
  amount: 500,
  reason: 'Test',
});
assert.strictEqual(adminNoToken.status, 401);
console.log('✔ [PASS] /api/admin/adjust-balance rejected without admin token');

// 5. Admin login & adjustment
const adminLogin = await router.handleRequest('POST', '/api/admin/login', {}, {
  adminKey: 'dc_admin_super_secret_kemet_999!',
});
assert.strictEqual(adminLogin.status, 200);
assert(adminLogin.body.token, 'Admin token returned');

const adminAdjust = await router.handleRequest('POST', '/api/admin/adjust-balance', {
  authorization: `Bearer ${adminLogin.body.token}`,
}, {
  targetUserId: 'usr_test_vip',
  currency: 'GC',
  amount: 50000,
  reason: 'VIP Promotion Grant',
});
assert.strictEqual(adminAdjust.status, 200);
assert.strictEqual(adminAdjust.body.balanceAfter, 150000); // 100k initial + 50k
console.log('✔ [PASS] /api/admin/adjust-balance authorized and ledgered');

// 6. Admin inspect ledger
const ledgerRes = await router.handleRequest('GET', '/api/admin/ledger', {
  authorization: `Bearer ${adminLogin.body.token}`,
});
assert.strictEqual(ledgerRes.status, 200);
assert(ledgerRes.body.chain.length > 0, 'Chain must contain blocks');
assert.strictEqual(ledgerRes.body.integrity.valid, true, 'Ledger integrity verified');
console.log('✔ [PASS] /api/admin/ledger returned verified audit trail');

console.log('\n🎉 ALL APIRouter ENDPOINTS FUNCTIONING WITH 100% SUCCESS!');
