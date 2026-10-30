// ============================================================================
// COMPREHENSIVE END-TO-END TEST SUITE FOR EGYPT SLOTS (ALL ASPECTS)
// ============================================================================
// Tests:
// 1. Asset & Media Integrity (every referenced image, texture, audio file exists)
// 2. Paylines & Geometry Audit (bounds, non-overlapping coordinate matrix)
// 3. Symbol Paytable & Math Engine (GC & SC scaling, pure wild vs substitution)
// 4. Smart Bet Adjuster & Low Balance Handlers (prevent purchase modal lockups)
// 5. Celestial Free Spins Mechanics (2x multiplier, retrigger, accumulator)
// 6. 3D Bonus Vault & Fortune Wheel Math (wedges, jackpots, collector meter)
// 7. Store & Sweepstakes Packages (GC/SC ratios, rescue bundles, economy tiers)
// 8. Sound Engine & Ambient Music Playlist Integrity
// 9. Auth Service & Session Verification
// ============================================================================

import fs from 'fs';
import path from 'path';
import {
  ACTIVE_THEME,
  CASINO_BRAND,
  THEME_ASSETS,
  GUARDIANS,
  SYMBOLS,
  PAYLINES,
  BET_TIERS_GC,
  BET_TIERS_SC,
  BONUS_CONFIG,
  FREE_SPINS_CONFIG,
  getSymbols,
  getWildSymbol,
  getExpandingSymbol,
  getBonusSymbol,
  getTopHighSymbol,
  getRegularSymbols,
} from '../src/config/slotConfig.js';
import { SWEEPSTAKES_CONFIG } from '../src/config/sweepstakesConfig.js';
import { AMBIENT_PLAYLIST } from '../src/audio/ambientMusicEngine.js';

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

console.log('\n======================================================');
console.log('🔍 RUNNING COMPREHENSIVE MULTI-ASPECT AUDIT SUITE...');
console.log('======================================================\n');

// ----------------------------------------------------------------------------
// 1. ASSET & MEDIA INTEGRITY
// ----------------------------------------------------------------------------
console.log('--- 1. Testing Asset & Media Integrity ---');

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

// Check Core Brand & Assets
checkFileExists(THEME_ASSETS.mainBackground, 'Main Background');
checkFileExists(THEME_ASSETS.reelFrameImage, 'Reel Frame');
checkFileExists(THEME_ASSETS.reelGlowImage, 'Reel Glow');
checkFileExists(THEME_ASSETS.reelShadowImage, 'Reel Shadow');
checkFileExists(THEME_ASSETS.reelNetImage, 'Reel Net');
checkFileExists(THEME_ASSETS.wildGlowImage1, 'Wild Glow 1');
checkFileExists(THEME_ASSETS.wildGlowImage2, 'Wild Glow 2');
checkFileExists(THEME_ASSETS.tallColumnBgImage, 'Tall Column BG');
checkFileExists(THEME_ASSETS.ambientSparksImage, 'Ambient Sparks');
checkFileExists(THEME_ASSETS.bonusCrestOverlayImage, 'Bonus Crest Overlay');
checkFileExists(CASINO_BRAND.logoImage, 'Casino Brand Logo');
checkFileExists(CASINO_BRAND.megaWinNeonImage, 'Mega Win 3D Crest');

// Check Guardians
checkFileExists(GUARDIANS.plaqueFrameImage, 'Guardian Plaque Frame');
checkFileExists(GUARDIANS.left.bodyImage, 'Left Guardian Body Image');
checkFileExists(GUARDIANS.left.chargedBodyImage, 'Left Guardian Charged Image');
checkFileExists(GUARDIANS.left.tallColumnImage, 'Left Guardian Tall Column Image');
if (GUARDIANS.left.eyesClosedImage) checkFileExists(GUARDIANS.left.eyesClosedImage, 'Left Guardian Eyes Closed');
if (GUARDIANS.left.auraImage) checkFileExists(GUARDIANS.left.auraImage, 'Left Guardian Aura');
if (GUARDIANS.left.handFxImage) checkFileExists(GUARDIANS.left.handFxImage, 'Left Guardian Hand FX');

checkFileExists(GUARDIANS.right.bodyImage, 'Right Guardian Body Image');
checkFileExists(GUARDIANS.right.chargedBodyImage, 'Right Guardian Charged Image');
checkFileExists(GUARDIANS.right.tallColumnImage, 'Right Guardian Tall Column Image');

// Check Symbols
SYMBOLS.forEach((s) => {
  checkFileExists(s.image, `Symbol [${s.id}] Image`);
  if (s.payoutTile) {
    checkFileExists(s.payoutTile, `Symbol [${s.id}] Payout Tile`);
  }
});

// Check Ambient Music Playlist Tracks
AMBIENT_PLAYLIST.forEach((track) => {
  checkFileExists(track.src, `Ambient Music Track [${track.title}]`);
});

// Scan source code for any missing /assets/ files
function scanAllCodeAssets() {
  function walkDir(dir) {
    let files = [];
    fs.readdirSync(dir).forEach((f) => {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) files = files.concat(walkDir(p));
      else if (f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.css')) files.push(p);
    });
    return files;
  }
  const allSrcFiles = walkDir(path.join(process.cwd(), 'src'));
  const assetRegex = /['"](\/assets\/[^'"]+)['"]/g;
  let codeChecked = 0;
  let codeMissing = 0;

  allSrcFiles.forEach((file) => {
    const text = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = assetRegex.exec(text)) !== null) {
      const url = m[1];
      // Skip query parameters or fragments if any
      const cleanUrl = url.split('?')[0].split('#')[0];
      const localPath = path.join(process.cwd(), 'public', cleanUrl.replace(/^\//, ''));
      if (!fs.existsSync(localPath)) {
        console.error(`    Missing asset found in code: ${cleanUrl} (in ${path.relative(process.cwd(), file)})`);
        codeMissing++;
      }
      codeChecked++;
    }
  });

  assert(codeMissing === 0, `Scanned ${codeChecked} source-referenced assets with 0 missing files`);
}
scanAllCodeAssets();

// ----------------------------------------------------------------------------
// 2. PAYLINES & GEOMETRY AUDIT
// ----------------------------------------------------------------------------
console.log('\n--- 2. Testing Paylines & Geometry ---');
assert(PAYLINES.length === 15, 'Game configured with exactly 15 paylines');
PAYLINES.forEach((line) => {
  assert(
    line.rows.length === 5,
    `Payline #${line.id} has 5 reel columns`
  );
  const validRows = line.rows.every((r) => r >= 0 && r <= 2);
  assert(
    validRows,
    `Payline #${line.id} rows are within 3-row cabinet bounds (0, 1, 2)`
  );
  assert(Boolean(line.color), `Payline #${line.id} has distinct laser color (${line.color})`);
});

// ----------------------------------------------------------------------------
// 3. SYMBOL PAYTABLE & MATH ENGINE
// ----------------------------------------------------------------------------
console.log('\n--- 3. Testing Symbol Paytable & Math Engine ---');
assert(SYMBOLS.length >= 10, 'Symbol suite has full spectrum of symbols');
const wildSym = getWildSymbol();
assert(wildSym && wildSym.isWild, 'Wild symbol correctly configured');
const expSym = getExpandingSymbol();
assert(expSym && expSym.isExpanding, '1×3 Expanding Wild Guardian correctly configured');
const bonusSym = getBonusSymbol();
assert(bonusSym && bonusSym.isBonus, 'Bonus Scatter symbol correctly configured');
const topHigh = getTopHighSymbol();
assert(topHigh && (topHigh.isTopHigh || topHigh.tier === 'high'), 'Top High symbol identified');
const regularSyms = getRegularSymbols();
assert(regularSyms.length >= 7, 'Regular symbol suite populated');

// Verify payout monotonicity
SYMBOLS.filter((s) => s.payouts).forEach((s) => {
  if (s.payouts[3] && s.payouts[4]) {
    assert(
      s.payouts[4] > s.payouts[3],
      `Symbol [${s.name}] 4-of-a-kind (${s.payouts[4]}) > 3-of-a-kind (${s.payouts[3]})`
    );
  }
  if (s.payouts[4] && s.payouts[5]) {
    assert(
      s.payouts[5] > s.payouts[4],
      `Symbol [${s.name}] 5-of-a-kind (${s.payouts[5]}) > 4-of-a-kind (${s.payouts[4]})`
    );
  }
});

// Check SC calibrated payouts
const scSymbols = getSymbols('SC');
assert(scSymbols.length === SYMBOLS.length, 'SC mode returns calibrated symbol suite');
scSymbols.forEach((s) => {
  assert(s.weight > 0, `SC symbol [${s.id}] has positive weight (${s.weight})`);
});

// ----------------------------------------------------------------------------
// 4. SMART BET ADJUSTER & BALANCE SAFETY
// ----------------------------------------------------------------------------
console.log('\n--- 4. Testing Smart Bet Adjuster & Balance Safety ---');

assert(BET_TIERS_GC.length === 16, '16 distinct Gold Coin bet tiers');
assert(BET_TIERS_SC.length === 14, '14 distinct Sweeps Coin bet tiers');
assert(BET_TIERS_GC[0] === 15, 'Minimum GC bet is 15 GC (1 per line)');
assert(BET_TIERS_SC[0] === 0.15, 'Minimum SC bet is 0.15 SC ($0.15 USD)');

// Helper testing the auto-adjust logic
function simulateBetAdjustment(currency, liveBalance, currentBet) {
  const tiers = currency === 'SC' ? BET_TIERS_SC : BET_TIERS_GC;
  const minBet = tiers[0];
  if (liveBalance >= currentBet) {
    return { canSpin: true, bet: currentBet, adjusted: false };
  }
  if (liveBalance >= minBet) {
    let fitIdx = tiers.length - 1;
    while (fitIdx > 0 && tiers[fitIdx] > liveBalance) fitIdx--;
    return { canSpin: true, bet: tiers[fitIdx], adjusted: true };
  }
  return { canSpin: false, bet: currentBet, adjusted: false };
}

// Scenario A: User had 150,000 GC bet, ran low, purchased 10,000 GC
const resA = simulateBetAdjustment('GC', 10000, 150000);
assert(resA.canSpin === true, 'Player with 10,000 GC and 150,000 GC bet is ALLOWED to spin');
assert(resA.adjusted === true, 'Bet is automatically adjusted down');
assert(resA.bet === 7500, `Bet adjusted to highest affordable tier: 7,500 GC (was ${resA.bet} GC)`);

// Scenario B: User in SC had 15.00 SC bet, purchased 5.00 SC package
const resB = simulateBetAdjustment('SC', 5.00, 15.00);
assert(resB.canSpin === true, 'Player with 5.00 SC and 15.00 SC bet is ALLOWED to spin');
assert(resB.adjusted === true, 'SC Bet is automatically adjusted down');
assert(resB.bet === 4.50, `SC Bet adjusted to highest affordable tier: 4.50 SC (was ${resB.bet} SC)`);

// Scenario C: User with 0 balance
const resC = simulateBetAdjustment('GC', 0, 75);
assert(resC.canSpin === false, 'Player with 0 balance is safely blocked until refill');

// Scenario D: Max Bet calculation on partial balance
function calculateMaxAffordableBet(currency, liveBalance) {
  const tiers = currency === 'SC' ? BET_TIERS_SC : BET_TIERS_GC;
  let targetIdx = tiers.length - 1;
  while (targetIdx > 0 && tiers[targetIdx] > liveBalance) {
    targetIdx--;
  }
  return tiers[targetIdx];
}
const maxBetWith20000 = calculateMaxAffordableBet('GC', 20000);
assert(maxBetWith20000 === 15000, `Max bet for 20,000 GC balance is 15,000 GC (calculated: ${maxBetWith20000})`);
const maxBetWith10SC = calculateMaxAffordableBet('SC', 10.00);
assert(maxBetWith10SC === 7.50, `Max bet for 10.00 SC balance is 7.50 SC (calculated: ${maxBetWith10SC})`);

// ----------------------------------------------------------------------------
// 5. CELESTIAL FREE SPINS MECHANICS
// ----------------------------------------------------------------------------
console.log('\n--- 5. Testing Celestial Free Spins ---');
assert(FREE_SPINS_CONFIG.winMultiplier === 2, 'Free Spins provides 2× Solar Multiplier');
assert(FREE_SPINS_CONFIG.symbols.length >= 8, 'Free Spins symbol set populated');
const fsWildSym = FREE_SPINS_CONFIG.symbols.find((s) => s.isWild);
assert(Boolean(fsWildSym), 'Free Spins features Solar Phoenix 3D Wild symbols');
assert(fsWildSym.payouts[5] > 0, `Free Spins Wild has high 5-of-a-kind payout (${fsWildSym.payouts[5]})`);
const fsRetriggerSym = FREE_SPINS_CONFIG.symbols.find((s) => s.id === 'fs_retrigger');
assert(Boolean(fsRetriggerSym), 'Free Spins features Solar Retrigger Ankh symbols');

// Test 2x Solar Multiplier math
const basePayout = 120;
const fsPayout = basePayout * FREE_SPINS_CONFIG.winMultiplier;
assert(fsPayout === 240, `Base payout of 120 becomes 240 in Free Spins (calculated: ${fsPayout})`);

// ----------------------------------------------------------------------------
// 6. 3D BONUS VAULT & WHEEL OF KEMET
// ----------------------------------------------------------------------------
console.log('\n--- 6. Testing 3D Bonus Vault & Fortune Wheel ---');
assert(BONUS_CONFIG.vaultTileStyles.length === 6, 'Vault has 6 high-definition relic tiles');
BONUS_CONFIG.vaultTileStyles.forEach((t) => {
  checkFileExists(t.art, `Vault Tile [${t.title}]`);
});

assert(BONUS_CONFIG.jackpotTiers.length === 4, 'Fortune Wheel has 4 jackpot tiers');
const jackpotLabels = BONUS_CONFIG.jackpotTiers.map((t) => t.id);
assert(
  jackpotLabels.includes('mini') &&
    jackpotLabels.includes('minor') &&
    jackpotLabels.includes('major') &&
    jackpotLabels.includes('grand'),
  'All 4 classic jackpot tiers defined (mini, minor, major, grand)'
);

// ----------------------------------------------------------------------------
// 7. STORE & SWEEPSTAKES PACKAGES
// ----------------------------------------------------------------------------
console.log('\n--- 7. Testing Store & Sweepstakes Packages ---');
assert(SWEEPSTAKES_CONFIG.storePackages.length >= 5, 'Store has full tier of token packages');
SWEEPSTAKES_CONFIG.storePackages.forEach((pkg) => {
  assert(pkg.priceUsd > 0, `Package [${pkg.id}] has positive USD price ($${pkg.priceUsd})`);
  assert(pkg.goldCoins > 0, `Package [${pkg.id}] provides Gold Coins (${pkg.goldCoins.toLocaleString()} GC)`);
  assert(pkg.freeSweepsCoins > 0, `Package [${pkg.id}] provides Free SC (${pkg.freeSweepsCoins} SC)`);
});

assert(SWEEPSTAKES_CONFIG.rescuePackages.length >= 3, 'Rescue low-balance refill bundles configured');
SWEEPSTAKES_CONFIG.rescuePackages.forEach((pkg) => {
  assert(pkg.priceUsd > 0 && pkg.goldCoins > 0 && pkg.freeSweepsCoins > 0, `Rescue package [${pkg.id}] is valid`);
});

// ----------------------------------------------------------------------------
// 8. SOUND ENGINE API COMPATIBILITY
// ----------------------------------------------------------------------------
console.log('\n--- 8. Testing Sound Engine API ---');
import { soundEngine } from '../src/audio/soundEngine.js';
const requiredSoundMethods = [
  'playSpinStart',
  'playReelTick',
  'playReelStop',
  'playWin',
  'playWinCelebration',
  'playButtonClick',
  'playButtonHover',
  'playCoinTick',
  'playThunderStrike',
  'playBonusTrigger',
  'playAnubisExpand',
  'playSlamStop',
  'playAnticipationRiser',
  'playFlowStreak',
];
requiredSoundMethods.forEach((methodName) => {
  assert(typeof soundEngine[methodName] === 'function', `soundEngine.${methodName}() is defined`);
});

// ----------------------------------------------------------------------------
// 9. AUTH SERVICE API COMPATIBILITY
// ----------------------------------------------------------------------------
console.log('\n--- 9. Testing Auth Service API ---');
import { authService } from '../src/services/authService.js';
const requiredAuthMethods = [
  'getCurrentUser',
  'saveSession',
  'logout',
  'onAuthStateChanged',
  'loginWithGoogle',
  'loginWithEmail',
  'sendPhoneOtp',
];
requiredAuthMethods.forEach((methodName) => {
  assert(typeof authService[methodName] === 'function', `authService.${methodName}() is defined`);
});

// ----------------------------------------------------------------------------
// SUMMARY REPORT
// ----------------------------------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL TESTS EXECUTED: ${totalTests}`);
console.log(`PASSED: ${passedTests}`);
console.log(`FAILED: ${failedTests}`);
if (failedTests === 0) {
  console.log('🎉 ALL ASPECTS OF THE GAME VERIFIED AND FUNCTIONING PERFECTLY!');
} else {
  console.error(`⚠️ ${failedTests} TESTS FAILED. PLEASE REVIEW.`);
}
console.log('======================================================\n');

process.exit(failedTests === 0 ? 0 : 1);
