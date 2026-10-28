// ============================================================================
// UNIVERSAL SLOT THEME CONFIGURATION ENGINE (`src/config/slotConfig.js`)
// ============================================================================
// HOW TO CHANGE THE ENTIRE GAME THEME (FOR CODERS & AI AGENTS):
// Every visual asset, character guardian, background, symbol, payline name,
// bonus game title/tile/wheel wedge, and UI string in the game is driven by
// `ACTIVE_THEME` in this single file.
//
// To switch themes (for example, to a "Motorcycle Biker" theme, "Cyberpunk" theme,
// "Pirate" theme, etc.), simply update `ACTIVE_THEME` below:
//   1. `brand`      -> Game title, subtitle, browser tab title, logo & mega win banner paths
//   2. `assets`     -> Main background, splash images, reel frame, tall column bg, bonus icon
//   3. `guardians`  -> Left & Right stage characters + their 1×3 expanding reel column sprites/titles
//   4. `splash`     -> All text & callouts on the promotional welcome screen
//   5. `uiCopy`     -> All HUD ticker messages, button labels, collector meter labels, & modals
//   6. `bonus`      -> Vault Pick-and-Win relic tiles, prize names, Fortune Wheel wedges, & Jackpots
//   7. `symbols`    -> Complete symbol suite (Wild, 1×3 Expanding, Bonus Scatter, 4 High, 4 Low 3D Royals)
//   8. `paylines`   -> 15 payline names and laser colors
// ============================================================================

export const BET_TIERS_GC = [
  15, 30, 45, 60, 75, 150, 300, 450, 750, 1500, 3000, 7500, 15000, 30000, 75000, 150000,
];

export const BET_TIERS_SC = [
  0.15, 0.30, 0.45, 0.60, 0.75, 1.50, 3.00, 4.50, 7.50, 15.00, 30.00, 45.00, 75.00, 150.00,
];

export const ACTIVE_THEME = {
  id: 'crowns_of_kemet',

  // 1. Core Brand & Casino Economy Settings
  brand: {
    casinoName: 'DC ENTERPRISES',
    casinoFullTitle: 'DC ENTERPRISES CASINO',
    creatorName: 'Daniel',
    gameTitle: 'DC ENTERPRISES: CROWNS OF KEMET',
    shortTitle: 'CROWNS OF KEMET',
    pageTitle: 'DC Enterprises Casino — Crowns of Kemet (By Daniel)',
    edition: 'DANIEL 3D ROYAL JEWEL VIP EDITION',
    logoImage: '/assets/psd/logo_long_frame.png',
    logoFrameImage: '/assets/psd/logo_long_frame.png',
    megaWinNeonImage: '/assets/neon/mega_win_royal_gold.png',
    baseLines: 15,
    defaultCoins: 250000,
    coinValues: [
      0.01,
      0.05,
      0.10,
      0.25,
      0.50,
      1.00,
      3.00,
      5.00,
      10.00,
      25.00,
      50.00,
      100.00,
      500.00,
      1000.00,
      10000.00,
    ],
    defaultCoinValueIndex: 5, // Starts at 1.00
    maxLevel: 10,
    betTiersGC: BET_TIERS_GC,
    betTiersSC: BET_TIERS_SC,
  },

  // 2. Stage, Cabinet & Environment Image Assets
  assets: {
    mainBackground: '/assets/background/background.png',
    // Splash now shows the DC Enterprises key art. Set splashVideo back to
    // '/assets/neon/splash_video.mp4' to restore the intro video.
    splashVideo: null,
    splashVideoEndFrame: '/assets/neon/splash_video_end_frame.jpg',
    splashHeroImage: '/assets/neon/dc_enterprises_splash_hd.jpg',
    splashCreativeImage: '/assets/neon/daniel_creative_ad_splash.jpg',
    splashOriginalImage: '/assets/neon/daniel_welcome_treasure.jpg',
    reelFrameImage: '/assets/reel/reel_frame_filled.png',
    reelGlowImage: '/assets/psd/reel_glow.png',
    reelShadowImage: '/assets/psd/reel_shadow.png',
    reelNetImage: '/assets/psd/reel_net.png',
    wildGlowImage1: '/assets/psd/wild_glow_01.png',
    wildGlowImage2: '/assets/psd/wild_glow_02.png',
    tallColumnBgImage: '/assets/psd/anubis_tall_bg.png',
    ambientSparksImage: '/assets/psd/fx_sparks.png',
    bonusCrestOverlayImage: '/assets/symbols/high/high_scarab_no_frame.png',
  },

  // 3. Left & Right Flanking Characters + 1×3 Expanding Reel Column Guardians
  guardians: {
    plaqueFrameImage: '/assets/psd/logo_short_frame.png',
    left: {
      name: 'Neon Anubis Guardian',
      plaqueTop: 'NEON GUARDIAN',
      plaqueBottom: 'DANIEL VIP',
      tallBannerText: 'ANUBIS 1×3 WILD',
      bodyImage: '/assets/characters/anubis.png',
      tallColumnImage: '/assets/characters/anubis_frame.png',
      eyesClosedImage: '/assets/psd/anubis_eyes_closed.png',
      auraImage: '/assets/psd/anubis_blue_light.png',
      handFxImage: '/assets/psd/anubis_hand_fire.png',
      keyedBackground: false,
    },
    right: {
      name: 'Queen Bastet Guardian',
      plaqueTop: 'QUEEN BASTET',
      plaqueBottom: 'DC ENTERPRISES',
      tallBannerText: 'BASTET 1×3 WILD',
      bodyImage: '/assets/neon/character_bastet_neon.jpg',
      tallColumnImage: '/assets/neon/character_bastet_neon.jpg',
      eyesClosedImage: null,
      auraImage: null,
      handFxImage: null,
      keyedBackground: true,
    },
  },

  // 4. Promotional Splash Screen Copywriting & Callouts
  splash: {
    marqueeBadge: '#1 VIP LAS VEGAS • KEMET NEON RESORT',
    liveJackpotLabel: 'LIVE GRAND JACKPOT',
    topLeftKicker: 'OFFICIAL FOUNDER EDITION',
    topLeftTitle: 'HOSTED BY DANIEL',
    viewOriginalLabel: 'VIEW ORIGINAL PHOTO',
    viewCreativeLabel: 'VIEW VEGAS AD KEY ART',
    leftCalloutHeader: 'VIP FOUNDER PERK',
    leftCalloutMetric: '250,000',
    leftCalloutSub: 'FREE VIP COINS',
    leftCalloutFine: 'INSTANT SIGN-ON BONUS',
    rightCalloutHeader: 'MEGA MULTIPLIERS',
    rightCalloutMetric: '100X WILD',
    rightCalloutSub: 'ANUBIS & BASTET',
    rightCalloutFine: '1×3 EXPANDING REELS',
    headlineEyebrow: 'DC ENTERPRISES CASINO • WORLD PREMIERE SLOT EVENT',
    headlineMain: 'CROWNS OF KEMET:',
    headlineAccent: "DANIEL'S NEON TREASURE",
    perkPills: [
      '250,000 FREE COINS INCLUDED',
      '15 LASER PAYLINES',
      'GSAP PRO REEL PHYSICS',
    ],
    ctaPrimary: 'CLAIM TREASURE & PLAY NOW',
    ctaSecondary: "ENTER DANIEL'S VIP LOUNGE • 250,000 COINS READY",
  },

  // 5. Cabinet HUD, Ticker, & Modal Copywriting
  uiCopy: {
    welcomeTicker:
      'WELCOME DANIEL TO DC ENTERPRISES CASINO — PHASER 3 WEBGL REEL ENGINE READY!',
    spinningTicker: 'PHASER 3 REELS SPINNING — DC ENTERPRISES CASINO!',
    noWinTicker: 'NO WINNING PAYLINES ON THIS SPIN — SPIN AGAIN AT DC ENTERPRISES CASINO!',
    megaWinTickerPrefix: 'MEGA ROYAL JACKPOT! DANIEL WON',
    resetBankrollTicker: 'BANKROLL RESET TO 250,000 COINS BY DANIEL!',
    insufficientCoinsTicker:
      'INSUFFICIENT COINS! CLICK RESET BANKROLL OR LOWER BET LEVEL.',
    bonusSpinButtonLabel: 'Force 3× Bonus Spin',
    bonusSpinButtonTooltip:
      'Spin & Land 3× 3D Bonus Symbols on the Reels to Trigger the Bonus Vault!',
    bonusOpenButtonLabel: 'Play 3D Bonus Games',
    bonusOpenButtonTooltip: 'Open the 3D Pick Vault & 3D Fortune Wheel Bonus Games!',
    expandDemoButtonLabel: 'Dual 1×3 Expand',
    expandDemoButtonTooltip: 'Demo Dual 1×3 Expanding Guardians!',
    megaWinDemoButtonLabel: 'Force Mega Win',
    megaWinDemoButtonTooltip: 'Demo a Multi-Line High Symbol + Wild Mega Win!',
    collectorMeterTitle: '3D ROYAL BONUS COLLECTOR',
    collectorMeterUnit: 'JEWELS',
    collectorMeterIcon: '/assets/symbols/high/high_scarab_no_frame.png',
    idleBreakdownHint:
      'LAND 3+ MATCHING SYMBOLS LEFT-TO-RIGHT OR 3+ BONUS CHESTS ANYWHERE FOR 3D BONUS GAMES!',
    bigWinRibbon: 'DC ENTERPRISES CASINO • DANIEL VIP MEGA JACKPOT',
    bigWinCollectButton: 'COLLECT VIP WINNINGS',
    paytableHeading: 'DC ENTERPRISES — OFFICIAL PAYTABLE & RULES',
    paytableAssetIntro:
      'Custom 3D Pop-Out Jewel-Toned Symbol Suite, Winged DC Enterprises Logo, Dual 1×3 Guardians, and 3D Engraved PSD Numbers:',
  },

  // 6. Color Palette Switcher Themes
  palettes: [
    { id: 'ultraviolet', label: 'Palette: Imperial Gold & Sapphire' },
    { id: 'acid', label: 'Palette: Solar Gold & Emerald' },
    { id: 'laser', label: 'Palette: Royal Amethyst & Gold' },
  ],

  // 7. Interactive 3D Bonus Games Configuration (Game 1: Pick Vault + Game 2: Fortune Wheel)
  bonus: {
    modalTitle: 'DC ENTERPRISES 3D ROYAL BONUS VAULT',
    game1TabLabel: '1. 3D Jeweled Relic Vault',
    game2TabLabel: '2. 3D Wheel of Kemet',
    scatterTriggerName: '3D BONUS CHEST SCATTERS',
    meterTriggerName: '36/36 BONUS COLLECTOR METER FULL',
    vipDirectTriggerName: 'DANIEL VIP BONUS CHAMBER ACCESS',
    vaultDefaultBanner: 'SELECT ANY 3D POP-OUT RELIC TO REVEAL YOUR TREASURE!',
    vaultExtraPicksBlessing: 'GUARDIAN BLESSING!',
    wheelTitle: "PHARAOH'S 3D CABOCHON WHEEL",
    wheelDescription:
      'Every wedge is forged in brushed 24k gold and inlaid with translucent ruby, emerald, amethyst, and sapphire cabochon gems. Land on 2× UPGRADE to double all wedges and earn an extra spin!',
    wheelDefaultBanner:
      'SPIN THE 3D CABOCHON WHEEL OF KEMET FOR MULTIPLIERS & JACKPOTS!',
    wheelCenterIcon: '/assets/symbols/high/high_scarab_no_frame.png',
    wheelUpgradeBannerPrefix: 'SOLAR UPGRADE! ALL WHEEL WEDGES DOUBLED TO',
    wheelJackpotBannerPrefix: 'ROYAL CROWN JACKPOT!',
    vaultTileStyles: [
      {
        title: 'Crimson Ruby Eye',
        art: '/assets/symbols/high/high_eye_no_frame.png',
        tileClass: 'vault-tile-ruby',
        accent: '#ef4444',
        tilt: '-6deg',
      },
      {
        title: 'Emerald Jade Scarab',
        art: '/assets/symbols/high/high_scarab_no_frame.png',
        tileClass: 'vault-tile-emerald',
        accent: '#10b981',
        tilt: '6deg',
      },
      {
        title: 'Royal Amethyst Ankh',
        art: '/assets/symbols/high/high_ankh_no_frame.png',
        tileClass: 'vault-tile-amethyst',
        accent: '#c084fc',
        tilt: '-5deg',
      },
      {
        title: 'Lapis Sapphire Collar',
        art: '/assets/symbols/high/high_necklace_no_frame.png',
        tileClass: 'vault-tile-sapphire',
        accent: '#38bdf8',
        tilt: '5deg',
      },
      {
        title: '3D Jeweled Pyramid',
        art: '/assets/symbols/wild/wild.png',
        tileClass: 'vault-tile-cyan',
        accent: '#00e5ff',
        tilt: '-4deg',
      },
      {
        title: 'Imperial Gold Eye',
        art: '/assets/symbols/high/high_eye_no_frame.png',
        tileClass: 'vault-tile-gold',
        accent: '#fbbf24',
        tilt: '7deg',
      },
    ],
    vaultPrizeTemplates: [
      { kind: 'coins', betMult: 3, label: 'ROYAL TREASURE' },
      { kind: 'coins', betMult: 4, label: 'RUBY OFFERING' },
      { kind: 'coins', betMult: 5, label: 'EMERALD HOARD' },
      { kind: 'coins', betMult: 6, label: 'SAPPHIRE CHEST' },
      { kind: 'coins', betMult: 8, label: 'GOLDEN VAULT' },
      { kind: 'coins', betMult: 10, label: 'IMPERIAL RELIC' },
      {
        kind: 'multiplier',
        multAdd: 1,
        extraPicks: 1,
        betMult: 2,
        label: '+1× MULT & +1 PICK!',
      },
      {
        kind: 'multiplier',
        multAdd: 2,
        extraPicks: 1,
        betMult: 3,
        label: '+2× MULT & +1 PICK!',
      },
      {
        kind: 'extra_picks',
        extraPicks: 2,
        betMult: 4,
        label: '+2 EXTRA PICKS!',
      },
      {
        kind: 'jackpot',
        jackpotId: 'mini',
        betMult: 20,
        label: 'MINI EMERALD JACKPOT!',
      },
      {
        kind: 'jackpot',
        jackpotId: 'minor',
        betMult: 50,
        label: 'MINOR SAPPHIRE JACKPOT!',
      },
      {
        kind: 'jackpot',
        jackpotId: 'major',
        betMult: 150,
        label: 'MAJOR AMETHYST JACKPOT!',
      },
    ],
    wheelWedges: [
      {
        label: '25× BET',
        type: 'coins',
        mult: 25,
        bgStart: '#881337',
        bgEnd: '#4c0519',
        gemColor: '#f43f5e',
        gemHi: '#fecdd3',
      },
      {
        label: '2× UPGRADE',
        sub: '+ FREE SPIN',
        type: 'upgrade',
        mult: 2,
        bgStart: '#78350f',
        bgEnd: '#451a03',
        gemColor: '#fbbf24',
        gemHi: '#fef08a',
      },
      {
        label: '15× BET',
        type: 'coins',
        mult: 15,
        bgStart: '#064e3b',
        bgEnd: '#022c22',
        gemColor: '#10b981',
        gemHi: '#a7f3d0',
      },
      {
        label: 'MINI JACKPOT',
        type: 'jackpot',
        jackpotId: 'mini',
        mult: 20,
        bgStart: '#0f766e',
        bgEnd: '#042f2e',
        gemColor: '#2dd4bf',
        gemHi: '#99f6e4',
      },
      {
        label: '40× BET',
        type: 'coins',
        mult: 40,
        bgStart: '#581c87',
        bgEnd: '#2e1065',
        gemColor: '#c084fc',
        gemHi: '#f3e8ff',
      },
      {
        label: '20× BET',
        type: 'coins',
        mult: 20,
        bgStart: '#1e3a8a',
        bgEnd: '#0f172a',
        gemColor: '#38bdf8',
        gemHi: '#bae6fd',
      },
      {
        label: 'MINOR JACKPOT',
        type: 'jackpot',
        jackpotId: 'minor',
        mult: 50,
        bgStart: '#0c4a6e',
        bgEnd: '#082f49',
        gemColor: '#00e5ff',
        gemHi: '#e0f2fe',
      },
      {
        label: '30× BET',
        type: 'coins',
        mult: 30,
        bgStart: '#701a75',
        bgEnd: '#3b0764',
        gemColor: '#e879f9',
        gemHi: '#fae8ff',
      },
      {
        label: '75× BET',
        type: 'coins',
        mult: 75,
        bgStart: '#7c2d12',
        bgEnd: '#431407',
        gemColor: '#f97316',
        gemHi: '#ffedd5',
      },
      {
        label: 'MAJOR JACKPOT',
        type: 'jackpot',
        jackpotId: 'major',
        mult: 150,
        bgStart: '#4c1d95',
        bgEnd: '#1e1b4b',
        gemColor: '#a855f7',
        gemHi: '#f3e8ff',
      },
      {
        label: '50× BET',
        type: 'coins',
        mult: 50,
        bgStart: '#065f46',
        bgEnd: '#022c22',
        gemColor: '#34d399',
        gemHi: '#d1fae5',
      },
      {
        label: 'GRAND CROWN',
        type: 'jackpot',
        jackpotId: 'grand',
        mult: 500,
        bgStart: '#991b1b',
        bgEnd: '#450a0a',
        gemColor: '#ffd700',
        gemHi: '#ffffff',
      },
    ],
    jackpotTiers: [
      {
        id: 'mini',
        label: 'MINI EMERALD',
        baseMultiplier: 20,
        color: '#10b981',
        gemHighlight: '#6ee7b7',
        tileBgStart: '#064e3b',
        tileBgEnd: '#022c22',
        icon: '/assets/symbols/high/high_scarab_no_frame.png',
      },
      {
        id: 'minor',
        label: 'MINOR SAPPHIRE',
        baseMultiplier: 50,
        color: '#38bdf8',
        gemHighlight: '#bae6fd',
        tileBgStart: '#0c4a6e',
        tileBgEnd: '#082f49',
        icon: '/assets/symbols/high/high_necklace_no_frame.png',
      },
      {
        id: 'major',
        label: 'MAJOR AMETHYST',
        baseMultiplier: 150,
        color: '#c084fc',
        gemHighlight: '#f3e8ff',
        tileBgStart: '#581c87',
        tileBgEnd: '#2e1065',
        icon: '/assets/symbols/high/high_ankh_no_frame.png',
      },
      {
        id: 'grand',
        label: 'GRAND RUBY CROWN',
        baseMultiplier: 500,
        color: '#f43f5e',
        gemHighlight: '#fecdd3',
        tileBgStart: '#881337',
        tileBgEnd: '#4c0519',
        icon: '/assets/symbols/high/high_eye_no_frame.png',
      },
    ],
  },

  // 8. Complete Symbol Suite (Role flags `isWild`, `isExpanding`, `isBonus`, `isTopHigh` drive all game logic!)
  symbols: [
    {
      id: 'wild',
      name: '3D Jeweled Pyramid Wild',
      tier: 'special',
      isWild: true,
      doublesLineWin: true,
      weight: 5.6,
      weightSC: 5.8,
      image: '/assets/symbols/wild/wild.png',
      noFrameImage: '/assets/symbols/wild/wild.png',
      frameImage: null,
      glowImage1: '/assets/psd/wild_glow_01.png',
      glowImage2: '/assets/psd/wild_glow_02.png',
      neonFilter: 'saturate(1.22) brightness(1.06) contrast(1.06)',
      payouts: { 3: 55, 4: 185, 5: 615 },
      payoutsSC: { 3: 57, 4: 191, 5: 635 },
      accentColor: '#00e5ff',
      description:
        '3D Gold & Multi-Gem Pyramid with glowing crystal apex. Doubles (2×) any payline win!',
    },
    {
      id: 'anubis',
      name: 'Anubis & Bastet 1×3 Expanding Wild',
      tier: 'special',
      isWild: true,
      isExpanding: true,
      weight: 3.1,
      weightSC: 3.3,
      image: '/assets/characters/anubis_frame.png',
      noFrameImage: '/assets/characters/anubis.png',
      frameImage: '/assets/psd/anubis_tall_frame.png',
      bgImage: '/assets/psd/anubis_tall_bg.png',
      neonFilter: 'saturate(1.2) brightness(1.05) contrast(1.06)',
      payouts: { 3: 62, 4: 221, 5: 738 },
      payoutsSC: { 3: 64, 4: 229, 5: 762 },
      accentColor: '#ffd700',
      description:
        'Expands to cover the entire 3-row reel column (1×3 Tall Guardian Wild) when landing!',
    },
    {
      id: 'bonus_chest',
      name: "Pharaoh's 3D Royal Bonus Chest",
      tier: 'special',
      isBonus: true,
      is3DBonus: true,
      bonusBadgeText: 'BONUS',
      weight: 6.3,
      weightSC: 6.4,
      tileBgStart: '#7c2d12',
      tileBgEnd: '#2a0a04',
      gemPrimary: '#fbbf24',
      gemHighlight: '#fef08a',
      gemSecondary: '#ef4444',
      tiltDeg: -6,
      image: '/assets/symbols/high/high_scarab.png',
      noFrameImage: '/assets/symbols/high/high_scarab_no_frame.png',
      frameImage: '/assets/psd/symbol_frame_gold.png',
      payouts: { 3: 55, 4: 148, 5: 554 },
      payoutsSC: { 3: 57, 4: 152, 5: 572 },
      accentColor: '#fbbf24',
      description:
        'SCATTER BONUS: Land 3, 4, or 5 anywhere on the reels to win an instant Scatter Payout + unlock the 3D Bonus Games!',
    },
    {
      id: 'eye',
      name: 'Crimson Ruby Eye of Horus',
      tier: 'high',
      isTopHigh: true,
      weight: 12.1,
      weightSC: 12.3,
      image: '/assets/symbols/high/high_eye.png',
      noFrameImage: '/assets/symbols/high/high_eye_no_frame.png',
      frameImage: '/assets/psd/symbol_frame_gold.png',
      neonFilter: 'saturate(1.22) brightness(1.05) contrast(1.06)',
      payouts: { 3: 31, 4: 98, 5: 308 },
      payoutsSC: { 3: 32, 4: 102, 5: 318 },
      accentColor: '#ef4444',
      description:
        '3D Gold & Cabochon Ruby Wedjat Eye bursting out of a Crimson Ruby velvet tile.',
    },
    {
      id: 'ankh',
      name: 'Royal Amethyst Ankh Cuff',
      tier: 'high',
      weight: 14.1,
      weightSC: 14.3,
      image: '/assets/symbols/high/high_ankh.png',
      noFrameImage: '/assets/symbols/high/high_ankh_no_frame.png',
      frameImage: '/assets/psd/symbol_frame_ankh.png',
      neonFilter: 'saturate(1.22) brightness(1.05) contrast(1.06)',
      payouts: { 3: 22, 4: 68, 5: 215 },
      payoutsSC: { 3: 23, 4: 70, 5: 222 },
      accentColor: '#c084fc',
      description:
        '3D Gold & Amethyst Gem Ankh Cuff bursting out of a Royal Purple velvet tile.',
    },
    {
      id: 'scarab',
      name: 'Emerald Jade Winged Scarab',
      tier: 'high',
      weight: 16.1,
      weightSC: 16.3,
      image: '/assets/symbols/high/high_scarab.png',
      noFrameImage: '/assets/symbols/high/high_scarab_no_frame.png',
      frameImage: '/assets/psd/symbol_frame_scarab.png',
      neonFilter: 'saturate(1.22) brightness(1.05) contrast(1.06)',
      payouts: { 3: 18, 4: 55, 5: 172 },
      payoutsSC: { 3: 19, 4: 57, 5: 178 },
      accentColor: '#10b981',
      description:
        '3D Winged Gold & Translucent Emerald Scarab bursting at a 45° angle off a Jade tile.',
    },
    {
      id: 'necklace',
      name: 'Lapis Sapphire Lotus Collar',
      tier: 'high',
      weight: 18.1,
      weightSC: 18.3,
      image: '/assets/symbols/high/high_necklace.png',
      noFrameImage: '/assets/symbols/high/high_necklace_no_frame.png',
      frameImage: '/assets/psd/symbol_frame_necklace.png',
      neonFilter: 'saturate(1.22) brightness(1.05) contrast(1.06)',
      payouts: { 3: 14, 4: 39, 5: 123 },
      payoutsSC: { 3: 14, 4: 41, 5: 127 },
      accentColor: '#3b82f6',
      description:
        '3D Gold & Amber-Sapphire Lotus Necklace bursting off a Royal Lapis Blue tile.',
    },
    {
      id: 'neon_a',
      name: '3D Ruby-Rose Royal Ace (A)',
      tier: 'low',
      weight: 21.8,
      weightSC: 21.6,
      is3DRoyal: true,
      letter: 'A',
      tileBgStart: '#6b0f2b',
      tileBgEnd: '#2d0412',
      gemPrimary: '#ff1e56',
      gemHighlight: '#ff8da1',
      gemSecondary: '#00e5ff',
      tiltDeg: -7,
      image: '/assets/psd/symbol_frame_gold.png',
      payouts: { 3: 10, 4: 27, 5: 74 },
      payoutsSC: { 3: 10, 4: 28, 5: 76 },
      accentColor: '#f43f5e',
      description:
        '3D Beveled Gold & Cabochon Ruby Ace ("A") popping off a Crimson-Rose velvet tile.',
    },
    {
      id: 'neon_k',
      name: '3D Turquoise-Cyan Royal King (K)',
      tier: 'low',
      weight: 23.8,
      weightSC: 23.6,
      is3DRoyal: true,
      letter: 'K',
      tileBgStart: '#064e5b',
      tileBgEnd: '#022229',
      gemPrimary: '#00e5ff',
      gemHighlight: '#a5f3fc',
      gemSecondary: '#f59e0b',
      tiltDeg: 6,
      image: '/assets/psd/symbol_frame_necklace.png',
      payouts: { 3: 7, 4: 20, 5: 55 },
      payoutsSC: { 3: 8, 4: 20, 5: 57 },
      accentColor: '#00e5ff',
      description:
        '3D Beveled Gold & Turquoise-Sapphire King ("K") popping off a Deep Teal velvet tile.',
    },
    {
      id: 'neon_q',
      name: '3D Amethyst-Orchid Royal Queen (Q)',
      tier: 'low',
      weight: 25.8,
      weightSC: 25.6,
      is3DRoyal: true,
      letter: 'Q',
      tileBgStart: '#4c116b',
      tileBgEnd: '#1e042e',
      gemPrimary: '#d946ef',
      gemHighlight: '#f5d0fe',
      gemSecondary: '#38bdf8',
      tiltDeg: -6,
      image: '/assets/psd/symbol_frame_ankh.png',
      payouts: { 3: 6, 4: 15, 5: 43 },
      payoutsSC: { 3: 6, 4: 15, 5: 44 },
      accentColor: '#d946ef',
      description:
        '3D Beveled Gold & Cabochon Amethyst Queen ("Q") popping off a Royal Orchid tile.',
    },
    {
      id: 'neon_j',
      name: '3D Amber-Emerald Royal Jack (J)',
      tier: 'low',
      weight: 27.8,
      weightSC: 27.6,
      is3DRoyal: true,
      letter: 'J',
      tileBgStart: '#0d4a26',
      tileBgEnd: '#031f0f',
      gemPrimary: '#10b981',
      gemHighlight: '#6ee7b7',
      gemSecondary: '#fbbf24',
      tiltDeg: 7,
      image: '/assets/psd/symbol_frame_scarab.png',
      payouts: { 3: 5, 4: 11, 5: 31 },
      payoutsSC: { 3: 5, 4: 11, 5: 32 },
      accentColor: '#fbbf24',
      description:
        '3D Beveled Gold & Cabochon Emerald-Amber Jack ("J") popping off a Forest Jade tile.',
    },
    {
      id: 'neon_10',
      name: '3D Cobalt-Sapphire Royal Ten (10)',
      tier: 'low',
      weight: 29.8,
      weightSC: 29.6,
      is3DRoyal: true,
      letter: '10',
      tileBgStart: '#0f172a',
      tileBgEnd: '#020617',
      gemPrimary: '#38bdf8',
      gemHighlight: '#e0f2fe',
      gemSecondary: '#f59e0b',
      tiltDeg: -5,
      image: '/assets/psd/symbol_frame_necklace.png',
      payouts: { 3: 4, 4: 7, 5: 22 },
      payoutsSC: { 3: 4, 4: 8, 5: 23 },
      accentColor: '#38bdf8',
      description:
        '3D Beveled Gold & Cobalt-Sapphire Ten ("10") popping off a Deep Midnight velvet tile.',
    },
  ],

  // 9. 15 Paylines
  paylines: [
    { id: 1, name: 'Middle Imperial Gold', rows: [1, 1, 1, 1, 1], color: '#ffd700' },
    { id: 2, name: 'Top Sapphire Beam', rows: [0, 0, 0, 0, 0], color: '#00e5ff' },
    { id: 3, name: 'Bottom Emerald Jade', rows: [2, 2, 2, 2, 2], color: '#10b981' },
    { id: 4, name: 'V-Crest Ruby', rows: [0, 1, 2, 1, 0], color: '#f43f5e' },
    { id: 5, name: 'Inverted Apex Amethyst', rows: [2, 1, 0, 1, 2], color: '#c084fc' },
    { id: 6, name: 'Upper Valley Amber', rows: [0, 0, 1, 0, 0], color: '#f59e0b' },
    { id: 7, name: 'Lower Peak Turquoise', rows: [2, 2, 1, 2, 2], color: '#38bdf8' },
    { id: 8, name: 'Crown Basin Rose', rows: [1, 2, 2, 2, 1], color: '#ec4899' },
    { id: 9, name: 'Royal Ridge Gold', rows: [1, 0, 0, 0, 1], color: '#fde047' },
    { id: 10, name: 'Ascending Wave', rows: [1, 0, 1, 0, 1], color: '#2dd4bf' },
    { id: 11, name: 'Descending Wave', rows: [1, 2, 1, 2, 1], color: '#a855f7' },
    { id: 12, name: 'Left Step Topaz', rows: [0, 1, 0, 1, 0], color: '#fbbf24' },
    { id: 13, name: 'Right Step Sapphire', rows: [2, 1, 2, 1, 2], color: '#60a5fa' },
    { id: 14, name: 'Upper Crest Jade', rows: [1, 1, 0, 1, 1], color: '#34d399' },
    { id: 15, name: 'Lower Trough Ruby', rows: [1, 1, 2, 1, 1], color: '#fb7185' },
  ],
};

// ============================================================================
// DERIVED EXPORTS & ROLE-BASED SYMBOL HELPERS
// (Components import these so they never hardcode any theme-specific IDs!)
// ============================================================================

export const CASINO_BRAND = ACTIVE_THEME.brand;
export const THEME_ASSETS = ACTIVE_THEME.assets;
export const GUARDIANS = ACTIVE_THEME.guardians;
export const SPLASH_CONFIG = ACTIVE_THEME.splash;
export const THEME_COPY = ACTIVE_THEME.uiCopy;
export const COLOR_PALETTES = ACTIVE_THEME.palettes;
export const BONUS_CONFIG = ACTIVE_THEME.bonus;
export const BONUS_JACKPOT_TIERS = ACTIVE_THEME.bonus.jackpotTiers;
export const SYMBOLS = ACTIVE_THEME.symbols;
export const PAYLINES = ACTIVE_THEME.paylines;

/**
 * Returns the active symbol suite calibrated for the given currency mode:
 * - 'GC' Mode (Social Play): Calibrated for ~90% RTP (10% house hold)
 * - 'SC' Mode (Sweepstakes / Cash Prizes): Calibrated for ~93.2% RTP (6.8% house hold)
 */
export function getSymbols(currencyMode = 'GC') {
  if (currencyMode === 'SC') {
    return ACTIVE_THEME.symbols.map((s) => ({
      ...s,
      weight: s.weightSC ?? s.weight,
      payouts: s.payoutsSC ?? s.payouts,
    }));
  }
  return ACTIVE_THEME.symbols;
}

export function getWildSymbol(currencyMode = 'GC') {
  const syms = getSymbols(currencyMode);
  return syms.find((s) => s.isWild && !s.isExpanding) || syms[0];
}

export function getExpandingSymbol(currencyMode = 'GC') {
  const syms = getSymbols(currencyMode);
  return syms.find((s) => s.isExpanding) || syms[1];
}

export function getBonusSymbol(currencyMode = 'GC') {
  const syms = getSymbols(currencyMode);
  return syms.find((s) => s.isBonus) || syms[2];
}

export function getTopHighSymbol(currencyMode = 'GC') {
  const syms = getSymbols(currencyMode);
  return (
    syms.find((s) => s.isTopHigh) ||
    syms.find((s) => s.tier === 'high') ||
    syms[3]
  );
}

export function getRegularSymbols(currencyMode = 'GC') {
  return getSymbols(currencyMode).filter((s) => !s.isWild && !s.isExpanding && !s.isBonus);
}

export const PSD_DIGIT_SPRITES = {
  '0': '/assets/psd/num_0.png',
  '1': '/assets/psd/num_1.png',
  '2': '/assets/psd/num_2.png',
  '3': '/assets/psd/num_3.png',
  '4': '/assets/psd/num_4.png',
  '5': '/assets/psd/num_5.png',
  '6': '/assets/psd/num_6.png',
  '7': '/assets/psd/num_7.png',
  '8': '/assets/psd/num_8.png',
  '9': '/assets/psd/num_9.png',
  '.': '/assets/psd/num_dot.png',
  ',': '/assets/psd/num_comma.png',
};

// ============================================================================
// ALL-NEW CELESTIAL FREE SPINS BONUS ROUND SYMBOL SUITE & CONFIGURATION
// ============================================================================
export const FREE_SPINS_CONFIG = {
  title: 'CELESTIAL SOLAR FREE SPINS',
  subTitle: 'ALL WINS MULTIPLIED BY 3× • SOLAR RETRIGGERS ACTIVE!',
  defaultSpins: 10,
  winMultiplier: 3,
  retriggerSpins: 3,
  symbols: [
    {
      id: 'fs_wild',
      name: 'Solar Phoenix 3× Wild',
      letter: 'WILD',
      isWild: true,
      weight: 5,
      image: '/assets/symbols/wild/wild.png',
      payouts: { 3: 45, 4: 140, 5: 450 },
      gemColor: '#f59e0b',
      gemHighlight: '#fffbeb',
      tileBgStart: '#7c2d12',
      tileBgEnd: '#2a0a04',
      badge: '3× WILD',
      accentColor: '#f59e0b',
      icon: '🔥',
      description: 'Solar Phoenix 3D Wild. Multiplies line wins by 3×!',
    },
    {
      id: 'fs_retrigger',
      name: 'Sun God Ra Aureole',
      letter: '+3 SPINS',
      isScatter: true,
      weight: 4.5,
      image: '/assets/symbols/high/high_scarab_no_frame.png',
      payouts: { 2: 15, 3: 60, 4: 180, 5: 600 },
      gemColor: '#ffd700',
      gemHighlight: '#ffffff',
      tileBgStart: '#854d0e',
      tileBgEnd: '#3a1a02',
      badge: '+3 SPINS',
      accentColor: '#ffd700',
      icon: '☀️',
      description: 'Land 3 or more anywhere to retrigger +3 FREE SPINS!',
    },
    {
      id: 'fs_mask',
      name: 'Diamond Solar Pharaoh Mask',
      letter: 'MASK',
      isHigh: true,
      weight: 11,
      image: '/assets/symbols/high/high_eye_no_frame.png',
      payouts: { 3: 26, 4: 80, 5: 260 },
      gemColor: '#00e5ff',
      gemHighlight: '#e0f2fe',
      tileBgStart: '#0c4a6e',
      tileBgEnd: '#021e30',
      accentColor: '#00e5ff',
      icon: '👑',
      description: 'Diamond encrusted 3D Pharaoh death mask.',
    },
    {
      id: 'fs_falcon',
      name: 'Golden Solar Horus Falcon',
      letter: 'FALCON',
      isHigh: true,
      weight: 13,
      image: '/assets/symbols/high/high_necklace_no_frame.png',
      payouts: { 3: 18, 4: 55, 5: 180 },
      gemColor: '#10b981',
      gemHighlight: '#a7f3d0',
      tileBgStart: '#064e3b',
      tileBgEnd: '#022319',
      accentColor: '#10b981',
      icon: '🦅',
      description: 'Emerald-winged 3D Solar Falcon of Horus.',
    },
    {
      id: 'fs_scepter',
      name: 'Crimson Sun Scepter',
      letter: 'SCEPTER',
      isHigh: true,
      weight: 15,
      image: '/assets/symbols/high/high_ankh_no_frame.png',
      payouts: { 3: 14, 4: 42, 5: 135 },
      gemColor: '#ef4444',
      gemHighlight: '#fee2e2',
      tileBgStart: '#7f1d1d',
      tileBgEnd: '#310909',
      accentColor: '#ef4444',
      icon: '⚡',
      description: 'Ruby-studded flail and crook solar power scepter.',
    },
    {
      id: 'fs_scarab',
      name: 'Celestial Amethyst Scarab',
      letter: 'SCARAB',
      isHigh: true,
      weight: 17,
      image: '/assets/symbols/high/high_scarab_no_frame.png',
      payouts: { 3: 11, 4: 32, 5: 100 },
      gemColor: '#c084fc',
      gemHighlight: '#f3e8ff',
      tileBgStart: '#581c87',
      tileBgEnd: '#24083a',
      accentColor: '#c084fc',
      icon: '🪲',
      description: 'Deep violet amethyst celestial sun beetle.',
    },
    {
      id: 'fs_royal_a',
      name: 'Solar Prismatic Ace',
      letter: 'A',
      isRoyal: true,
      weight: 20,
      payouts: { 3: 7, 4: 18, 5: 50 },
      gemColor: '#f43f5e',
      gemHighlight: '#ffe4e6',
      tileBgStart: '#4c0519',
      tileBgEnd: '#1f020a',
      accentColor: '#f43f5e',
      icon: '💎',
      description: '3D Prismatic Ruby Ace in brushed gold.',
    },
    {
      id: 'fs_royal_k',
      name: 'Solar Prismatic King',
      letter: 'K',
      isRoyal: true,
      weight: 22,
      payouts: { 3: 5, 4: 13, 5: 38 },
      gemColor: '#38bdf8',
      gemHighlight: '#e0f2fe',
      tileBgStart: '#082f49',
      tileBgEnd: '#021420',
      accentColor: '#38bdf8',
      icon: '💠',
      description: '3D Prismatic Sapphire King in brushed gold.',
    },
    {
      id: 'fs_royal_q',
      name: 'Solar Prismatic Queen',
      letter: 'Q',
      isRoyal: true,
      weight: 24,
      payouts: { 3: 4, 4: 10, 5: 28 },
      gemColor: '#34d399',
      gemHighlight: '#ecfdf5',
      tileBgStart: '#022c22',
      tileBgEnd: '#01140f',
      accentColor: '#34d399',
      icon: '✨',
      description: '3D Prismatic Emerald Queen in brushed gold.',
    },
    {
      id: 'fs_royal_j',
      name: 'Solar Prismatic Jack',
      letter: 'J',
      isRoyal: true,
      weight: 26,
      payouts: { 3: 3, 4: 7, 5: 20 },
      gemColor: '#a855f7',
      gemHighlight: '#faf5ff',
      tileBgStart: '#3b0764',
      tileBgEnd: '#170329',
      accentColor: '#a855f7',
      icon: '🔮',
      description: '3D Prismatic Amethyst Jack in brushed gold.',
    },
    {
      id: 'fs_royal_10',
      name: 'Solar Prismatic Ten',
      letter: '10',
      isRoyal: true,
      weight: 28,
      payouts: { 3: 2, 4: 5, 5: 15 },
      gemColor: '#38bdf8',
      gemHighlight: '#e0f2fe',
      tileBgStart: '#0f172a',
      tileBgEnd: '#020617',
      accentColor: '#38bdf8',
      icon: '💠',
      description: '3D Prismatic Cobalt-Sapphire Ten in brushed gold.',
    },
  ],
};
