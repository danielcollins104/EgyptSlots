// ============================================================================
// SWEEPSTAKES CASINO DUAL-CURRENCY ECONOMY MODEL (GC / SC)
// ============================================================================
// Legal & Operational Structure:
// 1. Gold Coins (GC):
//    - Purely for fun / social play.
//    - Cannot be redeemed for real money or prizes.
//    - Can be purchased in bundles or awarded via Daily Login bonuses / Faucet.
//
// 2. Sweeps Coins / Sweepstakes Coins (SC):
//    - Sweepstakes promotional currency (1 SC = $1.00 USD prize value upon redemption).
//    - CANNOT BE PURCHASED DIRECTLY (Standard US 50-State Sweepstakes Law compliant).
//    - Awarded as FREE BONUS promotional entries when purchasing GC bundles,
//      or via Alternative Method of Entry (AMOE / Daily Login Free SC / Mail-in).
//    - Once played through (1x rollover requirement), eligible SC can be redeemed
//      for cash / bank transfer (Stripe Connect / Chime / Debit) or digital gift cards.
// ============================================================================

export const CASHTAG_HANDLE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CHIME_HANDLE)
    ? import.meta.env.VITE_CHIME_HANDLE
    : '$Daniel-Collins-168';

export const CRYPTO_WALLET_ADDRESSES = {
  BTC:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTO_WALLET_BTC) ||
    'bc1qwhnp4ylpv2h2q5x0rr9zm3zpwfcw3rtdmz4q4q',
  ETH:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTO_WALLET_ETH) ||
    '0x6258e488F97617cc103838746955CB81a1d3E3af',
  SOL:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTO_WALLET_SOL) ||
    'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
  USDT_SOL:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTO_WALLET_USDT_SOL) ||
    'Ejj7hyePNeC9yHQKuEnRvjSiSdJ7sZfNsdmm3YZxFS1f',
  USDT_ERC20:
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_CRYPTO_WALLET_USDT_ERC20) ||
    '0x6258e488F97617cc103838746955CB81a1d3E3af',
};

export function getCashAppPaymentLink(priceUsd) {
  const cleanHandle = CASHTAG_HANDLE.startsWith('$') ? CASHTAG_HANDLE : `$${CASHTAG_HANDLE}`;
  const num = Number(priceUsd) || 0;
  const formatted = num % 1 === 0 ? num.toString() : num.toFixed(2);
  return `https://cash.app/${cleanHandle}/${formatted}`;
}

export function getPaymentReturnUrl(pkgId) {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname}?payment_success=true&pkg=${encodeURIComponent(pkgId || '')}`;
  }
  return `https://oopsiwon.com/?payment_success=true&pkg=${encodeURIComponent(pkgId || '')}`;
}

export function getStripePaymentLink(pkg) {
  if (!pkg) return '';
  const pkgId = String(pkg.id || '').replace('pkg_', '').toUpperCase();
  const envKey = `VITE_STRIPE_PAYMENT_LINK_${pkgId}`;
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envKey]) {
    return import.meta.env[envKey];
  }
  return pkg.stripePaymentLink || '';
}

export function getCashAppPayCheckoutLink(pkg) {
  if (!pkg) return '';
  const pkgId = String(pkg.id || '').replace('pkg_', '').toUpperCase();
  const envKey = `VITE_STRIPE_CASHAPP_LINK_${pkgId}`;
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[envKey]) {
    return import.meta.env[envKey];
  }
  // Direct live Cash App $Cashtag link with pre-filled exact dollar amount ($Daniel-Collins-168)
  if (pkg.cashAppPaymentLink) {
    return pkg.cashAppPaymentLink;
  }
  if (Number(pkg.priceUsd) > 0) {
    return getCashAppPaymentLink(pkg.priceUsd);
  }
  if (pkg.cashAppStripePaymentLink) {
    const sep = pkg.cashAppStripePaymentLink.includes('?') ? '&' : '?';
    return `${pkg.cashAppStripePaymentLink}${sep}client_reference_id=${encodeURIComponent(pkg.id)}`;
  }
  return getCashAppPaymentLink(19.99);
}

export const SWEEPSTAKES_CONFIG = {
  // Cashtag operator configuration for real payments
  cashtagHandle: CASHTAG_HANDLE,

  // Initial / Default Balances for New Players
  defaultGoldCoins: 1000, // 1,000 GC free starting bankroll
  defaultSweepsCoins: 10.0, // 10.00 free SC promotional bonus ($10.00 USD prize value)
  minRedemptionSC: 50.0, // Minimum $50 SC to request cash/crypto prize redemption
  minGiftCardRedemptionSC: 25.0, // Lower $25 SC minimum for Instant Digital Gift Cards
  giftCardBonusRate: 0.05, // +5% Bonus USD value when redeeming for Digital Gift Cards
  playthroughRequirementMultiplier: 1.0, // 1x anti-fraud playthrough requirement on bonus SC
  scUsdRate: 1.0, // 1 SC = $1.00 USD

  // Supported Redemption / Payout Methods
  redemptionMethods: [
    {
      id: 'giftcard',
      label: '🎁 Instant Digital Gift Card (+5% BONUS)',
      shortLabel: '🎁 Gift Card (+5%)',
      minSC: 25.0,
      bonusRate: 0.05,
      eta: 'Instant Email Delivery (5–15 Mins)',
      badge: '+5% EXTRA PAYOUT • $25 MIN',
    },
    {
      id: 'crypto',
      label: '⚡ On-Chain Crypto Payout (USDT / SOL / ETH / BTC)',
      shortLabel: '⚡ Crypto Wallet',
      minSC: 50.0,
      bonusRate: 0,
      eta: 'Near-Instant On-Chain Settlement (0% Casino Fee)',
      badge: 'FASTEST • 0% FEE',
    },
    {
      id: 'chime',
      label: '💸 Cash App ($Cashtag) / Chime Instant',
      shortLabel: '💸 Cash App / Chime',
      minSC: 50.0,
      bonusRate: 0,
      eta: 'Same-Day Direct P2P Transfer',
      badge: '1-CLICK P2P',
    },
    {
      id: 'debit',
      label: '💳 Instant Visa / Mastercard Debit Push',
      shortLabel: '💳 Instant Debit',
      minSC: 50.0,
      bonusRate: 0,
      eta: '15–60 Minutes (Fast Funds / OCT)',
      badge: 'INSTANT CARD PUSH',
    },
    {
      id: 'ach',
      label: '🏦 Direct Bank Transfer (ACH Routing & Account)',
      shortLabel: '🏦 Bank ACH',
      minSC: 50.0,
      bonusRate: 0,
      eta: '1–2 Business Days',
      badge: 'HIGH LIMIT BANK WIRE',
    },
  ],

  giftCardBrands: [
    { id: 'visa_virtual', name: 'Visa® Virtual Prepaid Card', icon: '💳', bonusPct: 5 },
    { id: 'amazon', name: 'Amazon.com eGift Card', icon: '📦', bonusPct: 5 },
    { id: 'apple', name: 'Apple / App Store Gift Card', icon: '🍎', bonusPct: 5 },
    { id: 'walmart', name: 'Walmart Digital Gift Card', icon: '🛒', bonusPct: 5 },
  ],

  cryptoPayoutAssets: [
    { id: 'USDT_SOL', symbol: 'USDT (Solana SPL)', network: 'Solana Mainnet', placeholder: 'Enter your Solana Wallet Address (e.g. Phantom / Solflare)...', rateUsd: 1.0 },
    { id: 'SOL', symbol: 'SOL (Solana)', network: 'Solana Mainnet', placeholder: 'Enter your Solana (SOL) Wallet Address...', rateUsd: 185.0 },
    { id: 'ETH', symbol: 'ETH / USDT (ERC-20)', network: 'Ethereum / Base / Arbitrum', placeholder: 'Enter your 0x... Ethereum Wallet Address...', rateUsd: 2950.0 },
    { id: 'BTC', symbol: 'BTC (Bitcoin)', network: 'Bitcoin Mainnet', placeholder: 'Enter your bc1q... or 1... Bitcoin Wallet Address...', rateUsd: 92000.0 },
  ],

  // Available Store Bundles (Buy Gold Coins -> Receive FREE bonus Sweeps Coins)
  storePackages: [
    {
      id: 'pkg_starter',
      tierTitle: 'Root Chakra Royal Scepter Pack',
      priceUsd: 4.99,
      originalPriceUsd: 9.99,
      goldCoins: 10000,
      freeSweepsCoins: 5.0,
      stripePriceId: 'price_1UXihFArFku8z2ykEKWrud15',
      stripePaymentLink: 'https://buy.stripe.com/eVq4gy93bfMLbCkgxY8ww09',
      cashAppStripePaymentLink: 'https://buy.stripe.com/4gMdR8envbwv9uc4Pg8ww08',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/4.99',
      popular: false,
      badge: 'STARTER DEAL • 50% OFF',
      tagline: 'Instant Unlock + $5.00 Free Redeemable SC',
      vipPerk: '⚡ Instant VIP Guest Status',
      relicArt: '/assets/symbols/high/high_ankh_no_frame.png',
      auraClass: 'tier-sapphire',
      savings: 'Save $5.00',
    },
    {
      id: 'pkg_bronze',
      tierTitle: 'Heart Chakra Scarab Chest',
      priceUsd: 9.99,
      originalPriceUsd: 16.99,
      goldCoins: 25000,
      freeSweepsCoins: 10.5,
      stripePriceId: 'price_1UXihFArFku8z2ykRROIkw7n',
      stripePaymentLink: 'https://buy.stripe.com/9B67sKgvDeIH9ucftU8ww03',
      cashAppStripePaymentLink: 'https://buy.stripe.com/4gM28qgvDcAz7m481s8ww07',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/9.99',
      popular: false,
      badge: '+5% BONUS SC',
      tagline: '2.5× More Gold Coins + Extra Free SC',
      vipPerk: '🔥 2× Scarab Meter Boost',
      relicArt: '/assets/symbols/high/high_scarab_no_frame.png',
      auraClass: 'tier-emerald',
      savings: '5% Extra SC',
    },
    {
      id: 'pkg_silver',
      tierTitle: 'Solar Plexus Pharaoh Treasury',
      priceUsd: 19.99,
      originalPriceUsd: 34.99,
      goldCoins: 60000,
      freeSweepsCoins: 22.0,
      stripePriceId: 'price_1UXihFArFku8z2ykx0Gt5mmA',
      stripePaymentLink: 'https://buy.stripe.com/3cI4gybbjeIH7m4ftU8ww02',
      cashAppStripePaymentLink: 'https://buy.stripe.com/4gM6oGdjr1VV21K3Lc8ww05',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/19.99',
      popular: true,
      badge: '🔥 #1 MOST POPULAR • +10% SC',
      tagline: '#1 Player Choice — $22.00 Real Prize Value!',
      vipPerk: '👑 Priority Fast-Track Payouts',
      relicArt: '/assets/symbols/high/high_necklace_no_frame.png',
      auraClass: 'tier-gold-popular',
      savings: '10% Extra SC',
    },
    {
      id: 'pkg_gold',
      tierTitle: 'Third-Eye Royal Horus Vault',
      priceUsd: 49.99,
      originalPriceUsd: 79.99,
      goldCoins: 175000,
      freeSweepsCoins: 55.0,
      stripePriceId: 'price_1UXihFArFku8z2ykbWHWw0Ch',
      stripePaymentLink: 'https://buy.stripe.com/8x2eVc93b8kj21K0z08ww00',
      cashAppStripePaymentLink: 'https://buy.stripe.com/eVq00i93bfML21K3Lc8ww0a',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/49.99',
      popular: false,
      badge: 'HIGH ROLLER • +10% SC',
      tagline: 'Exceeds $50 Minimum Cashout Threshold!',
      vipPerk: '💎 Instant Cashout Threshold Ready',
      relicArt: '/assets/symbols/high/high_eye_no_frame.png',
      auraClass: 'tier-amethyst',
      savings: '10% Extra SC',
    },
    {
      id: 'pkg_diamond',
      tierTitle: 'Crown Chakra Pharaoh Dynasty',
      priceUsd: 99.99,
      originalPriceUsd: 149.99,
      goldCoins: 400000,
      freeSweepsCoins: 115.0,
      stripePriceId: 'price_1UXihFArFku8z2ykd8aB3mCk',
      stripePaymentLink: 'https://buy.stripe.com/9B68wOcfncAz6i0chI8ww01',
      cashAppStripePaymentLink: 'https://buy.stripe.com/bJecN4frz8kjbCk3Lc8ww04',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/99.99',
      popular: false,
      badge: '💎 VIP WHALE • +15% SC',
      tagline: '+$15.00 Extra Free SC Bonus Included!',
      vipPerk: '🌟 Dedicated VIP Host & Max Limits',
      relicArt: '/assets/symbols/wild/wild.png',
      auraClass: 'tier-ruby-whale',
      savings: '15% Extra SC',
    },
  ],

  // 6th Spotlight Package for balanced 3x2 Luxury Store Grid
  featuredRoyalPackage: {
    id: 'pkg_custom_250',
    tierTitle: 'Imperial Sun God Hoard',
    priceUsd: 249.99,
    originalPriceUsd: 375.0,
    goldCoins: 1100000,
    freeSweepsCoins: 295.0,
    stripePriceId: 'price_1UacnKArFku8z2ykESXROPrA',
    stripePaymentLink: 'https://buy.stripe.com/28EbJ06V3bwvbCkgxY8ww0b',
    cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/249.99',
    popular: false,
    featuredSpotlight: true,
    badge: '👑 IMPERIAL SPOTLIGHT • +18% SC',
    tagline: '1.1 Million GC + $295.00 Free SC Value!',
    vipPerk: '☀️ 1-Hour Express Prize Redemptions',
    relicArt: '/assets/neon/mega_win_royal_gold.webp',
    auraClass: 'tier-imperial-sun',
    savings: '18% Extra SC ($45 Free Bonus)',
  },

  // High Roller Exclusive VIP Vault Packages ($5,000, $10,000, and $50,000)
  highRollerPackages: [
    {
      id: 'pkg_hr_5000',
      tierTitle: 'Sovereign Anubis Vault',
      priceUsd: 5000.0,
      originalPriceUsd: 6500.0,
      goldCoins: 65000000,
      freeSweepsCoins: 5600.0,
      stripePriceId: 'price_1UacnLArFku8z2ykrSfG5oQX',
      stripePaymentLink: 'https://buy.stripe.com/cNiaEW93bcAzbCk95w8ww0c',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/5000',
      popular: false,
      badge: 'VIP SOVEREIGN • +12% SC',
      tagline: 'VIP Concierge & Fast-Track Cashout',
      vipPerk: '⚡ +$600.00 Extra Free SC Bonus',
      relicArt: '/assets/characters/anubis_charged_fire.webp',
      auraClass: 'tier-amethyst',
      savings: '12% Extra Free SC ($600 Value)',
      tierName: 'Sovereign Vault',
    },
    {
      id: 'pkg_hr_10000',
      tierTitle: 'Royal Pharaoh Dynasty Vault',
      priceUsd: 10000.0,
      originalPriceUsd: 13500.0,
      goldCoins: 140000000,
      freeSweepsCoins: 11800.0,
      stripePriceId: 'price_1UacnMArFku8z2ykH5j1FFmj',
      stripePaymentLink: 'https://buy.stripe.com/6oUbJ0cfnasrcGo1D48ww0d',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/10000',
      popular: true,
      badge: '👑 ROYAL PHARAOH • +18% SC',
      tagline: 'Personal Host & Priority 24/7 Redemptions',
      vipPerk: '🔥 +$1,800.00 Extra Free SC Bonus',
      relicArt: '/assets/characters/bastet_charged_fire.webp',
      auraClass: 'tier-gold-popular',
      savings: '18% Extra Free SC ($1,800 Value)',
      tierName: 'Royal Pharaoh Vault',
    },
    {
      id: 'pkg_hr_50000',
      tierTitle: 'Sovereign Crown Chakra Apex Vault',
      priceUsd: 50000.0,
      originalPriceUsd: 70000.0,
      goldCoins: 800000000,
      freeSweepsCoins: 62500.0,
      stripePriceId: 'price_1UacnNArFku8z2ykBF8rz570',
      stripePaymentLink: 'https://buy.stripe.com/4gM9AS2EN0RR7m4chI8ww0e',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/50000',
      popular: false,
      badge: '💎 EMPEROR VAULT • +25% SC',
      tagline: 'Private Vault, Max Limits & Direct Wire Settlement',
      vipPerk: '👑 +$12,500.00 Extra Free SC Bonus',
      relicArt: '/assets/neon/mega_win_royal_gold.webp',
      auraClass: 'tier-ruby-whale',
      savings: '25% Extra Free SC ($12,500 Value)',
      tierName: 'Emperor Dynasty Vault',
    },
  ],

  // Special Low-Balance Rescue Packages (High Conversion Incentive)
  rescuePackages: [
    {
      id: 'pkg_rescue_bronze',
      priceUsd: 9.99,
      goldCoins: 30000,
      freeSweepsCoins: 12.0,
      stripePriceId: 'price_1UXihFArFku8z2ykRROIkw7n',
      stripePaymentLink: 'https://buy.stripe.com/9B67sKgvDeIH9ucftU8ww03',
      cashAppStripePaymentLink: 'https://buy.stripe.com/4gM28qgvDcAz7m481s8ww07',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/9.99',
      badge: 'RESCUE DEAL • +20% BONUS',
      tagline: 'Quick reload to stay in the action',
      savings: '20% Extra Free SC',
    },
    {
      id: 'pkg_rescue_silver',
      priceUsd: 19.99,
      goldCoins: 75000,
      freeSweepsCoins: 25.0,
      stripePriceId: 'price_1UXihFArFku8z2ykx0Gt5mmA',
      stripePaymentLink: 'https://buy.stripe.com/3cI4gybbjeIH7m4ftU8ww02',
      cashAppStripePaymentLink: 'https://buy.stripe.com/4gM6oGdjr1VV21K3Lc8ww05',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/19.99',
      badge: 'MOST POPULAR RESCUE • +25% BONUS',
      tagline: 'Best value bankroll booster',
      savings: '25% Extra Free SC',
      recommended: true,
    },
    {
      id: 'pkg_rescue_gold',
      priceUsd: 49.99,
      goldCoins: 210000,
      freeSweepsCoins: 65.0,
      stripePriceId: 'price_1UXihFArFku8z2ykbWHWw0Ch',
      stripePaymentLink: 'https://buy.stripe.com/8x2eVc93b8kj21K0z08ww00',
      cashAppStripePaymentLink: 'https://buy.stripe.com/eVq00i93bfML21K3Lc8ww0a',
      cashAppPaymentLink: 'https://cash.app/$Daniel-Collins-168/49.99',
      badge: 'WHALE RESCUE • +30% BONUS',
      tagline: 'Massive bankroll refill with VIP host perk',
      savings: '30% Extra Free SC',
    },
  ],

  // Free Daily Claim / Faucet Rewards
  dailyReward: {
    goldCoins: 5000,
    sweepsCoins: 0.5,
    cooldownHours: 24,
  },

  // Payment Providers
  paymentProviders: [
    {
      id: 'cashapp',
      name: 'Cash App / Apple Pay',
      badge: 'INSTANT LIVE PAY',
      handle: CASHTAG_HANDLE,
      supported: true,
      icon: 'DollarSign',
      description: `Instant mobile checkout via Cash App, Apple Pay, or debit card to ${CASHTAG_HANDLE}`,
    },
    {
      id: 'stripe',
      name: 'Credit / Debit Card (Stripe Checkout)',
      badge: '256-BIT ENCRYPTED',
      supported: true,
      requiresApiKey: true,
      envKey: 'VITE_STRIPE_PUBLISHABLE_KEY',
      icon: 'CreditCard',
      description: 'Visa, MasterCard, Amex, Apple Pay, Google Pay via Stripe',
    },
    {
      id: 'crypto',
      name: 'Cryptocurrency (USDT / BTC / ETH)',
      badge: '0% GAS BONUS',
      supported: true,
      icon: 'Bitcoin',
      description: 'Direct blockchain transfer with instant confirmation',
    },
    {
      id: 'chime',
      name: 'Chime / Bank Transfer (Chime Pay / Direct)',
      badge: 'FEE FREE',
      supported: true,
      requiresApiKey: true,
      envKey: 'VITE_CHIME_API_KEY',
      icon: 'Building2',
      description: 'Chime mobile direct deposit, Chime Checkbook & SpotMe instant cash',
    },
  ],
};

/**
 * Calculates dynamic Gold Coins and Free Sweeps Coins for any custom purchase amount ($USD)
 * with scaling VIP bonuses for high rollers.
 */
export function calculateCustomPackage(amountUsd) {
  const raw = Number(amountUsd);
  const num = Number(Math.max(1, Math.min(1000000, isNaN(raw) ? 25 : raw)).toFixed(2));

  // Tiered VIP bonuses matching & scaling across the store:
  // >= $50,000  -> +25% Extra Free SC
  // >= $10,000  -> +18% Extra Free SC
  // >= $5,000   -> +15% Extra Free SC
  // >= $100     -> +15% Extra Free SC
  // >= $20      -> +10% Extra Free SC
  // >= $10      -> +5% Extra Free SC
  // <  $10      -> 1:1 Free SC (1.00 SC per $1.00)
  let bonusRate = 0;
  if (num >= 50000) bonusRate = 0.25;
  else if (num >= 10000) bonusRate = 0.18;
  else if (num >= 100) bonusRate = 0.15;
  else if (num >= 20) bonusRate = 0.10;
  else if (num >= 10) bonusRate = 0.05;

  const freeSweepsCoins = Number((num * (1 + bonusRate)).toFixed(2));
  const gcPerDollar =
    num >= 100 ? 4000 : num >= 50 ? 3500 : num >= 20 ? 3000 : num >= 10 ? 2500 : 2000;
  const goldCoins = Math.round(num * gcPerDollar);
  const bonusPct = Math.round(bonusRate * 100);

  // Match closest live Stripe Payment Link as static fallback when dynamic Checkout Session is offline
  const allKnownPackages = [
    ...(SWEEPSTAKES_CONFIG.storePackages || []),
    ...(SWEEPSTAKES_CONFIG.featuredRoyalPackage ? [SWEEPSTAKES_CONFIG.featuredRoyalPackage] : []),
    ...(SWEEPSTAKES_CONFIG.highRollerPackages || []),
  ];
  let closestPkg = allKnownPackages[0];
  let minDiff = Infinity;
  for (const p of allKnownPackages) {
    const diff = Math.abs((p.priceUsd || 0) - num);
    if (diff < minDiff) {
      minDiff = diff;
      closestPkg = p;
    }
  }

  return {
    id: `pkg_custom_${num}`,
    priceUsd: num,
    goldCoins,
    freeSweepsCoins,
    popular: false,
    badge: bonusPct > 0 ? `CUSTOM VIP • +${bonusPct}% SC` : 'CUSTOM AMOUNT',
    tagline:
      bonusPct > 0
        ? `Custom Bundle (+${bonusPct}% Extra Free SC)`
        : 'Custom Gold Coin & Free SC Bundle',
    savings: bonusPct > 0 ? `${bonusPct}% Extra Free SC` : null,
    isCustom: true,
    stripePriceId: closestPkg?.stripePriceId || 'price_1UXiguArFku8z2ykmC3iSckl',
    stripePaymentLink:
      closestPkg?.stripePaymentLink || 'https://buy.stripe.com/28EdR893bcAz0XGezQ8ww04',
    cashAppStripePaymentLink:
      closestPkg?.cashAppStripePaymentLink ||
      closestPkg?.stripePaymentLink ||
      'https://buy.stripe.com/14A3cufrz2ZZfSAgxY8ww09',
    cashAppPaymentLink: getCashAppPaymentLink(num),
  };
}
