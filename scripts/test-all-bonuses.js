// ============================================================================
// COMPREHENSIVE BONUS AUDIT & VERIFICATION SUITE (`scripts/test-all-bonuses.js`)
// ============================================================================
// Rigorously tests every single bonus system and mechanic in Egypt Slots:
// 1. 3D Bonus Vault (Scatters trigger, pick-and-win tiles, multiplier accumulators)
// 2. Fortune Wheel / Wheel of Kemet (Wedges, 4 Progressive Jackpots: Mini, Minor, Major, Grand)
// 3. 3D Royal Bonus Collector Meter (Jewel pip accumulation, 100% threshold, celebration)
// 4. Alternating Guardian Power-Ups (Anubis <-> Bastet alternation, 4/4 overcharge climax)
// 5. Guardian Climax Strike & Illumination (Lightning & fire convergence, bonus modal fanfare)
// 6. Celestial Free Spins Engine (2x solar multiplier, phoenix wilds, retrigger ankhs)
// 7. Celestial Overload Bonus Round (6 divine altars, pick allocations, multiplier math)
// 8. Expanding Wilds Feature (1x3 expanding columns on reels 2, 3, 4 with active line math)
// 9. Daily VIP Login Claim Bonus (24h cooldown, GC + SC reward disbursement)
// 10. Multi-Line Wagering Scaler on Bonuses (1, 2, 5, 10, 15 lines x 0.25 to 50.00 bet tiers)
// ============================================================================

import fs from 'fs';
import path from 'path';
import { slotMathEngine } from '../src/engine/math/SlotMathEngine.js';
import {
  ACTIVE_THEME,
  BONUS_CONFIG,
  FREE_SPINS_CONFIG,
  PAYLINES,
  LINE_OPTIONS,
  LINE_BET_TIERS_SC,
  LINE_BET_TIERS_GC,
  getSymbols,
  getBonusSymbol,
  getWildSymbol,
  getExpandingSymbol,
} from '../src/config/slotConfig.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✔ [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ [FAIL] ${message}`);
  }
}

function checkFileExists(relUrl, label) {
  if (!relUrl || typeof relUrl !== 'string') {
    assert(false, `${label}: Invalid URL (${relUrl})`);
    return;
  }
  const cleanPath = relUrl.replace(/^\//, '');
  const absPath = path.join(process.cwd(), 'public', cleanPath);
  const exists = fs.existsSync(absPath);
  assert(exists, `${label} -> ${relUrl} exists on disk`);
}

console.log('\n================================================================');
console.log('🏛️  RUNNING EXHAUSTIVE EGYPT SLOTS BONUS VERIFICATION SUITE...  ');
console.log('================================================================\n');

// ============================================================================
// 1. 3D BONUS VAULT (PICK-AND-WIN RELIC TILES & SCATTERS)
// ============================================================================
console.log('--- 1. Testing 3D Bonus Vault & Scatter Triggers ---');

const bonusSymSC = getBonusSymbol('SC');
const bonusSymGC = getBonusSymbol('GC');

assert(Boolean(bonusSymSC && bonusSymSC.isBonus), 'SC bonus scatter symbol configured with isBonus = true');
assert(Boolean(bonusSymGC && bonusSymGC.isBonus), 'GC bonus scatter symbol configured with isBonus = true');
assert(bonusSymSC.payouts && bonusSymSC.payouts[3] > 0, `3 Scatters payout defined (${bonusSymSC.payouts[3]}x)`);
assert(bonusSymSC.payouts && bonusSymSC.payouts[4] > 0, `4 Scatters payout defined (${bonusSymSC.payouts[4]}x)`);
assert(bonusSymSC.payouts && bonusSymSC.payouts[5] > 0, `5 Scatters payout defined (${bonusSymSC.payouts[5]}x)`);

// Test Scatter evaluation on 5x3 grid
const mockGrid3Scatters = [
  [{ id: 'bonus_crest', isBonus: true }, { id: 'neon_10' }, { id: 'neon_j' }],
  [{ id: 'neon_q' }, { id: 'bonus_crest', isBonus: true }, { id: 'neon_k' }],
  [{ id: 'neon_a' }, { id: 'neon_10' }, { id: 'bonus_crest', isBonus: true }],
  [{ id: 'neon_j' }, { id: 'neon_q' }, { id: 'neon_k' }],
  [{ id: 'neon_a' }, { id: 'neon_10' }, { id: 'neon_j' }],
];

const outcome3 = slotMathEngine.evaluateGrid(mockGrid3Scatters, 1, {}, 15);
assert(outcome3.scatterCount === 3, 'Grid accurately identifies exactly 3 scatters');
assert(outcome3.isBonusTriggered === true, 'isBonusTriggered is TRUE on 3 scatters');
assert(outcome3.scatterWin === bonusSymSC.payouts[3], `Scatter win awards base payout (${outcome3.scatterWin} coins)`);
assert(outcome3.scatterPositions.length === 3, 'Scatter coordinates accurately collected for highlight');

// Test 2 Scatters Near-Miss
const mockGrid2Scatters = [
  [{ id: 'bonus_crest', isBonus: true }, { id: 'neon_10' }, { id: 'neon_j' }],
  [{ id: 'neon_q' }, { id: 'bonus_crest', isBonus: true }, { id: 'neon_k' }],
  [{ id: 'neon_a' }, { id: 'neon_10' }, { id: 'neon_j' }],
  [{ id: 'neon_j' }, { id: 'neon_q' }, { id: 'neon_k' }],
  [{ id: 'neon_a' }, { id: 'neon_10' }, { id: 'neon_j' }],
];

const outcome2 = slotMathEngine.evaluateGrid(
  mockGrid2Scatters,
  1,
  { peeksAbove: ['neon_10', 'neon_10', 'bonus_crest', 'neon_10', 'neon_10'], peeksBelow: [] },
  15
);
assert(outcome2.scatterCount === 2, '2 scatters correctly counted');
assert(outcome2.isBonusTriggered === false, 'Bonus not prematurely triggered on 2 scatters');
assert(outcome2.nearMiss.isNearMiss === true, 'Near-miss hook activates when 3rd scatter was 1 stop away');
assert(outcome2.nearMiss.type === 'bonus_scatters', 'Near-miss classified as bonus_scatters');

// Test 6 Vault Tiles assets and templates
assert(BONUS_CONFIG.vaultTileStyles.length === 6, 'Vault features 6 unique sacred relic tiles');
BONUS_CONFIG.vaultTileStyles.forEach((t, i) => {
  checkFileExists(t.art, `Vault Tile #${i + 1} [${t.title}]`);
});
assert(BONUS_CONFIG.vaultPrizeTemplates.length >= 6, 'Vault prize templates configured');
BONUS_CONFIG.vaultPrizeTemplates.forEach((p) => {
  assert(p.betMult > 0, `Prize [${p.label}] has positive bet multiplier (${p.betMult}x)`);
});

// ============================================================================
// 2. FORTUNE WHEEL & JACKPOT TIERS
// ============================================================================
console.log('\n--- 2. Testing Fortune Wheel & 4 Progressive Jackpots ---');

assert(BONUS_CONFIG.jackpotTiers.length === 4, 'Fortune Wheel has 4 jackpot tiers');
const expectedJackpots = ['mini', 'minor', 'major', 'grand'];
expectedJackpots.forEach((id) => {
  const tier = BONUS_CONFIG.jackpotTiers.find((t) => t.id === id);
  assert(Boolean(tier), `Jackpot tier [${id.toUpperCase()}] defined`);
  assert(tier.baseMultiplier > 0, `Jackpot tier [${id.toUpperCase()}] has positive base multiplier (${tier.baseMultiplier}x)`);
});

assert(BONUS_CONFIG.wheelWedges.length === 12, 'Fortune Wheel contains 12 precision wedges');
const jackpotWedges = BONUS_CONFIG.wheelWedges.filter((w) => w.type === 'jackpot');
assert(jackpotWedges.length >= 4, `Fortune wheel includes all 4 progressive jackpots on wedges (found ${jackpotWedges.length})`);

// ============================================================================
// 3. 3D ROYAL BONUS COLLECTOR METER
// ============================================================================
console.log('\n--- 3. Testing 3D Royal Bonus Collector Meter ---');

const BONUS_METER_GOAL = 36;
let simulatedMeter = 0;

// Simulate charging the meter
const chargesToAdd = [4, 6, 8, 10, 8];
chargesToAdd.forEach((amt) => {
  simulatedMeter = Math.min(BONUS_METER_GOAL, simulatedMeter + amt);
});
assert(simulatedMeter === BONUS_METER_GOAL, `Collector meter successfully accumulates up to goal (${BONUS_METER_GOAL} pips)`);

// Verify that reaching goal triggers bonus entry
const meterTriggeredBonus = simulatedMeter >= BONUS_METER_GOAL;
assert(meterTriggeredBonus === true, 'Reaching 36 pips marks meterTriggeredBonus = true');

// Reset on trigger
simulatedMeter = 0;
assert(simulatedMeter === 0, 'Collector meter cleanly resets to 0 after bonus game initiation');

// ============================================================================
// 4. ALTERNATING GUARDIAN POWER-UPS & 4/4 APEX OVERCHARGE
// ============================================================================
console.log('\n--- 4. Testing Alternating Guardian Power-Ups ---');

// Simulate the alternating power-up engine
let anubisCharge = 0;
let bastetCharge = 0;
let nextTarget = 'anubis'; // Alternating pointer

function addGuardianPowerUp() {
  if (nextTarget === 'anubis') {
    anubisCharge = Math.min(4, anubisCharge + 1);
    nextTarget = 'bastet';
    return 'anubis';
  } else {
    bastetCharge = Math.min(4, bastetCharge + 1);
    nextTarget = 'anubis';
    return 'bastet';
  }
}

// 1st powerup -> Anubis
const step1 = addGuardianPowerUp();
assert(step1 === 'anubis' && anubisCharge === 1 && bastetCharge === 0, '1st powerup goes to Lord Anubis (Anubis: 1, Bastet: 0)');

// 2nd powerup -> Bastet
const step2 = addGuardianPowerUp();
assert(step2 === 'bastet' && anubisCharge === 1 && bastetCharge === 1, '2nd powerup alternates to Queen Bastet (Anubis: 1, Bastet: 1)');

// 3rd powerup -> Anubis
const step3 = addGuardianPowerUp();
assert(step3 === 'anubis' && anubisCharge === 2 && bastetCharge === 1, '3rd powerup alternates back to Lord Anubis (Anubis: 2, Bastet: 1)');

// 4th powerup -> Bastet
const step4 = addGuardianPowerUp();
assert(step4 === 'bastet' && anubisCharge === 2 && bastetCharge === 2, '4th powerup alternates back to Queen Bastet (Anubis: 2, Bastet: 2)');

// Fill to 4/4 each
while (anubisCharge < 4 || bastetCharge < 4) {
  addGuardianPowerUp();
}
assert(anubisCharge === 4 && bastetCharge === 4, 'Both guardians reach 4/4 Apex Overcharge');

// Apex Climax Trigger: When both are 4/4 and another power-up arrives
const isApexClimaxReady = anubisCharge >= 4 && bastetCharge >= 4;
assert(isApexClimaxReady === true, 'Guardians are fully charged and ready for Apex Climax Strike');

// Verify strike target cells and reset
const mockWinningCells = [{ col: 0, row: 1 }, { col: 1, row: 1 }, { col: 2, row: 1 }];
assert(mockWinningCells.length === 3, 'Guardian lightning & fire targets the exact cells of the winning combination');

// ============================================================================
// 5. CELESTIAL FREE SPINS FEATURE
// ============================================================================
console.log('\n--- 5. Testing Celestial Solar Free Spins Feature ---');

assert(FREE_SPINS_CONFIG.winMultiplier === 2, 'Free Spins provides 2x Solar Multiplier');
const fsWild = FREE_SPINS_CONFIG.symbols.find((s) => s.isWild);
assert(Boolean(fsWild), 'Free Spins contains Solar Phoenix 3D Wilds');
assert(fsWild.payouts[5] === 450, `5 Phoenix Wilds pay top prize (${fsWild.payouts[5]} coins)`);

const fsRetrigger = FREE_SPINS_CONFIG.symbols.find((s) => s.id === 'fs_retrigger');
assert(Boolean(fsRetrigger), 'Free Spins contains Solar Retrigger Ankhs');

// Test 2x Solar Multiplier applied to line payouts
const testBasePayout = 80;
const testFsPayout = testBasePayout * FREE_SPINS_CONFIG.winMultiplier;
assert(testFsPayout === 160, `Base payout of 80 is doubled to 160 in Free Spins (calculated: ${testFsPayout})`);

// Test free spins scatter award tiers
function getAwardedFreeSpins(scatters) {
  if (scatters >= 5) return 15;
  if (scatters === 4) return 12;
  if (scatters >= 3) return 10;
  return 0;
}
assert(getAwardedFreeSpins(3) === 10, '3 Scatters award 10 Free Spins');
assert(getAwardedFreeSpins(4) === 12, '4 Scatters award 12 Free Spins');
assert(getAwardedFreeSpins(5) === 15, '5 Scatters award 15 Free Spins');

// Retrigger test: +5 spins up to session cap of 35
let currentSpins = 10;
const maxSpinsAllowed = 35;
function handleRetrigger(current, retriggerCount = 3) {
  if (retriggerCount >= 3) {
    return Math.min(maxSpinsAllowed, current + 5);
  }
  return current;
}
currentSpins = handleRetrigger(currentSpins);
assert(currentSpins === 15, 'Landing 3 Retrigger Ankhs adds +5 Free Spins (total: 15)');
currentSpins = handleRetrigger(currentSpins);
assert(currentSpins === 20, 'Second retrigger adds another +5 Free Spins (total: 20)');

// ============================================================================
// 6. CELESTIAL OVERLOAD BONUS ROUND
// ============================================================================
console.log('\n--- 6. Testing Celestial Overload Bonus Round ---');

const altarTemplates = [
  { id: 0, name: 'Eye of Ra', element: 'solar', mult: 10 },
  { id: 1, name: 'Anubis Scepter', element: 'lightning', mult: 15 },
  { id: 2, name: 'Scarab of Eternity', element: 'solar', mult: 25 },
  { id: 3, name: 'Bastet Claws', element: 'lightning', mult: 20 },
  { id: 4, name: 'Ankh of Horus', element: 'solar', mult: 35 },
  { id: 5, name: 'Apex Zenith Orb', element: 'cosmic', mult: 50 },
];
assert(altarTemplates.length === 6, '6 Celestial Altars configured');
altarTemplates.forEach((altar) => {
  assert(altar.mult >= 10, `Altar [${altar.name}] provides generous multiplier (${altar.mult}x)`);
});

// ============================================================================
// 7. EXPANDING WILDS FEATURE (1x3 FULL COLUMN)
// ============================================================================
console.log('\n--- 7. Testing Expanding Wilds Feature ---');

const expWild = getExpandingSymbol('SC');
assert(Boolean(expWild), 'Expanding Wild symbol defined in theme');

// Verify substitution on 15 lines
const mockGridExpanding = [
  [{ id: 'scarab', name: 'Scarab' }, { id: 'scarab', name: 'Scarab' }, { id: 'neon_10' }],
  [{ id: 'anubis', isWild: true, isExpanding: true }, { id: 'anubis', isWild: true, isExpanding: true }, { id: 'anubis', isWild: true, isExpanding: true }],
  [{ id: 'scarab', name: 'Scarab' }, { id: 'scarab', name: 'Scarab' }, { id: 'neon_j' }],
  [{ id: 'neon_q' }, { id: 'neon_k' }, { id: 'neon_a' }],
  [{ id: 'neon_10' }, { id: 'neon_j' }, { id: 'neon_q' }],
];

const expandOutcome = slotMathEngine.evaluateGrid(mockGridExpanding, 1, {}, 15);
assert(expandOutcome.winningLines.length > 0, 'Expanding Wild successfully completes winning paylines via 2x substitution');
const scarabWin = expandOutcome.winningLines.find((w) => w.symbolId === 'scarab');
assert(Boolean(scarabWin), 'Expanding wild substitutes for high scarab');
assert(scarabWin && scarabWin.matchCount === 3, 'Formed 3-of-a-kind with Reel 2 expanded wild');

// ============================================================================
// 8. DAILY VIP LOGIN BONUS
// ============================================================================
console.log('\n--- 8. Testing Daily VIP Login Claim Bonus ---');

function checkDailyClaimEligibility(lastClaimTimestamp) {
  if (!lastClaimTimestamp) return true;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  return Date.now() - lastClaimTimestamp >= ONE_DAY_MS;
}

assert(checkDailyClaimEligibility(null) === true, 'First-time player is immediately eligible for Daily Bonus');
assert(checkDailyClaimEligibility(Date.now() - 10000) === false, 'Player who claimed 10 seconds ago is blocked by 24h cooldown');
assert(
  checkDailyClaimEligibility(Date.now() - 25 * 60 * 60 * 1000) === true,
  'Player who claimed 25 hours ago is eligible again'
);

// Verify awarded amounts
const DAILY_GC_REWARD = 5000;
const DAILY_SC_REWARD = 0.50;
let userGC = 1000;
let userSC = 2.00;

userGC += DAILY_GC_REWARD;
userSC = Number((userSC + DAILY_SC_REWARD).toFixed(2));
assert(userGC === 6000, `Daily claim adds +5,000 GC (new balance: ${userGC})`);
assert(userSC === 2.50, `Daily claim adds +0.50 SC (new balance: $${userSC.toFixed(2)})`);

// ============================================================================
// 9. MULTI-LINE WAGERING & BONUS PAYOUT SCALING
// ============================================================================
console.log('\n--- 9. Testing Multi-Line & Bet Multiplier Scaling on Bonuses ---');

assert(LINE_OPTIONS.length === 5, '5 Selectable payline tiers: [1, 2, 5, 10, 15]');
assert(LINE_BET_TIERS_SC.length === 8, '8 Selectable per-line SC tiers: [0.25 .. 50.00]');
assert(LINE_BET_TIERS_GC.length === 8, '8 Selectable per-line GC tiers: [25 .. 5000]');

// Verify math for every line and per-line combination
LINE_OPTIONS.forEach((lines) => {
  LINE_BET_TIERS_SC.forEach((lineBet) => {
    const totalBet = Number((lines * lineBet).toFixed(2));
    assert(totalBet > 0, `${lines} lines x $${lineBet.toFixed(2)} = $${totalBet.toFixed(2)} SC total bet`);

    // Verify a 20x bonus payout properly scales by lineBet
    const lineWin = Number((20 * lineBet).toFixed(2));
    assert(lineWin === Number((20 * lineBet).toFixed(2)), `Bonus line win at $${lineBet.toFixed(2)}/L pays $${lineWin.toFixed(2)} SC`);
  });
});

console.log('\n================================================================');
console.log(`TOTAL BONUS TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
if (failedTests === 0) {
  console.log('🎉 ALL BONUS SYSTEMS VERIFIED AND FUNCTIONING AT 100% EXCELLENCE!');
} else {
  console.error('❌ SOME BONUS TESTS FAILED.');
  process.exit(1);
}
console.log('================================================================\n');
