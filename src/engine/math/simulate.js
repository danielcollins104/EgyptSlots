// ============================================================================
// HIGH-SPEED MONTE CARLO SIMULATION CLI TOOL (`src/engine/math/simulate.js`)
// ============================================================================
// Phase 1 — Math Core:
// Executes automated millions of spins to mathematically verify:
// 1. RTP (Return to Player %)
// 2. Volatility (Standard Deviation & Variance)
// 3. Hit Frequency & LDW (Losses-Disguised-as-Wins) distribution
// 4. Near-Miss frequency
//
// Usage:
//   node src/engine/math/simulate.js [numSpins] [betLevel]
// Example:
//   node src/engine/math/simulate.js 500000 1
// ============================================================================

import { SlotMathEngine } from './SlotMathEngine.js';
import { WIN_CATEGORIES } from './paytableConfig.js';

function runSimulation(numSpins = 250000, betLevel = 1) {
  const engine = new SlotMathEngine();
  const startTime = performance.now();

  let totalWagered = 0;
  let totalReturned = 0;
  let totalLineWins = 0;
  let totalScatterWins = 0;
  let totalHits = 0;
  let totalLDWHits = 0;
  let totalCleanWins = 0;
  let totalNearMisses = 0;
  let totalBonusTriggers = 0;
  let maxSingleWin = 0;

  const categoryCounts = {
    [WIN_CATEGORIES.LOSS]: 0,
    [WIN_CATEGORIES.LDW]: 0,
    [WIN_CATEGORIES.WIN_SMALL]: 0,
    [WIN_CATEGORIES.WIN_MEDIUM]: 0,
    [WIN_CATEGORIES.WIN_BIG]: 0,
    [WIN_CATEGORIES.WIN_MEGA]: 0,
  };

  // For Variance / Standard Deviation calculation
  const payoutRatios = new Float32Array(Math.min(numSpins, 1000000));

  for (let i = 0; i < numSpins; i++) {
    const outcome = engine.spin(betLevel);

    totalWagered += outcome.totalBet;
    totalReturned += outcome.totalWin;
    totalLineWins += outcome.lineWinsTotal;
    totalScatterWins += outcome.scatterWin;

    categoryCounts[outcome.winCategory]++;

    if (outcome.isWin) {
      totalHits++;
    }
    if (outcome.isLDW) {
      totalLDWHits++;
    } else if (outcome.isNetWin) {
      totalCleanWins++;
    }

    if (outcome.nearMiss.isNearMiss) {
      totalNearMisses++;
    }
    if (outcome.isBonusTriggered) {
      totalBonusTriggers++;
    }

    if (outcome.totalWin > maxSingleWin) {
      maxSingleWin = outcome.totalWin;
    }

    if (i < payoutRatios.length) {
      payoutRatios[i] = outcome.payoutRatio;
    }
  }

  const durationMs = performance.now() - startTime;
  const spinsPerSec = Math.round((numSpins / durationMs) * 1000);

  // Volatility Calculation (Mean, Variance, StdDev)
  const meanPayoutRatio = totalReturned / totalWagered;
  let varianceSum = 0;
  const sampleCount = Math.min(numSpins, payoutRatios.length);
  for (let i = 0; i < sampleCount; i++) {
    const diff = payoutRatios[i] - meanPayoutRatio;
    varianceSum += diff * diff;
  }
  const variance = varianceSum / sampleCount;
  const stdDev = Math.sqrt(variance);

  // 95% Confidence Interval for RTP
  const standardError = stdDev / Math.sqrt(numSpins);
  const ci95Lower = (meanPayoutRatio - 1.96 * standardError) * 100;
  const ci95Upper = (meanPayoutRatio + 1.96 * standardError) * 100;

  console.log('\n================================================================');
  console.log('🎰 DC ENTERPRISES CASINO — MATHEMATICAL VERIFICATION REPORT');
  console.log('   Phase 1 Math Core Monte Carlo Simulation');
  console.log('================================================================');
  console.log(`Executed Spins:        ${numSpins.toLocaleString()}`);
  console.log(`Bet Level:             Level ${betLevel} (Bet per spin: ${15 * betLevel} credits)`);
  console.log(`Execution Time:        ${durationMs.toFixed(1)} ms (${spinsPerSec.toLocaleString()} spins/sec)`);
  console.log('----------------------------------------------------------------');
  console.log('💰 RETURN TO PLAYER (RTP):');
  console.log(`   Total Wagered:      ${totalWagered.toLocaleString()} credits`);
  console.log(`   Total Returned:     ${totalReturned.toLocaleString()} credits`);
  console.log(`   REALIZED BASE RTP:  ${((totalReturned / totalWagered) * 100).toFixed(2)}%`);
  console.log(`   ├─ Line Wins RTP:   ${((totalLineWins / totalWagered) * 100).toFixed(2)}%`);
  console.log(`   └─ Scatter RTP:     ${((totalScatterWins / totalWagered) * 100).toFixed(2)}%`);
  console.log(`   95% Conf. Interval: [${ci95Lower.toFixed(2)}% — ${ci95Upper.toFixed(2)}%]`);
  console.log('----------------------------------------------------------------');
  console.log('📊 VOLATILITY & DISPERSION:');
  console.log(`   Variance (σ²):      ${variance.toFixed(3)}`);
  console.log(`   Std Dev (σ):        ${stdDev.toFixed(3)} (Medium-High Volatility)`);
  console.log(`   Max Single Hit:     ${maxSingleWin.toLocaleString()} credits (${(maxSingleWin / (15 * betLevel)).toFixed(1)}× bet)`);
  console.log('----------------------------------------------------------------');
  console.log('🎯 HIT FREQUENCIES & LDW (LOSSES-DISGUISED-AS-WINS):');
  console.log(`   Total Hit Freq:     ${((totalHits / numSpins) * 100).toFixed(2)}% (1 in ${(numSpins / totalHits).toFixed(1)} spins)`);
  console.log(`   ├─ Clean Net Wins:  ${((totalCleanWins / numSpins) * 100).toFixed(2)}% (>= 1.0× bet)`);
  console.log(`   └─ LDW (Sub-Bet):   ${((totalLDWHits / numSpins) * 100).toFixed(2)}% (${((totalLDWHits / totalHits) * 100).toFixed(1)}% of all hits)`);
  console.log('----------------------------------------------------------------');
  console.log('🔍 NEAR-MISSES & BONUS TRIGGERS:');
  console.log(`   Near-Miss Rate:     ${((totalNearMisses / numSpins) * 100).toFixed(2)}% (${totalNearMisses.toLocaleString()} occurrences)`);
  console.log(`   Bonus Trigger Rate: ${((totalBonusTriggers / numSpins) * 100).toFixed(2)}% (1 in ${Math.round(numSpins / (totalBonusTriggers || 1))} spins)`);
  console.log('----------------------------------------------------------------');
  console.log('🏆 OUTCOME TIERS BREAKDOWN:');
  console.log(`   LOSS (0 win):       ${categoryCounts[WIN_CATEGORIES.LOSS].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.LOSS] / numSpins) * 100).toFixed(2)}%)`);
  console.log(`   LDW (< 1× bet):     ${categoryCounts[WIN_CATEGORIES.LDW].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.LDW] / numSpins) * 100).toFixed(2)}%)`);
  console.log(`   SMALL (1×-2×):      ${categoryCounts[WIN_CATEGORIES.WIN_SMALL].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.WIN_SMALL] / numSpins) * 100).toFixed(2)}%)`);
  console.log(`   MEDIUM (2×-10×):    ${categoryCounts[WIN_CATEGORIES.WIN_MEDIUM].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.WIN_MEDIUM] / numSpins) * 100).toFixed(2)}%)`);
  console.log(`   BIG (10×-25×):      ${categoryCounts[WIN_CATEGORIES.WIN_BIG].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.WIN_BIG] / numSpins) * 100).toFixed(2)}%)`);
  console.log(`   MEGA (>= 25×):      ${categoryCounts[WIN_CATEGORIES.WIN_MEGA].toLocaleString()} (${((categoryCounts[WIN_CATEGORIES.WIN_MEGA] / numSpins) * 100).toFixed(2)}%)`);
  console.log('================================================================\n');

  return {
    numSpins,
    rtp: (totalReturned / totalWagered) * 100,
    hitFrequency: (totalHits / numSpins) * 100,
    ldwFrequency: (totalLDWHits / numSpins) * 100,
    variance,
    stdDev,
  };
}

const args = process.argv.slice(2);
const spinCount = args[0] ? parseInt(args[0], 10) : 250000;
const betLvl = args[1] ? parseInt(args[1], 10) : 1;

runSimulation(spinCount, betLvl);
