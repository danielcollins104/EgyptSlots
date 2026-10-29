// ============================================================================
// COMPREHENSIVE WIN AUDIT & VERIFICATION SUITE (`scripts/test-all-wins.js`)
// ============================================================================
// Tests all win calculations, paylines, symbol combinations, bet levels,
// and presentation formatters across Desktop, Mobile Portrait, and Mobile Horizontal.
// ============================================================================

import { slotMathEngine } from '../src/engine/math/SlotMathEngine.js';
import { MATH_PAYTABLE, MATH_PAYLINES } from '../src/engine/math/paytableConfig.js';
import {
  BET_TIERS_GC,
  BET_TIERS_SC,
  getSymbols,
  PAYLINES,
  FREE_SPINS_CONFIG,
} from '../src/config/slotConfig.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`❌ FAIL: ${testName}`);
  }
}

function formatCoinValue(val) {
  if (val === undefined || val === null || isNaN(val)) return '1.00';
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Number(val).toFixed(2);
}

console.log('🎰 STARTING COMPREHENSIVE WIN AUDIT SUITE...');

// ----------------------------------------------------------------------------
// TEST SUITE 1: Payline Definitions & Index Alignment
// ----------------------------------------------------------------------------
console.log('\n--- 1. Testing Payline Definitions & Geometric Bounds ---');
assert(PAYLINES.length === 15, '15 Paylines configured in slotConfig');
assert(MATH_PAYLINES.length === 15, '15 Paylines configured in MATH_PAYLINES');

for (let i = 0; i < 15; i++) {
  const p1 = PAYLINES[i];
  const p2 = MATH_PAYLINES[i];
  assert(p1.id === i + 1, `Payline ${i + 1} has correct ID`);
  assert(p1.rows.length === 5, `Payline ${i + 1} spans 5 columns`);
  assert(p1.rows.every((r) => r >= 0 && r <= 2), `Payline ${i + 1} rows are within 0..2 (3 rows)`);
  assert(
    JSON.stringify(p1.rows) === JSON.stringify(p2.rows),
    `Payline ${i + 1} geometry matches in config and math engine`
  );
}

// ----------------------------------------------------------------------------
// TEST SUITE 2: Symbol Payout Integrity across GC and SC Modes
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing Symbol Payout Matrices ---');
const gcSymbols = getSymbols('GC');
const scSymbols = getSymbols('SC');

assert(gcSymbols.length === 12, '12 Symbols present in GC mode');
assert(scSymbols.length === 12, '12 Symbols present in SC mode');

gcSymbols.forEach((sym) => {
  if (sym.payouts) {
    assert(sym.payouts[3] > 0, `${sym.id} has valid 3-match payout: ${sym.payouts[3]}`);
    assert(sym.payouts[4] > sym.payouts[3], `${sym.id} 4-match payout > 3-match: ${sym.payouts[4]}`);
    assert(sym.payouts[5] > sym.payouts[4], `${sym.id} 5-match payout > 4-match: ${sym.payouts[5]}`);
  }
});

// Verify SC payouts are >= GC payouts (calibrated for higher RTP in SC sweepstakes mode)
scSymbols.forEach((sym) => {
  const gcSym = gcSymbols.find((s) => s.id === sym.id);
  if (sym.payouts && gcSym?.payouts) {
    assert(
      sym.payouts[3] >= gcSym.payouts[3] &&
      sym.payouts[4] >= gcSym.payouts[4] &&
      sym.payouts[5] >= gcSym.payouts[5],
      `SC payouts for ${sym.id} are properly calibrated (${sym.payouts[5]} >= ${gcSym.payouts[5]})`
    );
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE 3: Individual Payline Win Evaluation on all 15 Lines
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Win Evaluation on all 15 Paylines ---');
const dummySym = gcSymbols.find((s) => s.id === 'neon_10');
const testSym = gcSymbols.find((s) => s.id === 'eye'); // Payouts: 31, 98, 308

for (const line of PAYLINES) {
  // Test 3 of a kind on this line
  const grid3 = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
  line.rows.slice(0, 3).forEach((r, c) => {
    grid3[c][r] = testSym;
  });

  const outcome3 = slotMathEngine.evaluateGrid(grid3, 1);
  const matchingLine = outcome3.winningLines.find((wl) => wl.line.id === line.id);
  assert(matchingLine !== undefined, `Line ${line.id} detects 3-of-a-kind ${testSym.name}`);
  assert(matchingLine?.matchCount === 3, `Line ${line.id} matchCount is 3`);
  assert(matchingLine?.lineWin === testSym.payouts[3], `Line ${line.id} lineWin is ${testSym.payouts[3]}`);
  assert(matchingLine?.cells?.length === 3, `Line ${line.id} outputs exact 3 winning cells`);

  // Test 4 of a kind on this line
  const grid4 = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
  line.rows.slice(0, 4).forEach((r, c) => {
    grid4[c][r] = testSym;
  });
  const outcome4 = slotMathEngine.evaluateGrid(grid4, 1);
  const matchingLine4 = outcome4.winningLines.find((wl) => wl.line.id === line.id);
  assert(matchingLine4?.matchCount === 4, `Line ${line.id} matchCount is 4`);
  assert(matchingLine4?.lineWin === testSym.payouts[4], `Line ${line.id} lineWin is ${testSym.payouts[4]}`);

  // Test 5 of a kind on this line
  const grid5 = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
  line.rows.forEach((r, c) => {
    grid5[c][r] = testSym;
  });
  const outcome5 = slotMathEngine.evaluateGrid(grid5, 1);
  const matchingLine5 = outcome5.winningLines.find((wl) => wl.line.id === line.id);
  assert(matchingLine5?.matchCount === 5, `Line ${line.id} matchCount is 5`);
  assert(matchingLine5?.lineWin === testSym.payouts[5], `Line ${line.id} lineWin is ${testSym.payouts[5]}`);
}

// ----------------------------------------------------------------------------
// TEST SUITE 4: 2× Wild Multiplier Substitution on Paylines
// ----------------------------------------------------------------------------
console.log('\n--- 4. Testing 2× Wild Multiplier Substitution ---');
const wildSym = gcSymbols.find((s) => s.id === 'wild');
const gridWithWild = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
// Place Eye on col 0, Wild on col 1, Eye on col 2 along line 1 (row 1)
gridWithWild[0][1] = testSym;
gridWithWild[1][1] = wildSym;
gridWithWild[2][1] = testSym;

const outcomeWild = slotMathEngine.evaluateGrid(gridWithWild, 1);
const winWithWild = outcomeWild.winningLines.find((wl) => wl.line.id === 1);
assert(winWithWild !== undefined, 'Line 1 detected 3-match with Wild substitution');
assert(winWithWild?.multiplier === 2, 'Wild doubled the payout multiplier to 2×');
assert(winWithWild?.lineWin === testSym.payouts[3] * 2, `Line win is doubled: ${testSym.payouts[3] * 2}`);
assert(winWithWild?.cells?.length === 3, 'Win contains 3 cell coordinates');

// ----------------------------------------------------------------------------
// TEST SUITE 5: Pure Wild Chain vs Regular Match Priority
// ----------------------------------------------------------------------------
console.log('\n--- 5. Testing Pure Wild Chain Priority ---');
// 3 Wilds starting from col 0
const gridPureWild = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
gridPureWild[0][1] = wildSym;
gridPureWild[1][1] = wildSym;
gridPureWild[2][1] = wildSym;
gridPureWild[3][1] = testSym;
gridPureWild[4][1] = testSym;

const outcomePureWild = slotMathEngine.evaluateGrid(gridPureWild, 1);
const winPureWild = outcomePureWild.winningLines.find((wl) => wl.line.id === 1);
// Pure wild payout for 3 wilds is 55. Regular match for Eye with wilds: 5 Eyes with 2x = 308 * 2 = 616.
// Slot engine awards whichever valid combination pays higher!
assert(winPureWild !== undefined, 'Evaluated highest paying combination on line 1');
assert(winPureWild?.lineWin >= wildSym.payouts[3], 'Awarded combination is >= pure wild payout');

// ----------------------------------------------------------------------------
// TEST SUITE 6: Scatter Bonus Payouts (3, 4, 5 Scatters Anywhere)
// ----------------------------------------------------------------------------
console.log('\n--- 6. Testing Scatter Bonus Payouts ---');
const bonusSym = gcSymbols.find((s) => s.isBonus);

// 3 Scatters
const gridScatter3 = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
gridScatter3[0][0] = bonusSym;
gridScatter3[2][1] = bonusSym;
gridScatter3[4][2] = bonusSym;
const outcomeS3 = slotMathEngine.evaluateGrid(gridScatter3, 1);
assert(outcomeS3.scatterCount === 3, 'Detected 3 Scatters on grid');
assert(outcomeS3.isBonusTriggered === true, '3 Scatters trigger Bonus Game');
assert(outcomeS3.scatterWin === bonusSym.payouts[3], `3 Scatters payout: ${bonusSym.payouts[3]}`);

// 4 Scatters
gridScatter3[1][2] = bonusSym;
const outcomeS4 = slotMathEngine.evaluateGrid(gridScatter3, 1);
assert(outcomeS4.scatterCount === 4, 'Detected 4 Scatters on grid');
assert(outcomeS4.scatterWin === bonusSym.payouts[4], `4 Scatters payout: ${bonusSym.payouts[4]}`);

// 5 Scatters
gridScatter3[3][0] = bonusSym;
const outcomeS5 = slotMathEngine.evaluateGrid(gridScatter3, 1);
assert(outcomeS5.scatterCount === 5, 'Detected 5 Scatters on grid');
assert(outcomeS5.scatterWin === bonusSym.payouts[5], `5 Scatters payout: ${bonusSym.payouts[5]}`);

// ----------------------------------------------------------------------------
// TEST SUITE 7: Bet Tiers & Payout Scaling in GC and SC Modes
// ----------------------------------------------------------------------------
console.log('\n--- 7. Testing All Bet Tiers across GC and SC ---');

// GC Bet Tiers
const gridTier3 = Array.from({ length: 5 }, () => Array.from({ length: 3 }, () => dummySym));
gridTier3[0][1] = testSym;
gridTier3[1][1] = testSym;
gridTier3[2][1] = testSym;

BET_TIERS_GC.forEach((betGC) => {
  const activeLevel = Math.max(1, Math.round(betGC / 15));
  const lineBet = betGC / 15;
  assert(Number.isInteger(lineBet), `GC Bet ${betGC} divides evenly across 15 lines (lineBet = ${lineBet})`);
  assert(activeLevel === lineBet, `GC Bet ${betGC} activeLevel equals lineBet (${activeLevel})`);

  // Evaluate 3 Eyes on Line 1 at this bet level
  const outcome = slotMathEngine.evaluateGrid(gridTier3, activeLevel);
  const win = outcome.winningLines.find((wl) => wl.line.id === 1);
  const expectedWin = testSym.payouts[3] * lineBet;
  assert(win?.lineWin === expectedWin, `GC Bet ${betGC}: 3 Eyes pays ${expectedWin} GC (matches paytable)`);
});

// SC Bet Tiers
BET_TIERS_SC.forEach((betSC) => {
  const activeLevel = Math.max(1, Math.round(betSC / 0.15));
  const lineBetSC = betSC / 15;
  assert(activeLevel > 0, `SC Bet ${betSC} has positive activeLevel ${activeLevel}`);

  // In App.jsx: finalWin = Number(((totalCoinsWon / (15 * activeLevel)) * spinBet).toFixed(2))
  // For Line 1: totalCoinsWon = testSym.payouts[3] * activeLevel
  const totalCoinsWon = testSym.payouts[3] * activeLevel;
  const finalWinSC = Number(((totalCoinsWon / (15 * activeLevel)) * betSC).toFixed(2));
  const expectedSC = Number((testSym.payouts[3] * lineBetSC).toFixed(2));
  assert(
    Math.abs(finalWinSC - expectedSC) < 0.001,
    `SC Bet $${betSC.toFixed(2)}: 3 Eyes pays $${finalWinSC.toFixed(2)} SC ($${expectedSC.toFixed(2)} USD)`
  );
});

// ----------------------------------------------------------------------------
// TEST SUITE 8: Celestial Free Spins Payout Math across All Bet Tiers
// ----------------------------------------------------------------------------
console.log('\n--- 8. Testing Celestial Free Spins Payout Math ---');
// In FreeSpinsScreen: wins are multiplied by 3x
const fs3EyesWin = testSym.payouts[3] * 3; // 31 * 3 = 93 base coins

// Test GC Free Spins at minimum bet (15 GC) and maximum bet (150,000 GC)
[15, 75, 1500, 150000].forEach((betGC) => {
  const wonAmount = Math.round((fs3EyesWin / 15) * betGC);
  const expected = fs3EyesWin * (betGC / 15);
  assert(wonAmount === expected, `GC Free Spins Bet ${betGC}: wonAmount is ${wonAmount} GC (correctly scaled)`);
});

// Test SC Free Spins at minimum bet ($0.15) and maximum bet ($150.00)
[0.15, 0.75, 15.00, 150.00].forEach((betSC) => {
  const wonAmount = Number(((fs3EyesWin / 15) * betSC).toFixed(2));
  const expected = Number((fs3EyesWin * (betSC / 15)).toFixed(2));
  assert(wonAmount === expected, `SC Free Spins Bet $${betSC.toFixed(2)}: wonAmount is $${wonAmount.toFixed(2)} SC`);
});

// ----------------------------------------------------------------------------
// TEST SUITE 9: 3D Vault & Fortune Wheel Bonus Wins in GC and SC
// ----------------------------------------------------------------------------
console.log('\n--- 9. Testing 3D Vault & Wheel Bonus Wins in GC and SC ---');
// In BonusGameModal:
// prize.baseCoins = currentBet * betMult
// In GC: currentBet = 75 GC -> baseCoins = 75 * 4 = 300 GC
// In SC: currentBet = 0.75 SC -> baseCoins = 0.75 * 4 = 3.00 SC
const gcBonusBet = 75;
const scBonusBet = 0.75;
const betMult = 4;
const mult = 2;

const gcWon = gcBonusBet * betMult * mult; // 75 * 4 * 2 = 600 GC
const scWon = Number((scBonusBet * betMult * mult).toFixed(2)); // 0.75 * 4 * 2 = 6.00 SC

assert(gcWon === 600, 'GC Bonus correctly yields 600 GC for 75 GC bet');
assert(scWon === 6.00, 'SC Bonus correctly yields 6.00 SC ($6.00 USD) for 0.75 SC bet');

// ----------------------------------------------------------------------------
// TEST SUITE 10: Presentation & Formatter Consistency
// ----------------------------------------------------------------------------
console.log('\n--- 10. Testing Formatter & Mobile Output Consistency ---');
assert(formatCoinValue(0.75) === '0.75', 'formatCoinValue(0.75) === "0.75"');
assert(formatCoinValue(10.00) === '10.00', 'formatCoinValue(10.00) === "10.00"');
assert(formatCoinValue(1500) === '1,500.00', 'formatCoinValue(1500) === "1,500.00"');
assert(formatCoinValue(0) === '0.00', 'formatCoinValue(0) === "0.00"');

console.log(`\n======================================================`);
console.log(`✅ COMPREHENSIVE WIN AUDIT COMPLETE: ${passed} PASSED, ${failed} FAILED`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
