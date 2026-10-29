// ============================================================================
// CALIBRATED PAYTABLE & PAYLINE SPECIFICATION (`src/engine/math/paytableConfig.js`)
// ============================================================================
// Phase 1 — Math Core: Payout matrices and paylines for 15-line casino evaluation.
// ============================================================================

export const MATH_PAYTABLE = {
  // SCATTER BONUS
  bonus_crest: {
    name: '3D Solar Scarab Relic (Scatter)',
    tier: 'scatter',
    isBonus: true,
    payouts: { 3: 66, 4: 178, 5: 668 },
  },

  // HIGH TIER SYMBOLS
  eye: {
    name: 'Crimson Ruby Eye of Horus',
    tier: 'high',
    isTopHigh: true,
    payouts: { 3: 37, 4: 119, 5: 372 },
  },
  ankh: {
    name: 'Royal Amethyst Ankh Cuff',
    tier: 'high',
    payouts: { 3: 27, 4: 83, 5: 259 },
  },
  scarab: {
    name: 'Emerald Jade Winged Scarab',
    tier: 'high',
    payouts: { 3: 22, 4: 67, 5: 208 },
  },
  necklace: {
    name: 'Lapis Sapphire Lotus Collar',
    tier: 'high',
    payouts: { 3: 17, 4: 48, 5: 149 },
  },

  // LOW TIER 3D ROYALS
  neon_a: {
    name: '3D Imperial Gold Royal Ace (A)',
    tier: 'low',
    payouts: { 3: 10, 4: 24, 5: 72 },
  },
  neon_k: {
    name: '3D Royal Ruby King (K)',
    tier: 'low',
    payouts: { 3: 8, 4: 20, 5: 56 },
  },
  neon_q: {
    name: '3D Royal Amethyst Queen (Q)',
    tier: 'low',
    payouts: { 3: 7, 4: 16, 5: 46 },
  },
  neon_j: {
    name: '3D Beveled Emerald Jack (J)',
    tier: 'low',
    payouts: { 3: 6, 4: 13, 5: 38 },
  },
  neon_10: {
    name: '3D Cobalt-Sapphire Royal Ten (10)',
    tier: 'low',
    payouts: { 3: 5, 4: 8, 5: 27 },
  },

  // WILDS
  wild: {
    name: 'Golden Pharaoh Mask (Wild)',
    tier: 'wild',
    isWild: true,
    multiplier: 2,
    payouts: { 3: 74, 4: 238, 5: 744 },
  },
  wild_expand: {
    name: '1×3 Expanding Guardian',
    tier: 'wild',
    isWild: true,
    isExpanding: true,
    multiplier: 2,
    payouts: { 3: 74, 4: 238, 5: 744 },
  },
};

// 15 Standard Casino Paylines (5 columns, rows 0=top, 1=middle, 2=bottom)
export const MATH_PAYLINES = [
  { id: 1, name: 'Middle Line', rows: [1, 1, 1, 1, 1], color: '#ffd700' },
  { id: 2, name: 'Top Line', rows: [0, 0, 0, 0, 0], color: '#00e5ff' },
  { id: 3, name: 'Bottom Line', rows: [2, 2, 2, 2, 2], color: '#10b981' },
  { id: 4, name: 'V-Crest', rows: [0, 1, 2, 1, 0], color: '#f43f5e' },
  { id: 5, name: 'Inverted Apex', rows: [2, 1, 0, 1, 2], color: '#c084fc' },
  { id: 6, name: 'Upper Valley', rows: [0, 0, 1, 0, 0], color: '#f59e0b' },
  { id: 7, name: 'Lower Peak', rows: [2, 2, 1, 2, 2], color: '#38bdf8' },
  { id: 8, name: 'Crown Basin', rows: [1, 2, 2, 2, 1], color: '#ec4899' },
  { id: 9, name: 'Royal Ridge', rows: [1, 0, 0, 0, 1], color: '#fde047' },
  { id: 10, name: 'Ascending Wave', rows: [1, 0, 1, 0, 1], color: '#2dd4bf' },
  { id: 11, name: 'Descending Wave', rows: [1, 2, 1, 2, 1], color: '#a855f7' },
  { id: 12, name: 'Left Step', rows: [0, 1, 0, 1, 0], color: '#fbbf24' },
  { id: 13, name: 'Right Step', rows: [2, 1, 2, 1, 2], color: '#60a5fa' },
  { id: 14, name: 'Upper Crest', rows: [1, 1, 0, 1, 1], color: '#34d399' },
  { id: 15, name: 'Lower Trough', rows: [1, 1, 2, 1, 1], color: '#fb7185' },
];

// Losses-Disguised-as-Wins (LDW) & Celebration Tiers
export const WIN_CATEGORIES = {
  LOSS: 'LOSS',
  LDW: 'LDW',               // 0 < win < totalBet
  WIN_SMALL: 'WIN_SMALL',   // totalBet <= win < 2 * totalBet
  WIN_MEDIUM: 'WIN_MEDIUM', // 2 * totalBet <= win < 10 * totalBet
  WIN_BIG: 'WIN_BIG',       // 10 * totalBet <= win < 25 * totalBet
  WIN_MEGA: 'WIN_MEGA',     // win >= 25 * totalBet
};
