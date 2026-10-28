// Monte Carlo Win Rate & RTP Simulation Suite for EgyptSlots
// Runs 100,000 full game spins evaluating the exact payline math, wild expansions,
// scatter payouts, free spins multipliers, and bonus meter mechanisms.

import {
  SYMBOLS,
  PAYLINES,
  FREE_SPINS_CONFIG,
  getWildSymbol,
  getExpandingSymbol,
  getBonusSymbol,
  BONUS_CONFIG,
} from '../src/config/slotConfig.js';

const COLS = 5;
const ROWS = 3;
const LINES = 15;
const BET_PER_SPIN = 15; // 15 lines x 1 coin

function pickWeightedSymbol(pool, excludeExpanding = false) {
  const filtered = excludeExpanding ? pool.filter((s) => !s.isExpanding) : pool;
  const totalWeight = filtered.reduce((acc, s) => acc + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sym of filtered) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return filtered[filtered.length - 1];
}

function generateSpinGrid() {
  const expSym = getExpandingSymbol();
  const grid = Array.from({ length: COLS }, () =>
    Array.from({ length: ROWS }, () => pickWeightedSymbol(SYMBOLS, true))
  );

  // 3.5% chance per middle column (1, 2, 3) to trigger 1x3 Expanding Wild Guardian
  for (let c = 1; c <= 3; c++) {
    if (Math.random() < 0.035) {
      grid[c] = [expSym, expSym, expSym];
    }
  }

  return grid;
}

function evaluateGridWins(finalGrid) {
  let totalCoinsWon = 0;
  let payingLinesCount = 0;

  // 1. Evaluate 15 Paylines Left-to-Right
  for (const line of PAYLINES) {
    const lineSymbols = line.rows.map((r, c) => finalGrid[c][r]);
    if (!lineSymbols[0] || lineSymbols[0].isBonus) continue;

    // A) Pure wild count
    let pureWildCount = 0;
    for (let c = 0; c < COLS; c++) {
      if (lineSymbols[c]?.isWild) pureWildCount++;
      else break;
    }
    const pureWildSym = lineSymbols[0];
    const pureWildWin = pureWildCount >= 3 ? pureWildSym.payouts?.[pureWildCount] || 0 : 0;

    // B) First regular symbol chain
    let firstRegularSym = null;
    for (let c = 0; c < COLS; c++) {
      const s = lineSymbols[c];
      if (!s || s.isBonus) break;
      if (!s.isWild) {
        firstRegularSym = s;
        break;
      }
    }

    let regMatchCount = 0;
    let hasDoublingWild = false;
    let regWin = 0;

    if (firstRegularSym) {
      for (let c = 0; c < COLS; c++) {
        const s = lineSymbols[c];
        if (!s || s.isBonus) break;
        if (s.id === firstRegularSym.id || s.isWild) {
          regMatchCount++;
          if (s.doublesLineWin || (s.isWild && !s.isExpanding)) {
            hasDoublingWild = true;
          }
        } else {
          break;
        }
      }
      if (regMatchCount >= 3) {
        const basePayout = firstRegularSym.payouts?.[regMatchCount] || 0;
        const wildMult = hasDoublingWild ? 2 : 1;
        regWin = basePayout * wildMult;
      }
    }

    const bestWin = Math.max(regWin, pureWildWin);
    if (bestWin > 0) {
      totalCoinsWon += bestWin;
      payingLinesCount++;
    }
  }

  // 2. Evaluate 3+ Bonus Scatters
  let bonusScatterCount = 0;
  let bonusSym = null;
  let meterCharges = 0;

  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const s = finalGrid[c][r];
      if (s?.isBonus) {
        bonusScatterCount++;
        bonusSym = s;
        meterCharges += 1;
      } else if (s?.isWild && !s?.isExpanding) {
        meterCharges += 1;
      }
    }
    if (finalGrid[c][0]?.isExpanding) {
      meterCharges += 1;
    }
  }

  let scatterWin = 0;
  if (bonusScatterCount >= 3 && bonusSym) {
    const capped = Math.min(5, bonusScatterCount);
    scatterWin = bonusSym.payouts?.[capped] || 75;
    totalCoinsWon += scatterWin;
  }

  return {
    totalCoinsWon,
    payingLinesCount,
    bonusScatterCount,
    scatterWin,
    meterCharges,
  };
}

// Evaluate Free Spins Bonus Round
function simulateFreeSpinsRound(initialSpins = 10) {
  let spinsLeft = initialSpins;
  let totalFreeSpinsAwarded = initialSpins;
  let totalBonusWon = 0;
  const multiplier = FREE_SPINS_CONFIG.winMultiplier || 3;
  const MAX_SESSION_SPINS = 30;

  while (spinsLeft > 0) {
    spinsLeft--;

    // Pick free spins grid
    const symbols = FREE_SPINS_CONFIG.symbols;
    const grid = Array.from({ length: COLS }, () =>
      Array.from({ length: ROWS }, () => pickWeightedSymbol(symbols))
    );

    // Paylines with 3x multiplier
    for (const line of PAYLINES) {
      const lineSymbols = line.rows.map((r, c) => grid[c][r]);
      if (!lineSymbols[0] || lineSymbols[0].isScatter) continue;

      let firstSym = null;
      for (let c = 0; c < COLS; c++) {
        const s = lineSymbols[c];
        if (!s || s.isScatter) break;
        if (!s.isWild) {
          firstSym = s;
          break;
        }
      }

      let matchCount = 0;
      if (firstSym) {
        for (let c = 0; c < COLS; c++) {
          const s = lineSymbols[c];
          if (!s || s.isScatter) break;
          if (s.id === firstSym.id || s.isWild) matchCount++;
          else break;
        }
      } else if (lineSymbols[0]?.isWild) {
        for (let c = 0; c < COLS; c++) {
          if (lineSymbols[c]?.isWild) matchCount++;
          else break;
        }
        firstSym = lineSymbols[0];
      }

      if (firstSym && matchCount >= 3) {
        const basePayout = firstSym.payouts?.[matchCount] || 0;
        totalBonusWon += basePayout * multiplier;
      }
    }

    // Retriggers (3+ Scatters)
    let scatters = 0;
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (grid[c][r]?.isScatter) scatters++;
      }
    }

    if (scatters >= 3) {
      const extra = scatters >= 4 ? 5 : 3;
      totalBonusWon += (scatters >= 4 ? 180 : 60) * multiplier;
      const canAward = Math.min(extra, MAX_SESSION_SPINS - totalFreeSpinsAwarded);
      if (canAward > 0) {
        spinsLeft += canAward;
        totalFreeSpinsAwarded += canAward;
      }
    } else if (scatters === 2) {
      totalBonusWon += 15 * multiplier;
    }
  }

  return {
    totalBonusWon,
    totalFreeSpinsAwarded,
  };
}

// Main Simulation Runner
function runSimulation(numSpins = 100000) {
  console.log(`\x1b[36m============================================================\x1b[0m`);
  console.log(`\x1b[33m🎲 STARTING MONTE CARLO WIN RATE & RTP SIMULATION (${numSpins.toLocaleString()} SPINS)\x1b[0m`);
  console.log(`\x1b[36m============================================================\x1b[0m`);

  let totalWagered = 0;
  let totalBaseWon = 0;
  let totalFreeSpinsWon = 0;
  let totalMeterBonusWon = 0;

  let totalWinsCount = 0; // Spins where win > 0
  let freeSpinsTriggersCount = 0;
  let meterBonusTriggersCount = 0;
  let maxSingleSpinWin = 0;

  // Distribution buckets (multiples of bet: 15 coins)
  const buckets = {
    loss: 0,          // 0x
    micro: 0,         // 0 < x < 1x
    small: 0,         // 1x <= x < 3x
    medium: 0,        // 3x <= x < 10x
    big: 0,           // 10x <= x < 25x
    super: 0,         // 25x <= x < 50x
    mega: 0,          // 50x <= x < 100x
    jackpot: 0,       // 100x+
  };

  let meterChargesAccum = 0;

  const startTime = Date.now();

  for (let i = 0; i < numSpins; i++) {
    totalWagered += BET_PER_SPIN;

    const grid = generateSpinGrid();
    const result = evaluateGridWins(grid);

    let spinWin = result.totalCoinsWon;
    totalBaseWon += spinWin;

    // Track Feature: 3+ Scatters triggers Free Spins
    if (result.bonusScatterCount >= 3) {
      freeSpinsTriggersCount++;
      const awardedSpins = result.bonusScatterCount >= 5 ? 15 : result.bonusScatterCount === 4 ? 12 : 10;
      const fsResult = simulateFreeSpinsRound(awardedSpins);
      totalFreeSpinsWon += fsResult.totalBonusWon;
      spinWin += fsResult.totalBonusWon;
    }

    // Track Feature: Meter Bonus (triggers when meterChargesAccum >= 36 and bonusScatterCount < 3)
    if (result.bonusScatterCount < 3) {
      meterChargesAccum += result.meterCharges;
      if (meterChargesAccum >= 36) {
        meterBonusTriggersCount++;
        meterChargesAccum = 0;
        // Vault/Wheel average win ~ 75-85 coins
        const bonusPrize = Math.floor(65 + Math.random() * 30);
        totalMeterBonusWon += bonusPrize;
        spinWin += bonusPrize;
      }
    }

    if (spinWin > 0) {
      totalWinsCount++;
    }

    if (spinWin > maxSingleSpinWin) {
      maxSingleSpinWin = spinWin;
    }

    // Win multiplier
    const multiplier = spinWin / BET_PER_SPIN;
    if (multiplier === 0) buckets.loss++;
    else if (multiplier < 1) buckets.micro++;
    else if (multiplier < 3) buckets.small++;
    else if (multiplier < 10) buckets.medium++;
    else if (multiplier < 25) buckets.big++;
    else if (multiplier < 50) buckets.super++;
    else if (multiplier < 100) buckets.mega++;
    else buckets.jackpot++;
  }

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const totalWonAll = totalBaseWon + totalFreeSpinsWon + totalMeterBonusWon;

  const overallRTP = ((totalWonAll / totalWagered) * 100).toFixed(2);
  const baseRTP = ((totalBaseWon / totalWagered) * 100).toFixed(2);
  const freeSpinsRTP = ((totalFreeSpinsWon / totalWagered) * 100).toFixed(2);
  const meterBonusRTP = ((totalMeterBonusWon / totalWagered) * 100).toFixed(2);
  const hitFrequency = ((totalWinsCount / numSpins) * 100).toFixed(2);

  console.log(`\n\x1b[32m✔ Simulation completed in ${elapsedSec}s!\x1b[0m\n`);

  console.log(`\x1b[1m=== CORE PERFORMANCE METRICS ===\x1b[0m`);
  console.log(`Total Spins Simulated : \x1b[33m${numSpins.toLocaleString()}\x1b[0m`);
  console.log(`Total Coins Wagered   : \x1b[37m${totalWagered.toLocaleString()} coins\x1b[0m`);
  console.log(`Total Coins Paid Out  : \x1b[32m${totalWonAll.toLocaleString()} coins\x1b[0m`);
  console.log(`------------------------------------------------------------`);
  console.log(`\x1b[1mOVERALL WIN RATE (Hit Rate) : \x1b[32m${hitFrequency}%\x1b[0m (1 in every ${(100 / hitFrequency).toFixed(2)} spins pays out)`);
  console.log(`\x1b[1mOVERALL RTP (Return to Player) : \x1b[32m${overallRTP}%\x1b[0m`);
  console.log(`   ├─ Base Game RTP     : ${baseRTP}%`);
  console.log(`   ├─ Free Spins RTP    : ${freeSpinsRTP}%`);
  console.log(`   └─ Bonus Meter RTP   : ${meterBonusRTP}%`);
  console.log(`------------------------------------------------------------`);

  console.log(`\n\x1b[1m=== BONUS FEATURE FREQUENCIES ===\x1b[0m`);
  console.log(`Free Spins Triggered  : ${freeSpinsTriggersCount.toLocaleString()} times (1 in every ${(numSpins / freeSpinsTriggersCount).toFixed(1)} spins)`);
  console.log(`Bonus Meter Triggered : ${meterBonusTriggersCount.toLocaleString()} times (1 in every ${(numSpins / meterBonusTriggersCount).toFixed(1)} spins)`);
  console.log(`Max Single Spin Payout: ${maxSingleSpinWin.toLocaleString()} coins (\x1b[33m${(maxSingleSpinWin / BET_PER_SPIN).toFixed(1)}× Bet\x1b[0m)`);

  console.log(`\n\x1b[1m=== WIN DISTRIBUTION BREAKDOWN ===\x1b[0m`);
  console.log(`  Loss (0×)          : ${(buckets.loss / numSpins * 100).toFixed(2)}% (${buckets.loss.toLocaleString()})`);
  console.log(`  Micro (<1×)        : ${(buckets.micro / numSpins * 100).toFixed(2)}% (${buckets.micro.toLocaleString()})`);
  console.log(`  Small (1× - 3×)    : ${(buckets.small / numSpins * 100).toFixed(2)}% (${buckets.small.toLocaleString()})`);
  console.log(`  Medium (3× - 10×)  : ${(buckets.medium / numSpins * 100).toFixed(2)}% (${buckets.medium.toLocaleString()})`);
  console.log(`  Big (10× - 25×)    : ${(buckets.big / numSpins * 100).toFixed(2)}% (${buckets.big.toLocaleString()})`);
  console.log(`  Super (25× - 50×)  : ${(buckets.super / numSpins * 100).toFixed(2)}% (${buckets.super.toLocaleString()})`);
  console.log(`  Mega (50× - 100×)  : ${(buckets.mega / numSpins * 100).toFixed(2)}% (${buckets.mega.toLocaleString()})`);
  console.log(`  Jackpot (100×+)    : ${(buckets.jackpot / numSpins * 100).toFixed(2)}% (${buckets.jackpot.toLocaleString()})`);
  console.log(`\x1b[36m============================================================\x1b[0m\n`);
}

runSimulation(100000);
