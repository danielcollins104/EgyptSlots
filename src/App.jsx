import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  BookOpen,
  Sparkles,
  Flame,
  Trophy,
  RotateCcw,
  RotateCw,
  Crown,
  Palette,
  Gem,
  Gift,
  CheckCircle2,
  CreditCard,
  Coins,
  DollarSign,
  KeyRound,
  History,
  ShoppingCart,
  ShieldCheck,
  Menu,
  X,
  Zap,
  Maximize,
  Minimize,
  Lock,
  LogOut,
  User,
  Disc,
} from 'lucide-react';
import {
  CASINO_BRAND,
  THEME_ASSETS,
  GUARDIANS,
  THEME_COPY,
  COLOR_PALETTES,
  BONUS_CONFIG,
  SYMBOLS,
  PAYLINES,
  BET_TIERS_GC,
  BET_TIERS_SC,
  LINE_OPTIONS,
  LINE_BET_TIERS_SC,
  LINE_BET_TIERS_GC,
  getSymbols,
  getWildSymbol,
  getExpandingSymbol,
  getBonusSymbol,
  getTopHighSymbol,
  getRegularSymbols,
} from './config/slotConfig';
import { SWEEPSTAKES_CONFIG, calculateCustomPackage } from './config/sweepstakesConfig';
import { paymentService } from './services/paymentService';
import PaymentModal from './components/PaymentModal';
import LowBalanceOfferModal from './components/LowBalanceOfferModal';
import VipPromoAdModal from './components/VipPromoAdModal';
import { soundEngine } from './audio/soundEngine';
import SplashScreen from './components/SplashScreen';
import BigWinPopup from './components/BigWinPopup';
import WinCelebrationSplash from './components/WinCelebrationSplash';
import PaytableModal from './components/PaytableModal';
import BonusGameModal from './components/BonusGameModal';
import FreeSpinsScreen from './components/FreeSpinsScreen';
import CollectorCelebrationModal from './components/CollectorCelebrationModal';
import MajorIlluminationEffect from './components/MajorIlluminationEffect';
import GuardianBonusCelebrationModal from './components/GuardianBonusCelebrationModal';
import CelestialOverloadBonusModal from './components/CelestialOverloadBonusModal';
import PsdGoldNumber from './components/PsdGoldNumber';
import NeonKeyedImage from './components/NeonKeyedImage';
import DcLogoPlaque from './components/DcLogoPlaque';
import AuthModal from './components/AuthModal';
import { authService } from './services/authService';
import AmbientMusicBar from './components/AmbientMusicBar';
import { ambientMusicEngine } from './audio/ambientMusicEngine';
import AmbientAtmosphere from './components/AmbientAtmosphere';
import CabinetPillars from './components/CabinetPillars';
import JackpotMarqueeBar from './components/JackpotMarqueeBar';
import CabinetGlassOverlay from './components/CabinetGlassOverlay';
import GuardianLightningStrike from './components/GuardianLightningStrike';
import PhaserReelEngine from './engine/PhaserReelEngine';
import { slotMathEngine } from './engine/math/SlotMathEngine.js';
import { spinPhysicalReels } from './engine/math/ReelStripModel.js';
import { slotEventBus } from './engine/math/EventBus.js';
import { assetPreloader } from './services/assetPreloader';
import './App.css';

const COLS = 5;
const ROWS = 3;
const BONUS_METER_GOAL = 36;

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

function generateInitialGrid() {
  const wildSym = getWildSymbol();
  const expSym = getExpandingSymbol();
  const topHigh = getTopHighSymbol();
  const regs = getRegularSymbols();
  const r = (idx) => regs[idx % regs.length] || topHigh;

  return [
    [r(4), topHigh, r(6)],
    [expSym, expSym, expSym],
    [r(2), wildSym, r(5)],
    [topHigh, r(1), r(7)],
    [r(4), r(3), topHigh],
  ];
}

function formatCoinValue(val) {
  if (val === undefined || val === null || isNaN(val)) return '1.00';
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return Number(val).toFixed(2);
}

export default function App() {
  const [showSplash, setShowSplash] = useState(() => {
    try {
      return sessionStorage.getItem('dc_session_splash_dismissed') !== 'true';
    } catch {
      return true;
    }
  });
  const [muted, setMuted] = useState(() => {
    try {
      return sessionStorage.getItem('dc_session_muted') === 'true';
    } catch {
      return false;
    }
  });
  const [neonThemeIdx, setNeonThemeIdx] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_theme_idx') || '0', 10);
      return Number.isNaN(saved) ? 0 : saved;
    } catch {
      return 0;
    }
  });
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [isTabletopPosture, setIsTabletopPosture] = useState(false);

  // Detect foldable tabletop posture (Viewport Segments / Device Posture API)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const checkPosture = () => {
      try {
        const postureType = window.navigator?.devicePosture?.type;
        const hasHorizSegments =
          window.matchMedia &&
          window.matchMedia('(horizontal-viewport-segments: 2)').matches;
        if (postureType === 'folded' || hasHorizSegments) {
          setIsTabletopPosture(true);
        }
      } catch {}
    };
    checkPosture();
    window.addEventListener('resize', checkPosture);
    try {
      window.navigator?.devicePosture?.addEventListener?.('change', checkPosture);
    } catch {}
    return () => {
      window.removeEventListener('resize', checkPosture);
      try {
        window.navigator?.devicePosture?.removeEventListener?.('change', checkPosture);
      } catch {}
    };
  }, []);

  // Asset Preloading & Instant Spin Lock Telemetry
  const [isAssetsLoaded, setIsAssetsLoaded] = useState(() => assetPreloader.isComplete);
  const [isHighResBgLoaded, setIsHighResBgLoaded] = useState(() => assetPreloader.highResLoaded);

  useEffect(() => {
    const unsubscribe = assetPreloader.subscribe((state) => {
      if (state.isComplete) setIsAssetsLoaded(true);
      if (state.highResLoaded) setIsHighResBgLoaded(true);
    });
    return unsubscribe;
  }, []);

  // Player Authentication & VIP Verification for Sweeps Coins (SC)
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalReason, setAuthModalReason] = useState('sc_toggle'); // 'sc_toggle' | 'sc_spin' | 'header_click'

  // Sweepstakes Dual-Currency Economy Model (GC vs SC)
  // Playing for SC requires VIP player login
  const [currencyMode, setCurrencyMode] = useState(() => {
    try {
      const user = authService.getCurrentUser();
      const userAcc = authService.getUserData(user?.id);
      if (userAcc?.currencyMode === 'SC' && user) return 'SC';
      const saved = localStorage.getItem('dc_casino_currency_mode');
      if (saved === 'SC' && user) return 'SC';
      return 'GC';
    } catch {
      return 'GC';
    }
  });

  const [goldCoins, setGoldCoins] = useState(() => {
    try {
      const user = authService.getCurrentUser();
      const userAcc = authService.getUserData(user?.id);
      if (userAcc && typeof userAcc.goldCoins === 'number') {
        return userAcc.goldCoins;
      }
      const saved = localStorage.getItem('dc_casino_gold_coins');
      return saved !== null ? parseInt(saved, 10) : SWEEPSTAKES_CONFIG.defaultGoldCoins;
    } catch {
      return SWEEPSTAKES_CONFIG.defaultGoldCoins;
    }
  });

  const [sweepsCoins, setSweepsCoins] = useState(() => {
    try {
      const user = authService.getCurrentUser();
      const userAcc = authService.getUserData(user?.id);
      if (userAcc && typeof userAcc.sweepsCoins === 'number') {
        return userAcc.sweepsCoins;
      }
      const saved = localStorage.getItem('dc_casino_sweeps_coins');
      return saved !== null ? parseFloat(saved) : SWEEPSTAKES_CONFIG.defaultSweepsCoins;
    } catch {
      return SWEEPSTAKES_CONFIG.defaultSweepsCoins;
    }
  });

  const goldCoinsRef = useRef(goldCoins);
  const sweepsCoinsRef = useRef(sweepsCoins);
  useEffect(() => {
    goldCoinsRef.current = goldCoins;
  }, [goldCoins]);
  useEffect(() => {
    sweepsCoinsRef.current = sweepsCoins;
  }, [sweepsCoins]);

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState('store');
  const [selectedStorePackage, setSelectedStorePackage] = useState(null);

  // Proactive & Insufficient Balance Smart Offer Modal State
  const [lowBalanceOfferOpen, setLowBalanceOfferOpen] = useState(false);
  const lastLowBalanceOfferTimeRef = useRef(0);

  // /casino-ad-architect High-Converting VIP Promo Ad Modal State
  const [vipPromoAdOpen, setVipPromoAdOpen] = useState(false);
  const [vipPromoAdReason, setVipPromoAdReason] = useState('vip_flash');
  const [vipPromoLastWin, setVipPromoLastWin] = useState(0);
  const sessionSpinCountRef = useRef(0);
  const hasShownHotStreakPromoRef = useRef(false);

  // Daily Login Reward & Faucet State
  const [canClaimDaily, setCanClaimDaily] = useState(() => authService.canClaimDailyReward(currentUser?.id));

  useEffect(() => {
    setCanClaimDaily(authService.canClaimDailyReward(currentUser?.id));
  }, [currentUser]);

  const handleClaimDailyBonus = () => {
    const res = authService.claimDailyReward(currentUser?.id);
    if (res.success) {
      setGoldCoins(res.goldCoins);
      setSweepsCoins(res.sweepsCoins);
      goldCoinsRef.current = res.goldCoins;
      sweepsCoinsRef.current = res.sweepsCoins;
      setCanClaimDaily(false);
      setStatusMessage('DAILY BONUS CLAIMED! +5,000 GC & +0.50 FREE SC ADDED TO YOUR VAULT!');
      soundEngine.playWinCelebration(false);
    } else {
      setStatusMessage('DAILY BONUS ALREADY CLAIMED TODAY. PLEASE CHECK BACK TOMORROW!');
    }
  };

  // Bottom UI State (Multi-Line Wagering & Per-Line Bet Selector) — Saved across foldable/rotation configuration changes
  const [selectedLines, setSelectedLines] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_selected_lines') || '15', 10);
      return LINE_OPTIONS.includes(saved) ? saved : 15;
    } catch {
      return 15;
    }
  });
  const [lineBetIndexSC, setLineBetIndexSC] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_line_bet_sc') || '0', 10);
      return saved >= 0 && saved < LINE_BET_TIERS_SC.length ? saved : 0;
    } catch {
      return 0;
    }
  }); // Default 0.25 SC ($3.75 total bet at 15 lines)
  const [lineBetIndexGC, setLineBetIndexGC] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_line_bet_gc') || '0', 10);
      return saved >= 0 && saved < LINE_BET_TIERS_GC.length ? saved : 0;
    } catch {
      return 0;
    }
  }); // Default 25 GC (375 GC total bet at 15 lines)
  const [betIndexGC, setBetIndexGC] = useState(4); // Backward-compatibility
  const [betIndexSC, setBetIndexSC] = useState(4); // Backward-compatibility

  // Initial Reel Grid & Spin Trigger
  const [initialGrid] = useState(() => generateInitialGrid());
  const [initialExpandedCols] = useState([false, true, false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const isSpinningRef = useRef(false);
  const phaserEngineRef = useRef(null);
  const [spinTrigger, setSpinTrigger] = useState(null);
  const [spinId, setSpinId] = useState(0);
  const pendingSpinRef = useRef(null);
  const triggerSpinRef = useRef(null);

  // Win state
  const [lastWinCoins, setLastWinCoins] = useState(0);
  const [winSplashAmount, setWinSplashAmount] = useState(0);
  const handleCloseWinSplash = useCallback(() => {
    setWinSplashAmount(0);
  }, []);
  const [winningLines, setWinningLines] = useState([]);
  const [winningCells, setWinningCells] = useState(new Set());
  const [activeWinLineIdx, setActiveWinLineIdx] = useState(0);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(THEME_COPY.welcomeTicker);

  // Casino Game Juice & Physical Cabinet Feedback
  const [cabinetImpact, setCabinetImpact] = useState('');
  const cabinetImpactTimerRef = useRef(null);
  const [spinShockwave, setSpinShockwave] = useState(false);
  const [floatingWinText, setFloatingWinText] = useState(null);
  const [floatingWinKey, setFloatingWinKey] = useState(0);

  const triggerCabinetImpact = useCallback((type) => {
    setCabinetImpact(type);
    if (cabinetImpactTimerRef.current) clearTimeout(cabinetImpactTimerRef.current);
    cabinetImpactTimerRef.current = setTimeout(() => {
      setCabinetImpact('');
    }, type === 'mega' ? 700 : 380);
  }, []);

  // Autoplay, Bonus Mechanisms & Modals
  const [autoPlayCount, setAutoPlayCount] = useState(0);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [bonusMeter, setBonusMeter] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_bonus_meter') || '4', 10);
      return Number.isNaN(saved) ? 4 : saved;
    } catch {
      return 4;
    }
  });
  const [collectorCelebrationOpen, setCollectorCelebrationOpen] = useState(false);
  const [bonusSession, setBonusSession] = useState(null);
  const [celestialBonusOpen, setCelestialBonusOpen] = useState(false);
  const [celestialBonusBet, setCelestialBonusBet] = useState(15);
  const [freeSpinsOpen, setFreeSpinsOpen] = useState(false);
  const [freeSpinsCount, setFreeSpinsCount] = useState(10);
  const [guardianAction, setGuardianAction] = useState(false);
  const [guardianBlinking, setGuardianBlinking] = useState(false);
  // Dynamic 5-Tier Guardian Progressive Escalation System:
  // 0 = Dormant Stone Statue (Still, Cold Granite, No Movement, No Glow)
  // 1 = Alive Living Entity (Color Restored, Living Breathing Starts, but NO Eyes Lit, NO Orbs)
  // 2 = Eyes of the Gods & Divine Corona Glow
  // 3 = Celestial Energy Orbs & Flames Manifest (Plasma & Solar Sunfire)
  // 4 = Incandescent Apex Overcharge (Maximum Scale, Blinding Glow, Crackling Lightning)
  // 5 = Grand Celestial Strike Laser
  const [anubisCharge, setAnubisCharge] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_anubis_charge') || '0', 10);
      return Number.isNaN(saved) ? 0 : saved;
    } catch {
      return 0;
    }
  });
  const [bastetCharge, setBastetCharge] = useState(() => {
    try {
      const saved = parseInt(sessionStorage.getItem('dc_session_bastet_charge') || '0', 10);
      return Number.isNaN(saved) ? 0 : saved;
    } catch {
      return 0;
    }
  });
  const anubisChargeRef = useRef(anubisCharge);
  const bastetChargeRef = useRef(bastetCharge);

  // Preserve interactive UI state across configuration changes (folding/unfolding, orientation rotation, window resize)
  useEffect(() => {
    try {
      sessionStorage.setItem('dc_session_splash_dismissed', showSplash ? 'false' : 'true');
      sessionStorage.setItem('dc_session_muted', muted ? 'true' : 'false');
      sessionStorage.setItem('dc_session_theme_idx', String(neonThemeIdx));
      sessionStorage.setItem('dc_session_selected_lines', String(selectedLines));
      sessionStorage.setItem('dc_session_line_bet_sc', String(lineBetIndexSC));
      sessionStorage.setItem('dc_session_line_bet_gc', String(lineBetIndexGC));
      sessionStorage.setItem('dc_session_bonus_meter', String(bonusMeter));
      sessionStorage.setItem('dc_session_anubis_charge', String(anubisCharge));
      sessionStorage.setItem('dc_session_bastet_charge', String(bastetCharge));
    } catch {}
  }, [
    showSplash,
    muted,
    neonThemeIdx,
    selectedLines,
    lineBetIndexSC,
    lineBetIndexGC,
    bonusMeter,
    anubisCharge,
    bastetCharge,
  ]);
  const [anubisPowerUp, setAnubisPowerUp] = useState(null);
  const [bastetPowerUp, setBastetPowerUp] = useState(null);
  const anubisTimerRef = useRef(null);
  const bastetTimerRef = useRef(null);

  const guardianChargeLevel = Math.max(anubisCharge, bastetCharge);
  const guardianChargeLevelRef = useRef(0);
  guardianChargeLevelRef.current = guardianChargeLevel;

  // 2026 Alternating Guardian Power-Up Engine:
  // First power-up goes to one character, next goes to the other, etc.
  const [nextPowerUpGuardian, setNextPowerUpGuardian] = useState('anubis'); // 'anubis' | 'bastet'
  const nextPowerUpGuardianRef = useRef('anubis');

  // Major Illumination & Guardian Bonus Celebration State
  const [majorIlluminationActive, setMajorIlluminationActive] = useState(false);
  const [majorIlluminationCells, setMajorIlluminationCells] = useState([]);
  const [guardianBonusCelebrationOpen, setGuardianBonusCelebrationOpen] = useState(false);

  const triggerAnubisPowerUp = useCallback((targetLevel) => {
    const next = Math.max(0, Math.min(4, targetLevel));
    setAnubisCharge(next);
    anubisChargeRef.current = next;

    const titles = [
      'STONE STATUE (DORMANT)',
      'LIVING ENTITY AWAKENED',
      'DIVINE EYES IGNITED',
      'PLASMA ORB MANIFESTED',
      'APEX OVERCHARGE REACHED',
    ];
    const badges = [
      '🗿 DORMANT STONE',
      '⚡ ANUBIS AWAKENED • LIFE RESTORED',
      '⚡ ANUBIS LEVEL 2 • DIVINE EYES',
      '🌀 ANUBIS LEVEL 3 • PLASMA ORB',
      '🔥 ANUBIS LEVEL 4 • APEX OVERCHARGE',
    ];

    if (next === 1) soundEngine.playQiGather?.();
    else if (next === 2) soundEngine.playQiGather?.();
    else if (next === 3) {
      soundEngine.playThunderStrike?.();
    } else if (next >= 4) {
      soundEngine.playThunderStrike?.();
    }

    setAnubisPowerUp({ level: next, badge: badges[next], title: titles[next], id: Date.now() });
    if (anubisTimerRef.current) clearTimeout(anubisTimerRef.current);
    anubisTimerRef.current = setTimeout(() => {
      setAnubisPowerUp(null);
    }, 1500);

    return next;
  }, []);

  const triggerBastetPowerUp = useCallback((targetLevel) => {
    const next = Math.max(0, Math.min(4, targetLevel));
    setBastetCharge(next);
    bastetChargeRef.current = next;

    const titles = [
      'STONE STATUE (DORMANT)',
      'LIVING ENTITY AWAKENED',
      'SOLAR EYES IGNITED',
      'SUNFIRE ORB MANIFESTED',
      'APEX OVERCHARGE REACHED',
    ];
    const badges = [
      '🗿 DORMANT STONE',
      '🌸 BASTET AWAKENED • LIFE RESTORED',
      '🌸 BASTET LEVEL 2 • SOLAR EYES',
      '🌟 BASTET LEVEL 3 • SUNFIRE ORB',
      '🔥 BASTET LEVEL 4 • APEX OVERCHARGE',
    ];

    if (next === 1) soundEngine.playQiGather?.();
    else if (next === 2) soundEngine.playQiGather?.();
    else if (next === 3) {
      soundEngine.playSolarFireball?.();
    } else if (next >= 4) {
      soundEngine.playSolarFireball?.();
    }

    setBastetPowerUp({ level: next, badge: badges[next], title: titles[next], id: Date.now() });
    if (bastetTimerRef.current) clearTimeout(bastetTimerRef.current);
    bastetTimerRef.current = setTimeout(() => {
      setBastetPowerUp(null);
    }, 1500);

    return next;
  }, []);

  const updateGuardianCharge = useCallback((updater) => {
    const curr = Math.max(anubisChargeRef.current, bastetChargeRef.current);
    const next = typeof updater === 'function' ? updater(curr) : updater;
    triggerAnubisPowerUp(next);
    triggerBastetPowerUp(next);
  }, [triggerAnubisPowerUp, triggerBastetPowerUp]);

  // 2026 Guardian Apex Overcharge Climax:
  // Both characters shoot lightning & fire at the triggering combination, causing major illumination,
  // followed by a "BONUS!" celebration animation and entry into Free Automatic Spins or 3D Bonus Vault.
  const triggerGuardianClimax = useCallback((explicitWinCells = null) => {
    // Both guardians reach Apex Overcharge
    triggerAnubisPowerUp(4);
    triggerBastetPowerUp(4);
    setGuardianAction(true);

    const targetCells =
      explicitWinCells && explicitWinCells.length > 0
        ? explicitWinCells
        : [[1, 1], [2, 1], [3, 1]];

    // 1. Shooting Animation: Anubis unleashes electric lightning, Bastet unleashes solar fire at combination
    setGuardianStrikeEvent({
      strikes: [
        {
          from: 'left',
          type: 'lightning',
          targetCells: targetCells,
          delay: 0,
        },
        {
          from: 'right',
          type: 'fire',
          targetCells: targetCells,
          delay: 150,
        },
      ],
    });

    soundEngine.playThunderStrike?.();
    setTimeout(() => soundEngine.playSolarFireball?.(), 160);

    // 2. Major Illumination occurs upon projectile impact
    setTimeout(() => {
      setMajorIlluminationCells(targetCells);
      setMajorIlluminationActive(true);
      soundEngine.playAnticipationRiser?.();
    }, 450);

    // 3. Celebration Animation saying "BONUS!"
    setTimeout(() => {
      setGuardianBonusCelebrationOpen(true);
      setGuardianAction(false);
    }, 1300);

    setStatusMessage(
      '⚡ APEX WRATH CONVERGENCE! GUARDIANS UNLEASH CELESTIAL STRIKE ON COMBINATION!'
    );
  }, [triggerAnubisPowerUp, triggerBastetPowerUp]);

  // Alternating power-up step helper: alternates between Anubis and Bastet
  const triggerAlternatingPowerUp = useCallback(() => {
    // If both are already fully powered up (4/4), unleash the Climax!
    if (anubisChargeRef.current >= 4 && bastetChargeRef.current >= 4) {
      triggerGuardianClimax();
      return;
    }

    const currentTarget = nextPowerUpGuardianRef.current;
    if (currentTarget === 'anubis') {
      const nextA = Math.min(4, anubisChargeRef.current + 1);
      triggerAnubisPowerUp(nextA);
      nextPowerUpGuardianRef.current = 'bastet';
      setNextPowerUpGuardian('bastet');
      setStatusMessage(`⚡ LORD ANUBIS POWERS UP (STAGE ${nextA}/4)! [NEXT POWER-UP -> QUEEN BASTET]`);
    } else {
      const nextB = Math.min(4, bastetChargeRef.current + 1);
      triggerBastetPowerUp(nextB);
      nextPowerUpGuardianRef.current = 'anubis';
      setNextPowerUpGuardian('anubis');
      setStatusMessage(`🌸 QUEEN BASTET POWERS UP (STAGE ${nextB}/4)! [NEXT POWER-UP -> LORD ANUBIS]`);
    }

    if (anubisChargeRef.current >= 4 && bastetChargeRef.current >= 4) {
      setStatusMessage('🔥⚡ BOTH GUARDIANS REACHED MAXIMUM APEX OVERCHARGE (4/4)! NEXT WIN UNLEASHES THE DIVINE BONUS!');
    }
  }, [triggerAnubisPowerUp, triggerBastetPowerUp, triggerGuardianClimax]);

  const handleStartFreeSpinsFromGuardians = useCallback(() => {
    setGuardianBonusCelebrationOpen(false);
    setMajorIlluminationActive(false);
    // Reset guardian charges to 0 so the player can build them up again
    triggerAnubisPowerUp(0);
    triggerBastetPowerUp(0);
    nextPowerUpGuardianRef.current = 'anubis';
    setNextPowerUpGuardian('anubis');

    // Launch 6 calibrated celestial free spins from Guardian Overcharge
    setAutoPlayCount(0);
    setFreeSpinsCount(6);
    setFreeSpinsOpen(true);
    soundEngine.playBonusTrigger?.();
  }, [triggerAnubisPowerUp, triggerBastetPowerUp]);

  const handleEnterBonusVaultFromGuardians = useCallback(() => {
    setGuardianBonusCelebrationOpen(false);
    setMajorIlluminationActive(false);
    // Reset guardian charges
    triggerAnubisPowerUp(0);
    triggerBastetPowerUp(0);
    nextPowerUpGuardianRef.current = 'anubis';
    setNextPowerUpGuardian('anubis');

    // Launch 3D Treasure Vault with balanced picks and 1x starting multiplier
    setAutoPlayCount(0);
    setBonusSession({
      triggerReason: 'Guardian Apex Overcharge 3D Vault',
      initialPicks: 5,
      wheelSpins: 3,
      startingMultiplier: 2,
      scatterWinCoins: 0,
      defaultGame: 'doors',
    });
    soundEngine.playBonusTrigger?.();
  }, [triggerAnubisPowerUp, triggerBastetPowerUp]);

  const [guardianMartialMove, setGuardianMartialMove] = useState(null);
  const [guardianStrikeEvent, setGuardianStrikeEvent] = useState(null);
  const landedSymbolsByColRef = useRef([null, null, null, null, null]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    soundEngine.playButtonClick(600);
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement;
        const requestFs =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (requestFs) {
          requestFs.call(docEl).catch(() => {});
        }
      } else {
        const exitFs =
          document.exitFullscreen ||
          document.webkitExitFullscreen ||
          document.mozCancelFullScreen ||
          document.msExitFullscreen;
        if (exitFs) {
          exitFs.call(document).catch(() => {});
        }
      }
    } catch {}
  };

  // Psychological Flow State & Rhythm Cadence Engine
  const [turboFlow, setTurboFlow] = useState(false);
  const [flowStreak, setFlowStreak] = useState(0);
  const isHoldingSpinRef = useRef(false);
  const lastSpinEndTimeRef = useRef(0);

  // Multi-Line Wagering and Per-Line Bet calculations for GC and SC
  const selectedLinesIdx = Math.max(0, LINE_OPTIONS.indexOf(selectedLines));
  const activeLineBetTiers = currencyMode === 'SC' ? LINE_BET_TIERS_SC : LINE_BET_TIERS_GC;
  const lineBetIdx = currencyMode === 'SC' ? lineBetIndexSC : lineBetIndexGC;
  const lineBetSC = LINE_BET_TIERS_SC[lineBetIndexSC] ?? 0.25;
  const lineBetGC = LINE_BET_TIERS_GC[lineBetIndexGC] ?? 25;
  const currentLineBet = currencyMode === 'SC' ? lineBetSC : lineBetGC;

  // The total bet is strictly calculated as: bet per line * selected lines
  const totalBetSC = Number((lineBetSC * selectedLines).toFixed(2));
  const totalBetGC = Math.round(lineBetGC * selectedLines);
  const currentBet = currencyMode === 'SC' ? totalBetSC : totalBetGC;
  const currentBetSC = totalBetSC;
  const currentBetGC = totalBetGC;
  const activeBetTiers = activeLineBetTiers;
  const currentBetIdx = lineBetIdx;
  const level = Math.max(1, Math.round(currencyMode === 'SC' ? totalBetSC / 0.25 : totalBetGC / 25));
  const coinValue = currencyMode === 'SC' ? lineBetSC : 1.0;
  const currentTheme = COLOR_PALETTES[neonThemeIdx % COLOR_PALETTES.length];

  const handleLaunchCelestialOverload = useCallback((existingBonusCoins = 0) => {
    if (existingBonusCoins > 0) {
      if (currencyMode === 'SC') {
        setSweepsCoins((prev) => {
          const next = Number((prev + existingBonusCoins).toFixed(2));
          sweepsCoinsRef.current = next;
          try {
            localStorage.setItem('dc_casino_sweeps_coins', next.toFixed(2));
          } catch {}
          return next;
        });
      } else {
        setGoldCoins((prev) => {
          const next = prev + existingBonusCoins;
          goldCoinsRef.current = next;
          try {
            localStorage.setItem('dc_casino_gold_coins', String(next));
          } catch {}
          return next;
        });
      }
      setLastWinCoins(existingBonusCoins);
    }
    setBonusSession(null);
    setGuardianBonusCelebrationOpen(false);
    setMajorIlluminationActive(false);
    setAutoPlayCount(0);
    setCelestialBonusBet(currentBet || 15);
    setCelestialBonusOpen(true);
    soundEngine.playBonusTrigger?.();
  }, [currencyMode, currentBet]);

  // Sync balances and currencyMode to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('dc_casino_currency_mode', currencyMode);
    } catch {}
  }, [currencyMode]);

  useEffect(() => {
    try {
      localStorage.setItem('dc_casino_gold_coins', String(goldCoins));
      authService.saveUserData(currentUser?.id, { goldCoins });
    } catch {}
  }, [goldCoins, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('dc_casino_sweeps_coins', sweepsCoins.toFixed(2));
      authService.saveUserData(currentUser?.id, { sweepsCoins });
    } catch {}
  }, [sweepsCoins, currentUser]);

  // Dynamically sync browser document title to the active theme
  useEffect(() => {
    if (CASINO_BRAND.pageTitle) {
      document.title = CASINO_BRAND.pageTitle;
    }
  }, []);

  // Strip legacy '?payment=...' param only (preserve '?payment_success=true&pkg=...' for the return handler below)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('payment') && !params.has('payment_success')) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (_) {}
  }, []);

  // VIP Player Authentication Listener: auto-react to login/logout events & swap per-account bankrolls
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged((user) => {
      setCurrentUser(user);
      const acc = authService.getUserData(user?.id);
      if (acc) {
        setGoldCoins(acc.goldCoins);
        goldCoinsRef.current = acc.goldCoins;
        setSweepsCoins(acc.sweepsCoins);
        sweepsCoinsRef.current = acc.sweepsCoins;
        if (user && acc.currencyMode) {
          setCurrencyMode(acc.currencyMode);
        } else if (!user) {
          setCurrencyMode('GC');
        }
      }
      if (!user && currencyMode === 'SC') {
        setCurrencyMode('GC');
        setStatusMessage('GUEST SESSION • SWITCHED TO SOCIAL GOLD COINS (GC).');
      } else if (user) {
        setStatusMessage(`WELCOME BACK, ${String(user?.name || 'VIP Player').toUpperCase()}! VIP ACCOUNT DATA RESTORED.`);
      }
    });
    return unsubscribe;
  }, [currencyMode]);

  // Ambient Flow Music: Auto-start on first interaction & sync with master mute
  useEffect(() => {
    ambientMusicEngine.initAutoStart();
  }, []);

  useEffect(() => {
    ambientMusicEngine.setMuted(muted);
  }, [muted]);

  // Auto-duck ambient music during Big Wins, Free Spins, or 3D Bonus rounds
  useEffect(() => {
    const isSpecialActive = bigWinAmount > 0 || Boolean(bonusSession) || freeSpinsOpen || celestialBonusOpen;
    ambientMusicEngine.duck(isSpecialActive);
  }, [bigWinAmount, bonusSession, freeSpinsOpen, celestialBonusOpen]);

  // Periodic Guardian eye blink (if configured on the left or right guardian)
  useEffect(() => {
    const interval = setInterval(() => {
      setGuardianBlinking(true);
      setTimeout(() => setGuardianBlinking(false), 180);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  // Cycle highlighted winning payline
  useEffect(() => {
    if (winningLines.length <= 1) {
      setActiveWinLineIdx(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveWinLineIdx((prev) => (prev + 1) % winningLines.length);
    }, 1600);
    return () => clearInterval(timer);
  }, [winningLines]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  /**
   * Hardened, 100% Authentic Slot Win Evaluator:
   *  1. Evaluates all 15 paylines strictly left-to-right starting at Reel 1 (c = 0).
   *  2. Bonus Scatter symbols (`sym.isBonus`) NEVER pay on paylines and Wilds NEVER substitute for Scatters.
   *  3. On each payline, evaluates both:
   *     - Any pure-wild prefix starting at Reel 1 (`pureWildCount >= 3`), AND
   *     - The first non-wild regular symbol chain starting at Reel 1 (`regMatchCount >= 3`),
   *     awarding whichever valid combination pays higher.
   *  4. Evaluates 3+ `isBonus` Scatter symbols anywhere on the 5×3 grid (awards Scatter payout + Bonus Game).
   */
  const evaluateGridWins = useCallback(
    (
      finalGrid,
      betLevel = 1,
      stripMetadata = {},
      activeLinesCount = selectedLines,
      effectiveLineBet = (currencyMode === 'SC' ? lineBetSC : lineBetGC)
    ) => {
      const numLines = activeLinesCount || selectedLines || 15;
      const isSC = currencyMode === 'SC';
      const outcome = slotMathEngine.evaluateGrid(finalGrid, 1, stripMetadata, numLines);

      // Map outcome to UI-compatible format with explicit cell coordinates and dual-currency figures
      const wins = outcome.winningLines.map((wl) => {
        // Find original symbol object from grid for UI rendering
        let symObj = null;
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < ROWS; r++) {
            if (finalGrid[c][r]?.id === wl.symbolId) {
              symObj = finalGrid[c][r];
              break;
            }
          }
          if (symObj) break;
        }
        const winCells =
          wl.cells ||
          Array.from({ length: wl.matchCount }, (_, c) => [c, wl.line.rows[c]]);

        // Each line win pays base payout * wild multiplier * per-line bet
        const lineWinSC = Number((wl.lineWin * lineBetSC).toFixed(2));
        const lineWinGC = Math.round(wl.lineWin * lineBetGC);

        return {
          line: wl.line,
          symbol: symObj || { id: wl.symbolId, name: wl.symbolName },
          matchCount: wl.matchCount,
          lineWin: isSC ? lineWinSC : lineWinGC,
          lineWinSC,
          lineWinGC,
          wildMultiplier: wl.multiplier,
          isScatter: false,
          cells: winCells,
        };
      });

      if (outcome.scatterCount >= 3) {
        let bonusSym = null;
        for (let c = 0; c < COLS; c++) {
          for (let r = 0; r < ROWS; r++) {
            if (finalGrid[c][r]?.isBonus) {
              bonusSym = finalGrid[c][r];
              break;
            }
          }
          if (bonusSym) break;
        }
        const scatterCells =
          outcome.scatterPositions && outcome.scatterPositions.length > 0
            ? outcome.scatterPositions.map((p) => [p.col, p.row])
            : [];
        if (scatterCells.length === 0) {
          for (let c = 0; c < COLS; c++) {
            for (let r = 0; r < ROWS; r++) {
              if (finalGrid[c][r]?.isBonus) scatterCells.push([c, r]);
            }
          }
        }
        const scatterWinSC = Number((outcome.scatterWin * lineBetSC).toFixed(2));
        const scatterWinGC = Math.round(outcome.scatterWin * lineBetGC);
        wins.unshift({
          line: {
            id: 'BONUS',
            name: `${outcome.scatterCount}× ${bonusSym?.name || 'Solar Scarab Scatters'}`,
            rows: [1, 1, 1, 1, 1],
            color: '#fbbf24',
          },
          symbol: bonusSym || { id: 'bonus_crest', name: '3D Solar Scarab Relic' },
          matchCount: outcome.scatterCount,
          lineWin: isSC ? scatterWinSC : scatterWinGC,
          lineWinSC,
          lineWinGC,
          wildMultiplier: 1,
          isScatter: true,
          cells: scatterCells,
        });
      }

      const totalWinCoins = isSC
        ? Number((outcome.totalWin * lineBetSC).toFixed(2))
        : Math.round(outcome.totalWin * lineBetGC);

      const scatterWinCoins = isSC
        ? Number((outcome.scatterWin * lineBetSC).toFixed(2))
        : Math.round(outcome.scatterWin * lineBetGC);

      return {
        wins,
        winCoordSet: new Set(outcome.winningCells),
        totalCoinsWon: totalWinCoins,
        bonusCount: outcome.scatterCount,
        scatterWinCoins,
        meterChargesEarned: outcome.meterChargesEarned,
        winCategory: outcome.winCategory,
        isLDW: outcome.isLDW,
        nearMiss: outcome.nearMiss,
        outcome,
      };
    },
    [currencyMode, lineBetSC, lineBetGC, selectedLines]
  );

  const handleColumnStop = useCallback((colIdx, didExpand, targetSymbols) => {
    if (targetSymbols) {
      landedSymbolsByColRef.current[colIdx] = targetSymbols;
    }
    if (didExpand) {
      setGuardianAction(true);
      soundEngine.playAnubisExpand();
      setTimeout(() => setGuardianAction(false), 1200);
    }

    // Dynamic Guardian Perched & Illumination Suspense Evaluation:
    // Check symbols landed across stopped reels (col 0 through colIdx)
    let scattersLanded = 0;
    let highMatchingCount = 0;
    const landedCols = landedSymbolsByColRef.current.slice(0, colIdx + 1).filter(Boolean);
    landedCols.forEach((colSyms) => {
      colSyms.forEach((sym) => {
        if (sym?.isBonus) scattersLanded++;
        if (sym?.isTopHigh || sym?.id === 'high_scarab' || sym?.id === 'high_eye' || sym?.id === 'high_ankh') {
          highMatchingCount++;
        }
      });
    });

    if (scattersLanded >= 2 && colIdx < COLS - 1) {
      // 2 Scatters landed: anticipation riser audio cue
      soundEngine.playAnticipationRiser();
    }
  }, []);

  const handleSpinComplete = useCallback(() => {
    isSpinningRef.current = false;
    setIsSpinning(false);

    const pending = pendingSpinRef.current;
    if (!pending) {
      return;
    }

    const { nextGrid, activeLevel, spinBet, lineBet, linesCount, forcedMode, stripMetadata } = pending;
    const {
      wins,
      winCoordSet,
      totalCoinsWon,
      bonusCount,
      scatterWinCoins,
      meterChargesEarned,
      winCategory,
      isLDW,
      nearMiss,
    } = evaluateGridWins(nextGrid, activeLevel, stripMetadata || {}, linesCount || selectedLines, lineBet);

    // Update the 3D Bonus Collector Meter
    let meterTriggeredBonus = false;
    setBonusMeter((prev) => {
      const nextVal = prev + meterChargesEarned;
      if (nextVal >= BONUS_METER_GOAL && bonusCount < 3) {
        meterTriggeredBonus = true;
        return BONUS_METER_GOAL;
      }
      return Math.min(BONUS_METER_GOAL, nextVal);
    });

    const isSC = currencyMode === 'SC';
    const finalWin = totalCoinsWon;
    const finalScatterWin = scatterWinCoins;

    if (totalCoinsWon > 0) {
      if (isSC) {
        setSweepsCoins((prev) => Number((prev + finalWin).toFixed(2)));
      } else {
        setGoldCoins((prev) => prev + finalWin);
      }
      setLastWinCoins(finalWin);
      setWinningLines(wins);
      setWinningCells(winCoordSet);

      const isBig = finalWin >= spinBet * 8 || forcedMode === 'bigwin' || forcedMode === 'megawin' || forcedMode === 'ultrawin';
      setGuardianAction(true);
      setTimeout(() => setGuardianAction(false), 1800);

      // Trigger tactile cabinet recoil and floating win text
      triggerCabinetImpact(isBig ? 'mega' : 'win');
      setFloatingWinText(isSC ? `+${formatCoinValue(finalWin)} SC` : `+${finalWin.toLocaleString()} GC`);
      setFloatingWinKey((k) => k + 1);

      if (isBig) {
        setBigWinAmount(finalWin);
        setWinSplashAmount(0); // Mega Win modal handles display and sound
      } else {
        setBigWinAmount(0);
        setWinSplashAmount(finalWin); // WinCelebrationSplash handles display and sound once
      }

      // Guardian Selective Animation & Persistent Charge Build-Up Engine:
      // Characters do NOT move on every win; only on rare select combinations (sacred awakening relics, 4/5-of-a-kind, expanding wilds, big wins, scatters).
      const allWinCells = Array.from(winCoordSet).map((k) => k.split(',').map(Number));
      const hasExpandingWild = pending?.nextExpanded && pending.nextExpanded.some((e) => e === true);
      const hasLotusMatch = wins.some((w) => w.symbol?.id === 'bastet_lotus');
      const hasScepterMatch = wins.some((w) => w.symbol?.id === 'anubis_scepter');
      const hasGuardianAwakener = hasLotusMatch || hasScepterMatch;
      const hasHighMatch = wins.some(
        (w) =>
          w.matchCount >= 4 ||
          (w.matchCount >= 3 &&
            (w.symbol?.isTopHigh ||
              w.symbol?.isGuardianAwakener ||
              w.symbol?.id === 'bastet_lotus' ||
              w.symbol?.id === 'anubis_scepter' ||
              w.symbol?.id === 'eye'))
      );
      const isSelectCombination = isBig || bonusCount >= 2 || hasExpandingWild || hasHighMatch || hasGuardianAwakener;
      const currentCharge = guardianChargeLevelRef.current ?? guardianChargeLevel;

      if (bonusCount >= 3) {
        // =========================================================================
        // 3+ SACRED SCATTERS: GRAND CELESTIAL STRIKE + WRATH OF THE GODS BONUS ROUND!
        // =========================================================================
        setGuardianAction(true);
        const leftTargets = allWinCells.filter((c) => c[0] <= 2);
        const rightTargets = allWinCells.filter((c) => c[0] >= 2);

        setGuardianStrikeEvent({
          strikes: [
            {
              from: 'left',
              type: 'lightning',
              targetCells: leftTargets.length > 0 ? leftTargets : allWinCells,
              delay: 0,
            },
            {
              from: 'right',
              type: 'fire',
              targetCells: rightTargets.length > 0 ? rightTargets : allWinCells,
              delay: 150,
            },
          ],
        });

        soundEngine.playThunderStrike();
        setTimeout(() => soundEngine.playSolarFireball(), 160);
        setTimeout(() => soundEngine.playBonusTrigger(), 450);

        setStatusMessage(
          `⚡ GRAND CELESTIAL STRIKE UNLEASHED! ${bonusCount} SCATTERS TRIGGER CELESTIAL SOLAR FREE SPINS!`
        );

        setTimeout(() => {
          setGuardianAction(false);
        }, 1600);
      } else if (isSelectCombination) {
        // =========================================================================
        // 2026 ALTERNATING GUARDIAN POWER-UPS & FULL CHARGE CLIMAX:
        // 1. Power-ups strictly alternate between Lord Anubis and Queen Bastet.
        // 2. Once both are fully powered up (4/4) and get another power-up:
        //    They shoot lightning & fire at the combination, causing major illumination,
        //    a celebratory "BONUS!" animation, and launching Free Automatic Spins!
        // =========================================================================
        const areBothFullyPowered =
          anubisChargeRef.current >= 4 && bastetChargeRef.current >= 4;

        let statusText = '';

        if (areBothFullyPowered) {
          // CLIMAX: Fully powered up AND received another power-up from this combination!
          triggerGuardianClimax(allWinCells);
          statusText = '⚡🔥 DUAL GUARDIANS FULLY CHARGED! LIGHTNING & FIRE STRIKE COMBINATION — BONUS ACTIVATED!';
        } else {
          // Standard alternating power-up sequence
          setGuardianAction(true);
          setTimeout(() => setGuardianAction(false), 1600);

          const currentTarget = nextPowerUpGuardianRef.current;
          if (currentTarget === 'anubis') {
            const nextA = Math.min(4, anubisChargeRef.current + 1);
            triggerAnubisPowerUp(nextA);
            nextPowerUpGuardianRef.current = 'bastet';
            setNextPowerUpGuardian('bastet');
            statusText = `⚡ LORD ANUBIS POWERS UP (STAGE ${nextA}/4)! [NEXT POWER-UP -> QUEEN BASTET]`;
          } else {
            const nextB = Math.min(4, bastetChargeRef.current + 1);
            triggerBastetPowerUp(nextB);
            nextPowerUpGuardianRef.current = 'anubis';
            setNextPowerUpGuardian('anubis');
            statusText = `🌸 QUEEN BASTET POWERS UP (STAGE ${nextB}/4)! [NEXT POWER-UP -> LORD ANUBIS]`;
          }

          if (anubisChargeRef.current >= 4 && bastetChargeRef.current >= 4) {
            statusText = '🔥⚡ BOTH GUARDIANS REACHED MAXIMUM APEX OVERCHARGE (4/4)! NEXT WIN UNLEASHES THE DIVINE BONUS!';
          }
        }

        const firstWin = wins[0];
        if (isBig) {
          setStatusMessage(
            `${statusText} ${THEME_COPY.megaWinTickerPrefix} ${
              isSC ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD PRIZE)` : `${finalWin.toLocaleString()} GC`
            }!`
          );
        } else {
          setStatusMessage(
            `${statusText} ${wins.length} PAYLINE${wins.length > 1 ? 'S' : ''} (${firstWin.matchCount}× ${firstWin.symbol.name}) PAID ${
              isSC ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD)` : `${finalWin.toLocaleString()} GC`
            }!`
          );
        }
      } else {
        // =========================================================================
        // REGULAR LOW WIN (3 Royal Symbols): GUARDIANS REMAIN CALM & DIGNIFIED
        // They do NOT move or attack on ordinary wins, preserving their current charge!
        // =========================================================================
        setGuardianAction(false);
        const firstWin = wins[0];
        setStatusMessage(
          `VERIFIED WIN! ${wins.length} PAYLINE${wins.length > 1 ? 'S' : ''} (${firstWin.matchCount}× ${firstWin.symbol.name}) PAID ${
            isSC ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD)` : `${finalWin.toLocaleString()} GC`
          }!`
        );
      }
    } else {
      // Losses: Bet subtracted at spin start
      setWinSplashAmount(0);
      if (nearMiss?.isNearMiss) {
        // Near miss: 2 scatters landed! Perch up to Level 2 to build suspense, preserving charge!
        updateGuardianCharge((prev) => Math.max(prev, 2));
        soundEngine.playAnticipationRiser();
        setStatusMessage(`⚡ NEAR-MISS! ${nearMiss.description} • GUARDIANS PERCHED IN SUSPENSE!`);
      } else {
        // On regular spin with no win: do NOT wipe out their hard-earned charge!
        // Maintain their living presence.
        setStatusMessage(`${CASINO_BRAND.casinoFullTitle} • ${CASINO_BRAND.edition}`);
      }
    }

    // Psychological Flow State Momentum Tracking & Music Synchronization
    const nowMs = performance.now();
    const intervalSinceLastSpin = nowMs - lastSpinEndTimeRef.current;
    lastSpinEndTimeRef.current = nowMs;

    let nextStreak = 1;
    if (intervalSinceLastSpin < (turboFlow ? 3500 : 5500)) {
      nextStreak = flowStreak + 1;
      setFlowStreak(nextStreak);
      ambientMusicEngine.setFlowMomentum?.(nextStreak);
      if (nextStreak >= 3 && totalCoinsWon === 0) {
        soundEngine.playFlowStreak(nextStreak);
        setStatusMessage(`⚡ FLOW MOMENTUM ACTIVE (${nextStreak}X RHYTHM CHAIN) • IN THE ZONE!`);
      }
    } else {
      setFlowStreak(1);
      ambientMusicEngine.setFlowMomentum?.(1);
    }

    // Continuous Hold-to-Spin Flow Loop
    if (
      isHoldingSpinRef.current &&
      bonusCount < 3 &&
      !meterTriggeredBonus &&
      !freeSpinsOpen &&
      !bonusSession
    ) {
      setTimeout(() => {
        if (isHoldingSpinRef.current && !isSpinningRef.current) {
          triggerSpinRef.current?.();
        }
      }, turboFlow ? 140 : 280);
    }

    // Launch the Celestial Free Spins Feature if 3+ Scatters landed!
    if (bonusCount >= 3) {
      setAutoPlayCount(0);
      const awardedSpins = bonusCount >= 5 ? 15 : bonusCount === 4 ? 12 : 10;
      setTimeout(() => {
        soundEngine.playBonusTrigger();
        setFreeSpinsCount(awardedSpins);
        setFreeSpinsOpen(true);
      }, 900);
    } else if (meterTriggeredBonus) {
      setAutoPlayCount(0);
      setTimeout(() => {
        setCollectorCelebrationOpen(true);
        setStatusMessage(
          `⚡ 36/36 ROYAL CHAKRA COLLECTOR FULL! 2× MULTIPLIER UNLOCKED! SOVEREIGN PHARAOH UNLEASHED!`
        );
      }, 700);
    } else {
      // Flow-Safe Low-Balance / Rescue Refill Check:
      // Triggered if player's SC or GC runs critically low/out after a spin completes.
      const nowTimestamp = Date.now();
      const isSC = currencyMode === 'SC';
      const bal = isSC ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins);
      const isDepleted = isSC ? bal < 0.15 : bal < 15;
      const isCriticallyLow = isSC ? bal <= 0.50 : bal <= 50;

      // When depleted, prompt after 1200ms with a 30s cooldown; when low, 60s cooldown
      const cooldownMs = isDepleted ? 30000 : 60000;
      if (
        (isDepleted || isCriticallyLow) &&
        nowTimestamp - lastLowBalanceOfferTimeRef.current > cooldownMs &&
        !isHoldingSpinRef.current
      ) {
        setTimeout(() => {
          if (
            !isSpinningRef.current &&
            !freeSpinsOpen &&
            !bonusSession &&
            !isHoldingSpinRef.current
          ) {
            const currentLiveBal = isSC ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins);
            if (currentLiveBal <= (isSC ? 0.50 : 50)) {
              setLowBalanceOfferOpen(true);
              lastLowBalanceOfferTimeRef.current = Date.now();
            }
          }
        }, 1200);
      } else {
        // High-Conversion Mid-Session Milestone / Hot-Streak VIP Flash Drop
        sessionSpinCountRef.current += 1;
        if (
          !hasShownHotStreakPromoRef.current &&
          (sessionSpinCountRef.current === 8 || flowStreak >= 3) &&
          !isHoldingSpinRef.current &&
          nowTimestamp - lastLowBalanceOfferTimeRef.current > 45000
        ) {
          hasShownHotStreakPromoRef.current = true;
          setTimeout(() => {
            if (
              !isSpinningRef.current &&
              !freeSpinsOpen &&
              !bonusSession &&
              !isHoldingSpinRef.current
            ) {
              setVipPromoAdReason('hot_streak');
              setVipPromoAdOpen(true);
            }
          }, 1400);
        }
      }
    }
  }, [evaluateGridWins, currencyMode, turboFlow, flowStreak, sweepsCoins, goldCoins, freeSpinsOpen, bonusSession]);

  const handleEnterBonusFromCollector = () => {
    setCollectorCelebrationOpen(false);
    setBonusMeter(0);
    setBonusSession({
      triggerReason: BONUS_CONFIG.meterTriggerName,
      initialPicks: 5,
      wheelSpins: 3,
      startingMultiplier: 1,
      scatterWinCoins: 0,
      defaultGame: 'doors',
    });
  };

  const handleCollectorClick = () => {
    if (isSpinning) return;
    if (bonusMeter >= BONUS_METER_GOAL) {
      setCollectorCelebrationOpen(true);
    } else {
      openBonusGamesManually('doors');
    }
  };

  const openBonusGamesManually = (defaultGame = 'doors') => {
    if (isSpinning) return;
    soundEngine.playBonusTrigger();
    setAutoPlayCount(0);
    setBonusSession({
      triggerReason: BONUS_CONFIG.vipDirectTriggerName,
      initialPicks: 5,
      wheelSpins: 3,
      startingMultiplier: 1,
      scatterWinCoins: 0,
      defaultGame,
    });
    if (bonusMeter >= BONUS_METER_GOAL) {
      setBonusMeter(0);
    }
  };

  const handleCompleteBonus = (totalBonusCoins) => {
    const isSC = currencyMode === 'SC';
    const extraCoinsBeyondScatter =
      totalBonusCoins - (bonusSession?.scatterWinCoins || 0);

    if (isSC) {
      const extraSC = Number(extraCoinsBeyondScatter.toFixed(2));
      const totalSC = Number(totalBonusCoins.toFixed(2));
      if (extraSC > 0) {
        setSweepsCoins((prev) => Number((prev + extraSC).toFixed(2)));
      }
      setLastWinCoins(totalSC);
      setBonusSession(null);
      if (totalSC > 0) {
        setBigWinAmount(totalSC);
        setStatusMessage(
          `3D BONUS COMPLETED! ${String(CASINO_BRAND?.creatorName || 'DC Enterprises').toUpperCase()} WON ${totalSC.toFixed(2)} SC ($${totalSC.toFixed(2)} USD PRIZE)!`
        );
      }
    } else {
      if (extraCoinsBeyondScatter > 0) {
        setGoldCoins((prev) => prev + extraCoinsBeyondScatter);
      }
      setLastWinCoins(totalBonusCoins);
      setBonusSession(null);
      if (totalBonusCoins > 0) {
        setBigWinAmount(totalBonusCoins);
        setStatusMessage(
          `3D BONUS COMPLETED! ${String(CASINO_BRAND?.creatorName || 'DC Enterprises').toUpperCase()} WON ${totalBonusCoins.toLocaleString()} TOTAL BONUS GOLD COINS!`
        );
      }
    }
  };

  const triggerFreeSpinsManually = (spins = 10) => {
    if (isSpinning || freeSpinsOpen) return;
    setAutoPlayCount(0);
    setFreeSpinsCount(spins);
    setFreeSpinsOpen(true);
    soundEngine.playBonusTrigger();
  };

  const handleCompleteFreeSpins = (totalBonusWon) => {
    setFreeSpinsOpen(false);
    if (totalBonusWon > 0) {
      if (currencyMode === 'SC') {
        setSweepsCoins((prev) => Number((prev + totalBonusWon).toFixed(2)));
      } else {
        setGoldCoins((prev) => prev + totalBonusWon);
      }
      setLastWinCoins(totalBonusWon);
      setBigWinAmount(totalBonusWon);
      setStatusMessage(
        `CELESTIAL FREE SPINS COMPLETED! WON +${
          currencyMode === 'SC'
            ? `$${totalBonusWon.toFixed(2)} USD`
            : `${totalBonusWon.toLocaleString()} GC`
        } TOTAL BONUS!`
      );
    }
  };

  const handlePurchaseSuccess = (data) => {
    const addedGC = data.goldCoins ?? data.goldCoinsAdded ?? 0;
    const addedSC = data.freeSweepsCoins ?? data.sweepsCoinsAdded ?? 0;

    // If the user was a Guest when they completed a purchase, automatically upgrade them to a verified VIP account so SC is unlocked!
    let activeUser = authService.getCurrentUser();
    if (!activeUser) {
      activeUser = {
        id: 'usr_vip_high_roller',
        name: 'High Roller VIP',
        email: 'highroller@dc-casino.vip',
        provider: 'vip_pass',
        method: 'vip_pass',
        tier: 'VIP MEMBER',
        isVerifiedSC: true,
        scEligibility: 'eligible',
        joinedAt: new Date().toISOString(),
      };
      authService.saveSession(activeUser);
      setCurrentUser(activeUser);
    }

    const nextGC = (goldCoinsRef.current ?? goldCoins) + addedGC;
    const nextSC = Number(((sweepsCoinsRef.current ?? sweepsCoins) + addedSC).toFixed(2));

    setGoldCoins(nextGC);
    goldCoinsRef.current = nextGC;
    try {
      localStorage.setItem('dc_casino_gold_coins', String(nextGC));
    } catch {}

    setSweepsCoins(nextSC);
    sweepsCoinsRef.current = nextSC;
    try {
      localStorage.setItem('dc_casino_sweeps_coins', nextSC.toFixed(2));
    } catch {}

    if (addedSC > 0) {
      setCurrencyMode('SC');
    }
    authService.saveUserData(activeUser?.id, {
      goldCoins: nextGC,
      sweepsCoins: nextSC,
      currencyMode: addedSC > 0 ? 'SC' : currencyMode,
    });

    // Ensure all purchase/offer modals are closed immediately
    setLowBalanceOfferOpen(false);
    setPaymentModalOpen(false);
    setSelectedStorePackage(null);
    lastLowBalanceOfferTimeRef.current = Date.now();

    // Auto-adjust bet tiers if current bet was higher than the user's funds
    if (BET_TIERS_GC[betIndexGC] > nextGC && nextGC >= BET_TIERS_GC[0]) {
      let fitIdx = BET_TIERS_GC.length - 1;
      while (fitIdx > 0 && BET_TIERS_GC[fitIdx] > nextGC) fitIdx--;
      setBetIndexGC(fitIdx);
    }
    if (BET_TIERS_SC[betIndexSC] > nextSC && nextSC >= BET_TIERS_SC[0]) {
      let fitIdx = BET_TIERS_SC.length - 1;
      while (fitIdx > 0 && BET_TIERS_SC[fitIdx] > nextSC) fitIdx--;
      setBetIndexSC(fitIdx);
    }

    soundEngine.playWin(true);
    setFloatingWinText(`+${addedGC.toLocaleString()} GC & +${addedSC.toFixed(2)} FREE SC!`);
    setFloatingWinKey((k) => k + 1);
    triggerCabinetImpact('win');
    setStatusMessage(
      `🎉 PAYMENT SUCCESS! CREDITED +${addedGC.toLocaleString()} GC & +${addedSC.toFixed(2)} FREE SC TO YOUR TOP BALANCE!`
    );
  };

  const handleRedeemSuccess = (amountSC) => {
    setSweepsCoins((prev) => {
      const next = Math.max(0, Number((prev - amountSC).toFixed(2)));
      sweepsCoinsRef.current = next;
      try {
        localStorage.setItem('dc_casino_sweeps_coins', next.toFixed(2));
      } catch {}
      return next;
    });
    soundEngine.playWin(false);
    setStatusMessage(
      `PRIZE REDEMPTION SUBMITTED! $${amountSC.toFixed(2)} USD SENT TO YOUR ACCOUNT.`
    );
  };

  // Automatic Game Return Listener for Cash App Pay and Stripe Checkout (?payment_success=true&pkg=...)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const isSuccess = params.get('payment_success') === 'true' || params.get('success') === 'true';
      const pkgId =
        params.get('pkg') ||
        params.get('client_reference_id') ||
        localStorage.getItem('dc_pending_purchase_pkg');

      if (isSuccess) {
        let matchedPkg = null;
        if (pkgId) {
          matchedPkg =
            SWEEPSTAKES_CONFIG.storePackages.find((p) => p.id === pkgId) ||
            (SWEEPSTAKES_CONFIG.featuredRoyalPackage?.id === pkgId
              ? SWEEPSTAKES_CONFIG.featuredRoyalPackage
              : null) ||
            SWEEPSTAKES_CONFIG.highRollerPackages.find((p) => p.id === pkgId) ||
            SWEEPSTAKES_CONFIG.rescuePackages.find((p) => p.id === pkgId);
        }

        // Check for custom amount purchase via URL query params or saved custom package
        if (!matchedPkg) {
          const urlAmount = parseFloat(params.get('amount') || '0');
          const urlGC = parseInt(params.get('gc') || '0', 10);
          const urlSC = parseFloat(params.get('sc') || '0');
          if (urlAmount >= 1) {
            const calc = calculateCustomPackage(urlAmount);
            matchedPkg = {
              ...calc,
              id: pkgId || calc.id,
              priceUsd: urlAmount,
              goldCoins: urlGC > 0 ? urlGC : calc.goldCoins,
              freeSweepsCoins: urlSC > 0 ? urlSC : calc.freeSweepsCoins,
            };
          } else {
            try {
              const savedCustom = localStorage.getItem('dc_pending_purchase_custom_pkg');
              if (savedCustom) {
                const parsed = JSON.parse(savedCustom);
                if (parsed && parsed.priceUsd > 0 && parsed.goldCoins > 0) {
                  matchedPkg = parsed;
                }
              }
            } catch {}
          }
        }

        if (!matchedPkg) {
          matchedPkg = SWEEPSTAKES_CONFIG.storePackages[2]; // Fallback to Silver Bundle
        }

        if (matchedPkg) {
          setShowSplash(false);
          paymentService.recordPurchase({
            packageId: matchedPkg.id,
            amountUsd: matchedPkg.priceUsd,
            goldCoins: matchedPkg.goldCoins,
            sweepsCoins: matchedPkg.freeSweepsCoins,
            method: 'stripe_checkout',
            status: 'completed',
          });
          handlePurchaseSuccess(matchedPkg);
          soundEngine.playWinCelebration('big');
        }

        // Clean query params so refresh doesn't trigger duplicate credit
        try {
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
          localStorage.removeItem('dc_pending_purchase_pkg');
          localStorage.removeItem('dc_pending_purchase_custom_pkg');
        } catch {}
      }
    } catch (err) {
      console.warn('Payment return redirect check error:', err);
    }
  }, []);

  const triggerSpin = useCallback(
    (forcedMode = null, overrideBet = null) => {
      // PRELOAD GUARD: Player cannot spin until 100% of game assets are pre-cached
      if (!isAssetsLoaded) {
        setStatusMessage('PRE-CACHING 3D RELICS & ASSETS... PLEASE WAIT.');
        return;
      }

      // QUICK STOP / SLAM STOP: If reels are already spinning, immediately complete the spin
      if (isSpinningRef.current) {
        triggerCabinetImpact('slam');
        phaserEngineRef.current?.instantStop();
        return;
      }
      if (bonusSession || freeSpinsOpen) return;

      let effectiveCurrency = currencyMode;
      let isSC = effectiveCurrency === 'SC';
      const liveSC = sweepsCoinsRef.current ?? sweepsCoins;
      const liveGC = goldCoinsRef.current ?? goldCoins;

      // VIP login enforcement for SC
      if (isSC && !currentUser) {
        setCurrencyMode('GC');
        effectiveCurrency = 'GC';
        isSC = false;
        setStatusMessage('GUEST SESSION • PLAYING FOR SOCIAL GOLD COINS (GC).');
      }

      let activeSpinBet = overrideBet;
      let activeLineBet = isSC ? lineBetSC : lineBetGC;
      let activeLinesCount = selectedLines;

      if (activeSpinBet == null) {
        activeSpinBet = isSC ? totalBetSC : totalBetGC;
      }

      // Smart Balance Evaluation & Dynamic Bet Adjuster:
      // If the player has coins, NEVER block them from spinning!
      if (isSC) {
        const minSCBet = LINE_BET_TIERS_SC[0]; // 0.25 SC min
        if (liveSC >= activeSpinBet) {
          // Normal: Player has sufficient SC for this bet
        } else if (liveSC >= minSCBet) {
          // Player has SC, but current total bet is higher than balance
          // 1. Try lowering the per-line bet tier at current selectedLines
          let fitIdx = lineBetIndexSC;
          while (fitIdx > 0 && Number((LINE_BET_TIERS_SC[fitIdx] * activeLinesCount).toFixed(2)) > liveSC) {
            fitIdx--;
          }
          if (Number((LINE_BET_TIERS_SC[fitIdx] * activeLinesCount).toFixed(2)) <= liveSC) {
            setLineBetIndexSC(fitIdx);
            activeLineBet = LINE_BET_TIERS_SC[fitIdx];
            activeSpinBet = Number((activeLineBet * activeLinesCount).toFixed(2));
            setStatusMessage(`BET AUTO-ADJUSTED TO $${activeSpinBet.toFixed(2)} SC ($${formatCoinValue(activeLineBet)} × ${activeLinesCount}L) TO MATCH YOUR BALANCE!`);
          } else {
            // Even at lowest line bet (0.25), reduce active lines to fit
            let fitLinesIdx = LINE_OPTIONS.length - 1;
            while (fitLinesIdx > 0 && Number((LINE_BET_TIERS_SC[0] * LINE_OPTIONS[fitLinesIdx]).toFixed(2)) > liveSC) {
              fitLinesIdx--;
            }
            setSelectedLines(LINE_OPTIONS[fitLinesIdx]);
            setLineBetIndexSC(0);
            activeLinesCount = LINE_OPTIONS[fitLinesIdx];
            activeLineBet = LINE_BET_TIERS_SC[0];
            activeSpinBet = Number((activeLineBet * activeLinesCount).toFixed(2));
            setStatusMessage(`LINES & BET AUTO-ADJUSTED TO $${activeSpinBet.toFixed(2)} SC ($0.25 × ${activeLinesCount}L) TO MATCH YOUR BALANCE!`);
          }
        } else {
          // Player is OUT of Sweeps Coins (< 0.25 SC)
          // Open the Refill modal immediately with 1-click Gold Coin bundles (+ Free SC)
          setAutoPlayCount(0);
          soundEngine.playButtonClick(420);
          setStatusMessage('OUT OF SWEEPS COINS! REFILL GOLD COINS TO CLAIM FREE BONUS SC, OR SWITCH TO SOCIAL PLAY.');
          setLowBalanceOfferOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
          return;
        }
      }

      if (!isSC) {
        const minGCBet = LINE_BET_TIERS_GC[0]; // 25 GC min
        if (liveGC >= activeSpinBet) {
          // Normal: Player has sufficient GC for this bet
        } else if (liveGC >= minGCBet) {
          let fitIdx = lineBetIndexGC;
          while (fitIdx > 0 && Math.round(LINE_BET_TIERS_GC[fitIdx] * activeLinesCount) > liveGC) {
            fitIdx--;
          }
          if (Math.round(LINE_BET_TIERS_GC[fitIdx] * activeLinesCount) <= liveGC) {
            setLineBetIndexGC(fitIdx);
            activeLineBet = LINE_BET_TIERS_GC[fitIdx];
            activeSpinBet = Math.round(activeLineBet * activeLinesCount);
            setStatusMessage(`BET AUTO-ADJUSTED TO ${activeSpinBet.toLocaleString()} GC (${activeLineBet.toLocaleString()} × ${activeLinesCount}L) TO MATCH YOUR BALANCE!`);
          } else {
            let fitLinesIdx = LINE_OPTIONS.length - 1;
            while (fitLinesIdx > 0 && Math.round(LINE_BET_TIERS_GC[0] * LINE_OPTIONS[fitLinesIdx]) > liveGC) {
              fitLinesIdx--;
            }
            setSelectedLines(LINE_OPTIONS[fitLinesIdx]);
            setLineBetIndexGC(0);
            activeLinesCount = LINE_OPTIONS[fitLinesIdx];
            activeLineBet = LINE_BET_TIERS_GC[0];
            activeSpinBet = Math.round(activeLineBet * activeLinesCount);
            setStatusMessage(`LINES & BET AUTO-ADJUSTED TO ${activeSpinBet.toLocaleString()} GC (25 × ${activeLinesCount}L) TO MATCH YOUR BALANCE!`);
          }
        } else {
          // Out of Gold Coins (< 25 GC)
          setAutoPlayCount(0);
          soundEngine.playButtonClick(420);
          setStatusMessage('OUT OF GOLD COINS! REFILL IN STORE TO KEEP PLAYING OR SWITCH TO SWEEPS COINS.');
          setLowBalanceOfferOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
          return;
        }
      }

      const activeLevel = Math.max(1, Math.round(isSC ? activeSpinBet / 0.15 : activeSpinBet / 15));

      if (isSC) {
        setSweepsCoins((prev) => {
          const next = Math.max(0, Number((prev - activeSpinBet).toFixed(2)));
          sweepsCoinsRef.current = next;
          try {
            localStorage.setItem('dc_casino_sweeps_coins', next.toFixed(2));
          } catch {}
          return next;
        });
      } else {
        setGoldCoins((prev) => {
          const next = Math.max(0, prev - activeSpinBet);
          goldCoinsRef.current = next;
          try {
            localStorage.setItem('dc_casino_gold_coins', String(next));
          } catch {}
          return next;
        });
      }

      setLastWinCoins(0);
      setWinSplashAmount(0);
      setFloatingWinText(null);
      setSpinId((s) => s + 1);
      setWinningLines([]);
      setWinningCells(new Set());
      setBigWinAmount(0);
      // Preserve persistent guardian charge level across spins as they build up to the Grand Celestial Strike!
      setGuardianStrikeEvent(null);
      landedSymbolsByColRef.current = [null, null, null, null, null];
      isSpinningRef.current = true;
      setIsSpinning(true);
      setStatusMessage(THEME_COPY.spinningTicker);

      // Trigger Golden Shockwave and start sound
      setSpinShockwave(false);
      requestAnimationFrame(() => setSpinShockwave(true));
      soundEngine.playSpinStart();

      const activeSymbols = getSymbols(currencyMode);
      const wildSym = getWildSymbol(currencyMode);
      const expSym = getExpandingSymbol(currencyMode);
      const bonusSym = getBonusSymbol(currencyMode);
      const topHigh = getTopHighSymbol(currencyMode);
      const regs = getRegularSymbols(currencyMode);
      const r = (idx) => regs[idx % regs.length] || topHigh;

      let nextGrid;
      let stripMetadata = {};
      const nextExpanded = [false, false, false, false, false];

      if (forcedMode === 'anubis') {
        nextExpanded[1] = true;
        nextExpanded[3] = true;
        nextGrid = [
          [topHigh, r(2), topHigh],
          [expSym, expSym, expSym],
          [topHigh, r(2), topHigh],
          [expSym, expSym, expSym],
          [topHigh, r(2), topHigh],
        ];
      } else if (forcedMode === 'microwin') {
        const lowSym = regs[regs.length - 1] || topHigh;
        nextGrid = [
          [r(1), lowSym, r(3)],
          [r(2), lowSym, r(4)],
          [r(3), lowSym, r(5)],
          [r(4), r(6), r(1)],
          [r(5), r(7), r(2)],
        ];
      } else if (forcedMode === 'miniwin') {
        const midSym = regs[2] || topHigh;
        nextGrid = [
          [r(1), midSym, r(4)],
          [r(2), midSym, r(5)],
          [r(3), midSym, r(6)],
          [r(4), r(7), r(1)],
          [r(5), r(1), r(2)],
        ];
      } else if (forcedMode === 'superwin') {
        nextGrid = [
          [r(2), topHigh, r(4)],
          [r(3), topHigh, r(5)],
          [r(4), topHigh, r(6)],
          [r(5), topHigh, r(7)],
          [r(6), r(1), r(2)],
        ];
      } else if (forcedMode === 'bigwin') {
        nextGrid = [
          [topHigh, topHigh, r(4)],
          [topHigh, wildSym, r(5)],
          [wildSym, topHigh, topHigh],
          [topHigh, wildSym, r(6)],
          [topHigh, topHigh, r(7)],
        ];
      } else if (forcedMode === 'megawin') {
        nextGrid = [
          [topHigh, topHigh, topHigh],
          [topHigh, wildSym, topHigh],
          [wildSym, topHigh, wildSym],
          [topHigh, wildSym, topHigh],
          [topHigh, topHigh, r(4)],
        ];
      } else if (forcedMode === 'ultrawin') {
        nextGrid = [
          [wildSym, topHigh, wildSym],
          [topHigh, wildSym, topHigh],
          [wildSym, topHigh, wildSym],
          [topHigh, wildSym, topHigh],
          [wildSym, topHigh, wildSym],
        ];
      } else if (forcedMode === 'bonus') {
        nextGrid = [
          [r(4), bonusSym, r(6)],
          [r(2), r(5), r(7)],
          [r(6), bonusSym, r(1)],
          [r(3), r(4), r(5)],
          [r(7), bonusSym, r(2)],
        ];
      } else {
        // Phase 1 Math Core: Authentic Casino Physical Reel Strip RNG
        const stripResult = spinPhysicalReels();
        stripMetadata = stripResult;
        const symbolMap = new Map();
        activeSymbols.forEach((s) => {
          symbolMap.set(s.id, s);
          if (s.isBonus) {
            symbolMap.set('bonus_chest', s);
            symbolMap.set('bonus_crest', s);
          }
          if (s.isExpanding) {
            symbolMap.set('anubis', s);
            symbolMap.set('wild_expand', s);
          }
        });

        nextGrid = stripResult.grid.map((col) =>
          col.map((id) => symbolMap.get(id) || symbolMap.get('neon_10') || activeSymbols[0])
        );

        // Check expanding wild columns (Reels 2, 3, 4) — calibrated authentic casino feature rate
        let expandedCount = 0;
        for (let c = 1; c <= 3; c++) {
          const hasPhysicalExpand = nextGrid[c].some((s) => s.isExpanding);
          if ((hasPhysicalExpand && expandedCount < 2) || (!hasPhysicalExpand && expandedCount === 0 && Math.random() < 0.0015)) {
            nextExpanded[c] = true;
            nextGrid[c] = [expSym, expSym, expSym];
            expandedCount++;
          }
        }
      }

      pendingSpinRef.current = {
        nextGrid,
        nextExpanded,
        activeLevel,
        spinBet: activeSpinBet,
        lineBet: activeLineBet,
        linesCount: activeLinesCount,
        forcedMode,
        stripMetadata,
      };

      setSpinTrigger({
        id: Date.now() + Math.random(),
        targetGrid: nextGrid,
        targetExpanded: nextExpanded,
        isTurbo: turboFlow,
      });
    },
    [
      isSpinning,
      bonusSession,
      freeSpinsOpen,
      goldCoins,
      sweepsCoins,
      currencyMode,
      currentBetGC,
      currentBetSC,
      betIndexGC,
      betIndexSC,
      selectedLines,
      lineBetIndexSC,
      lineBetIndexGC,
      lineBetSC,
      lineBetGC,
      totalBetSC,
      totalBetGC,
      currentUser,
      turboFlow,
      isAssetsLoaded,
    ]
  );

  triggerSpinRef.current = triggerSpin;

  // --------------------------------------------------------------------------
  // Tap-to-Spin Engine: Allows players on mobile (and desktop) to tap anywhere
  // on the reels / symbols to trigger spin, slam-stop, or hold for continuous flow.
  // --------------------------------------------------------------------------
  const lastReelTapTimeRef = useRef(0);
  const reelTouchStartRef = useRef(null);

  const handleReelPointerDown = useCallback((e) => {
    // Only accept primary touch or left-click
    if (e.button !== undefined && e.button !== 0) return;
    isHoldingSpinRef.current = true;
    reelTouchStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
  }, []);

  const handleReelPointerUp = useCallback((e) => {
    isHoldingSpinRef.current = false;
    if (!reelTouchStartRef.current) return;
    const dx = Math.abs(e.clientX - reelTouchStartRef.current.x);
    const dy = Math.abs(e.clientY - reelTouchStartRef.current.y);
    const dt = Date.now() - reelTouchStartRef.current.time;
    reelTouchStartRef.current = null;

    // Detect quick intentional tap (held < 450ms and moved < 35px)
    if (dt < 450 && dx < 35 && dy < 35) {
      const now = Date.now();
      if (now - lastReelTapTimeRef.current > 200) {
        lastReelTapTimeRef.current = now;
        if (bigWinAmount > 0) setBigWinAmount(0);
        if (winSplashAmount > 0) setWinSplashAmount(0);
        triggerSpin();
      }
    }
  }, [bigWinAmount, winSplashAmount, triggerSpin]);

  const handleReelPointerCancel = useCallback(() => {
    isHoldingSpinRef.current = false;
    reelTouchStartRef.current = null;
  }, []);

  const handleReelClick = useCallback(() => {
    const now = Date.now();
    // Guard against duplicate trigger if pointerup already handled this tap
    if (now - lastReelTapTimeRef.current > 200) {
      lastReelTapTimeRef.current = now;
      if (bigWinAmount > 0) setBigWinAmount(0);
      if (winSplashAmount > 0) setWinSplashAmount(0);
      triggerSpin();
    }
  }, [bigWinAmount, winSplashAmount, triggerSpin]);

  // Autoplay handler
  useEffect(() => {
    if (autoPlayCount > 0 && !isSpinning && bigWinAmount === 0 && !bonusSession && !freeSpinsOpen && isAssetsLoaded) {
      const timer = setTimeout(() => {
        setAutoPlayCount((prev) => Math.max(0, prev - 1));
        triggerSpin();
      }, turboFlow ? 450 : 900);
      return () => clearTimeout(timer);
    }
  }, [autoPlayCount, isSpinning, bigWinAmount, bonusSession, freeSpinsOpen, triggerSpin, turboFlow, isAssetsLoaded]);

  // Desktop & Adaptive Keyboard Shortcuts (Space, Bet Up/Down, Lines Left/Right, Mute, Fullscreen, Paytable, Bonus, Navigation, Shortcut Helper, Escape)
  useEffect(() => {
    const onKeyDown = (e) => {
      // Do not intercept if user is typing in an input, textarea, select, or contentEditable field
      if (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName) ||
        e.target?.isContentEditable
      ) {
        return;
      }

      // Escape: Dismiss temporary UI (modals, drawers, overlays)
      if (e.code === 'Escape') {
        if (e.repeat) return;
        if (keyboardShortcutsOpen) {
          setKeyboardShortcutsOpen(false);
          return;
        }
        if (bigWinAmount > 0) setBigWinAmount(0);
        if (winSplashAmount > 0) setWinSplashAmount(0);
        if (paytableOpen) setPaytableOpen(false);
        if (paymentModalOpen) setPaymentModalOpen(false);
        if (authModalOpen) setAuthModalOpen(false);
        if (lowBalanceOfferOpen) setLowBalanceOfferOpen(false);
        return;
      }

      // Keyboard Shortcut Helper: ? (Shift+Slash) or Ctrl+Slash
      if (
        (e.code === 'Slash' && (e.shiftKey || e.ctrlKey || e.metaKey)) ||
        e.key === '?'
      ) {
        e.preventDefault();
        if (e.repeat) return;
        soundEngine.playButtonClick(680);
        setKeyboardShortcutsOpen((prev) => !prev);
        return;
      }

      // Ctrl+1 to Ctrl+4: Switch top-level navigation destinations
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && !showSplash) {
        if (e.code === 'Digit1') {
          e.preventDefault();
          if (e.repeat) return;
          setPaymentModalTab('store');
          setPaymentModalOpen(true);
          return;
        }
        if (e.code === 'Digit2') {
          e.preventDefault();
          if (e.repeat) return;
          setPaymentModalTab('redeem');
          setPaymentModalOpen(true);
          return;
        }
        if (e.code === 'Digit3') {
          e.preventDefault();
          if (e.repeat) return;
          setPaymentModalTab('history');
          setPaymentModalOpen(true);
          return;
        }
        if (e.code === 'Digit4') {
          e.preventDefault();
          if (e.repeat) return;
          setPaytableOpen((prev) => !prev);
          return;
        }
      }

      // Spacebar: Spin trigger
      if (e.code === 'Space' && !showSplash && !paytableOpen && !bonusSession && !freeSpinsOpen && isAssetsLoaded) {
        e.preventDefault();
        if (e.repeat) return; // Prevent browser repeat events
        isHoldingSpinRef.current = true;
        if (bigWinAmount > 0) {
          setBigWinAmount(0);
        } else if (winSplashAmount > 0) {
          setWinSplashAmount(0);
          triggerSpin();
        } else {
          triggerSpin();
        }
        return;
      }

      // Lines Left/Right: ArrowLeft / KeyA (Decrease Lines), ArrowRight / KeyD (Increase Lines)
      if ((e.code === 'ArrowLeft' || e.code === 'KeyA') && !isSpinning && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        handleLinesChange(-1);
        return;
      }
      if ((e.code === 'ArrowRight' || e.code === 'KeyD') && !isSpinning && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        handleLinesChange(1);
        return;
      }

      // Bet Up: ArrowUp or KeyW
      if ((e.code === 'ArrowUp' || e.code === 'KeyW') && !isSpinning && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        handleBetChange(1);
        return;
      }

      // Bet Down: ArrowDown or KeyS
      if ((e.code === 'ArrowDown' || e.code === 'KeyS') && !isSpinning && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        handleBetChange(-1);
        return;
      }

      // Mute Toggle: KeyM
      if (e.code === 'KeyM' && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        toggleMute();
        return;
      }

      // Fullscreen Toggle: KeyF
      if (e.code === 'KeyF' && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        toggleFullscreen();
        return;
      }

      // Paytable Toggle: KeyP
      if (e.code === 'KeyP' && !showSplash && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        if (e.repeat) return;
        setPaytableOpen((prev) => !prev);
        return;
      }
    };

    const onKeyUp = (e) => {
      if (e.code === 'Space') {
        isHoldingSpinRef.current = false;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    showSplash,
    keyboardShortcutsOpen,
    paytableOpen,
    paymentModalOpen,
    authModalOpen,
    lowBalanceOfferOpen,
    bonusSession,
    freeSpinsOpen,
    bigWinAmount,
    winSplashAmount,
    triggerSpin,
    isSpinning,
    muted,
    currencyMode,
    selectedLines,
    lineBetIndexSC,
    lineBetIndexGC,
    isAssetsLoaded,
  ]);

  const handleLinesChange = (delta) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(540);
    const currIdx = LINE_OPTIONS.indexOf(selectedLines);
    const nextIdx = Math.min(LINE_OPTIONS.length - 1, Math.max(0, (currIdx === -1 ? 4 : currIdx) + delta));
    const nextLines = LINE_OPTIONS[nextIdx];
    setSelectedLines(nextLines);
    if (currencyMode === 'SC') {
      const nextTotal = Number((lineBetSC * nextLines).toFixed(2));
      setStatusMessage(`LINES SET TO ${nextLines} ACTIVE PAYLINE${nextLines > 1 ? 'S' : ''}! TOTAL BET: $${formatCoinValue(nextTotal)} SC ($${formatCoinValue(lineBetSC)} × ${nextLines}L)`);
    } else {
      const nextTotal = Math.round(lineBetGC * nextLines);
      setStatusMessage(`LINES SET TO ${nextLines} ACTIVE PAYLINE${nextLines > 1 ? 'S' : ''}! TOTAL BET: ${nextTotal.toLocaleString()} GC (${lineBetGC.toLocaleString()} × ${nextLines}L)`);
    }
  };

  const handleSelectLines = (lines) => {
    if (isSpinning || !LINE_OPTIONS.includes(lines)) return;
    soundEngine.playButtonClick(540);
    setSelectedLines(lines);
    if (currencyMode === 'SC') {
      const nextTotal = Number((lineBetSC * lines).toFixed(2));
      setStatusMessage(`LINES SET TO ${lines} ACTIVE PAYLINE${lines > 1 ? 'S' : ''}! TOTAL BET: $${formatCoinValue(nextTotal)} SC`);
    } else {
      const nextTotal = Math.round(lineBetGC * lines);
      setStatusMessage(`LINES SET TO ${lines} ACTIVE PAYLINE${lines > 1 ? 'S' : ''}! TOTAL BET: ${nextTotal.toLocaleString()} GC`);
    }
  };

  const handleBetChange = (delta) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(620);
    if (currencyMode === 'SC') {
      setLineBetIndexSC((prev) => {
        const next = Math.min(LINE_BET_TIERS_SC.length - 1, Math.max(0, prev + delta));
        const nextLineBet = LINE_BET_TIERS_SC[next];
        const nextTotal = Number((nextLineBet * selectedLines).toFixed(2));
        setStatusMessage(`LINE BET: $${formatCoinValue(nextLineBet)} SC × ${selectedLines} LINES = $${formatCoinValue(nextTotal)} SC TOTAL BET!`);
        return next;
      });
    } else {
      setLineBetIndexGC((prev) => {
        const next = Math.min(LINE_BET_TIERS_GC.length - 1, Math.max(0, prev + delta));
        const nextLineBet = LINE_BET_TIERS_GC[next];
        const nextTotal = Math.round(nextLineBet * selectedLines);
        setStatusMessage(`LINE BET: ${nextLineBet.toLocaleString()} GC × ${selectedLines} LINES = ${nextTotal.toLocaleString()} GC TOTAL BET!`);
        return next;
      });
    }
  };

  const handleSelectLineBet = (tierIdx) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(620);
    if (currencyMode === 'SC') {
      const validIdx = Math.min(LINE_BET_TIERS_SC.length - 1, Math.max(0, tierIdx));
      setLineBetIndexSC(validIdx);
      const nextLineBet = LINE_BET_TIERS_SC[validIdx];
      const nextTotal = Number((nextLineBet * selectedLines).toFixed(2));
      setStatusMessage(`LINE BET: $${formatCoinValue(nextLineBet)} SC × ${selectedLines} LINES = $${formatCoinValue(nextTotal)} SC TOTAL BET!`);
    } else {
      const validIdx = Math.min(LINE_BET_TIERS_GC.length - 1, Math.max(0, tierIdx));
      setLineBetIndexGC(validIdx);
      const nextLineBet = LINE_BET_TIERS_GC[validIdx];
      const nextTotal = Math.round(nextLineBet * selectedLines);
      setStatusMessage(`LINE BET: ${nextLineBet.toLocaleString()} GC × ${selectedLines} LINES = ${nextTotal.toLocaleString()} GC TOTAL BET!`);
    }
  };

  const handleMaxBet = () => {
    if (isSpinning) return;
    soundEngine.playButtonClick(740);
    const isSC = currencyMode === 'SC';
    const liveBal = isSC ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins);
    const tiers = isSC ? LINE_BET_TIERS_SC : LINE_BET_TIERS_GC;

    // Max Bet maximizes to 15 lines and highest affordable per-line bet tier
    setSelectedLines(15);
    let targetIdx = tiers.length - 1;
    while (targetIdx > 0 && (tiers[targetIdx] * 15) > liveBal) {
      targetIdx--;
    }

    if (isSC) {
      setLineBetIndexSC(targetIdx);
      const newTotal = Number((tiers[targetIdx] * 15).toFixed(2));
      triggerSpin(null, newTotal);
    } else {
      setLineBetIndexGC(targetIdx);
      const newTotal = Math.round(tiers[targetIdx] * 15);
      triggerSpin(null, newTotal);
    }
  };

  const handleAutoPlayToggle = () => {
    soundEngine.playButtonClick(500);
    if (autoPlayCount > 0) {
      setAutoPlayCount(0);
    } else {
      setAutoPlayCount(25);
    }
  };

  return (
    <div className={`casino-app-root theme-${currentTheme.id} ${isTabletopPosture ? 'tabletop-posture-active' : ''}`}>
      {/* Welcome Screen */}
      {showSplash && <SplashScreen onEnterCasino={() => setShowSplash(false)} />}

      {/* Adaptive Keyboard Shortcuts & Foldable Tabletop Helper Modal */}
      {keyboardShortcutsOpen && (
        <div
          className="adaptive-shortcuts-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard Shortcuts and Adaptive Posture Controls"
          onClick={() => setKeyboardShortcutsOpen(false)}
        >
          <div
            className="adaptive-shortcuts-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adaptive-shortcuts-header">
              <div>
                <h2 className="adaptive-shortcuts-title">⌨️ KEYBOARD SHORTCUTS &amp; ADAPTIVE POSTURE</h2>
                <p className="adaptive-shortcuts-sub">
                  Desktop, Tablet &amp; Foldable Hardware Controls
                </p>
              </div>
              <button
                type="button"
                className="adaptive-shortcuts-close"
                onClick={() => setKeyboardShortcutsOpen(false)}
                aria-label="Dismiss keyboard shortcuts (Esc)"
                title="Dismiss keyboard shortcuts (Esc)"
              >
                <X size={18} />
              </button>
            </div>

            <div className="adaptive-posture-toggle-row">
              <div>
                <strong>📱 Foldable Tabletop Posture</strong>
                <span>Splits Viewing Stage (top screen) &amp; Controls Deck (bottom flat screen)</span>
              </div>
              <button
                type="button"
                className={`adaptive-posture-btn ${isTabletopPosture ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(660);
                  setIsTabletopPosture((prev) => !prev);
                }}
              >
                {isTabletopPosture ? 'TABLETOP: ON' : 'TABLETOP: OFF'}
              </button>
            </div>

            <div className="adaptive-shortcuts-grid">
              <div className="shortcut-item">
                <span>Spin Reels / Instant Stop</span>
                <kbd>Space</kbd>
              </div>
              <div className="shortcut-item">
                <span>Increase Bet Per Line</span>
                <kbd>↑ / W</kbd>
              </div>
              <div className="shortcut-item">
                <span>Decrease Bet Per Line</span>
                <kbd>↓ / S</kbd>
              </div>
              <div className="shortcut-item">
                <span>Increase Active Paylines</span>
                <kbd>→ / D</kbd>
              </div>
              <div className="shortcut-item">
                <span>Decrease Active Paylines</span>
                <kbd>← / A</kbd>
              </div>
              <div className="shortcut-item">
                <span>Mute / Unmute Audio</span>
                <kbd>M</kbd>
              </div>
              <div className="shortcut-item">
                <span>Toggle Fullscreen</span>
                <kbd>F</kbd>
              </div>
              <div className="shortcut-item">
                <span>Open Paytable &amp; Rules</span>
                <kbd>P</kbd>
              </div>
              <div className="shortcut-item">
                <span>Open Coin Store</span>
                <kbd>Ctrl+1</kbd>
              </div>
              <div className="shortcut-item">
                <span>Redeem Sweeps Prizes</span>
                <kbd>Ctrl+2</kbd>
              </div>
              <div className="shortcut-item">
                <span>View Payment History</span>
                <kbd>Ctrl+3</kbd>
              </div>
              <div className="shortcut-item">
                <span>Dismiss Active Dialog</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progressive Stage Background: Instant Low-Res Placeholder + High-Res WebP */}
      <div
        className="temple-background-lowres"
        style={{ backgroundImage: `url('${THEME_ASSETS.mainBackgroundLowRes || '/assets/background/background_lowres.jpg'}')` }}
      />
      <div
        className={`temple-background neon-temple-bg ${isHighResBgLoaded ? 'loaded' : 'loading'}`}
        style={{ backgroundImage: `url('${THEME_ASSETS.mainBackground}')` }}
      />

      {/* Ambient Spark & Ray Overlays */}
      <img
        ref={(el) => {
          if (el) el.setAttribute('fetchpriority', 'low');
        }}
        src={THEME_ASSETS.ambientSparksImage}
        alt=""
        className="ambient-sparks neon-fx-shift"
        draggable={false}
        decoding="async"
      />

      {/* Top DC Enterprises Casino VIP Navigation & Feature Bar */}
      <header className="dc-casino-topbar">
        <div
          className="dc-topbar-brand"
          onClick={() => setShowSplash(true)}
          title="Open Welcome Screen"
        >
          <img
            src={THEME_ASSETS.splashCreativeImage}
            alt={CASINO_BRAND.creatorName}
            className="dc-daniel-avatar"
          />
          <div className="dc-crest-badge">DC</div>
          <div className="dc-brand-titles">
            <span className="dc-casino-name">{CASINO_BRAND.casinoFullTitle}</span>
            <span className="dc-creator-tag">
              <Crown size={12} /> CREATED BY {String(CASINO_BRAND?.creatorName || 'DC Enterprises').toUpperCase()} •{' '}
              {CASINO_BRAND.shortTitle}
            </span>
          </div>
        </div>

        {/* Sweepstakes Dual-Currency Switcher & Store / Redeem CTAs */}
        <div className="dc-sweepstakes-control-center">
          <div
            className="sweepstakes-mode-switch-box"
            title="Toggle between Social Gold Coins (GC) and Promotional Sweeps Coins (SC)"
          >
            <button
              className={`mode-switch-btn gc-mode ${currencyMode === 'GC' ? 'active' : ''}`}
              onClick={() => {
                soundEngine.playButtonClick(660);
                setCurrencyMode('GC');
                setStatusMessage('SWITCHED TO GOLD COINS (GC) • PURE CASINO SOCIAL FUN!');
              }}
            >
              <div className="mode-btn-content">
                <div className="mode-label-row">
                  <span className="mode-badge-dot gold" />
                  <span className="mode-name">GOLD COINS</span>
                </div>
                <div className="mode-bal-val">
                  {goldCoins.toLocaleString()} <span className="curr-unit">GC</span>
                </div>
              </div>
            </button>

            <button
              className={`mode-switch-btn sc-mode ${currencyMode === 'SC' ? 'active' : ''}`}
              onClick={() => {
                soundEngine.playButtonClick(880);
                if (!currentUser) {
                  setAuthModalReason('sc_toggle');
                  setAuthModalOpen(true);
                  return;
                }
                setCurrencyMode('SC');
                if (sweepsCoins < 0.15) {
                  setStatusMessage(
                    'OUT OF SWEEPS COINS! REFILL GOLD COINS TO CLAIM FREE BONUS SC.'
                  );
                  setLowBalanceOfferOpen(true);
                  lastLowBalanceOfferTimeRef.current = Date.now();
                } else {
                  setStatusMessage(
                    'SWITCHED TO SWEEPS COINS (SC) • REDEEMABLE FOR REAL CASH PRIZES ($1.00 USD / 1 SC)!'
                  );
                }
              }}
            >
              <div className="mode-btn-content">
                <div className="mode-label-row">
                  <span className="mode-badge-dot green" />
                  <span className="mode-name">SWEEPS COINS</span>
                  <span className="mode-prize-tag">REAL PRIZES</span>
                </div>
                <div className="mode-bal-val">
                  ${sweepsCoins.toFixed(2)} <span className="curr-unit">SC</span>
                </div>
              </div>
            </button>
          </div>

          {/* Quick Buy Button for Landscape Mobile Screens */}
          <button
            type="button"
            className={`landscape-quick-buy-btn ${currencyMode === 'SC' && sweepsCoins < 0.15 ? 'urgent-refill-pulse' : ''}`}
            onClick={() => {
              soundEngine.playButtonClick(700);
              setPaymentModalTab('store');
              setPaymentModalOpen(true);
            }}
            title="Buy Gold Coins bundles & claim Free Bonus Sweeps Coins"
          >
            <ShoppingCart size={13} />
            <span>+ BUY</span>
          </button>

          <div className="sweepstakes-action-btns">
            <button
              type="button"
              className="dc-pay-btn vip-flash-deal-btn"
              onClick={() => {
                soundEngine.playButtonClick(760);
                setVipPromoAdReason('vip_flash');
                setVipPromoAdOpen(true);
              }}
              title="Claim VIP Founder's 50% OFF Flash Bundle (+Free Redeemable SC)"
            >
              <Gift size={15} className="pay-btn-icon" />
              <div className="pay-btn-labels">
                <span className="pay-btn-primary">50% OFF</span>
                <span className="pay-btn-secondary">VIP DEAL</span>
              </div>
            </button>

            <button
              className={`dc-pay-btn buy-gc-btn ${currencyMode === 'SC' && sweepsCoins < 0.15 ? 'urgent-refill-pulse' : ''}`}
              onClick={() => {
                soundEngine.playButtonClick(700);
                setPaymentModalTab('store');
                setPaymentModalOpen(true);
              }}
              title="Buy Gold Coins bundles & receive FREE Bonus Sweeps Coins (Stripe / Chime)"
            >
              <ShoppingCart size={15} className="pay-btn-icon" />
              <div className="pay-btn-labels">
                <span className="pay-btn-primary">GET COINS</span>
                <span className="pay-btn-secondary">+FREE SC</span>
              </div>
            </button>

            <button
              className="dc-pay-btn redeem-sc-btn"
              onClick={() => {
                soundEngine.playButtonClick(800);
                setPaymentModalTab('redeem');
                setPaymentModalOpen(true);
              }}
              title="Redeem Sweeps Coins for Real Cash Prizes sent to Chime or Bank (1 SC = $1 USD)"
            >
              <DollarSign size={15} className="pay-btn-icon" />
              <div className="pay-btn-labels">
                <span className="pay-btn-primary">REDEEM</span>
                <span className="pay-btn-secondary">PRIZES</span>
              </div>
            </button>

            <button
              className="dc-action-btn tx-history-btn"
              onClick={() => {
                soundEngine.playButtonClick(540);
                setPaymentModalTab('history');
                setPaymentModalOpen(true);
              }}
              title="View Payment & Redemption History"
            >
              <History size={15} />
            </button>
          </div>
        </div>

        {/* Desktop Interactive Demo Feature Buttons & Color Spectrum Switcher */}
        <div className="dc-topbar-actions desktop-actions">
          <button
            className={`dc-action-btn turbo-flow-btn ${turboFlow ? 'active-turbo' : ''}`}
            onClick={() => {
              soundEngine.playButtonClick(turboFlow ? 440 : 880);
              setTurboFlow(!turboFlow);
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title={turboFlow ? "Turbo Flow Active: Rapid Spins (Click to switch to Standard)" : "Enable Turbo Flow: Hypnotic Rapid Spins"}
          >
            <Zap size={15} className={turboFlow ? 'zap-turbo-active' : ''} />
            <span>{turboFlow ? 'TURBO ON' : 'TURBO'}</span>
          </button>

          <button
            className="dc-action-btn special-bonus"
            onClick={() => triggerSpin('bonus')}
            disabled={isSpinning}
            title={THEME_COPY.bonusSpinButtonTooltip}
          >
            <Gift size={15} />
            <span>{THEME_COPY.bonusSpinButtonLabel}</span>
          </button>

          <button
            className="dc-action-btn special-bonus-direct"
            onClick={() => openBonusGamesManually('doors')}
            disabled={isSpinning}
            title={THEME_COPY.bonusOpenButtonTooltip}
          >
            <Gem size={15} />
            <span>{THEME_COPY.bonusOpenButtonLabel}</span>
          </button>

          <button
            className="dc-action-btn special-guardian-climax"
            onClick={() => handleLaunchCelestialOverload(0)}
            disabled={isSpinning || celestialBonusOpen}
            title="Launch Wrath of the Gods: Celestial Overload 3-Wave Divine Bonus Round!"
          >
            <Zap size={15} color="#c084fc" />
            <span>Wrath of Gods ⚡</span>
          </button>

          <button
            className="dc-action-btn special-freespins"
            onClick={() => triggerFreeSpinsManually(10)}
            onMouseEnter={() => soundEngine.playButtonHover()}
            disabled={isSpinning || freeSpinsOpen}
            title="Launch 10 Automated Celestial Free Spins with 3× Multiplier & Retriggers!"
          >
            <Sparkles size={15} />
            <span>Free Spins (10)</span>
          </button>

          <button
            className="dc-action-btn special-anubis"
            onClick={() => triggerSpin('anubis')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            disabled={isSpinning}
            title={THEME_COPY.expandDemoButtonTooltip}
          >
            <Flame size={15} />
            <span>{THEME_COPY.expandDemoButtonLabel}</span>
          </button>

          <button
            className="dc-action-btn special-bigwin"
            onClick={() => triggerSpin('bigwin')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            disabled={isSpinning}
            title={THEME_COPY.megaWinDemoButtonTooltip}
          >
            <Trophy size={15} />
            <span>{THEME_COPY.megaWinDemoButtonLabel}</span>
          </button>

          <button
            className="dc-action-btn special-guardian-cycle"
            onClick={() => {
              soundEngine.playButtonClick(660);
              const nextStage = (guardianChargeLevel + 1) % 5;
              triggerAnubisPowerUp(nextStage);
              triggerBastetPowerUp(nextStage);
              if (nextStage === 0) {
                setStatusMessage('⚡ GUARDIANS LEVEL 0: DORMANT STONE STATUES (RESTING ON PEDESTALS)');
              } else if (nextStage === 1) {
                setStatusMessage('⚡ GUARDIANS LEVEL 1: LIVING ENTITIES AWAKENED ON THEIR PEDESTALS!');
              } else if (nextStage === 2) {
                setStatusMessage('⚡ GUARDIANS LEVEL 2: DIVINE EYES & AURIC CORONA IGNITED!');
              } else if (nextStage === 3) {
                setStatusMessage('⚡ GUARDIANS LEVEL 3: PLASMA & SUNFIRE ORBS CONJURED ON PEDESTALS!');
              } else if (nextStage === 4) {
                setStatusMessage('⚡ GUARDIANS LEVEL 4: APEX OVERCHARGE — MAXIMUM DIVINE RADIANCE!');
              }
            }}
            title="Cycle & test the 5 Guardian Escalation Stages right on their pedestals (0: Stone, 1: Alive, 2: Eyes, 3: Orbs, 4: Apex)"
          >
            <Zap size={15} />
            <span>
              Pedestal:{' '}
              {guardianChargeLevel === 0
                ? '0: Stone'
                : guardianChargeLevel === 1
                ? '1: Alive'
                : guardianChargeLevel === 2
                ? '2: Eyes'
                : guardianChargeLevel === 3
                ? '3: Orbs'
                : '4: Apex'}
            </span>
          </button>

          {/* Alternating Power-Up Demo Button */}
          <button
            className="dc-action-btn special-guardian-alt"
            onClick={triggerAlternatingPowerUp}
            title="Alternate power-ups between Lord Anubis and Queen Bastet! Once both reach 4/4, the next triggers the Climax!"
          >
            <Zap size={15} color="#00e5ff" />
            <span>Alt Power-Up ({nextPowerUpGuardian === 'anubis' ? 'Anubis' : 'Bastet'})</span>
          </button>

          {/* Full Climax Animation Demo Button */}
          <button
            className="dc-action-btn special-guardian-climax"
            onClick={() => triggerGuardianClimax()}
            title="Trigger full Apex Overcharge Climax: Anubis shoots lightning, Bastet shoots fire, major illumination, BONUS celebration & 10 Free Automatic Spins!"
          >
            <Flame size={15} color="#f59e0b" />
            <span>Guardians Climax (BONUS)</span>
          </button>

          <button
            className="dc-action-btn special-collector-demo"
            onClick={() => {
              soundEngine.playButtonClick(660);
              setBonusMeter(BONUS_METER_GOAL);
              setCollectorCelebrationOpen(true);
            }}
            title="Demo the 3D Royal Bonus Collector 36/36 Celebration Animation!"
          >
            <Gem size={15} />
            <span>Fill Collector (36)</span>
          </button>

          <button
            className="dc-action-btn active-mode"
            onClick={() => {
              soundEngine.playButtonClick();
              setNeonThemeIdx((p) => (p + 1) % COLOR_PALETTES.length);
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title="Cycle Color Spectrum"
          >
            <Palette size={15} />
            <span>{currentTheme.label}</span>
          </button>

          <button
            className="dc-action-btn"
            onClick={() => {
              soundEngine.playButtonClick();
              setPaytableOpen(true);
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title="Open paytable and rules (P)"
            aria-label="Open paytable and rules (P)"
          >
            <BookOpen size={15} />
            <span>Paytable &amp; Rules</span>
          </button>

          <button
            className="dc-action-btn"
            onClick={() => {
              soundEngine.playButtonClick(680);
              setKeyboardShortcutsOpen((prev) => !prev);
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title="Keyboard shortcuts and foldable posture (?)"
            aria-label="Keyboard shortcuts and foldable posture (?)"
          >
            <span style={{ fontWeight: 900, fontSize: '0.82rem' }}>?</span>
          </button>

          <button
            className="dc-action-btn"
            onClick={() => {
              soundEngine.playButtonClick();
              if (currencyMode === 'SC') {
                const defSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins;
                setSweepsCoins(defSC);
                sweepsCoinsRef.current = defSC;
                try {
                  localStorage.setItem('dc_casino_sweeps_coins', defSC.toFixed(2));
                } catch {}
                setStatusMessage('RESET SWEEPS COINS TO 10.00 SC ($10.00 USD)!');
              } else {
                const defGC = SWEEPSTAKES_CONFIG.defaultGoldCoins;
                setGoldCoins(defGC);
                goldCoinsRef.current = defGC;
                try {
                  localStorage.setItem('dc_casino_gold_coins', String(defGC));
                } catch {}
                setStatusMessage(THEME_COPY.resetBankrollTicker);
              }
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title={currencyMode === 'SC' ? 'Reset Sweeps Coins to 10.00 SC' : 'Reset Gold Coins to 250,000 GC'}
            aria-label={currencyMode === 'SC' ? 'Reset Sweeps Coins to 10.00 SC' : 'Reset Gold Coins to 250,000 GC'}
          >
            <RotateCcw size={15} />
          </button>

          <AmbientMusicBar />

          <button
            className="dc-action-btn"
            onClick={toggleMute}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
            aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {currentUser ? (
            <div className="topbar-user-badge" title={`Logged in as ${currentUser.name || 'VIP Player'} (${currentUser.provider || currentUser.method || 'VIP'})`}>
              <User size={14} className="user-icon" />
              <div className="user-meta">
                <span className="user-name">{currentUser.name || 'VIP Player'}</span>
                <span className="user-tier">{currentUser.tier || 'VIP PLAYER'}</span>
              </div>
              <button
                className="user-logout-btn"
                onClick={() => {
                  soundEngine.playButtonClick(400);
                  authService.logout();
                }}
                title="Log Out of VIP Account"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              className="topbar-auth-btn"
              onClick={() => {
                soundEngine.playButtonClick(750);
                setAuthModalReason('header_click');
                setAuthModalOpen(true);
              }}
              title="Sign In with Google, Email or Phone to Unlock Sweeps Coins (SC)"
            >
              <Lock size={13} />
              <span>VIP LOGIN / SIGN IN</span>
            </button>
          )}
        </div>

        {/* Mobile Quick Action Buttons (Compact Viewport) */}
        <div className="dc-topbar-actions mobile-quick-actions">
          <button
            className="dc-action-btn fullscreen-toggle-btn"
            onClick={toggleFullscreen}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen (Hide Browser UI)'}
            aria-label="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>

          <AmbientMusicBar />

          <button
            className="dc-action-btn"
            onClick={toggleMute}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title="Toggle Sound"
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <button
            className={`dc-action-btn mobile-menu-toggle ${mobileMenuOpen ? 'active' : ''}`}
            onClick={() => {
              soundEngine.playButtonClick(620);
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            aria-label="Toggle VIP Feature Menu"
            title="Open VIP Feature Drawer"
          >
            {mobileMenuOpen ? <X size={15} /> : <Menu size={15} />}
            <span>VIP ⚡</span>
          </button>
        </div>
      </header>

      {/* Mobile Slide-down Egyptian VIP Features Drawer */}
      {mobileMenuOpen && (
        <div className="mobile-features-drawer">
          <div className="mobile-drawer-header">
            <span>VIP CASINO FEATURES &amp; DEMOS</span>
            <button className="mobile-drawer-close" onClick={() => setMobileMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="mobile-drawer-grid">
            {currentUser ? (
              <div
                className="mobile-drawer-card mobile-user-card"
                style={{
                  gridColumn: '1 / -1',
                  borderColor: 'rgba(255, 215, 0, 0.4)',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.12), rgba(0, 0, 0, 0.6))',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <User size={24} color="#ffd700" className="card-icon" />
                <div className="card-txt" style={{ flex: 1 }}>
                  <strong style={{ color: '#ffd700', fontSize: '0.9rem' }}>{currentUser?.name || 'VIP Player'} ({currentUser?.tier || 'VIP'})</strong>
                  <small style={{ color: '#00e5ff', display: 'block', marginTop: '2px' }}>Verified via {String(currentUser?.provider || currentUser?.method || 'VIP').toUpperCase()} • SC Active</small>
                </div>
                <button
                  className="mobile-drawer-logout-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(400);
                    authService.logout();
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    background: 'rgba(255, 60, 60, 0.2)',
                    border: '1px solid rgba(255, 60, 60, 0.4)',
                    color: '#ff6666',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 700
                  }}
                >
                  <LogOut size={12} />
                  <span>LOGOUT</span>
                </button>
              </div>
            ) : (
              <button
                className="mobile-drawer-card mobile-auth-card"
                style={{
                  gridColumn: '1 / -1',
                  borderColor: 'rgba(255, 215, 0, 0.5)',
                  background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(0, 229, 255, 0.1))'
                }}
                onClick={() => {
                  soundEngine.playButtonClick(750);
                  setMobileMenuOpen(false);
                  setAuthModalReason('header_click');
                  setAuthModalOpen(true);
                }}
              >
                <Lock size={20} color="#ffd700" className="card-icon" />
                <div className="card-txt">
                  <strong style={{ color: '#ffd700' }}>👑 VIP PLAYER LOGIN / SIGN UP</strong>
                  <small style={{ color: '#00e5ff' }}>Unlock Sweeps Coins &amp; Real Cash Redemptions</small>
                </div>
              </button>
            )}

            {/* Paylines & Bet Multiplier Quick Selector Card */}
            <div
              className="mobile-drawer-card mobile-bet-lines-card"
              style={{
                gridColumn: '1 / -1',
                borderColor: 'rgba(255, 215, 0, 0.45)',
                background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.08), rgba(0, 0, 0, 0.85))',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 900, color: '#fde047', letterSpacing: '0.04em' }}>
                  WAGER CALCULATOR
                </span>
                <span style={{ fontSize: '0.78rem', color: '#38bdf8', fontWeight: 800 }}>
                  TOTAL BET: {currencyMode === 'SC' ? `$${formatCoinValue(totalBetSC)}` : totalBetGC.toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                {currencyMode === 'SC'
                  ? `$${formatCoinValue(lineBetSC)} SC × ${selectedLines} Lines = $${formatCoinValue(totalBetSC)} SC`
                  : `${lineBetGC.toLocaleString()} GC × ${selectedLines} Lines = ${totalBetGC.toLocaleString()} GC`}
              </div>

              {/* Lines chips: 1, 2, 5, 10, 15 */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px', fontWeight: 700 }}>
                  SELECT ACTIVE PAYLINES:
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {LINE_OPTIONS.map((lines) => (
                    <button
                      key={lines}
                      type="button"
                      onClick={() => handleSelectLines(lines)}
                      style={{
                        flex: '1 1 auto',
                        minWidth: '48px',
                        padding: '6px 8px',
                        borderRadius: '6px',
                        border: selectedLines === lines ? '1.5px solid #ffd700' : '1px solid rgba(255, 255, 255, 0.2)',
                        background: selectedLines === lines ? 'linear-gradient(180deg, #b45309, #78350f)' : 'rgba(0, 0, 0, 0.45)',
                        color: selectedLines === lines ? '#fff' : 'rgba(255, 255, 255, 0.85)',
                        fontWeight: selectedLines === lines ? 900 : 700,
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        boxShadow: selectedLines === lines ? '0 0 10px rgba(245, 158, 11, 0.6)' : 'none',
                      }}
                    >
                      {lines} {lines === 1 ? 'Line' : 'Lines'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bet per line chips */}
              <div>
                <div style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '5px', fontWeight: 700 }}>
                  BET PER LINE:
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                  {activeLineBetTiers.map((tierVal, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSelectLineBet(idx)}
                      style={{
                        padding: '6px 4px',
                        borderRadius: '6px',
                        border: lineBetIdx === idx ? '1.5px solid #34d399' : '1px solid rgba(255, 255, 255, 0.2)',
                        background: lineBetIdx === idx ? 'linear-gradient(180deg, #047857, #064e3b)' : 'rgba(0, 0, 0, 0.45)',
                        color: lineBetIdx === idx ? '#fff' : 'rgba(255, 255, 255, 0.85)',
                        fontWeight: lineBetIdx === idx ? 900 : 700,
                        fontSize: '0.72rem',
                        cursor: 'pointer',
                        boxShadow: lineBetIdx === idx ? '0 0 10px rgba(52, 211, 153, 0.5)' : 'none',
                      }}
                    >
                      {currencyMode === 'SC' ? `$${formatCoinValue(tierVal)}` : tierVal.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile Ambient Flow Music Card */}
            <div
              className="mobile-drawer-card mobile-music-card"
              style={{
                gridColumn: '1 / -1',
                borderColor: 'rgba(56, 189, 248, 0.4)',
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.12), rgba(15, 23, 42, 0.75))',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px'
              }}
            >
              <Disc size={22} color="#38bdf8" className="card-icon" />
              <div className="card-txt" style={{ flex: 1 }}>
                <strong style={{ color: '#38bdf8', fontSize: '0.88rem' }}>🎵 Ambient Flow Music</strong>
                <small style={{ color: '#94a3b8', display: 'block', marginTop: '2px' }}>
                  {ambientMusicEngine.getCurrentTrack()?.title || 'Enchanted Pulse'} (Quiet Mix)
                </small>
              </div>
              <button
                onClick={() => {
                  soundEngine.playButtonClick(500);
                  ambientMusicEngine.togglePlay();
                }}
                style={{
                  background: 'rgba(255, 215, 0, 0.18)',
                  border: '1px solid rgba(255, 215, 0, 0.4)',
                  color: '#ffd700',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {ambientMusicEngine.isPlaying ? 'PAUSE' : 'PLAY'}
              </button>
              <button
                onClick={() => {
                  soundEngine.playButtonClick(600);
                  ambientMusicEngine.nextTrack(true);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#f1f5f9',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                NEXT ⏭
              </button>
            </div>

            <button
              className="mobile-drawer-card store-card"
              onClick={() => {
                soundEngine.playButtonClick(700);
                setMobileMenuOpen(false);
                setPaymentModalTab('store');
                setPaymentModalOpen(true);
              }}
            >
              <ShoppingCart size={20} className="card-icon" color="#ffd700" />
              <div className="card-txt">
                <strong style={{ color: '#ffd700' }}>Get Coins (+Free SC)</strong>
                <small>Buy Gold Coins Packages</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card redeem-card"
              onClick={() => {
                soundEngine.playButtonClick(800);
                setMobileMenuOpen(false);
                setPaymentModalTab('redeem');
                setPaymentModalOpen(true);
              }}
            >
              <DollarSign size={20} className="card-icon" color="#39ff14" />
              <div className="card-txt">
                <strong style={{ color: '#39ff14' }}>Redeem Cash Prizes</strong>
                <small>Cash Out SC (1 SC = $1 USD)</small>
              </div>
            </button>
            <button
              className={`mobile-drawer-card turbo-card ${turboFlow ? 'active-card' : ''}`}
              onClick={() => {
                soundEngine.playButtonClick(turboFlow ? 440 : 880);
                setTurboFlow(!turboFlow);
              }}
            >
              <Zap size={20} className="card-icon" />
              <div className="card-txt">
                <strong>{turboFlow ? '⚡ Turbo Flow: ON' : '⚡ Turbo Flow: OFF'}</strong>
                <small>Hypnotic rapid cadence</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card bonus-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('bonus');
              }}
              disabled={isSpinning}
            >
              <Gift size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Bonus Scatters Spin</strong>
                <small>Spin 3+ Vault Keys</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card direct-vault-card"
              onClick={() => {
                setMobileMenuOpen(false);
                openBonusGamesManually('doors');
              }}
              disabled={isSpinning}
            >
              <Gem size={20} className="card-icon" />
              <div className="card-txt">
                <strong>5-Chamber Bonus Portal</strong>
                <small>Doors, Hold &amp; Win, Vault, Wheel &amp; Ra</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card climax-card"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLaunchCelestialOverload(0);
              }}
              disabled={isSpinning || celestialBonusOpen}
            >
              <Zap size={20} className="card-icon" color="#c084fc" />
              <div className="card-txt">
                <strong>Wrath of Gods: Celestial Overload</strong>
                <small>3-Wave Anubis &amp; Bastet Divine Bonus</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card freespins-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerFreeSpinsManually(10);
              }}
              disabled={isSpinning || freeSpinsOpen}
            >
              <Sparkles size={20} className="card-icon" />
              <div className="card-txt">
                <strong>10 Free Spins</strong>
                <small>3× Celestial Multipliers</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card anubis-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('anubis');
              }}
              disabled={isSpinning}
            >
              <Flame size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Expanding Wilds</strong>
                <small>1x3 Full Column Guardians</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card climax-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerGuardianClimax();
              }}
            >
              <Flame size={20} className="card-icon" color="#f59e0b" />
              <div className="card-txt">
                <strong>Guardians Climax (BONUS)</strong>
                <small>Lightning, Fire, Illumination & Free Spins</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card microwin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('microwin');
              }}
              disabled={isSpinning}
            >
              <Sparkles size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Micro Win Hit</strong>
                <small>Quick Flow Payout</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card miniwin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('miniwin');
              }}
              disabled={isSpinning}
            >
              <Trophy size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Mini Win Hit</strong>
                <small>Emerald Bounty</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card superwin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('superwin');
              }}
              disabled={isSpinning}
            >
              <Gem size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Super Win Hit</strong>
                <small>4-of-a-Kind Lapis</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card bigwin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('bigwin');
              }}
              disabled={isSpinning}
            >
              <Crown size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Big Win Hit</strong>
                <small>Temple Vault Payout</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card megawin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('megawin');
              }}
              disabled={isSpinning}
            >
              <Trophy size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Mega Win Hit</strong>
                <small>Full Line Screen Jackpot</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card ultrawin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('ultrawin');
              }}
              disabled={isSpinning}
            >
              <Flame size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Ultra Colossal Win</strong>
                <small>Full Screen Celestial Triumph</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card guardian-stage-card"
              onClick={() => {
                soundEngine.playButtonClick(660);
                const nextStage = (guardianChargeLevel + 1) % 5;
                triggerAnubisPowerUp(nextStage);
                triggerBastetPowerUp(nextStage);
                if (nextStage === 0) {
                  setStatusMessage('⚡ GUARDIANS LEVEL 0: DORMANT STONE STATUES (RESTING ON PEDESTALS)');
                } else if (nextStage === 1) {
                  setStatusMessage('⚡ GUARDIANS LEVEL 1: LIVING ENTITIES AWAKENED ON THEIR PEDESTALS!');
                } else if (nextStage === 2) {
                  setStatusMessage('⚡ GUARDIANS LEVEL 2: DIVINE EYES & AURIC CORONA IGNITED!');
                } else if (nextStage === 3) {
                  setStatusMessage('⚡ GUARDIANS LEVEL 3: PLASMA & SUNFIRE ORBS CONJURED ON PEDESTALS!');
                } else if (nextStage === 4) {
                  setStatusMessage('⚡ GUARDIANS LEVEL 4: APEX OVERCHARGE — MAXIMUM DIVINE RADIANCE!');
                }
              }}
            >
              <Zap size={20} className="card-icon" color="#00e5ff" />
              <div className="card-txt">
                <strong>
                  Guardian Pedestal Level:{' '}
                  {guardianChargeLevel === 0
                    ? '0 (Stone)'
                    : guardianChargeLevel === 1
                    ? '1 (Alive)'
                    : guardianChargeLevel === 2
                    ? '2 (Eyes)'
                    : guardianChargeLevel === 3
                    ? '3 (Orbs)'
                    : '4 (Apex)'}
                </strong>
                <small>Power-ups live on their pedestals</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card theme-card"
              onClick={() => {
                soundEngine.playButtonClick();
                setNeonThemeIdx((p) => (p + 1) % COLOR_PALETTES.length);
              }}
            >
              <Palette size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Theme: {currentTheme.label}</strong>
                <small>Cycle Neon Palette</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card paytable-card-btn"
              onClick={() => {
                soundEngine.playButtonClick();
                setMobileMenuOpen(false);
                setPaytableOpen(true);
              }}
            >
              <BookOpen size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Paytable &amp; Rules</strong>
                <small>15 Paylines &amp; Symbol Values</small>
              </div>
            </button>

            <button
              className="mobile-drawer-card reset-card"
              onClick={() => {
                soundEngine.playButtonClick();
                if (currencyMode === 'SC') {
                  const defSC = SWEEPSTAKES_CONFIG.defaultSweepsCoins;
                  setSweepsCoins(defSC);
                  sweepsCoinsRef.current = defSC;
                  try {
                    localStorage.setItem('dc_casino_sweeps_coins', defSC.toFixed(2));
                  } catch {}
                  setStatusMessage('RESET SWEEPS COINS TO 10.00 SC ($10.00 USD)!');
                } else {
                  const defGC = SWEEPSTAKES_CONFIG.defaultGoldCoins;
                  setGoldCoins(defGC);
                  goldCoinsRef.current = defGC;
                  try {
                    localStorage.setItem('dc_casino_gold_coins', String(defGC));
                  } catch {}
                  setStatusMessage(THEME_COPY.resetBankrollTicker);
                }
              }}
            >
              <RotateCcw size={20} className="card-icon" />
              <div className="card-txt">
                <strong>Reset Balance</strong>
                <small>{currencyMode === 'SC' ? 'Reset to 10.00 SC' : 'Reset to 250,000 GC'}</small>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Main Slot Machine Stage: Left Guardian + Center Cabinet + Right Guardian */}
      <main className="slot-stage-container">
        {/* Left Guardian Character (Anubis on his Pedestal) */}
        <aside
          className={`anubis-guardian-column left-col ${
            guardianAction ? 'anubis-action-surge' : ''
          } guardian-charge-stage-${anubisCharge} ${
            anubisCharge === 0 ? 'guardian-charge-stone-statue' : ''
          } ${anubisCharge === 1 ? 'guardian-charge-alive' : ''} ${
            anubisCharge === 2 ? 'guardian-charge-eyes-lit' : ''
          } ${anubisCharge === 3 ? 'guardian-charge-orbs-manifest' : ''} ${
            anubisCharge >= 4 ? 'guardian-charge-overcharged' : ''
          } ${guardianStrikeEvent ? 'guardian-charge-strike' : ''} ${
            anubisPowerUp ? 'guardian-pedestal-powerup-surge anubis-powerup-active' : ''
          }`}
          onClick={() => {
            const nextLvl = (anubisCharge + 1) % 5;
            triggerAnubisPowerUp(nextLvl);
            setStatusMessage(
              `⚡ ANUBIS POWER-UP: ${
                nextLvl === 0
                  ? 'DORMANT STONE'
                  : nextLvl === 1
                  ? 'ALIVE'
                  : nextLvl === 2
                  ? 'DIVINE EYES'
                  : nextLvl === 3
                  ? 'PLASMA ORB'
                  : 'APEX OVERCHARGE'
              }!`
            );
          }}
          title="Click to power up Lord Anubis on his pedestal!"
          style={{ cursor: 'pointer' }}
        >
          {/* Pedestal Power-Up Vertical Energy Surge Effect */}
          {anubisPowerUp && (
            <div className="guardian-pedestal-fx-wrap anubis-fx">
              <div className="guardian-pedestal-light-pillar" />
              <div className="guardian-pedestal-shock-ring ring-1" />
              <div className="guardian-pedestal-shock-ring ring-2" />
              <div className="guardian-pedestal-badge anubis-badge">
                <Zap size={14} className="badge-icon" />
                <span>{anubisPowerUp.badge}</span>
              </div>
            </div>
          )}

          <div className="anubis-guardian-figure">
            {/* Living Aura: Continuous hypnotic ambient pulsation */}
            <div className="guardian-living-aura anubis-living-aura" />
            {/* Divine Eyes: Only lit at Stage 2+ */}
            {anubisCharge >= 2 && (
              <div
                className={`guardian-divine-eyes anubis-divine-eyes ${
                  guardianBlinking ? 'blinking' : ''
                }`}
              />
            )}
            {/* Celestial Power Orb: Only manifests at Stage 3+ */}
            {anubisCharge >= 3 && (
              <div className="guardian-power-orb anubis-power-orb" />
            )}
            {/* Blinding Crackling Lightning Aura: Only manifests at Stage 4+ */}
            {anubisCharge >= 4 && (
              <div className="guardian-charged-crackling-aura" />
            )}
            {anubisCharge >= 2 && GUARDIANS.left.auraImage && (
              <img
                src={GUARDIANS.left.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {anubisCharge >= 4 && GUARDIANS.left.apexBodyImage ? (
              <NeonKeyedImage
                src={GUARDIANS.left.apexBodyImage}
                alt={GUARDIANS.left.name}
                className="guardian-body-img neon-char-filter guardian-apex-overcharged"
                threshold={26}
                feather={44}
              />
            ) : anubisCharge === 3 && GUARDIANS.left.chargedBodyImage ? (
              <NeonKeyedImage
                src={GUARDIANS.left.chargedBodyImage}
                alt={GUARDIANS.left.name}
                className="guardian-body-img neon-char-filter guardian-perched-charged"
                threshold={26}
                feather={44}
              />
            ) : GUARDIANS.left.keyedBackground ? (
              <NeonKeyedImage
                src={GUARDIANS.left.bodyImage}
                alt={GUARDIANS.left.name}
                className="guardian-body-img neon-char-filter"
                threshold={26}
                feather={44}
              />
            ) : (
              <img
                ref={(el) => {
                  if (el) el.setAttribute('fetchpriority', 'low');
                }}
                src={GUARDIANS.left.bodyImage}
                alt={GUARDIANS.left.name}
                className="guardian-body-img neon-char-filter"
                draggable={false}
                decoding="async"
              />
            )}
            {guardianBlinking && anubisCharge >= 1 && GUARDIANS.left.eyesClosedImage && (
              <img
                src={GUARDIANS.left.eyesClosedImage}
                alt=""
                className="guardian-blink-overlay neon-char-filter"
                draggable={false}
              />
            )}
            {anubisCharge >= 3 && GUARDIANS.left.handFxImage && (
              <img
                src={GUARDIANS.left.handFxImage}
                alt=""
                className="guardian-hand-flame"
                draggable={false}
              />
            )}
          </div>
          <div className="guardian-pedestal-plaque">
            <img
              src={GUARDIANS.plaqueFrameImage}
              alt=""
              className="neon-frame-filter"
              draggable={false}
            />
            <div className="guardian-plaque-txt">
              <span>
                {anubisCharge === 0
                  ? 'ANCIENT STATUE'
                  : anubisCharge === 1
                  ? 'LIVING ENTITY'
                  : anubisCharge === 2
                  ? 'EYES OF ANUBIS'
                  : anubisCharge === 3
                  ? 'PLASMA SUMMONER'
                  : 'APEX OVERCHARGE'}
              </span>
              <strong>
                {anubisCharge === 0
                  ? 'DORMANT'
                  : anubisCharge === 1
                  ? 'ALIVE'
                  : anubisCharge === 2
                  ? 'DIVINE GLOW'
                  : anubisCharge === 3
                  ? 'PLASMA ORB'
                  : 'READY TO STRIKE'}
              </strong>
            </div>
          </div>
          <div className="guardian-floor-runes" />
        </aside>

        {/* Center Slot Machine Cabinet */}
        <section className="slot-cabinet-wrapper">
          {/* 2026 Volumetric Temple Light & 3D Gold Dust Engine */}
          <AmbientAtmosphere
            isSpinning={isSpinning}
            hasWin={winningLines.length > 0}
            intensity={flowStreak >= 3 ? 1.4 : 1.0}
          />

          {/* 2026 Progressive Jackpot Display Marquee: Positioned JUST ABOVE the cabinet with ZERO tile obstruction */}
          <div className="casino-jackpots-strip">
            <JackpotMarqueeBar
              currencyMode={currencyMode}
              currentBet={currentBet}
              isSpinning={isSpinning}
              hasWin={winningLines.length > 0}
            />
          </div>

          {/* Mobile Portrait Guardian Companion Bar — Keeps Lord Anubis & Queen Bastet Visible in Vertical Mode */}
          <div className="mobile-portrait-guardians-bar">
            <button
              type="button"
              className={`mpg-companion-pill mpg-anubis stage-${anubisCharge} ${anubisPowerUp ? 'mpg-surge' : ''}`}
              onClick={() => {
                const nextLvl = (anubisCharge + 1) % 5;
                triggerAnubisPowerUp(nextLvl);
                setStatusMessage(
                  `⚡ ANUBIS POWER-UP: ${
                    nextLvl === 0
                      ? 'DORMANT STONE'
                      : nextLvl === 1
                      ? 'ALIVE'
                      : nextLvl === 2
                      ? 'DIVINE EYES'
                      : nextLvl === 3
                      ? 'PLASMA ORB'
                      : 'APEX OVERCHARGE'
                  }!`
                );
              }}
              title="Tap to power up Lord Anubis!"
            >
              <img
                src={
                  anubisCharge >= 4 && GUARDIANS.left.apexBodyImage
                    ? GUARDIANS.left.apexBodyImage
                    : anubisCharge === 3 && GUARDIANS.left.chargedBodyImage
                    ? GUARDIANS.left.chargedBodyImage
                    : GUARDIANS.left.bodyImage
                }
                alt="Lord Anubis"
                className="mpg-avatar-img"
                draggable={false}
              />
              <div className="mpg-meta">
                <span className="mpg-name">⚡ LORD ANUBIS</span>
                <span className="mpg-stage">
                  LVL {anubisCharge}/4 •{' '}
                  {anubisCharge === 0
                    ? 'STONE'
                    : anubisCharge === 1
                    ? 'ALIVE'
                    : anubisCharge === 2
                    ? 'EYES'
                    : anubisCharge === 3
                    ? 'ORB'
                    : 'APEX!'}
                </span>
              </div>
            </button>

            <button
              type="button"
              className={`mpg-companion-pill mpg-bastet stage-${bastetCharge} ${bastetPowerUp ? 'mpg-surge' : ''}`}
              onClick={() => {
                const nextLvl = (bastetCharge + 1) % 5;
                triggerBastetPowerUp(nextLvl);
                setStatusMessage(
                  `🌸 BASTET POWER-UP: ${
                    nextLvl === 0
                      ? 'DORMANT STONE'
                      : nextLvl === 1
                      ? 'ALIVE'
                      : nextLvl === 2
                      ? 'SOLAR EYES'
                      : nextLvl === 3
                      ? 'SUNFIRE ORB'
                      : 'APEX OVERCHARGE'
                  }!`
                );
              }}
              title="Tap to power up Queen Bastet!"
            >
              <div className="mpg-meta mpg-meta-right">
                <span className="mpg-name">QUEEN BASTET 🌸</span>
                <span className="mpg-stage">
                  LVL {bastetCharge}/4 •{' '}
                  {bastetCharge === 0
                    ? 'STONE'
                    : bastetCharge === 1
                    ? 'ALIVE'
                    : bastetCharge === 2
                    ? 'EYES'
                    : bastetCharge === 3
                    ? 'ORB'
                    : 'APEX!'}
                </span>
              </div>
              <img
                src={
                  bastetCharge >= 4 && GUARDIANS.right.apexBodyImage
                    ? GUARDIANS.right.apexBodyImage
                    : bastetCharge === 3 && GUARDIANS.right.chargedBodyImage
                    ? GUARDIANS.right.chargedBodyImage
                    : GUARDIANS.right.bodyImage
                }
                alt="Queen Bastet"
                className="mpg-avatar-img"
                draggable={false}
              />
            </button>
          </div>

          <div className={`reel-cabinet-box ${cabinetImpact ? `cabinet-impact-${cabinetImpact}` : ''} ${flowStreak >= 3 ? 'flow-momentum-active' : ''}`}>
            <img
              ref={(el) => {
                if (el) el.setAttribute('fetchpriority', 'low');
              }}
              src={THEME_ASSETS.reelGlowImage}
              alt=""
              className="psd-reel-glow neon-fx-shift"
              draggable={false}
              decoding="async"
            />

            <img
              ref={(el) => {
                if (el) el.setAttribute('fetchpriority', 'low');
              }}
              src={THEME_ASSETS.reelShadowImage}
              alt=""
              className="psd-reel-shadow"
              draggable={false}
              decoding="async"
            />

            {/* 2026 Architectural Egyptian Temple Pillars: Left & Right Bas-Relief Carved Stone & Gold Textures */}
            <CabinetPillars
              isSpinning={isSpinning}
              hasWin={winningLines.length > 0}
            />

            {/* Top Arch 3D Gold & Jewel-Toned Plaque Logo */}
            <div className="cabinet-dc-neon-logo">
              <DcLogoPlaque className="cabinet-dc-logo-img" />
            </div>

            {/* Reel Cabinet Frame */}
            <img
              ref={(el) => {
                if (el) el.setAttribute('fetchpriority', 'low');
              }}
              src={THEME_ASSETS.reelFrameImage}
              alt="Reel Frame"
              className="psd-reel-frame-img neon-cabinet-filter"
              draggable={false}
              decoding="async"
            />

            {/* Engraved Nameplate on the Top Arch Beam */}
            <div className="cabinet-arch-engraving">
              <span>{CASINO_BRAND.casinoFullTitle}</span>
              <span className="arch-dot">⚡</span>
              <span>CREATED BY {String(CASINO_BRAND?.creatorName || 'DC Enterprises').toUpperCase()}</span>
              {flowStreak >= 3 && (
                <div className="flow-streak-badge">
                  <Zap size={11} className="flow-badge-zap" />
                  <span>FLOW ×{flowStreak}</span>
                </div>
              )}
            </div>

            {/* 5x3 Reel Window - Tap anywhere on reels/symbols to spin or instant stop */}
            <div
              className={`reel-window-viewport tap-to-spin-viewport ${isSpinning ? 'reels-spinning' : 'reels-idle'}`}
              onClick={handleReelClick}
              onPointerDown={handleReelPointerDown}
              onPointerUp={handleReelPointerUp}
              onPointerCancel={handleReelPointerCancel}
              onPointerLeave={handleReelPointerCancel}
              role="button"
              tabIndex={0}
              aria-label={!isAssetsLoaded ? 'Loading Assets' : (isSpinning ? 'Instant Stop' : 'Tap Anywhere on Tiles to Spin')}
              title={!isAssetsLoaded ? 'Pre-caching 3D Relic Assets...' : (isSpinning ? 'Tap Anywhere on Tiles for Instant Stop' : 'Tap Anywhere on Tiles / Symbols to Spin')}
            >
              <PhaserReelEngine
                ref={phaserEngineRef}
                initialGrid={initialGrid}
                initialExpandedCols={initialExpandedCols}
                spinTrigger={spinTrigger}
                onColumnStop={handleColumnStop}
                onSpinComplete={handleSpinComplete}
                onSlamStop={() => triggerCabinetImpact('slam')}
                winningLines={winningLines}
                winningCells={winningCells}
                activeWinLineIdx={activeWinLineIdx}
              />

              {/* 2026 Curved OLED Glass Overlay, Perimeter LEDs & 24K Micro-Filigree Corners */}
              <CabinetGlassOverlay
                isSpinning={isSpinning}
                hasWin={winningLines.length > 0}
              />

              {/* Floating Coin Win Badge with Golden Orbit */}
              {floatingWinText && (
                <div key={floatingWinKey} className="floating-win-flyup">
                  <span className="flyup-star">★</span>
                  <span>{floatingWinText}</span>
                  <span className="flyup-star">★</span>
                </div>
              )}

              {/* Real-Time Win Celebration Image & Animation Plaque */}
              <WinCelebrationSplash
                winAmount={winSplashAmount}
                currencyMode={currencyMode}
                betAmount={currentBet}
                spinId={spinId}
                onClose={handleCloseWinSplash}
              />
            </div>

            {/* Bottom Control Bar */}
            <div className="psd-bottom-control-bar">
              <img
                src="/assets/psd/ui_base_bar.png"
                alt=""
                className="psd-ui-base-img neon-ui-filter"
                draggable={false}
              />

              {/* Left Section: LINES & BET */}
              <div className="psd-ui-left-controls">
                <div className="psd-stat-block lines-block">
                  <img
                    src="/assets/psd/label_lines.png"
                    alt="LINES"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-Selector-row">
                    <button
                      type="button"
                      className="psd-arrow-btn"
                      onClick={() => handleLinesChange(-1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || selectedLinesIdx <= 0}
                      aria-label="Decrease Lines"
                      title="Decrease Paylines (1, 2, 5, 10, 15)"
                    >
                      <img
                        src="/assets/psd/arrow_left.png"
                        alt="<"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                    <span className="psd-stat-value lines-display">{selectedLines}</span>
                    <button
                      type="button"
                      className="psd-arrow-btn"
                      onClick={() => handleLinesChange(1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || selectedLinesIdx >= LINE_OPTIONS.length - 1}
                      aria-label="Increase Lines"
                      title="Increase Paylines (1, 2, 5, 10, 15)"
                    >
                      <img
                        src="/assets/psd/arrow_right.png"
                        alt=">"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                  </div>
                </div>

                <div className="psd-stat-block bet-block">
                  <img
                    src="/assets/psd/label_bet.png"
                    alt="BET"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-Selector-row">
                    <button
                      type="button"
                      className="psd-arrow-btn"
                      onClick={() => handleBetChange(-1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || lineBetIdx <= 0}
                      aria-label="Decrease Bet"
                      title="Decrease Bet Per Line (.25, .50, 1, 2, 5, 10, 25, 50)"
                    >
                      <img
                        src="/assets/psd/arrow_left.png"
                        alt="<"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                    <div className="psd-bet-stacked-display">
                      <span className="psd-stat-value bet-display">
                        {currencyMode === 'SC'
                          ? `$${formatCoinValue(totalBetSC)}`
                          : totalBetGC.toLocaleString()}
                      </span>
                      <span className="psd-bet-subtext">
                        {currencyMode === 'SC'
                          ? `($${formatCoinValue(lineBetSC)} × ${selectedLines})`
                          : `(${lineBetGC.toLocaleString()} × ${selectedLines})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="psd-arrow-btn"
                      onClick={() => handleBetChange(1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || lineBetIdx >= activeLineBetTiers.length - 1}
                      aria-label="Increase Bet"
                      title="Increase Bet Per Line (.25, .50, 1, 2, 5, 10, 25, 50)"
                    >
                      <img
                        src="/assets/psd/arrow_right.png"
                        alt=">"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Center Button Group: AUTOPLAY + SPIN + MAX BET */}
              <div className="psd-ui-center-buttons">
                <button
                  className={`psd-wing-btn autoplay-wing ${
                    autoPlayCount > 0 ? 'active-auto' : ''
                  }`}
                  onClick={handleAutoPlayToggle}
                  onMouseEnter={() => soundEngine.playButtonHover()}
                >
                  <img
                    src="/assets/psd/btn_autoplay.png"
                    alt=""
                    className="wing-btn-bg neon-wing-filter"
                    draggable={false}
                  />
                  {autoPlayCount > 0 ? (
                    <span className="wing-btn-live-text">STOP ({autoPlayCount})</span>
                  ) : (
                    <img
                      src="/assets/psd/label_autoplay.png"
                      alt="AUTO PLAY"
                      className="wing-btn-label"
                      draggable={false}
                    />
                  )}
                </button>

                <button
                  className={`psd-spin-button ${isSpinning ? 'spinning' : ''} ${!isAssetsLoaded ? 'assets-loading' : ''}`}
                  onClick={() => triggerSpin()}
                  disabled={!isAssetsLoaded}
                  onPointerDown={() => { isHoldingSpinRef.current = true; }}
                  onPointerUp={() => { isHoldingSpinRef.current = false; }}
                  onPointerLeave={() => { isHoldingSpinRef.current = false; }}
                  aria-label={!isAssetsLoaded ? 'Loading Assets' : (isSpinning ? 'Instant Stop' : 'Spin Reels')}
                  title={!isAssetsLoaded ? 'Pre-caching 3D Relic Assets...' : (isSpinning ? 'Instant Stop (Spacebar)' : 'Spin Reels (Hold Spacebar or Click for Continuous Flow)')}
                >
                  <div className={`spin-shockwave-ring ${spinShockwave ? 'active' : ''}`} />
                  <img
                    src="/assets/psd/btn_spin_glow.png"
                    alt=""
                    className="spin-btn-glow neon-spin-filter"
                    draggable={false}
                  />
                  <img
                    src="/assets/psd/btn_spin_base.png"
                    alt=""
                    className="spin-btn-base neon-spin-filter"
                    draggable={false}
                  />
                  <img
                    src="/assets/psd/btn_spin_icon.png"
                    alt="SPIN"
                    className="spin-btn-icon"
                    draggable={false}
                  />
                </button>

                <button
                  className="psd-wing-btn maxbet-wing"
                  onClick={handleMaxBet}
                  onMouseEnter={() => soundEngine.playButtonHover()}
                  disabled={isSpinning}
                >
                  <img
                    src="/assets/psd/btn_max_bet.png"
                    alt=""
                    className="wing-btn-bg neon-wing-filter"
                    draggable={false}
                  />
                  <img
                    src="/assets/psd/label_max_bet.png"
                    alt="MAX BET"
                    className="wing-btn-label"
                    draggable={false}
                  />
                </button>
              </div>

              {/* Right Section: WIN & COINS */}
              <div className="psd-ui-right-controls">
                <div className="psd-stat-block win-block">
                  <img
                    src="/assets/psd/label_win.png"
                    alt="WIN"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-stat-value win-display">
                    {lastWinCoins > 0
                      ? currencyMode === 'SC'
                        ? `$${formatCoinValue(lastWinCoins)}`
                        : lastWinCoins.toLocaleString()
                      : '0'}
                  </div>
                </div>

                <div className="psd-stat-block coins-block">
                  <img
                    src="/assets/psd/label_coins.png"
                    alt="COINS"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-coins-row">
                    <div className="psd-stat-value coins-number">
                      {currencyMode === 'SC'
                        ? `$${formatCoinValue(sweepsCoins)}`
                        : goldCoins.toLocaleString()}
                    </div>
                    <span className={`psd-curr-badge ${String(currencyMode || 'gc').toLowerCase()}-badge`}>
                      {currencyMode}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Bonus Collector Meter & Live Verified Winning Combination Pill */}
          <div className="cabinet-bonus-and-win-bar">
            <div
              className={`scarab-collector-meter ${bonusMeter >= BONUS_METER_GOAL || collectorCelebrationOpen ? 'full-celebration' : ''}`}
              onClick={handleCollectorClick}
              title="Land Wilds (+1) or 3D Bonus Symbols (+2) to charge! Click anytime to preview the 3D Bonus Games or Celebration!"
            >
              <img
                src={THEME_COPY.collectorMeterIcon}
                alt="Bonus Collector"
                className="meter-scarab-3d-icon"
                draggable={false}
              />
              <div className="meter-body">
                <div className="meter-header-row">
                  <span className="meter-title">{THEME_COPY.collectorMeterTitle}</span>
                  <span className="meter-count">
                    {bonusMeter} / {BONUS_METER_GOAL} {THEME_COPY.collectorMeterUnit} {bonusMeter >= BONUS_METER_GOAL ? '• FULL!' : `(2× MULT AT ${BONUS_METER_GOAL})`}
                  </span>
                </div>
                <div className="meter-gem-pips">
                  {Array.from({ length: BONUS_METER_GOAL }, (_, idx) => (
                    <span
                      key={idx}
                      className={`meter-gem-pip ${idx < bonusMeter ? 'charged' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {winningLines.length > 0 ? (
              (() => {
                const activeW = winningLines[activeWinLineIdx % winningLines.length];
                return (
                  <div
                    className="verified-win-pill"
                    style={{ borderColor: activeW?.line?.color || '#ffd700' }}
                  >
                    <CheckCircle2 size={15} className="verified-icon" />
                    <span>
                      {activeW.isScatter
                        ? `SCATTER BONUS: ${activeW.matchCount}× ${
                            activeW.symbol.name
                          } = +${
                            currencyMode === 'SC'
                              ? `$${formatCoinValue(activeW.lineWinSC || (activeW.lineWin / (15 * activeLevel)) * currentBetSC)} SC`
                              : `${activeW.lineWin.toLocaleString()} GC`
                          }`
                        : `LINE #${activeW.line.id} (${activeW.line.name}): ${
                            activeW.matchCount
                          }× ${activeW.symbol.name}${
                            activeW.wildMultiplier > 1 ? ' [2× WILD]' : ''
                          } = +${
                            currencyMode === 'SC'
                              ? `$${formatCoinValue(activeW.lineWinSC || (activeW.lineWin / (15 * activeLevel)) * currentBetSC)} SC`
                              : `${activeW.lineWin.toLocaleString()} GC`
                          } (${
                            (activeWinLineIdx % winningLines.length) + 1
                          }/${winningLines.length})`}
                    </span>
                  </div>
                );
              })()
            ) : (
              <div className="verified-win-pill idle-pill">
                <Gem size={14} />
                <span>{THEME_COPY.idleBreakdownHint}</span>
              </div>
            )}
          </div>

          {/* Lower Cabinet Ticker & Pediment */}
          <div className="cabinet-status-pediment">
            <div className="pediment-win-box">
              <span className="pediment-label">LAST WIN</span>
              {lastWinCoins > 0 ? (
                <div className="neon-psd-digits">
                  <PsdGoldNumber value={lastWinCoins} height={28} gap={-2} />
                </div>
              ) : (
                <span className="pediment-zero">0 COINS</span>
              )}
            </div>

            <div className="pediment-ticker">
              <Sparkles size={15} className="ticker-sparkle" />
              <span>{statusMessage}</span>
            </div>

            <div className="pediment-cash-box">
              <span className="pediment-label">
                {currencyMode === 'SC' ? 'REAL CASH PRIZES' : 'SOCIAL PLAY (GC)'}
              </span>
              <span className="pediment-cash-val">
                {currencyMode === 'SC'
                  ? `$${sweepsCoins.toFixed(2)} USD`
                  : `${goldCoins.toLocaleString()} GC`}
              </span>
            </div>
          </div>
        </section>

        {/* Right Guardian Character (Bastet on her Pedestal) */}
        <aside
          className={`anubis-guardian-column right-col ${
            guardianAction ? 'anubis-action-surge' : ''
          } guardian-charge-stage-${bastetCharge} ${
            bastetCharge === 0 ? 'guardian-charge-stone-statue' : ''
          } ${bastetCharge === 1 ? 'guardian-charge-alive' : ''} ${
            bastetCharge === 2 ? 'guardian-charge-eyes-lit' : ''
          } ${bastetCharge === 3 ? 'guardian-charge-orbs-manifest' : ''} ${
            bastetCharge >= 4 ? 'guardian-charge-overcharged' : ''
          } ${guardianStrikeEvent ? 'guardian-charge-strike' : ''} ${
            bastetPowerUp ? 'guardian-pedestal-powerup-surge bastet-powerup-active' : ''
          }`}
          onClick={() => {
            const nextLvl = (bastetCharge + 1) % 5;
            triggerBastetPowerUp(nextLvl);
            setStatusMessage(
              `🌸 BASTET POWER-UP: ${
                nextLvl === 0
                  ? 'DORMANT STONE'
                  : nextLvl === 1
                  ? 'ALIVE'
                  : nextLvl === 2
                  ? 'SOLAR EYES'
                  : nextLvl === 3
                  ? 'SUNFIRE ORB'
                  : 'APEX OVERCHARGE'
              }!`
            );
          }}
          title="Click to power up Queen Bastet on her pedestal!"
          style={{ cursor: 'pointer' }}
        >
          {/* Pedestal Power-Up Vertical Solar Fire Surge Effect */}
          {bastetPowerUp && (
            <div className="guardian-pedestal-fx-wrap bastet-fx">
              <div className="guardian-pedestal-light-pillar" />
              <div className="guardian-pedestal-shock-ring ring-1" />
              <div className="guardian-pedestal-shock-ring ring-2" />
              <div className="guardian-pedestal-badge bastet-badge">
                <Flame size={14} className="badge-icon" />
                <span>{bastetPowerUp.badge}</span>
              </div>
            </div>
          )}

          <div className="anubis-guardian-figure bastet-figure">
            {/* Living Aura: Continuous hypnotic ambient pulsation */}
            <div className="guardian-living-aura bastet-living-aura" />
            {/* Divine Eyes: Only lit at Stage 2+ */}
            {bastetCharge >= 2 && (
              <div
                className={`guardian-divine-eyes bastet-divine-eyes ${
                  guardianBlinking ? 'blinking' : ''
                }`}
              />
            )}
            {/* Celestial Power Orb: Only manifests at Stage 3+ */}
            {bastetCharge >= 3 && (
              <div className="guardian-power-orb bastet-power-orb" />
            )}
            {/* Blinding Solar Fire & Crackling Aura: Only manifests at Stage 4+ */}
            {bastetCharge >= 4 && (
              <div className="guardian-charged-crackling-aura bastet-charged-crackling-aura" />
            )}
            {bastetCharge >= 2 && GUARDIANS.right.auraImage && (
              <img
                src={GUARDIANS.right.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {bastetCharge >= 4 && GUARDIANS.right.apexBodyImage ? (
              <NeonKeyedImage
                src={GUARDIANS.right.apexBodyImage}
                alt={GUARDIANS.right.name}
                className="guardian-body-img bastet-guardian-img guardian-apex-overcharged"
                threshold={26}
                feather={44}
              />
            ) : bastetCharge === 3 && GUARDIANS.right.chargedBodyImage ? (
              <NeonKeyedImage
                src={GUARDIANS.right.chargedBodyImage}
                alt={GUARDIANS.right.name}
                className="guardian-body-img bastet-guardian-img guardian-perched-charged"
                threshold={26}
                feather={44}
              />
            ) : GUARDIANS.right.keyedBackground ? (
              <NeonKeyedImage
                src={GUARDIANS.right.bodyImage}
                alt={GUARDIANS.right.name}
                className="guardian-body-img bastet-guardian-img"
                threshold={26}
                feather={44}
              />
            ) : (
              <img
                ref={(el) => {
                  if (el) el.setAttribute('fetchpriority', 'low');
                }}
                src={GUARDIANS.right.bodyImage}
                alt={GUARDIANS.right.name}
                className="guardian-body-img bastet-guardian-img"
                draggable={false}
                decoding="async"
              />
            )}
            {guardianBlinking && bastetCharge >= 1 && GUARDIANS.right.eyesClosedImage && (
              <img
                src={GUARDIANS.right.eyesClosedImage}
                alt=""
                className="guardian-blink-overlay neon-char-filter"
                draggable={false}
              />
            )}
            {bastetCharge >= 3 && GUARDIANS.right.handFxImage && (
              <img
                src={GUARDIANS.right.handFxImage}
                alt=""
                className="guardian-hand-flame"
                draggable={false}
              />
            )}
          </div>
          <div className="guardian-pedestal-plaque">
            <img
              src={GUARDIANS.plaqueFrameImage}
              alt=""
              className="neon-frame-filter"
              draggable={false}
            />
            <div className="guardian-plaque-txt">
              <span>
                {bastetCharge === 0
                  ? 'ANCIENT STATUE'
                  : bastetCharge === 1
                  ? 'LIVING ENTITY'
                  : bastetCharge === 2
                  ? 'EYES OF BASTET'
                  : bastetCharge === 3
                  ? 'SOLAR SUMMONER'
                  : 'APEX OVERCHARGE'}
              </span>
              <strong>
                {bastetCharge === 0
                  ? 'DORMANT'
                  : bastetCharge === 1
                  ? 'ALIVE'
                  : bastetCharge === 2
                  ? 'SOLAR GLOW'
                  : bastetCharge === 3
                  ? 'SUNFIRE ORB'
                  : 'READY TO STRIKE'}
              </strong>
            </div>
          </div>
          <div className="guardian-floor-runes" />
        </aside>

        {/* 2026 Guardian Dynamic Lightning & Fire Projectile Strike Overlay */}
        <GuardianLightningStrike
          strikeEvent={guardianStrikeEvent}
          onComplete={() => setGuardianStrikeEvent(null)}
        />
      </main>

      {/* 2026 Major Illumination Effect: Blinding radiant burst upon Guardian combination strike */}
      <MajorIlluminationEffect
        active={majorIlluminationActive}
        targetCells={majorIlluminationCells}
        onIlluminationPeak={() => {
          soundEngine.playWinCelebration?.();
        }}
      />

      {/* 2026 Guardian Bonus Celebration Modal: "BONUS!" Fanfare & Automatic Free Spins entry */}
      <GuardianBonusCelebrationModal
        isOpen={guardianBonusCelebrationOpen}
        onStartFreeSpins={handleStartFreeSpinsFromGuardians}
        onEnterBonusVault={handleEnterBonusVaultFromGuardians}
        onLaunchCelestialOverload={() => handleLaunchCelestialOverload(0)}
        onClose={() => setGuardianBonusCelebrationOpen(false)}
        initialSpins={6}
      />

      {/* 3D Bonus Games Modal */}
      <BonusGameModal
        bonusSession={bonusSession}
        currentBet={currentBet}
        coinValue={coinValue}
        currencyMode={currencyMode}
        onCompleteBonus={handleCompleteBonus}
        onLaunchCelestialOverload={handleLaunchCelestialOverload}
      />

      {/* 2026 Grand Climax: Wrath of the Gods — Celestial Overload Bonus Round */}
      <CelestialOverloadBonusModal
        isOpen={celestialBonusOpen}
        currentBet={celestialBonusBet}
        currencyMode={currencyMode}
        onComplete={(totalWinCoins) => {
          setCelestialBonusOpen(false);
          const isSC = currencyMode === 'SC';
          if (isSC) {
            const scWin = Number((totalWinCoins / 100).toFixed(2));
            if (scWin > 0) {
              setSweepsCoins((prev) => {
                const next = Number((prev + scWin).toFixed(2));
                sweepsCoinsRef.current = next;
                try {
                  localStorage.setItem('dc_casino_sweeps_coins', next.toFixed(2));
                } catch {}
                return next;
              });
              setBigWinAmount(scWin);
              setLastWinCoins(scWin);
              setStatusMessage(
                `⚡ CELESTIAL OVERLOAD COMPLETED! WON $${scWin.toFixed(2)} SC ($${scWin.toFixed(2)} USD REAL PRIZE)!`
              );
            }
          } else {
            if (totalWinCoins > 0) {
              setGoldCoins((prev) => {
                const next = prev + totalWinCoins;
                goldCoinsRef.current = next;
                try {
                  localStorage.setItem('dc_casino_gold_coins', String(next));
                } catch {}
                return next;
              });
              setBigWinAmount(totalWinCoins);
              setLastWinCoins(totalWinCoins);
              setStatusMessage(
                `⚡ CELESTIAL OVERLOAD COMPLETED! WON ${totalWinCoins.toLocaleString()} TOTAL GOLD COINS!`
              );
            }
          }
          // Now discharge back to stone statue Stage 0
          updateGuardianCharge(0);
          setGuardianAction(false);
          soundEngine.playSlamStop();
        }}
      />

      {/* Big Win / Mega Win / Ultra Win Celebration Pop-Up */}
      <BigWinPopup
        winCoins={bigWinAmount}
        coinValue={coinValue}
        currencyMode={currencyMode}
        betAmount={currentBet}
        onClose={() => setBigWinAmount(0)}
        onClaimVipOffer={(wonAmt) => {
          setBigWinAmount(0);
          setVipPromoLastWin(wonAmt || bigWinAmount);
          setVipPromoAdReason('post_big_win');
          setVipPromoAdOpen(true);
        }}
      />

      {/* /casino-ad-architect 4-Pillar VIP Founder Promotional Ad & 1-Click Checkout */}
      <VipPromoAdModal
        isOpen={vipPromoAdOpen}
        onClose={() => setVipPromoAdOpen(false)}
        triggerReason={vipPromoAdReason}
        lastWinAmount={vipPromoLastWin}
        currencyMode={currencyMode}
        sweepsCoins={sweepsCoinsRef.current ?? sweepsCoins}
        goldCoins={goldCoinsRef.current ?? goldCoins}
        onSelectPackage={(pkg) => {
          setVipPromoAdOpen(false);
          setSelectedStorePackage(pkg);
          setPaymentModalTab('store');
          setPaymentModalOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
        onOpenFullStore={() => {
          setVipPromoAdOpen(false);
          setSelectedStorePackage(null);
          setPaymentModalTab('store');
          setPaymentModalOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
      />

      {/* Paytable Modal */}
      <PaytableModal
        isOpen={paytableOpen}
        onClose={() => setPaytableOpen(false)}
        level={level}
        currencyMode={currencyMode}
      />

      {/* Non-Disruptive Smart Low Balance Offer / Rescue Modal */}
      <LowBalanceOfferModal
        isOpen={lowBalanceOfferOpen}
        onClose={() => {
          setLowBalanceOfferOpen(false);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
        currencyMode={currencyMode}
        balance={currencyMode === 'SC' ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins)}
        goldCoins={goldCoinsRef.current ?? goldCoins}
        onSwitchToGC={() => {
          setCurrencyMode('GC');
          setLowBalanceOfferOpen(false);
          setStatusMessage('SWITCHED TO SOCIAL GOLD COINS (GC) • PURE CASINO SOCIAL FUN!');
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
        canClaimDaily={canClaimDaily}
        onClaimDailyBonus={handleClaimDailyBonus}
        onSelectPackage={(pkg) => {
          setLowBalanceOfferOpen(false);
          setSelectedStorePackage(pkg);
          setPaymentModalTab('store');
          setPaymentModalOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
        onOpenStore={() => {
          setLowBalanceOfferOpen(false);
          setPaymentModalTab('store');
          setPaymentModalOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
      />

      {/* Sweepstakes Payment & Coin Store Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedStorePackage(null);
          setLowBalanceOfferOpen(false);
          lastLowBalanceOfferTimeRef.current = Date.now();
        }}
        initialTab={paymentModalTab}
        initialPackage={selectedStorePackage}
        goldCoins={goldCoins}
        sweepsCoins={sweepsCoins}
        onPurchaseSuccess={handlePurchaseSuccess}
        onRedeemSuccess={handleRedeemSuccess}
      />

      {/* Automated Celestial Free Spins Bonus Stage */}
      <FreeSpinsScreen
        isOpen={freeSpinsOpen}
        initialSpins={freeSpinsCount}
        betAmount={currentBet}
        coinValue={coinValue}
        currencyMode={currencyMode}
        linesCount={selectedLines}
        lineBet={currentLineBet}
        onComplete={handleCompleteFreeSpins}
      />

      {/* 3D Royal Bonus Collector Full Celebration Animation */}
      <CollectorCelebrationModal
        isOpen={collectorCelebrationOpen}
        onClose={() => setCollectorCelebrationOpen(false)}
        onEnterBonus={handleEnterBonusFromCollector}
        currencyMode={currencyMode}
        currentBet={currentBet}
      />

      {/* Player Authentication & VIP Verification Modal for Sweeps Coins (SC) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason={authModalReason}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrencyMode('SC');
          setStatusMessage(`VIP VERIFIED! WELCOME ${String(user?.name || 'VIP Player').toUpperCase()} — SC UNLOCKED!`);
        }}
      />

      {/* Out of Sweeps Coins Floating Action Reminder Bar */}
      {currencyMode === 'SC' && sweepsCoins < 0.15 && !showSplash && !paymentModalOpen && !lowBalanceOfferOpen && (
        <aside className="out-of-sc-floating-bar" role="alert">
          <div className="out-of-sc-content">
            <div className="out-of-sc-icon-group">
              <Sparkles size={16} className="sparkle-gold" />
              <span className="out-of-sc-title">OUT OF SWEEPS COINS</span>
            </div>
            <span className="out-of-sc-sub">
              Get Gold Coins to receive FREE promotional Sweeps Coins ($1 USD / 1 SC)!
            </span>
          </div>
          <div className="out-of-sc-btn-group">
            <button
              type="button"
              className="out-of-sc-buy-btn"
              onClick={() => {
                soundEngine.playButtonClick(640);
                setPaymentModalTab('store');
                setPaymentModalOpen(true);
              }}
            >
              <Coins size={14} />
              <span>REFILL COINS</span>
            </button>
            {goldCoins >= 15 && (
              <button
                type="button"
                className="out-of-sc-switch-btn"
                onClick={() => {
                  soundEngine.playButtonClick(500);
                  setCurrencyMode('GC');
                  setStatusMessage('SWITCHED TO SOCIAL GOLD COINS (GC) • PURE FUN CASINO PLAY!');
                }}
              >
                <span>PLAY FREE (GC)</span>
              </button>
            )}
          </div>
        </aside>
      )}

      {/* Mobile-First Ergonomic Command Center & Balance Dock (Active on Mobile Phones < 680px) */}
      <nav className="mobile-floating-control-dock" aria-label="Mobile Controls">
        {/* Tier 1: Prominent Mobile Balance Display & Quick Refill Button */}
        <div className="mobile-dock-top-hud">
          <div
            className={`mobile-dock-bal-card ${String(currencyMode || 'gc').toLowerCase()}-mode-bal`}
            onClick={() => {
              soundEngine.playButtonClick(currencyMode === 'GC' ? 880 : 660);
              if (currencyMode === 'GC') {
                if (!currentUser) {
                  setAuthModalReason('sc_toggle');
                  setAuthModalOpen(true);
                  return;
                }
                setCurrencyMode('SC');
                if (sweepsCoins < 0.15) {
                  setStatusMessage('OUT OF SWEEPS COINS! REFILL GOLD COINS TO CLAIM FREE BONUS SC.');
                  setLowBalanceOfferOpen(true);
                  lastLowBalanceOfferTimeRef.current = Date.now();
                } else {
                  setStatusMessage('SWITCHED TO SWEEPS COINS (SC) • 1 SC = $1.00 USD REAL PRIZES!');
                }
              } else {
                setCurrencyMode('GC');
                setStatusMessage('SWITCHED TO GOLD COINS (GC) • PURE CASINO SOCIAL PLAY!');
              }
            }}
            title="Tap to switch between Gold Coins (GC) and Sweeps Coins (SC)"
            role="button"
            tabIndex={0}
          >
            <div className="mobile-bal-icon-tag">
              {currencyMode === 'SC' ? (
                <Gem size={15} className="mobile-bal-gem-icon" />
              ) : (
                <Coins size={15} className="mobile-bal-coin-icon" />
              )}
              <span className="mobile-bal-currency-name">
                {currencyMode === 'SC' ? 'SWEEPS COINS' : 'GOLD COINS'}
              </span>
            </div>
            <div className="mobile-bal-value-display">
              <span className="mobile-bal-number">
                {currencyMode === 'SC' ? `$${sweepsCoins.toFixed(2)}` : goldCoins.toLocaleString()}
              </span>
              <span className="mobile-bal-badge">{currencyMode}</span>
              <span className="mobile-bal-switch-hint">⇄ SWITCH</span>
            </div>
          </div>

          <button
            type="button"
            className="mobile-dock-vip-deal-btn"
            onClick={() => {
              soundEngine.playButtonClick(760);
              setVipPromoAdReason(currencyMode === 'SC' && sweepsCoins < 50 ? 'cashout_bridge' : 'vip_flash');
              setVipPromoAdOpen(true);
            }}
            title="Claim 50% OFF VIP Founder's Bundle"
            aria-label="Claim 50% OFF VIP Founder's Bundle"
          >
            <Gift size={14} />
            <span>50% VIP</span>
          </button>

          <button
            type="button"
            className={`mobile-dock-buy-btn ${currencyMode === 'SC' && sweepsCoins < 0.15 ? 'urgent-refill-pulse' : ''}`}
            onClick={() => {
              soundEngine.playButtonClick(700);
              setPaymentModalTab('store');
              setPaymentModalOpen(true);
            }}
            title="Get Gold Coins & Free Sweeps Coins Bonus"
            aria-label="Get Coins"
          >
            <ShoppingCart size={14} className="mobile-buy-icon" />
            <div className="mobile-buy-text-stack">
              <span className="mobile-buy-main">GET COINS</span>
              <span className="mobile-buy-sub">+FREE SC</span>
            </div>
          </button>
        </div>

        {/* Tier 2: Spin, Lines, Bet & Win Controls */}
        <div className="mobile-dock-bottom-controls">
          <div className="mobile-dock-lines-group">
            <button
              type="button"
              className="mobile-dock-btn lines-stepper-btn"
              onClick={() => handleLinesChange(-1)}
              disabled={isSpinning || selectedLinesIdx <= 0}
              aria-label="Decrease Lines"
              title="Decrease Lines (1, 2, 5, 10, 15)"
            >
              -
            </button>
            <div className="mobile-dock-lines-info">
              <span className="mobile-dock-label">LINES</span>
              <span className="mobile-dock-val lines-val">{selectedLines}</span>
            </div>
            <button
              type="button"
              className="mobile-dock-btn lines-stepper-btn"
              onClick={() => handleLinesChange(1)}
              disabled={isSpinning || selectedLinesIdx >= LINE_OPTIONS.length - 1}
              aria-label="Increase Lines"
              title="Increase Lines (1, 2, 5, 10, 15)"
            >
              +
            </button>
          </div>

          <div className="mobile-dock-bet-group">
            <button
              type="button"
              className="mobile-dock-btn bet-stepper-btn"
              onClick={() => handleBetChange(-1)}
              disabled={isSpinning || lineBetIdx <= 0}
              aria-label="Decrease Bet"
              title="Decrease Bet"
            >
              -
            </button>
            <div className="mobile-dock-bet-info">
              <span className="mobile-dock-label">BET</span>
              <span className="mobile-dock-val">
                {currencyMode === 'SC' ? `$${formatCoinValue(totalBetSC)}` : totalBetGC.toLocaleString()}
              </span>
              <span className="mobile-dock-subval">
                {currencyMode === 'SC' ? `$${formatCoinValue(lineBetSC)}/L` : `${lineBetGC.toLocaleString()}/L`}
              </span>
            </div>
            <button
              type="button"
              className="mobile-dock-btn bet-stepper-btn"
              onClick={() => handleBetChange(1)}
              disabled={isSpinning || lineBetIdx >= activeLineBetTiers.length - 1}
              aria-label="Increase Bet"
              title="Increase Bet"
            >
              +
            </button>
          </div>

          <button
            className={`mobile-dock-spin-btn ${isSpinning ? 'spinning' : ''} ${!isAssetsLoaded ? 'assets-loading' : ''}`}
            onClick={() => triggerSpin()}
            disabled={!isAssetsLoaded}
            onPointerDown={() => { isHoldingSpinRef.current = true; }}
            onPointerUp={() => { isHoldingSpinRef.current = false; }}
            onPointerLeave={() => { isHoldingSpinRef.current = false; }}
            aria-label={!isAssetsLoaded ? 'Loading Assets' : (isSpinning ? 'Instant Stop' : 'Spin Reels')}
            title={!isAssetsLoaded ? 'Pre-caching 3D Relic Assets...' : (isSpinning ? 'Instant Stop' : 'Spin Reels (Hold for Continuous Flow)')}
          >
            <div className={`spin-shockwave-ring ${spinShockwave ? 'active' : ''}`} />
            <RotateCw size={26} className={`dock-spin-icon ${isSpinning ? 'dock-spin-animated' : ''}`} />
            <span className="dock-spin-text">{isSpinning ? 'STOP' : 'SPIN'}</span>
          </button>

          <div className="mobile-dock-right-group">
            <div className="mobile-dock-win-info">
              <span className="mobile-dock-label">WIN</span>
              <span className="mobile-dock-win-val">
                {lastWinCoins > 0
                  ? currencyMode === 'SC'
                    ? `$${formatCoinValue(lastWinCoins)}`
                    : lastWinCoins.toLocaleString()
                  : '0'}
              </span>
            </div>

            <button
              className={`mobile-dock-turbo-btn ${turboFlow ? 'active' : ''}`}
              onClick={() => {
                soundEngine.playButtonClick(turboFlow ? 440 : 880);
                setTurboFlow(!turboFlow);
              }}
              aria-label="Toggle Turbo Flow Mode"
              title="Toggle Turbo Flow Mode"
            >
              <Zap size={13} />
              <span>{turboFlow ? 'TURBO' : 'NORM'}</span>
            </button>

            <button
              className={`mobile-dock-auto-btn ${autoPlayCount > 0 ? 'active' : ''}`}
              onClick={handleAutoPlayToggle}
              aria-label="Toggle Autoplay"
            >
              {autoPlayCount > 0 ? `STOP (${autoPlayCount})` : 'AUTO'}
            </button>
          </div>
        </div>
      </nav>
    </div>
  );
}
