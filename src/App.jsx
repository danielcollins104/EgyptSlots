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
  getSymbols,
  getWildSymbol,
  getExpandingSymbol,
  getBonusSymbol,
  getTopHighSymbol,
  getRegularSymbols,
} from './config/slotConfig';
import { SWEEPSTAKES_CONFIG } from './config/sweepstakesConfig';
import PaymentModal from './components/PaymentModal';
import LowBalanceOfferModal from './components/LowBalanceOfferModal';
import { soundEngine } from './audio/soundEngine';
import SplashScreen from './components/SplashScreen';
import BigWinPopup from './components/BigWinPopup';
import WinCelebrationSplash from './components/WinCelebrationSplash';
import PaytableModal from './components/PaytableModal';
import BonusGameModal from './components/BonusGameModal';
import FreeSpinsScreen from './components/FreeSpinsScreen';
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
  const [showSplash, setShowSplash] = useState(true);
  const [muted, setMuted] = useState(false);
  const [neonThemeIdx, setNeonThemeIdx] = useState(0);

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

  // Bottom UI State (Unified Bet Selector across 15 Fixed Paylines)
  const [betIndexGC, setBetIndexGC] = useState(4); // Default 75 GC (5 per line)
  const [betIndexSC, setBetIndexSC] = useState(4); // Default 0.75 SC (0.05 per line)

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
  const [bonusMeter, setBonusMeter] = useState(4);
  const [bonusSession, setBonusSession] = useState(null);
  const [freeSpinsOpen, setFreeSpinsOpen] = useState(false);
  const [freeSpinsCount, setFreeSpinsCount] = useState(10);
  const [guardianAction, setGuardianAction] = useState(false);
  const [guardianBlinking, setGuardianBlinking] = useState(false);
  // Dynamic Guardian Illumination & Strike System:
  // 0 = idle, 1 = alert (early scatters/high pairs), 2 = perched & charged (anticipation/2+ scatters ready to cast), 3 = strike
  const [guardianChargeLevel, setGuardianChargeLevel] = useState(0);
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

  // Direct Bet calculations for GC and SC
  const activeBetTiers = currencyMode === 'SC' ? BET_TIERS_SC : BET_TIERS_GC;
  const currentBetIdx = currencyMode === 'SC' ? betIndexSC : betIndexGC;
  const currentBetGC = BET_TIERS_GC[betIndexGC] ?? 75;
  const currentBetSC = BET_TIERS_SC[betIndexSC] ?? 0.75;
  const currentBet = currencyMode === 'SC' ? currentBetSC : currentBetGC;
  const level = Math.max(1, Math.round(currencyMode === 'SC' ? currentBetSC / 0.15 : currentBetGC / 15));
  const coinValue = currencyMode === 'SC' ? Number((currentBetSC / 15).toFixed(3)) : 1.0;
  const currentTheme = COLOR_PALETTES[neonThemeIdx % COLOR_PALETTES.length];

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

  // NOTE: Purchases must only be credited after server-side Stripe confirmation (webhook).
  // The old "?payment=success&pkg=..." URL handler credited coins with no verification and
  // has been removed. Strip those params if present so old links don't linger in the URL.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('payment') || params.has('pkg') || params.has('pkg_id')) {
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
        setStatusMessage(`WELCOME BACK, ${user.name.toUpperCase()}! VIP ACCOUNT DATA RESTORED.`);
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
    const isSpecialActive = bigWinAmount > 0 || Boolean(bonusSession) || freeSpinsOpen;
    ambientMusicEngine.duck(isSpecialActive);
  }, [bigWinAmount, bonusSession, freeSpinsOpen]);

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
  const evaluateGridWins = useCallback((finalGrid, betLevel, stripMetadata = {}) => {
    // Phase 1 Math Core: Decoupled evaluation via SlotMathEngine
    const outcome = slotMathEngine.evaluateGrid(finalGrid, betLevel, stripMetadata);

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
      const lineWinSC = Number(
        (((wl.lineWin / (15 * (betLevel || 1))) * (currentBetSC || 0.75))).toFixed(2)
      );
      return {
        line: wl.line,
        symbol: symObj || { id: wl.symbolId, name: wl.symbolName },
        matchCount: wl.matchCount,
        lineWin: wl.lineWin,
        lineWinSC,
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
      const scatterWinSC = Number(
        (((outcome.scatterWin / (15 * (betLevel || 1))) * (currentBetSC || 0.75))).toFixed(2)
      );
      wins.unshift({
        line: {
          id: 'BONUS',
          name: `${outcome.scatterCount}× ${bonusSym?.name || 'Solar Scarab Scatters'}`,
          rows: [1, 1, 1, 1, 1],
          color: '#fbbf24',
        },
        symbol: bonusSym || { id: 'bonus_crest', name: '3D Solar Scarab Relic' },
        matchCount: outcome.scatterCount,
        lineWin: outcome.scatterWin,
        lineWinSC: scatterWinSC,
        wildMultiplier: 1,
        isScatter: true,
        cells: scatterCells,
      });
    }

    return {
      wins,
      winCoordSet: new Set(outcome.winningCells),
      totalCoinsWon: outcome.totalWin,
      bonusCount: outcome.scatterCount,
      scatterWinCoins: outcome.scatterWin,
      meterChargesEarned: outcome.meterChargesEarned,
      winCategory: outcome.winCategory,
      isLDW: outcome.isLDW,
      nearMiss: outcome.nearMiss,
      outcome,
    };
  }, [currentBetSC]);

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
      // 2 Scatters on board during active spin -> GUARDIANS PERCH UP, FULLY CHARGED WITH FIRE & LIGHTNING!
      setGuardianChargeLevel(2);
      soundEngine.playAnticipationRiser();
    } else if (scattersLanded === 1 || highMatchingCount >= 2) {
      // Alert level illumination: eyes glow, gentle aura surge
      setGuardianChargeLevel((prev) => Math.max(prev, 1));
    }
  }, []);

  const handleSpinComplete = useCallback(() => {
    isSpinningRef.current = false;
    setIsSpinning(false);

    const pending = pendingSpinRef.current;
    if (!pending) {
      return;
    }

    const { nextGrid, activeLevel, spinBet, forcedMode, stripMetadata } = pending;
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
    } = evaluateGridWins(nextGrid, activeLevel, stripMetadata || {});

    // Update the 3D Bonus Collector Meter
    let meterTriggeredBonus = false;
    setBonusMeter((prev) => {
      const nextVal = prev + meterChargesEarned;
      if (nextVal >= BONUS_METER_GOAL && bonusCount < 3) {
        meterTriggeredBonus = true;
        return 0;
      }
      return Math.min(BONUS_METER_GOAL, nextVal);
    });

    const isSC = currencyMode === 'SC';
    const finalWin = isSC
      ? Number(((totalCoinsWon / (15 * activeLevel)) * spinBet).toFixed(2))
      : totalCoinsWon;
    const finalScatterWin = isSC
      ? Number(((scatterWinCoins / (15 * activeLevel)) * spinBet).toFixed(2))
      : scatterWinCoins;

    if (totalCoinsWon > 0) {
      if (isSC) {
        setSweepsCoins((prev) => Number((prev + finalWin).toFixed(2)));
      } else {
        setGoldCoins((prev) => prev + finalWin);
      }
      setLastWinCoins(finalWin);
      setWinningLines(wins);
      setWinningCells(winCoordSet);

      const isBig = finalWin >= spinBet * 8 || forcedMode === 'bigwin';
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

      // Guardian Projectile Strike Engine:
      const allWinCells = Array.from(winCoordSet).map((k) => k.split(',').map(Number));

      if (bonusCount >= 3) {
        // Scatter Bonus: Both guardians throw violent lightning and solar fire bolts at the reels!
        setGuardianChargeLevel(3);
        const scatterCells =
          outcome.scatterPositions && outcome.scatterPositions.length > 0
            ? outcome.scatterPositions.map((p) => [p.col, p.row])
            : [[1, 1], [3, 1]];
        setGuardianStrikeEvent({
          strikes: [
            {
              from: 'left',
              type: 'lightning',
              targetCells: scatterCells.slice(0, 2),
              delay: 0,
            },
            {
              from: 'right',
              type: 'fire',
              targetCells: scatterCells.slice(2),
              delay: 140,
            },
          ],
        });
        soundEngine.playThunderStrike();
        setTimeout(() => soundEngine.playSolarFireball(), 160);
        setTimeout(() => setGuardianChargeLevel(0), 2400);

        setStatusMessage(
          `3D BONUS UNLOCKED! ${bonusCount}× ${getBonusSymbol().name} PAID ${
            isSC
              ? `${formatCoinValue(finalScatterWin)} SC ($${formatCoinValue(finalScatterWin)} USD)`
              : `${finalScatterWin.toLocaleString()} GC`
          } + BONUS FEATURE!`
        );
      } else if (isBig || wins.some((w) => w.matchCount >= 4)) {
        // Big Win or 4+ of a kind: Guardian casts projectile strike directly into the winning line!
        setGuardianChargeLevel(3);
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
              delay: 130,
            },
          ],
        });
        soundEngine.playThunderStrike();
        setTimeout(() => soundEngine.playSolarFireball(), 150);
        setTimeout(() => setGuardianChargeLevel(0), 2000);

        if (isBig) {
          setBigWinAmount(finalWin);
          setStatusMessage(
            `${THEME_COPY.megaWinTickerPrefix} ${
              isSC
                ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD PRIZE)`
                : `${finalWin.toLocaleString()} GC`
            } AT ${CASINO_BRAND.casinoFullTitle}!`
          );
        } else {
          const firstWin = wins[0];
          setStatusMessage(
            `VERIFIED WIN! ${wins.length} PAYLINE${
              wins.length > 1 ? 'S' : ''
            } (${firstWin.matchCount}× ${firstWin.symbol.name}) PAID ${
              isSC
                ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD)`
                : `${finalWin.toLocaleString()} GC`
            }!`
          );
        }
      } else {
        // ANY Regular Win: The corresponding guardian attacks the winning symbols with elemental power!
        const firstWin = wins[0];
        const avgCol =
          allWinCells.reduce((acc, c) => acc + c[0], 0) / (allWinCells.length || 1);
        const isRightBastet = avgCol >= 2.2;
        setGuardianChargeLevel(3);
        if (isRightBastet) {
          setGuardianStrikeEvent({
            from: 'right',
            type: 'fire',
            targetCells: allWinCells,
          });
          soundEngine.playSolarFireball();
        } else {
          setGuardianStrikeEvent({
            from: 'left',
            type: 'lightning',
            targetCells: allWinCells,
          });
          soundEngine.playThunderStrike();
        }
        setTimeout(() => setGuardianChargeLevel(0), 1600);
        setStatusMessage(
          `VERIFIED WIN! ${wins.length} PAYLINE${
            wins.length > 1 ? 'S' : ''
          } (${firstWin.matchCount}× ${firstWin.symbol.name}) PAID ${
            isSC
              ? `${formatCoinValue(finalWin)} SC ($${formatCoinValue(finalWin)} USD)`
              : `${finalWin.toLocaleString()} GC`
          }!`
        );
      }
    } else {
      // Do not display losses; bet was already subtracted from total at spin start
      setWinSplashAmount(0);
      if (nearMiss?.isNearMiss) {
        // Near miss keeps character perched up & crackling with blue flame & amber lightning to hold suspense!
        setGuardianChargeLevel(2);
        setTimeout(() => {
          setGuardianChargeLevel((lvl) => (lvl === 2 ? 0 : lvl));
        }, 3200);
        setStatusMessage(`⚡ NEAR-MISS! ${nearMiss.description}`);
      } else {
        setGuardianChargeLevel(0);
        setStatusMessage(`${CASINO_BRAND.casinoFullTitle} • ${CASINO_BRAND.edition}`);
      }
    }

    // Psychological Flow State Momentum Tracking
    const nowMs = performance.now();
    const intervalSinceLastSpin = nowMs - lastSpinEndTimeRef.current;
    lastSpinEndTimeRef.current = nowMs;

    let nextStreak = 1;
    if (intervalSinceLastSpin < (turboFlow ? 3500 : 5500)) {
      nextStreak = flowStreak + 1;
      setFlowStreak(nextStreak);
      if (nextStreak >= 3) {
        soundEngine.playFlowStreak(nextStreak);
        if (totalCoinsWon === 0) {
          setStatusMessage(`⚡ FLOW MOMENTUM ACTIVE (${nextStreak}X RHYTHM CHAIN) • IN THE ZONE!`);
        }
      }
    } else {
      setFlowStreak(1);
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
        soundEngine.playBonusTrigger();
        setBonusSession({
          triggerReason: BONUS_CONFIG.meterTriggerName,
          initialPicks: 4,
          wheelSpins: 1,
          startingMultiplier: 2,
          scatterWinCoins: 0,
          defaultGame: 'vault',
        });
      }, 750);
    } else {
      // Flow-Safe Low-Balance / Rescue Refill Check:
      // Triggered only if player is running critically low, idle, not in bonus/free spins, and not spamming.
      const nowTimestamp = Date.now();
      if (
        nowTimestamp - lastLowBalanceOfferTimeRef.current > 120000 &&
        !isHoldingSpinRef.current
      ) {
        setTimeout(() => {
          if (
            !isSpinningRef.current &&
            !freeSpinsOpen &&
            !bonusSession &&
            !isHoldingSpinRef.current
          ) {
            const isSC = currencyMode === 'SC';
            const bal = isSC ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins);
            const threshold = isSC ? 0.50 : 50;
            if (bal <= threshold) {
              setLowBalanceOfferOpen(true);
              lastLowBalanceOfferTimeRef.current = Date.now();
            }
          }
        }, 1800);
      }
    }
  }, [evaluateGridWins, currencyMode, turboFlow, flowStreak, sweepsCoins, goldCoins, freeSpinsOpen, bonusSession]);

  const openBonusGamesManually = (defaultGame = 'vault') => {
    if (isSpinning) return;
    soundEngine.playBonusTrigger();
    setAutoPlayCount(0);
    setBonusSession({
      triggerReason: BONUS_CONFIG.vipDirectTriggerName,
      initialPicks: 4,
      wheelSpins: 2,
      startingMultiplier: bonusMeter >= BONUS_METER_GOAL ? 2 : 1,
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
          `3D BONUS COMPLETED! ${CASINO_BRAND.creatorName.toUpperCase()} WON ${totalSC.toFixed(2)} SC ($${totalSC.toFixed(2)} USD PRIZE)!`
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
          `3D BONUS COMPLETED! ${CASINO_BRAND.creatorName.toUpperCase()} WON ${totalBonusCoins.toLocaleString()} TOTAL BONUS GOLD COINS!`
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

  const triggerSpin = useCallback(
    (forcedMode = null, overrideBet = null) => {
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
      if (activeSpinBet == null) {
        activeSpinBet = isSC ? (BET_TIERS_SC[betIndexSC] ?? 0.75) : (BET_TIERS_GC[betIndexGC] ?? 75);
      }

      // Smart Balance Evaluation & Dynamic Bet Adjuster:
      // If the player has coins, NEVER block them from spinning!
      if (isSC) {
        const minSCBet = BET_TIERS_SC[0]; // 0.15 SC
        if (liveSC >= activeSpinBet) {
          // Normal: Player has sufficient SC for this bet
        } else if (liveSC >= minSCBet) {
          // Player has SC, but current bet is higher than balance -> auto-adjust down to highest affordable tier!
          let fitIdx = BET_TIERS_SC.length - 1;
          while (fitIdx > 0 && BET_TIERS_SC[fitIdx] > liveSC) fitIdx--;
          activeSpinBet = BET_TIERS_SC[fitIdx];
          setBetIndexSC(fitIdx);
          setStatusMessage(`BET AUTO-ADJUSTED TO $${activeSpinBet.toFixed(2)} SC TO MATCH YOUR BALANCE!`);
        } else if (liveGC >= BET_TIERS_GC[0]) {
          // Out of SC, but has Gold Coins -> seamless switch to GC so player keeps spinning!
          setCurrencyMode('GC');
          effectiveCurrency = 'GC';
          isSC = false;
          let fitIdx = BET_TIERS_GC.length - 1;
          while (fitIdx > 0 && BET_TIERS_GC[fitIdx] > liveGC) fitIdx--;
          activeSpinBet = BET_TIERS_GC[fitIdx];
          setBetIndexGC(fitIdx);
          setStatusMessage(`LOW SWEEPS COINS • SWITCHED TO GOLD COINS (${activeSpinBet.toLocaleString()} GC) TO KEEP SPINNING!`);
        } else {
          // Truly empty in both SC and GC (< 0.15 SC and < 15 GC)
          setStatusMessage('INSUFFICIENT SWEEPS COINS! GET FREE SC WITH STORE BUNDLES OR SWITCH TO GOLD COINS!');
          setAutoPlayCount(0);
          setLowBalanceOfferOpen(true);
          lastLowBalanceOfferTimeRef.current = Date.now();
          return;
        }
      }

      if (!isSC) {
        const minGCBet = BET_TIERS_GC[0]; // 15 GC
        if (liveGC >= activeSpinBet) {
          // Normal: Player has sufficient GC for this bet
        } else if (liveGC >= minGCBet) {
          // Player has GC, but current bet is higher than balance -> auto-adjust down to highest affordable tier!
          let fitIdx = BET_TIERS_GC.length - 1;
          while (fitIdx > 0 && BET_TIERS_GC[fitIdx] > liveGC) fitIdx--;
          activeSpinBet = BET_TIERS_GC[fitIdx];
          setBetIndexGC(fitIdx);
          setStatusMessage(`BET AUTO-ADJUSTED TO ${activeSpinBet.toLocaleString()} GC TO MATCH YOUR BALANCE!`);
        } else if (currentUser && liveSC >= BET_TIERS_SC[0]) {
          // Out of GC, but has Sweeps Coins -> seamless switch to SC so player keeps spinning!
          setCurrencyMode('SC');
          effectiveCurrency = 'SC';
          isSC = true;
          let fitIdx = BET_TIERS_SC.length - 1;
          while (fitIdx > 0 && BET_TIERS_SC[fitIdx] > liveSC) fitIdx--;
          activeSpinBet = BET_TIERS_SC[fitIdx];
          setBetIndexSC(fitIdx);
          setStatusMessage(`LOW GOLD COINS • SWITCHED TO SWEEPS COINS ($${activeSpinBet.toFixed(2)} SC) TO KEEP SPINNING!`);
        } else {
          // Truly empty in both GC and SC (< 15 GC and < 0.15 SC)
          setStatusMessage(THEME_COPY.insufficientCoinsTicker);
          setAutoPlayCount(0);
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
      // If characters were charged from a near-miss/scatters, maintain alert combat posture into the spin!
      setGuardianChargeLevel((lvl) => (lvl >= 2 ? 1 : 0));
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
          [r(5), topHigh, r(7)],
          [expSym, expSym, expSym],
          [r(6), topHigh, r(4)],
          [expSym, expSym, expSym],
          [r(7), topHigh, r(5)],
        ];
      } else if (forcedMode === 'bigwin') {
        nextGrid = [
          [topHigh, topHigh, r(4)],
          [topHigh, wildSym, r(5)],
          [wildSym, topHigh, topHigh],
          [topHigh, wildSym, r(6)],
          [topHigh, topHigh, r(7)],
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

        // Check expanding wild columns (Reels 2, 3, 4) — calibrated authentic casino feature rate (~1 in 96 spins)
        for (let c = 1; c <= 3; c++) {
          if (nextGrid[c].some((s) => s.isExpanding) || Math.random() < 0.0035) {
            nextExpanded[c] = true;
            nextGrid[c] = [expSym, expSym, expSym];
          }
        }
      }

      pendingSpinRef.current = {
        nextGrid,
        nextExpanded,
        activeLevel,
        spinBet: activeSpinBet,
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
      currentUser,
      turboFlow,
    ]
  );

  triggerSpinRef.current = triggerSpin;

  // Autoplay handler
  useEffect(() => {
    if (autoPlayCount > 0 && !isSpinning && bigWinAmount === 0 && !bonusSession && !freeSpinsOpen) {
      const timer = setTimeout(() => {
        setAutoPlayCount((prev) => Math.max(0, prev - 1));
        triggerSpin();
      }, turboFlow ? 450 : 900);
      return () => clearTimeout(timer);
    }
  }, [autoPlayCount, isSpinning, bigWinAmount, bonusSession, freeSpinsOpen, triggerSpin, turboFlow]);

  // Spacebar continuous hold-to-spin and instant tap-to-spin
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !showSplash && !paytableOpen && !bonusSession && !freeSpinsOpen) {
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
  }, [showSplash, paytableOpen, bonusSession, freeSpinsOpen, bigWinAmount, winSplashAmount, triggerSpin]);

  const handleBetChange = (delta) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(620);
    if (currencyMode === 'SC') {
      setBetIndexSC((prev) =>
        Math.min(BET_TIERS_SC.length - 1, Math.max(0, prev + delta))
      );
    } else {
      setBetIndexGC((prev) =>
        Math.min(BET_TIERS_GC.length - 1, Math.max(0, prev + delta))
      );
    }
  };

  const handleMaxBet = () => {
    if (isSpinning) return;
    soundEngine.playButtonClick(740);
    const isSC = currencyMode === 'SC';
    const liveBal = isSC ? (sweepsCoinsRef.current ?? sweepsCoins) : (goldCoinsRef.current ?? goldCoins);
    const tiers = isSC ? BET_TIERS_SC : BET_TIERS_GC;

    // Find highest affordable bet up to the maximum tier
    let targetIdx = tiers.length - 1;
    while (targetIdx > 0 && tiers[targetIdx] > liveBal) {
      targetIdx--;
    }

    if (isSC) {
      setBetIndexSC(targetIdx);
      triggerSpin(null, tiers[targetIdx]);
    } else {
      setBetIndexGC(targetIdx);
      triggerSpin(null, tiers[targetIdx]);
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
    <div className={`casino-app-root theme-${currentTheme.id}`}>
      {/* Welcome Screen */}
      {showSplash && <SplashScreen onEnterCasino={() => setShowSplash(false)} />}

      {/* Main Stage Background */}
      <div
        className="temple-background neon-temple-bg"
        style={{ backgroundImage: `url('${THEME_ASSETS.mainBackground}')` }}
      />

      {/* Ambient Spark & Ray Overlays */}
      <img
        src={THEME_ASSETS.ambientSparksImage}
        alt=""
        className="ambient-sparks neon-fx-shift"
        draggable={false}
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
              <Crown size={12} /> CREATED BY {CASINO_BRAND.creatorName.toUpperCase()} •{' '}
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
                setStatusMessage(
                  'SWITCHED TO SWEEPS COINS (SC) • REDEEMABLE FOR REAL CASH PRIZES ($1.00 USD / 1 SC)!'
                );
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

          <div className="sweepstakes-action-btns">
            <button
              className="dc-pay-btn buy-gc-btn"
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
            onClick={() => openBonusGamesManually('vault')}
            disabled={isSpinning}
            title={THEME_COPY.bonusOpenButtonTooltip}
          >
            <Gem size={15} />
            <span>{THEME_COPY.bonusOpenButtonLabel}</span>
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
          >
            <BookOpen size={15} />
            <span>Paytable &amp; Rules</span>
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
          >
            <RotateCcw size={15} />
          </button>

          <AmbientMusicBar />

          <button
            className="dc-action-btn"
            onClick={toggleMute}
            onMouseEnter={() => soundEngine.playButtonHover()}
            title="Toggle Sound"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {currentUser ? (
            <div className="topbar-user-badge" title={`Logged in as ${currentUser.name} (${currentUser.method})`}>
              <User size={14} className="user-icon" />
              <div className="user-meta">
                <span className="user-name">{currentUser.name}</span>
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
                  <strong style={{ color: '#ffd700', fontSize: '0.9rem' }}>{currentUser.name} ({currentUser.tier || 'VIP'})</strong>
                  <small style={{ color: '#00e5ff', display: 'block', marginTop: '2px' }}>Verified via {currentUser.method.toUpperCase()} • SC Active</small>
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
                  {ambientMusicEngine.getCurrentTrack().title} (Quiet Mix)
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
                openBonusGamesManually('vault');
              }}
              disabled={isSpinning}
            >
              <Gem size={20} className="card-icon" />
              <div className="card-txt">
                <strong>3D Bonus Vault Game</strong>
                <small>Open 3-Tier Multiplier Pick</small>
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
              className="mobile-drawer-card bigwin-card"
              onClick={() => {
                setMobileMenuOpen(false);
                triggerSpin('bigwin');
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
        {/* Left Guardian Character (Configured in `GUARDIANS.left`) */}
        <aside
          className={`anubis-guardian-column left-col ${
            guardianAction ? 'anubis-action-surge' : ''
          } ${guardianChargeLevel === 1 ? 'guardian-charge-alert' : ''} ${
            guardianChargeLevel === 2 ? 'guardian-charge-perched' : ''
          } ${guardianChargeLevel >= 3 ? 'guardian-charge-strike' : ''}`}
        >
          <div className="anubis-guardian-figure">
            <div className="guardian-living-aura anubis-living-aura" />
            <div
              className={`guardian-divine-eyes anubis-divine-eyes ${
                guardianBlinking ? 'blinking' : ''
              }`}
            />
            <div className="guardian-power-orb anubis-power-orb" />
            {guardianChargeLevel >= 2 && (
              <div className="guardian-charged-crackling-aura" />
            )}
            {GUARDIANS.left.auraImage && (
              <img
                src={GUARDIANS.left.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {guardianChargeLevel >= 2 && GUARDIANS.left.chargedBodyImage ? (
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
                src={GUARDIANS.left.bodyImage}
                alt={GUARDIANS.left.name}
                className="guardian-body-img neon-char-filter"
                draggable={false}
              />
            )}
            {guardianBlinking && GUARDIANS.left.eyesClosedImage && (
              <img
                src={GUARDIANS.left.eyesClosedImage}
                alt=""
                className="guardian-blink-overlay neon-char-filter"
                draggable={false}
              />
            )}
            {GUARDIANS.left.handFxImage && (
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
              <span>{GUARDIANS.left.plaqueTop}</span>
              <strong>{GUARDIANS.left.plaqueBottom}</strong>
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

          <div className={`reel-cabinet-box ${cabinetImpact ? `cabinet-impact-${cabinetImpact}` : ''} ${flowStreak >= 3 ? 'flow-momentum-active' : ''}`}>
            <img
              src={THEME_ASSETS.reelGlowImage}
              alt=""
              className="psd-reel-glow neon-fx-shift"
              draggable={false}
            />

            <img
              src={THEME_ASSETS.reelShadowImage}
              alt=""
              className="psd-reel-shadow"
              draggable={false}
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

            {/* 2026 Progressive Jackpot Display Marquee (Grand, Major, Minor, Mini) */}
            <JackpotMarqueeBar
              currencyMode={currencyMode}
              currentBet={currentBet}
              isSpinning={isSpinning}
              hasWin={winningLines.length > 0}
            />

            {/* Reel Cabinet Frame */}
            <img
              src={THEME_ASSETS.reelFrameImage}
              alt="Reel Frame"
              className="psd-reel-frame-img neon-cabinet-filter"
              draggable={false}
            />

            {/* Engraved Nameplate on the Top Arch Beam */}
            <div className="cabinet-arch-engraving">
              <span>{CASINO_BRAND.casinoFullTitle}</span>
              <span className="arch-dot">⚡</span>
              <span>CREATED BY {CASINO_BRAND.creatorName.toUpperCase()}</span>
              {flowStreak >= 3 && (
                <div className="flow-streak-badge">
                  <Zap size={11} className="flow-badge-zap" />
                  <span>FLOW ×{flowStreak}</span>
                </div>
              )}
            </div>

            {/* 5x3 Reel Window */}
            <div className="reel-window-viewport">
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
                  <div className="psd-stat-value lines-display">15</div>
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
                      className="psd-arrow-btn"
                      onClick={() => handleBetChange(-1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || currentBetIdx <= 0}
                      aria-label="Decrease Bet"
                    >
                      <img
                        src="/assets/psd/arrow_left.png"
                        alt="<"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                    <span className="psd-stat-value bet-display">
                      {currencyMode === 'SC'
                        ? `$${formatCoinValue(currentBetSC)}`
                        : currentBetGC.toLocaleString()}
                    </span>
                    <button
                      className="psd-arrow-btn"
                      onClick={() => handleBetChange(1)}
                      onMouseEnter={() => soundEngine.playButtonHover()}
                      disabled={isSpinning || currentBetIdx >= activeBetTiers.length - 1}
                      aria-label="Increase Bet"
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
                  className={`psd-spin-button ${isSpinning ? 'spinning' : ''}`}
                  onClick={() => triggerSpin()}
                  onPointerDown={() => { isHoldingSpinRef.current = true; }}
                  onPointerUp={() => { isHoldingSpinRef.current = false; }}
                  onPointerLeave={() => { isHoldingSpinRef.current = false; }}
                  onMouseEnter={() => soundEngine.playButtonHover()}
                  aria-label={isSpinning ? 'Instant Stop' : 'Spin Reels'}
                  title={isSpinning ? 'Instant Stop (Spacebar)' : 'Spin Reels (Hold Spacebar or Click for Continuous Flow)'}
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
                  <div className="psd-stat-value coins-number">
                    {currencyMode === 'SC'
                      ? `$${formatCoinValue(sweepsCoins)}`
                      : goldCoins.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3D Bonus Collector Meter & Live Verified Winning Combination Pill */}
          <div className="cabinet-bonus-and-win-bar">
            <div
              className="scarab-collector-meter"
              onClick={() => openBonusGamesManually('vault')}
              title="Land Wilds (+1) or 3D Bonus Symbols (+2) to charge! Click anytime to preview the 3D Bonus Games!"
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
                    {bonusMeter} / {BONUS_METER_GOAL} {THEME_COPY.collectorMeterUnit} (2× MULT AT {BONUS_METER_GOAL})
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

        {/* Right Guardian Character (Configured in `GUARDIANS.right`) */}
        <aside
          className={`anubis-guardian-column right-col ${
            guardianAction ? 'anubis-action-surge' : ''
          } ${guardianChargeLevel === 1 ? 'guardian-charge-alert' : ''} ${
            guardianChargeLevel === 2 ? 'guardian-charge-perched' : ''
          } ${guardianChargeLevel >= 3 ? 'guardian-charge-strike' : ''}`}
        >
          <div className="anubis-guardian-figure bastet-figure">
            <div className="guardian-living-aura bastet-living-aura" />
            <div
              className={`guardian-divine-eyes bastet-divine-eyes ${
                guardianBlinking ? 'blinking' : ''
              }`}
            />
            <div className="guardian-power-orb bastet-power-orb" />
            {guardianChargeLevel >= 2 && (
              <div className="guardian-charged-crackling-aura bastet-charged-crackling-aura" />
            )}
            {GUARDIANS.right.auraImage && (
              <img
                src={GUARDIANS.right.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {guardianChargeLevel >= 2 && GUARDIANS.right.chargedBodyImage ? (
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
                src={GUARDIANS.right.bodyImage}
                alt={GUARDIANS.right.name}
                className="guardian-body-img bastet-guardian-img"
                draggable={false}
              />
            )}
            {guardianBlinking && GUARDIANS.right.eyesClosedImage && (
              <img
                src={GUARDIANS.right.eyesClosedImage}
                alt=""
                className="guardian-blink-overlay neon-char-filter"
                draggable={false}
              />
            )}
            {GUARDIANS.right.handFxImage && (
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
              <span>{GUARDIANS.right.plaqueTop}</span>
              <strong>{GUARDIANS.right.plaqueBottom}</strong>
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

      {/* 3D Bonus Games Modal */}
      <BonusGameModal
        bonusSession={bonusSession}
        currentBet={currentBet}
        coinValue={coinValue}
        currencyMode={currencyMode}
        onCompleteBonus={handleCompleteBonus}
      />

      {/* Big Win / Mega Win Celebration Pop-Up */}
      <BigWinPopup
        winCoins={bigWinAmount}
        coinValue={coinValue}
        currencyMode={currencyMode}
        onClose={() => setBigWinAmount(0)}
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
        onComplete={handleCompleteFreeSpins}
      />

      {/* Player Authentication & VIP Verification Modal for Sweeps Coins (SC) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        reason={authModalReason}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setCurrencyMode('SC');
          setStatusMessage(`VIP VERIFIED! WELCOME ${user.name.toUpperCase()} — SC UNLOCKED!`);
        }}
      />

      {/* Mobile-First Ergonomic Thumb Control Dock (Active on Mobile Phones < 680px) */}
      <nav className="mobile-floating-control-dock">
        <div className="mobile-dock-bet-group">
          <button
            className="mobile-dock-btn"
            onClick={() => handleBetChange(-1)}
            disabled={isSpinning || currentBetIdx <= 0}
            aria-label="Decrease Bet"
          >
            -
          </button>
          <div className="mobile-dock-bet-info">
            <span className="mobile-dock-label">BET</span>
            <span className="mobile-dock-val">
              {currencyMode === 'SC' ? `$${formatCoinValue(currentBetSC)}` : currentBetGC.toLocaleString()}
            </span>
          </div>
          <button
            className="mobile-dock-btn"
            onClick={() => handleBetChange(1)}
            disabled={isSpinning || currentBetIdx >= activeBetTiers.length - 1}
            aria-label="Increase Bet"
          >
            +
          </button>
        </div>

        <button
          className={`mobile-dock-spin-btn ${isSpinning ? 'spinning' : ''}`}
          onClick={() => triggerSpin()}
          onPointerDown={() => { isHoldingSpinRef.current = true; }}
          onPointerUp={() => { isHoldingSpinRef.current = false; }}
          onPointerLeave={() => { isHoldingSpinRef.current = false; }}
          aria-label={isSpinning ? 'Instant Stop' : 'Spin Reels'}
          title={isSpinning ? 'Instant Stop' : 'Spin Reels (Hold for Continuous Flow)'}
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
      </nav>
    </div>
  );
}
