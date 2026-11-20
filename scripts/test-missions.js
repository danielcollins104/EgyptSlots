// Daily Missions Engine — unit tests (node scripts/test-missions.js)
import assert from 'node:assert/strict';
import {
  MISSIONS_CONFIG,
  loadMissionsState,
  recordSpin,
  getMissionsView,
  claimMission,
  claimTrio,
  saveMissionsState,
} from '../src/retention/missions.js';

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log(`  ok - ${name}`); }
  catch (e) { console.error(`  FAIL - ${name}\n    ${e.message}`); process.exitCode = 1; }
}
function memStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), _m: m };
}

t('fresh state has empty progress and no claims', () => {
  const { state } = loadMissionsState('u1', memStorage());
  const v = getMissionsView(state);
  assert.equal(v.list.length, MISSIONS_CONFIG.missions.length);
  assert.ok(v.list.every((m) => m.progress === 0 && !m.claimed && !m.complete));
});

t('spin counting progresses SPIN MASTER', () => {
  let { state } = loadMissionsState('u2', memStorage());
  for (let i = 0; i < 50; i++) state = recordSpin(state, { mode: 'GC' }).state;
  const spin = getMissionsView(state).list.find((m) => m.id === 'spin_50');
  assert.equal(spin.progress, 50);
  assert.equal(spin.complete, true);
});

t('big win detection uses 10x bet threshold', () => {
  let { state } = loadMissionsState('u3', memStorage());
  state = recordSpin(state, { mode: 'GC', winAmount: 9.9, betAmount: 1 }).state;
  assert.equal(getMissionsView(state).list.find((m) => m.id === 'bigwin_1').progress, 0);
  state = recordSpin(state, { mode: 'GC', winAmount: 10, betAmount: 1 }).state;
  assert.equal(getMissionsView(state).list.find((m) => m.id === 'bigwin_1').progress, 1);
});

t('dual currency requires both modes', () => {
  let { state } = loadMissionsState('u4', memStorage());
  state = recordSpin(state, { mode: 'GC' }).state;
  assert.equal(getMissionsView(state).list.find((m) => m.id === 'both_modes').progress, 1);
  state = recordSpin(state, { mode: 'SC' }).state;
  assert.equal(getMissionsView(state).list.find((m) => m.id === 'both_modes').progress, 2);
});

t('mission completion event fires exactly once on crossing', () => {
  let { state } = loadMissionsState('u5', memStorage());
  let events = [];
  for (let i = 0; i < 50; i++) { const r = recordSpin(state, { mode: 'GC' }); state = r.state; events = events.concat(r.events); }
  const completes = events.filter((e) => e.type === 'mission_completed' && e.mission.id === 'spin_50');
  assert.equal(completes.length, 1);
});

t('claim awards reward and blocks double claim', () => {
  let { state } = loadMissionsState('u6', memStorage());
  for (let i = 0; i < 50; i++) state = recordSpin(state, { mode: 'GC' }).state;
  const res = claimMission(state, 'spin_50');
  assert.equal(res.reward.gc, 2000);
  const again = claimMission(res.state, 'spin_50');
  assert.equal(again.error, 'already_claimed');
});

t('cannot claim incomplete mission', () => {
  const { state } = loadMissionsState('u7', memStorage());
  assert.equal(claimMission(state, 'bonus_2').error, 'not_complete');
});

t('SC daily cap blocks claims that would exceed it', () => {
  const store = memStorage();
  // Pre-seed a state where bonus_2 is complete but only $0.05 SC headroom remains
  saveMissionsState('u8', {
    date: new Date().toLocaleDateString('en-CA'), lastVisit: new Date().toLocaleDateString('en-CA'),
    spins: 5, bonuses: 2, bigWins: 0, modes: { GC: true }, claimed: {}, scAwardedToday: 0.95, trioClaimed: false,
  }, store);
  const { state } = loadMissionsState('u8', store);
  const res = claimMission(state, 'bonus_2'); // +0.25 SC would hit 1.20 > 1.0 cap
  assert.equal(res.error, 'sc_cap_reached');
});

t('SC claim exactly at cap boundary is allowed', () => {
  const store = memStorage();
  saveMissionsState('u8b', {
    date: new Date().toLocaleDateString('en-CA'), lastVisit: new Date().toLocaleDateString('en-CA'),
    spins: 50, bonuses: 0, bigWins: 0, modes: { GC: true }, claimed: {}, scAwardedToday: 0.90, trioClaimed: false,
  }, store);
  const { state } = loadMissionsState('u8b', store);
  const res = claimMission(state, 'spin_50'); // +0.10 -> exactly 1.00
  assert.equal(res.error, undefined);
  assert.ok(Math.abs(res.state.scAwardedToday - 1.0) < 1e-9);
});

t('trio requires all missions claimed', () => {
  let { state } = loadMissionsState('u9', memStorage());
  assert.equal(claimTrio(state).error, 'not_complete');
});

t('trio awards after all missions claimed', () => {
  let { state } = loadMissionsState('u10', memStorage());
  for (let i = 0; i < 50; i++) state = recordSpin(state, { mode: 'GC', winAmount: 20, betAmount: 1, bonusTriggered: i < 2 }).state;
  state = recordSpin(state, { mode: 'SC' }).state;
  for (const id of ['spin_50', 'bonus_2', 'bigwin_1', 'both_modes']) {
    const res = claimMission(state, id);
    assert.equal(res.error, undefined, id);
    state = res.state;
  }
  const trio = claimTrio(state);
  assert.equal(trio.reward.gc, MISSIONS_CONFIG.trioReward.gc);
  assert.equal(claimTrio(trio.state).error, 'already_claimed');
});

t('persistence roundtrip survives reload', () => {
  const store = memStorage();
  let { state } = loadMissionsState('u11', store);
  state = recordSpin(state, { mode: 'GC' }).state;
  saveMissionsState('u11', state, store); // engine is pure; caller persists
  const reloaded = loadMissionsState('u11', store);
  assert.equal(reloaded.state.spins, 1);
});

t('comeback flag fires after absence', () => {
  const store = memStorage();
  store.setItem(`${MISSIONS_CONFIG.storagePrefix}:u12`, JSON.stringify({
    date: '2026-11-12', lastVisit: '2026-11-12', spins: 10, bonuses: 0, bigWins: 0,
    modes: { GC: true }, claimed: {}, scAwardedToday: 0, trioClaimed: false,
  }));
  const { state, comebackDue } = loadMissionsState('u12', store);
  assert.equal(comebackDue, true);
  assert.equal(state.spins, 0); // daily reset applied
});

console.log(`\n${passed} tests passed${process.exitCode ? ' (with failures)' : ''}`);
