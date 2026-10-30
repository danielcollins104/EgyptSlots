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
  defaultGoldCoins: 1000, // 1,000 GC free starting bankroll
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
      stripePriceId: 'price_1UVHyAPDpwmSIl1LVVPSqGJB',
      stripePaymentLink: 'https://buy.stripe.com/test_bJe7sN8TveURdFH0nB8AE04',
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
      stripePriceId: 'price_1UVI3SPDpwmSIl1L7gbjF9cR',
      stripePaymentLink: 'https://buy.stripe.com/test_aFadRbfhTcMJ9preer8AE03',
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
      stripePriceId: 'price_1UVHt3PDpwmSIl1LMpDikc7a',
      stripePaymentLink: 'https://buy.stripe.com/test_14A9AV0mZeURatvdan8AE05',
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
      stripePriceId: 'price_1UVI44PDpwmSIl1LRMjorAI9',
      stripePaymentLink: 'https://buy.stripe.com/test_14A6oJd9LbIFgRT5HV8AE01',
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
      stripePriceId: 'price_1UVI4lPDpwmSIl1L8F0xnw10',
      stripePaymentLink: 'https://buy.stripe.com/test_4gM8wR4DfcMJ0SVgmz8AE02',
      popular: false,
      badge: 'VIP WHALE • +15% SC',
      tagline: 'Ultimate VIP value package',
      savings: '15% Extra SC',
    },
  ],

  // High Roller Exclusive VIP Vault Packages ($5,000, $10,000, and $50,000)
  highRollerPackages: [
    {
      id: 'pkg_hr_5000',
      priceUsd: 5000.0,
      goldCoins: 65000000,
      freeSweepsCoins: 5600.0,
      stripePriceId: 'price_dc_hr_5000',
      stripePaymentLink: 'https://buy.stripe.com/test_dc_hr_5000',
      popular: false,
      badge: 'VIP SOVEREIGN • +12% SC',
      tagline: 'VIP Concierge & Fast-Track Cashout',
      savings: '12% Extra Free SC ($600 Value)',
      tierName: 'Sovereign Vault',
    },
    {
      id: 'pkg_hr_10000',
      priceUsd: 10000.0,
      goldCoins: 140000000,
      freeSweepsCoins: 11800.0,
      stripePriceId: 'price_dc_hr_10000',
      stripePaymentLink: 'https://buy.stripe.com/test_dc_hr_10000',
      popular: true,
      badge: 'ROYAL PHARAOH • +18% SC',
      tagline: 'Personal Host & Priority 24/7 Redemptions',
      savings: '18% Extra Free SC ($1,800 Value)',
      tierName: 'Royal Pharaoh Vault',
    },
    {
      id: 'pkg_hr_50000',
      priceUsd: 50000.0,
      goldCoins: 800000000,
      freeSweepsCoins: 62500.0,
      stripePriceId: 'price_dc_hr_50000',
      stripePaymentLink: 'https://buy.stripe.com/test_dc_hr_50000',
      popular: false,
      badge: 'EMPEROR VAULT • +25% SC',
      tagline: 'Private Vault, Max Limits & Direct Wire Settlement',
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
      badge: 'RESCUE DEAL • +20% BONUS',
      tagline: 'Quick reload to stay in the action',
      savings: '20% Extra Free SC',
    },
    {
      id: 'pkg_rescue_silver',
      priceUsd: 19.99,
      goldCoins: 75000,
      freeSweepsCoins: 25.0,
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

/**
 * Calculates dynamic Gold Coins and Free Sweeps Coins for any custom purchase amount ($USD)
 * with scaling VIP bonuses for high rollers.
 */
export function calculateCustomPackage(amountUsd) {
  const num = Math.max(10, Math.min(1000000, Math.round(Number(amountUsd) || 0)));

  // Tiered VIP bonuses:
  // >= $50,000  -> +25% Extra Free SC
  // >= $10,000  -> +18% Extra Free SC
  // >= $5,000   -> +12% Extra Free SC
  // >= $1,000   -> +10% Extra Free SC
  // >= $100     -> +5% Extra Free SC
  let bonusRate = 0.05;
  if (num >= 50000) bonusRate = 0.25;
  else if (num >= 10000) bonusRate = 0.18;
  else if (num >= 5000) bonusRate = 0.12;
  else if (num >= 1000) bonusRate = 0.10;

  const freeSweepsCoins = Number((num * (1 + bonusRate)).toFixed(2));
  const gcPerDollar = num >= 5000 ? 16000 : num >= 1000 ? 14000 : 12000;
  const goldCoins = Math.round(num * gcPerDollar);
  const bonusPct = Math.round(bonusRate * 100);

  return {
    id: `pkg_custom_${num}`,
    priceUsd: num,
    goldCoins,
    freeSweepsCoins,
    popular: false,
    badge: `CUSTOM VIP • +${bonusPct}% SC`,
    tagline: `Custom High Roller Bundle (${bonusPct}% Extra SC)`,
    savings: `${bonusPct}% Extra Free SC`,
    isCustom: true,
  };
}
