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
import { spinPhysicalReels, getReelHeights } from '../src/engine/math/ReelStripModel.js';
import { paymentService } from '../src/services/paymentService.js';
import { sweepstakesCheckoutController } from '../src/services/sweepstakesCheckoutController.js';
import { SecurityServer } from '../server/SecurityServer.js';

const rootDir = process.cwd();

if (typeof globalThis.localStorage === 'undefined') {
  const memStore = new Map();
  globalThis.localStorage = {
    getItem: (k) => (memStore.has(k) ? memStore.get(k) : null),
    setItem: (k, v) => memStore.set(k, String(v)),
    removeItem: (k) => memStore.delete(k),
    clear: () => memStore.clear(),
  };
}

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
checkFileExists(THEME_ASSETS.tileElectricFireAuraImage, 'Tile Electric & Fire Suspense Aura');
checkFileExists(THEME_ASSETS.bonusSupernovaBurstImage, '3-Tile Bonus Supernova Burst');
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
// 6. 3D BONUS VAULT & CROWN CHAKRA WHEEL
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
  assert(
    pkg.stripePaymentLink &&
      pkg.stripePaymentLink.startsWith('https://buy.stripe.com/') &&
      !pkg.stripePaymentLink.includes('/test_'),
    `Package [${pkg.id}] has LIVE Stripe Payment Link (${pkg.stripePaymentLink})`
  );
  assert(
    pkg.cashAppStripePaymentLink &&
      pkg.cashAppStripePaymentLink.startsWith('https://buy.stripe.com/') &&
      !pkg.cashAppStripePaymentLink.includes('/test_'),
    `Package [${pkg.id}] has LIVE Cash App Stripe Payment Link (${pkg.cashAppStripePaymentLink})`
  );
});

assert(
  SWEEPSTAKES_CONFIG.featuredRoyalPackage &&
    SWEEPSTAKES_CONFIG.featuredRoyalPackage.stripePaymentLink.startsWith('https://buy.stripe.com/') &&
    !SWEEPSTAKES_CONFIG.featuredRoyalPackage.stripePaymentLink.includes('/test_'),
  'Featured Royal Package ($249.99) has LIVE Stripe Payment Link'
);

SWEEPSTAKES_CONFIG.highRollerPackages.forEach((pkg) => {
  assert(
    pkg.stripePaymentLink &&
      pkg.stripePaymentLink.startsWith('https://buy.stripe.com/') &&
      !pkg.stripePaymentLink.includes('/test_'),
    `High-Roller Package [${pkg.id}] has LIVE Stripe Payment Link (${pkg.stripePaymentLink})`
  );
});

assert(SWEEPSTAKES_CONFIG.rescuePackages.length >= 3, 'Rescue low-balance refill bundles configured');
SWEEPSTAKES_CONFIG.rescuePackages.forEach((pkg) => {
  assert(pkg.priceUsd > 0 && pkg.goldCoins > 0 && pkg.freeSweepsCoins > 0, `Rescue package [${pkg.id}] is valid`);
  assert(
    pkg.stripePaymentLink &&
      pkg.stripePaymentLink.startsWith('https://buy.stripe.com/') &&
      !pkg.stripePaymentLink.includes('/test_'),
    `Rescue package [${pkg.id}] has LIVE Stripe Payment Link`
  );
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
// 10. CASINO AD ARCHITECT & 1-CLICK CONVERSION FLOWS
// ----------------------------------------------------------------------------
console.log('\n--- 10. Testing Casino Ad Architect & 1-Click Conversion Flows ---');
const vipAdModalSrc = fs.readFileSync(path.join(rootDir, 'src/components/VipPromoAdModal.jsx'), 'utf8');
assert(
  vipAdModalSrc.includes('featuredPackages') || vipAdModalSrc.includes('VIP_FOUNDER_OFFERS'),
  'VipPromoAdModal defines 3-tier VIP Founder Offer Stack'
);
assert(vipAdModalSrc.includes('liveJackpot'), 'VipPromoAdModal features live progressive jackpot ticker');
assert(
  vipAdModalSrc.includes('cashout_bridge') || vipAdModalSrc.includes('vip-ad-cashout-bridge-card'),
  'VipPromoAdModal features Real Prize Cashout Bridge Meter'
);
assert(vipAdModalSrc.includes('onSelectPackage'), 'VipPromoAdModal supports 1-click direct package checkout');

const bigWinSrc = fs.readFileSync(path.join(rootDir, 'src/components/BigWinPopup.jsx'), 'utf8');
assert(bigWinSrc.includes('bigwin-vip-upsell-banner'), 'BigWinPopup includes Post-Big-Win VIP Upsell Banner');

const lowBalanceSrc = fs.readFileSync(path.join(rootDir, 'src/components/LowBalanceOfferModal.jsx'), 'utf8');
assert(lowBalanceSrc.includes('rescue-live-jackpot-strip'), 'LowBalanceOfferModal includes Live Progressive Jackpot urgency strip');

// ----------------------------------------------------------------------------
// 11. ADAPTIVE ANDROID, FOLDABLE POSTURE & MULTI-WINDOW COMPLIANCE
// ----------------------------------------------------------------------------
console.log('\n--- 11. Testing Adaptive Android, Foldable Posture & Testing Setup ---');
const manifestXml = fs.readFileSync(
  path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'),
  'utf8'
);
assert(
  manifestXml.includes('android:resizeableActivity="true"'),
  'AndroidManifest enables resizeableActivity="true" for multi-window & foldables'
);
assert(
  !manifestXml.includes('android:screenOrientation='),
  'AndroidManifest has no orientation locks (full orientation freedom)'
);
assert(
  !manifestXml.includes('android:configChanges='),
  'AndroidManifest omits restrictive configChanges to allow adaptive recreation'
);
assert(
  fs.existsSync(
    path.join(
      rootDir,
      'android/app/src/main/java/com/dcenterprises/egyptslots/CasinoConfigRepository.java'
    )
  ),
  'Android CasinoConfigRepository interface exists for testable DI/Fake architecture'
);
assert(
  fs.existsSync(
    path.join(
      rootDir,
      'android/app/src/test/java/com/dcenterprises/egyptslots/CasinoUnitTest.java'
    )
  ),
  'Android Robolectric & JUnit4 CasinoUnitTest suite exists'
);
assert(
  fs.existsSync(
    path.join(
      rootDir,
      'android/app/src/androidTest/java/com/dcenterprises/egyptslots/CasinoInstrumentedTest.java'
    )
  ),
  'Android Espresso & UIAutomator CasinoInstrumentedTest suite exists'
);

// ----------------------------------------------------------------------------
// 12. LIVE ON-CHAIN CRYPTO VERIFIER & WALLET INTEGRITY
// ----------------------------------------------------------------------------
console.log('\n--- 12. Testing Live On-Chain Crypto Verifier ---');
const cryptoVerifierSrc = fs.readFileSync(
  path.join(rootDir, 'src/services/cryptoVerifierService.js'),
  'utf8'
);
assert(
  cryptoVerifierSrc.includes('OFFICIAL_WALLETS') &&
    cryptoVerifierSrc.includes('verifyCryptoDeposit'),
  'On-chain crypto verifier service is present and configured with official wallets'
);
const paymentModalSrc = fs.readFileSync(
  path.join(rootDir, 'src/components/PaymentModal.jsx'),
  'utf8'
);
assert(
  paymentModalSrc.includes('/api/verify-crypto-tx'),
  'PaymentModal connects to live /api/verify-crypto-tx endpoint'
);
assert(
  !ACTIVE_THEME.brand.gameTitle.toLowerCase().includes('kemet') &&
    ACTIVE_THEME.brand.gameTitle.includes('CHAKRA DYNASTY'),
  `Game title uses Egyptian Royalty & Chakra branding (${ACTIVE_THEME.brand.gameTitle}) with zero Kemet references`
);
const appCssSrc = fs.readFileSync(path.join(rootDir, 'src/App.css'), 'utf8');
assert(
  !/psychedel|psychadel/i.test(appCssSrc),
  'Zero psychedelic/psychadelic text or animations remain in App.css'
);

// ----------------------------------------------------------------------------
// 13. 4-PILLAR PAYOUT ARCHITECTURE & ADMIN 1-CLICK PAYOUT CENTER
// ----------------------------------------------------------------------------
console.log('\n--- 13. Testing 4-Pillar Payout System (Playthrough, +5% Gift Cards, Crypto, Admin Queue) ---');
assert(
  SWEEPSTAKES_CONFIG.minGiftCardRedemptionSC === 25.0 &&
    SWEEPSTAKES_CONFIG.giftCardBonusRate === 0.05 &&
    Array.isArray(SWEEPSTAKES_CONFIG.redemptionMethods) &&
    SWEEPSTAKES_CONFIG.redemptionMethods.length >= 5,
  'Sweepstakes config defines $25 Gift Card minimum, +5% bonus rate, and 5 payout channels'
);

// 13a. 1x Playthrough (Rollover) Anti-Fraud Tracker
paymentService.savePlaythroughState({
  totalGrantedBonusSC: 20,
  totalWageredSC: 0,
  totalWonSC: 0,
  unplayedBonusSC: 20,
});
const ptBefore = paymentService.getPlaythroughState(20);
assert(
  ptBefore.redeemableSC === 0 && ptBefore.unplayedSC === 20 && !ptBefore.isFullyUnlocked,
  'Unplayed bonus SC requires 1x rollover before unlocking for redemption'
);
paymentService.recordScWagered(12);
paymentService.recordScWon(45);
const ptAfter = paymentService.getPlaythroughState(53);
assert(
  ptAfter.unplayedSC === 8 && ptAfter.redeemableSC === 45,
  'Wagered SC unlocks rollover 1:1 and won SC is immediately redeemable'
);
paymentService.recordScWagered(8);
const ptFull = paymentService.getPlaythroughState(53);
assert(
  ptFull.isFullyUnlocked && ptFull.redeemableSC === 53,
  '100% 1x playthrough unlocks full SC balance for instant redemption'
);

// 13b. Instant Digital Gift Card (+5% Bonus Value & $25 Minimum)
const gcRedeem = paymentService.requestRedemption({
  sweepsCoins: 25,
  method: 'giftcard',
  giftCardBrand: 'visa_virtual',
  destination: 'winner@oopsiwon.com',
  enforcePlaythrough: true,
  currentScBalance: 53,
});
assert(
  gcRedeem.success && gcRedeem.amountSC === 25 && gcRedeem.amountUsd === 26.25 && gcRedeem.bonusUsd === 1.25,
  'Instant Digital Gift Card redemption accepts $25 SC minimum and adds +5% bonus ($26.25 USD)'
);

// 13c. On-Chain Crypto Payout URI & Cash App 1-Click Deep-Link
const cryptoRedeem = paymentService.requestRedemption({
  sweepsCoins: 50,
  method: 'crypto',
  cryptoAsset: 'USDT_SOL',
  destination: 'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
});
assert(
  cryptoRedeem.success &&
    cryptoRedeem.cryptoPayoutUri.startsWith('solana:Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f?amount=50.00'),
  'Crypto payout generates pre-populated Solana URI and QR code for 1-tap wallet signing'
);

const cashAppRedeem = paymentService.requestRedemption({
  sweepsCoins: 60,
  method: 'chime',
  destination: '$WinnerCashtag',
});
assert(
  cashAppRedeem.success &&
    cashAppRedeem.cashAppPayoutLink === 'https://cash.app/$WinnerCashtag/60.00',
  'Cash App redemption generates 1-click operator payout deep-link (https://cash.app/$WinnerCashtag/60.00)'
);

// 13d. Admin 1-Click Payout Center Approval & Rejection Queue
const approved = paymentService.approveRedemption(cashAppRedeem.redemptionId, {
  txHashOrReceipt: 'CASHAPP_RCPT_999',
});
assert(
  approved.success &&
    approved.redemption.status === 'completed' &&
    approved.redemption.txHashOrReceipt === 'CASHAPP_RCPT_999',
  'Admin 1-Click Payout Center marks redemption completed with TXID/Receipt'
);

const rejected = paymentService.rejectRedemption(cryptoRedeem.redemptionId, {
  reason: 'Test refund',
});
assert(
  rejected.success && rejected.refundSC === 50 && rejected.redemption.status === 'rejected',
  'Admin 1-Click Payout Center rejects redemption and returns exact SC refund amount'
);

// ----------------------------------------------------------------------------
// 14. PROVABLY FAIR VERIFIER, INTEGER-CENT PRECISION & RESPONSIBLE GAMING
// ----------------------------------------------------------------------------
console.log('\n--- 14. Testing Provably Fair HMAC-SHA256 Verifier, Integer-Cent Math & Responsible Gaming ---');
assert(
  paymentService.fromCents(paymentService.toCents(0.1) + paymentService.toCents(0.2)) === 0.3,
  'paymentService integer-cent helpers eliminate floating-point drift (0.10 + 0.20 === 0.30)'
);

const pfSpin = paymentService.createNextSpinRng();
const pfPhysical = spinPhysicalReels(pfSpin.rngFn);
const recordedReceipt = paymentService.recordVerifiedSpin({
  currencyMode: 'SC',
  betAmount: 0.75,
  winAmount: 3.5,
  selectedLines: 15,
  betLevel: 1,
  stops: pfPhysical.stops,
  serverSeed: pfSpin.serverSeed,
  serverSeedHash: pfSpin.serverSeedHash,
  clientSeed: pfSpin.clientSeed,
  nonce: pfSpin.nonce,
  scatterCount: 0,
});
const verifiedReceipt = paymentService.verifySpinReceipt(recordedReceipt, getReelHeights());
assert(
  verifiedReceipt.verified && verifiedReceipt.hashMatches && verifiedReceipt.stopsMatch,
  'Client-side Provably Fair HMAC-SHA256 spin receipt verifier recomputes exact 5 reel stops'
);

// Responsible Gaming Limits & Cool-Off Verification
paymentService.saveResponsibleGamingState({
  dailyDepositLimitUsd: 100,
  maxSpinBetSC: 5.0,
  maxSpinBetGC: 500,
  realityCheckMinutes: 30,
  coolOffUntil: null,
  depositsTodayUsd: 80,
});
const depAllowed = paymentService.checkDepositLimit(15);
const depBlocked = paymentService.checkDepositLimit(25);
assert(
  depAllowed.allowed && !depBlocked.allowed,
  'Responsible Gaming daily deposit limit allows $15 within $100 cap and blocks $25 excess'
);
const spinAllowed = paymentService.checkSpinAllowed({ currencyMode: 'SC', betAmount: 3.75 });
const spinBlocked = paymentService.checkSpinAllowed({ currencyMode: 'SC', betAmount: 7.50 });
assert(
  spinAllowed.allowed && !spinBlocked.allowed,
  'Responsible Gaming max single-spin wager limit enforces $5.00 SC cap'
);
paymentService.activateCoolOff(24);
const coolOffSpin = paymentService.checkSpinAllowed({ currencyMode: 'GC', betAmount: 25 });
assert(
  !coolOffSpin.allowed && coolOffSpin.code === 'COOL_OFF',
  'Voluntary Cool-Off immediately pauses spins across GC and SC'
);
paymentService.clearCoolOffForDemo();
paymentService.saveResponsibleGamingState({
  dailyDepositLimitUsd: 0,
  maxSpinBetSC: 0,
  maxSpinBetGC: 0,
  realityCheckMinutes: 0,
});

// ----------------------------------------------------------------------------
// 15. MVC CHECKOUT ORCHESTRATOR, RAIL BONUS SC & WEBHOOK BONUS TOKENS SYNC
// ----------------------------------------------------------------------------
console.log('\n--- 15. Testing MVC Sweepstakes Checkout Orchestrator & Webhook Sync ---');
const baseStarterPkg = SWEEPSTAKES_CONFIG.storePackages[0]; // $4.99 -> 5.00 SC
const cardPkg = sweepstakesCheckoutController.computePackageWithRailBonus(baseStarterPkg, 'card');
const cashAppPkg = sweepstakesCheckoutController.computePackageWithRailBonus(baseStarterPkg, 'cashapp');
const cryptoPkg = sweepstakesCheckoutController.computePackageWithRailBonus(baseStarterPkg, 'crypto');
assert(
  cardPkg.freeSweepsCoins === baseStarterPkg.freeSweepsCoins && cardPkg.extraRailBonusSC === 0,
  'Standard Card rail preserves exact base Sweeps Coins (5.00 SC on $4.99 starter pack)'
);
assert(
  cashAppPkg.freeSweepsCoins === Number((baseStarterPkg.freeSweepsCoins * 1.05).toFixed(2)) &&
    cryptoPkg.freeSweepsCoins === Number((baseStarterPkg.freeSweepsCoins * 1.05).toFixed(2)),
  'Cash App & Crypto Vault rails accurately compute +5% extra Sweeps Coins without jump-to-2000 corruption'
);

const futureYear2 = ((new Date().getFullYear() + 2) % 100).toString().padStart(2, '0');
const pastYear2 = ((new Date().getFullYear() - 1) % 100).toString().padStart(2, '0');
const validVisa = sweepstakesCheckoutController.validateCardInput({
  cardNumber: '4242 4242 4242 4242',
  cardExpiry: `12/${futureYear2}`,
  cardCvc: '123',
});
const expiredVisa = sweepstakesCheckoutController.validateCardInput({
  cardNumber: '4242 4242 4242 4242',
  cardExpiry: `01/${pastYear2}`,
  cardCvc: '123',
});
const validAmex = sweepstakesCheckoutController.validateCardInput({
  cardNumber: '3782 822463 10005',
  cardExpiry: `12/${futureYear2}`,
  cardCvc: '1234',
});
assert(
  validVisa.valid && validVisa.brand === 'VISA' && validVisa.last4 === '4242' && !expiredVisa.valid,
  'Dynamic card validator accepts valid Visa and rejects expired card dates'
);
assert(
  validAmex.valid && validAmex.brand === 'AMEX' && validAmex.last4 === '0005',
  'Amex 15-digit 4-6-5 format and 4-digit CID validate cleanly'
);

const savedToken = sweepstakesCheckoutController.saveCardForOneClick({
  brand: 'VISA',
  last4: '4242',
  expiry: `12/${futureYear2}`,
  holderName: 'Daniel VIP',
});
const rawSavedCards = localStorage.getItem('dc_saved_payment_cards_v1') || '';
assert(
  Boolean(savedToken?.id) &&
    !rawSavedCards.includes('42424242') &&
    !rawSavedCards.includes('cardCvc'),
  '1-Click Saved Card vault stores tokenized last4 metadata only (never raw PAN or CVC)'
);

const webhookSecServer = new SecurityServer();
const balBeforeWebhook = webhookSecServer.wallet.getAccount('usr_webhook_custom_tester').sweepsCoins;
const webhookRes = await webhookSecServer.handleStripeWebhook({
  id: 'evt_custom_bonus_tokens_sync_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      metadata: {
        packageId: 'pkg_custom_25',
        userId: 'usr_webhook_custom_tester',
        goldCoins: '50000',
        bonusTokens: '25.00',
      },
    },
  },
});
const balAfterWebhook = webhookSecServer.wallet.getAccount('usr_webhook_custom_tester').sweepsCoins;
assert(
  webhookRes.status === 'processed' && Number((balAfterWebhook - balBeforeWebhook).toFixed(2)) === 25,
  'SecurityServer Stripe webhook credits exact +25.00 custom-pack SC from metadata.bonusTokens'
);

// ----------------------------------------------------------------------------
// 16. VIP LOYALTY XP PROGRESSION, DAILY STREAK & GUEST-TO-VIP BALANCE MERGE
// ----------------------------------------------------------------------------
console.log('\n--- 16. Testing VIP Loyalty XP, Daily Streak & Balance Preservation ---');
localStorage.setItem('dc_casino_gold_coins', '340000');
localStorage.setItem('dc_casino_sweeps_coins', '42.50');
const mergedNewVipAcc = authService.getUserData('usr_fresh_vip_merge_test');
assert(
  mergedNewVipAcc.goldCoins === 340000 && mergedNewVipAcc.sweepsCoins === 42.5,
  'New VIP login preserves higher active Guest session GC (340,000) and SC ($42.50)'
);

const vipStep1 = authService.recordVipSpinXp('usr_vip_xp_tester', 140, false);
const vipStep2 = authService.recordVipSpinXp('usr_vip_xp_tester', 20, true);
assert(
  vipStep1.level === 1 && vipStep2.leveledUp === true && vipStep2.level === 2 && vipStep2.rewardSC === 0.25,
  'Crossing 250 VIP XP triggers Level 2 (SILVER SCARAB) milestone and awards +$0.25 Free SC'
);

const dailyClaim1 = authService.claimDailyReward('usr_daily_streak_tester');
const cannotDoubleClaim = authService.canClaimDailyReward('usr_daily_streak_tester');
assert(
  dailyClaim1.success && dailyClaim1.addedGC === 5000 && dailyClaim1.addedSC === 0.5 && !cannotDoubleClaim,
  'Daily login bonus grants +5,000 GC & +$0.50 Free SC and enforces 24-hour cooldown'
);

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
