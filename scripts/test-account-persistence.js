import assert from 'node:assert';
import { authService } from '../src/services/authService.js';

// Polyfill localStorage for Node test runner
const memoryStore = new Map();
globalThis.localStorage = {
  getItem: (key) => memoryStore.get(key) || null,
  setItem: (key, val) => memoryStore.set(key, String(val)),
  removeItem: (key) => memoryStore.delete(key),
  clear: () => memoryStore.clear(),
};
globalThis.window = {
  dispatchEvent: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

console.log('🧪 RUNNING PER-ACCOUNT DATA PERSISTENCE TEST...\n');

// 1. Player A (Alice) signs up / logs in
const alice = { id: 'usr_alice_101', name: 'Alice', email: 'alice@dc-casino.vip' };
const aliceInitial = authService.getUserData(alice.id);
assert.strictEqual(aliceInitial.goldCoins, 100000, 'Alice receives 100,000 GC starter balance');
assert.strictEqual(aliceInitial.sweepsCoins, 10.0, 'Alice receives 10.00 SC starter balance');
console.log('✔ Alice registered with 100,000 GC and 10.00 SC');

// 2. Alice plays, wins a mega jackpot of 500,000 GC and 50 SC
authService.saveUserData(alice.id, { goldCoins: 600000, sweepsCoins: 60.0 });
console.log('✔ Alice won 500,000 GC -> Balance updated to 600,000 GC');

// 3. Alice logs out
authService.logout();
console.log('✔ Alice logged out');

// 4. Player B (Bob) signs in on the same device
const bob = { id: 'usr_bob_202', name: 'Bob', email: 'bob@dc-casino.vip' };
const bobInitial = authService.getUserData(bob.id);
assert.strictEqual(bobInitial.goldCoins, 100000, 'Bob receives fresh isolated 100,000 GC balance');
assert.strictEqual(bobInitial.sweepsCoins, 10.0, 'Bob receives fresh isolated 10.00 SC balance');
console.log('✔ Bob registered independently with fresh 100,000 GC and 10.00 SC (unaffected by Alice)');

// 5. Bob spins and loses 30,000 GC
authService.saveUserData(bob.id, { goldCoins: 70000, sweepsCoins: 8.5 });
console.log('✔ Bob played down to 70,000 GC and 8.50 SC');

// 6. Bob logs out
authService.logout();

// 7. Alice logs back in on the device
const aliceRestored = authService.getUserData(alice.id);
assert.strictEqual(aliceRestored.goldCoins, 600000, 'Alice restored her exact 600,000 GC balance');
assert.strictEqual(aliceRestored.sweepsCoins, 60.0, 'Alice restored her exact 60.00 SC balance');
console.log('✔ Alice logged back in: exact 600,000 GC and 60.00 SC restored perfectly!');

// 8. Bob logs back in
const bobRestored = authService.getUserData(bob.id);
assert.strictEqual(bobRestored.goldCoins, 70000, 'Bob restored his exact 70,000 GC balance');
assert.strictEqual(bobRestored.sweepsCoins, 8.5, 'Bob restored his exact 8.50 SC balance');
console.log('✔ Bob logged back in: exact 70,000 GC and 8.50 SC restored perfectly!');

console.log('\n🎉 ALL INDIVIDUAL ACCOUNT DATA PERSISTENCE TESTS PASSED (100% ISOLATION & RETENTION)!');
