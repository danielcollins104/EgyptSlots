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

export const SWEEPSTAKES_CONFIG = {
  // Initial / Default Balances for New Players
  defaultGoldCoins: 250000, // 250,000 GC free starting bankroll
  defaultSweepsCoins: 10.0, // 10.00 free SC promotional bonus ($10.00 USD prize value)
  minRedemptionSC: 50.0, // Minimum $50 SC to request prize redemption
  scUsdRate: 1.0, // 1 SC = $1.00 USD

  // Available Store Bundles (Buy Gold Coins -> Receive FREE bonus Sweeps Coins)
  storePackages: [
    {
      id: 'pkg_starter',
      priceUsd: 4.99,
      goldCoins: 10000,
      freeSweepsCoins: 5.0,
      popular: false,
      badge: 'STARTER BUNDLE',
      tagline: 'Best for getting started',
      savings: null,
    },
    {
      id: 'pkg_bronze',
      priceUsd: 9.99,
      goldCoins: 25000,
      freeSweepsCoins: 10.5,
      popular: false,
      badge: '+5% BONUS SC',
      tagline: 'Great casual value',
      savings: '5% Extra SC',
    },
    {
      id: 'pkg_silver',
      priceUsd: 19.99,
      goldCoins: 60000,
      freeSweepsCoins: 22.0,
      popular: true,
      badge: 'MOST POPULAR • +10% SC',
      tagline: 'Player favorite package',
      savings: '10% Extra SC',
    },
    {
      id: 'pkg_gold',
      priceUsd: 49.99,
      goldCoins: 175000,
      freeSweepsCoins: 55.0,
      popular: false,
      badge: 'HIGH ROLLER • +10% SC',
      tagline: 'Serious player package',
      savings: '10% Extra SC',
    },
    {
      id: 'pkg_diamond',
      priceUsd: 99.99,
      goldCoins: 400000,
      freeSweepsCoins: 115.0,
      popular: false,
      badge: 'VIP WHALE • +15% SC',
      tagline: 'Ultimate VIP value package',
      savings: '15% Extra SC',
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
      id: 'stripe',
      name: 'Credit / Debit Card (Stripe Checkout)',
      badge: 'INSTANT CREDIT',
      supported: true,
      requiresApiKey: true,
      envKey: 'VITE_STRIPE_PUBLISHABLE_KEY',
      icon: 'CreditCard',
      description: 'Visa, MasterCard, Amex, Apple Pay, Google Pay via Stripe',
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
