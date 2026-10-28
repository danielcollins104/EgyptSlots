import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Volume2,
  VolumeX,
  BookOpen,
  Sparkles,
  Flame,
  Trophy,
  RotateCcw,
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
  getWildSymbol,
  getExpandingSymbol,
  getBonusSymbol,
  getTopHighSymbol,
  getRegularSymbols,
} from './config/slotConfig';
import { SWEEPSTAKES_CONFIG } from './config/sweepstakesConfig';
import PaymentModal from './components/PaymentModal';
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
import PhaserReelEngine from './engine/PhaserReelEngine';
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

  // Sweepstakes Dual-Currency Economy Model (GC vs SC)
  const [currencyMode, setCurrencyMode] = useState(() => {
    try {
      return localStorage.getItem('dc_casino_currency_mode') || 'GC';
    } catch {
      return 'GC';
    }
  });

  const [goldCoins, setGoldCoins] = useState(() => {
    try {
      const saved = localStorage.getItem('dc_casino_gold_coins');
      return saved !== null ? parseInt(saved, 10) : SWEEPSTAKES_CONFIG.defaultGoldCoins;
    } catch {
      return SWEEPSTAKES_CONFIG.defaultGoldCoins;
    }
  });

  const [sweepsCoins, setSweepsCoins] = useState(() => {
    try {
      const saved = localStorage.getItem('dc_casino_sweeps_coins');
      return saved !== null ? parseFloat(saved) : SWEEPSTAKES_CONFIG.defaultSweepsCoins;
    } catch {
      return SWEEPSTAKES_CONFIG.defaultSweepsCoins;
    }
  });

  // Payment Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentModalTab, setPaymentModalTab] = useState('store');

  // Bottom UI State
  const [level, setLevel] = useState(1);
  const [coinValueIdx, setCoinValueIdx] = useState(CASINO_BRAND.defaultCoinValueIndex);

  // Initial Reel Grid & Spin Trigger
  const [initialGrid] = useState(() => generateInitialGrid());
  const [initialExpandedCols] = useState([false, true, false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(null);
  const [spinId, setSpinId] = useState(0);
  const pendingSpinRef = useRef(null);

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

  // Autoplay, Bonus Mechanisms & Modals
  const [autoPlayCount, setAutoPlayCount] = useState(0);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [bonusMeter, setBonusMeter] = useState(4);
  const [bonusSession, setBonusSession] = useState(null);
  const [freeSpinsOpen, setFreeSpinsOpen] = useState(false);
  const [freeSpinsCount, setFreeSpinsCount] = useState(10);
  const [guardianAction, setGuardianAction] = useState(false);
  const [guardianBlinking, setGuardianBlinking] = useState(false);

  // Bet calculations for GC and SC
  const coinValue = CASINO_BRAND.coinValues[coinValueIdx] ?? 1.0;
  const currentBetGC = Math.max(1, Math.round(CASINO_BRAND.baseLines * level * (coinValue >= 1 ? coinValue : 1)));
  const currentBetSC = Number((coinValue * level).toFixed(2));
  const currentBet = currencyMode === 'GC' ? currentBetGC : currentBetSC;
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
    } catch {}
  }, [goldCoins]);

  useEffect(() => {
    try {
      localStorage.setItem('dc_casino_sweeps_coins', sweepsCoins.toFixed(2));
    } catch {}
  }, [sweepsCoins]);

  // Dynamically sync browser document title to the active theme
  useEffect(() => {
    if (CASINO_BRAND.pageTitle) {
      document.title = CASINO_BRAND.pageTitle;
    }
  }, []);

  // Handle Stripe Checkout Redirect return (e.g. ?payment=success&pkg=pkg_silver)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment');
      const pkgId = params.get('pkg_id') || params.get('pkg');

      if ((paymentStatus === 'success' || paymentStatus === 'completed') && pkgId) {
        const pkg = SWEEPSTAKES_CONFIG.storePackages.find((p) => p.id === pkgId);
        if (pkg) {
          handlePurchaseSuccess(pkg);
          setPaymentModalOpen(false);
          // Clean URL so refresh does not re-credit
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }
    } catch (_) {}
  }, []);

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
  const evaluateGridWins = useCallback((finalGrid, betLevel) => {
    const wins = [];
    const winCoordSet = new Set();
    let totalCoinsWon = 0;

    // 1. Evaluate 15 Left-to-Right Paylines
    for (const line of PAYLINES) {
      const lineSymbols = line.rows.map((r, c) => finalGrid[c][r]);

      if (!lineSymbols[0] || lineSymbols[0].isBonus) {
        continue;
      }

      // A) Count consecutive pure Wilds starting from c = 0
      let pureWildCount = 0;
      for (let c = 0; c < COLS; c++) {
        if (lineSymbols[c]?.isWild) {
          pureWildCount++;
        } else {
          break;
        }
      }
      const pureWildSym = lineSymbols[0];
      const pureWildWin =
        pureWildCount >= 3 ? (pureWildSym.payouts?.[pureWildCount] || 0) * betLevel : 0;

      // B) Find the first non-wild, non-bonus symbol along the contiguous chain from c = 0
      let firstRegularSym = null;
      for (let c = 0; c < COLS; c++) {
        const s = lineSymbols[c];
        if (!s || s.isBonus) break;
        if (!s.isWild) {
          firstRegularSym = s;
          break;
        }
      }

      let regMatchCount = 0;
      let hasDoublingWild = false;
      let regWin = 0;

      if (firstRegularSym) {
        for (let c = 0; c < COLS; c++) {
          const s = lineSymbols[c];
          if (!s || s.isBonus) break;
          if (s.id === firstRegularSym.id || s.isWild) {
            regMatchCount++;
            if (s.doublesLineWin || (s.isWild && !s.isExpanding)) {
              hasDoublingWild = true;
            }
          } else {
            break;
          }
        }
        if (regMatchCount >= 3) {
          const basePayout = firstRegularSym.payouts?.[regMatchCount] || 0;
          const wildMult = hasDoublingWild ? 2 : 1;
          regWin = basePayout * betLevel * wildMult;
        }
      }

      // Pick the highest valid left-to-right win on this payline
      let bestSym = null;
      let bestCount = 0;
      let bestWin = 0;
      let bestWildMult = 1;

      if (regWin >= pureWildWin && regWin > 0) {
        bestSym = firstRegularSym;
        bestCount = regMatchCount;
        bestWin = regWin;
        bestWildMult = hasDoublingWild ? 2 : 1;
      } else if (pureWildWin > 0) {
        bestSym = pureWildSym;
        bestCount = pureWildCount;
        bestWin = pureWildWin;
        bestWildMult = 1;
      }

      if (bestWin > 0 && bestCount >= 3) {
        totalCoinsWon += bestWin;
        const cells = [];
        for (let c = 0; c < bestCount; c++) {
          const r = line.rows[c];
          cells.push([c, r]);
          winCoordSet.add(`${c}-${r}`);
        }
        wins.push({
          line,
          symbol: bestSym,
          matchCount: bestCount,
          lineWin: bestWin,
          wildMultiplier: bestWildMult,
          cells,
          isScatter: false,
        });
      }
    }

    // 2. Evaluate 3+ Bonus Scatters anywhere on the 5×3 grid & count meter charges
    const bonusCells = [];
    let bonusSymRef = null;
    let meterChargesEarned = 0;

    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        const sym = finalGrid[c][r];
        if (!sym) continue;
        if (sym.isBonus) {
          bonusCells.push([c, r]);
          bonusSymRef = sym;
          meterChargesEarned += 1;
        } else if (sym.isWild && !sym.isExpanding) {
          meterChargesEarned += 1;
        }
      }
      // If entire column is expanded 1x3 Guardian, count +1 charge for that column
      if (
        finalGrid[c][0]?.isExpanding &&
        finalGrid[c][1]?.isExpanding &&
        finalGrid[c][2]?.isExpanding
      ) {
        meterChargesEarned += 1;
      }
    }

    let scatterWinCoins = 0;
    if (bonusCells.length >= 3 && bonusSymRef) {
      const cappedCount = Math.min(5, bonusCells.length);
      scatterWinCoins = (bonusSymRef.payouts?.[cappedCount] || 75) * betLevel;
      totalCoinsWon += scatterWinCoins;
      bonusCells.forEach(([c, r]) => winCoordSet.add(`${c}-${r}`));

      wins.unshift({
        line: {
          id: 'BONUS',
          name: `${bonusCells.length}× ${bonusSymRef.name}`,
          rows: [1, 1, 1, 1, 1],
          color: '#fbbf24',
        },
        symbol: bonusSymRef,
        matchCount: bonusCells.length,
        lineWin: scatterWinCoins,
        wildMultiplier: 1,
        cells: bonusCells,
        isScatter: true,
      });
    }

    return {
      wins,
      winCoordSet,
      totalCoinsWon,
      bonusCount: bonusCells.length,
      scatterWinCoins,
      meterChargesEarned,
    };
  }, []);

  const handleColumnStop = useCallback((colIdx, didExpand) => {
    if (didExpand) {
      setGuardianAction(true);
      soundEngine.playAnubisExpand();
      setTimeout(() => setGuardianAction(false), 1200);
    }
  }, []);

  const handleSpinComplete = useCallback(() => {
    const pending = pendingSpinRef.current;
    if (!pending) {
      setIsSpinning(false);
      return;
    }

    const { nextGrid, activeLevel, spinBet, forcedMode } = pending;
    const {
      wins,
      winCoordSet,
      totalCoinsWon,
      bonusCount,
      scatterWinCoins,
      meterChargesEarned,
    } = evaluateGridWins(nextGrid, activeLevel);

    setIsSpinning(false);

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
      ? Number(((totalCoinsWon / 15) * spinBet).toFixed(2))
      : Math.round(totalCoinsWon * (coinValue >= 1 ? coinValue : 1));
    const finalScatterWin = isSC
      ? Number(((scatterWinCoins / 15) * spinBet).toFixed(2))
      : Math.round(scatterWinCoins * (coinValue >= 1 ? coinValue : 1));

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

      if (isBig) {
        setBigWinAmount(finalWin);
        setWinSplashAmount(0); // Mega Win modal handles display and sound
      } else {
        setBigWinAmount(0);
        setWinSplashAmount(finalWin); // WinCelebrationSplash handles display and sound once
      }

      if (bonusCount >= 3) {
        setStatusMessage(
          `3D BONUS UNLOCKED! ${bonusCount}× ${getBonusSymbol().name} PAID ${
            isSC
              ? `${formatCoinValue(finalScatterWin)} SC ($${formatCoinValue(finalScatterWin)} USD)`
              : `${finalScatterWin.toLocaleString()} GC`
          } + BONUS FEATURE!`
        );
      } else if (isBig) {
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
      // Do not display losses; bet was already subtracted from total at spin start
      setWinSplashAmount(0);
      setStatusMessage(`${CASINO_BRAND.casinoFullTitle} • ${CASINO_BRAND.edition}`);
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
    }
  }, [evaluateGridWins, currencyMode]);

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
      const extraSC = Number((extraCoinsBeyondScatter * 0.01).toFixed(2));
      const totalSC = Number((totalBonusCoins * 0.01).toFixed(2));
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
    setGoldCoins((prev) => prev + addedGC);
    setSweepsCoins((prev) => Number((prev + addedSC).toFixed(2)));
    setPaymentModalOpen(false); // Automatically return to the game!
    soundEngine.playWin(true);
    setStatusMessage(
      `🎉 PAYMENT SUCCESS! CREDITED +${addedGC.toLocaleString()} GC & +${addedSC.toFixed(2)} FREE SC TO YOUR TOP BALANCE!`
    );
  };

  const handleRedeemSuccess = (amountSC) => {
    setSweepsCoins((prev) => Math.max(0, Number((prev - amountSC).toFixed(2))));
    soundEngine.playWin(false);
    setStatusMessage(
      `PRIZE REDEMPTION SUBMITTED! $${amountSC.toFixed(2)} USD SENT TO YOUR ACCOUNT.`
    );
  };

  const triggerSpin = useCallback(
    (forcedMode = null, overrideLevel = null) => {
      if (isSpinning || bonusSession || freeSpinsOpen) return;
      const activeLevel = overrideLevel ?? level;
      const isSC = currencyMode === 'SC';
      const spinBetGC = Math.max(1, Math.round(CASINO_BRAND.baseLines * activeLevel * (coinValue >= 1 ? coinValue : 1)));
      const spinBetSC = Number((coinValue * activeLevel).toFixed(2));
      const activeSpinBet = isSC ? spinBetSC : spinBetGC;

      if (isSC) {
        if (sweepsCoins < spinBetSC) {
          setStatusMessage('INSUFFICIENT SWEEPS COINS! GET FREE SC WITH STORE BUNDLES OR SWITCH TO GOLD COINS!');
          setAutoPlayCount(0);
          return;
        }
        setSweepsCoins((prev) => Math.max(0, Number((prev - spinBetSC).toFixed(2))));
      } else {
        if (goldCoins < spinBetGC) {
          setStatusMessage(THEME_COPY.insufficientCoinsTicker);
          setAutoPlayCount(0);
          return;
        }
        setGoldCoins((prev) => prev - spinBetGC);
      }

      setLastWinCoins(0);
      setWinSplashAmount(0);
      setSpinId((s) => s + 1);
      setWinningLines([]);
      setWinningCells(new Set());
      setBigWinAmount(0);
      setIsSpinning(true);
      setStatusMessage(THEME_COPY.spinningTicker);

      soundEngine.playSpinStart();

      const wildSym = getWildSymbol();
      const expSym = getExpandingSymbol();
      const bonusSym = getBonusSymbol();
      const topHigh = getTopHighSymbol();
      const regs = getRegularSymbols();
      const r = (idx) => regs[idx % regs.length] || topHigh;

      const nextGrid = Array.from({ length: COLS }, () =>
        Array.from({ length: ROWS }, () => pickWeightedSymbol(SYMBOLS, true))
      );
      const nextExpanded = [false, false, false, false, false];

      if (forcedMode === 'anubis') {
        nextExpanded[1] = true;
        nextExpanded[3] = true;
        nextGrid[0] = [r(5), topHigh, r(7)];
        nextGrid[1] = [expSym, expSym, expSym];
        nextGrid[2] = [r(6), topHigh, r(4)];
        nextGrid[3] = [expSym, expSym, expSym];
        nextGrid[4] = [r(7), topHigh, r(5)];
      } else if (forcedMode === 'bigwin') {
        nextGrid[0] = [topHigh, topHigh, r(4)];
        nextGrid[1] = [topHigh, wildSym, r(5)];
        nextGrid[2] = [wildSym, topHigh, topHigh];
        nextGrid[3] = [topHigh, wildSym, r(6)];
        nextGrid[4] = [topHigh, topHigh, r(7)];
      } else if (forcedMode === 'bonus') {
        nextGrid[0] = [r(4), bonusSym, r(6)];
        nextGrid[1] = [r(2), r(5), r(7)];
        nextGrid[2] = [r(6), bonusSym, r(1)];
        nextGrid[3] = [r(3), r(4), r(5)];
        nextGrid[4] = [r(7), bonusSym, r(2)];
      } else {
        for (let c = 1; c <= 3; c++) {
          if (Math.random() < 0.035) {
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
      };

      setSpinTrigger({
        id: Date.now() + Math.random(),
        targetGrid: nextGrid,
        targetExpanded: nextExpanded,
      });
    },
    [isSpinning, bonusSession, level, goldCoins, sweepsCoins, currencyMode, coinValue]
  );

  // Autoplay handler
  useEffect(() => {
    if (autoPlayCount > 0 && !isSpinning && bigWinAmount === 0 && !bonusSession && !freeSpinsOpen) {
      const timer = setTimeout(() => {
        setAutoPlayCount((prev) => Math.max(0, prev - 1));
        triggerSpin();
      }, 950);
      return () => clearTimeout(timer);
    }
  }, [autoPlayCount, isSpinning, bigWinAmount, bonusSession, freeSpinsOpen, triggerSpin]);

  // Spacebar shortcut to Spin
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !showSplash && !paytableOpen && !bonusSession && !freeSpinsOpen) {
        e.preventDefault();
        if (bigWinAmount > 0) {
          setBigWinAmount(0);
        } else {
          triggerSpin();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showSplash, paytableOpen, bonusSession, bigWinAmount, triggerSpin]);

  const handleLevelChange = (delta) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(580);
    setLevel((prev) => Math.min(CASINO_BRAND.maxLevel, Math.max(1, prev + delta)));
  };

  const handleCoinValueChange = (delta) => {
    if (isSpinning) return;
    soundEngine.playButtonClick(620);
    setCoinValueIdx((prev) =>
      Math.min(CASINO_BRAND.coinValues.length - 1, Math.max(0, prev + delta))
    );
  };

  const handleMaxBet = () => {
    if (isSpinning) return;
    soundEngine.playButtonClick(740);
    setLevel(CASINO_BRAND.maxLevel);
    triggerSpin(null, CASINO_BRAND.maxLevel);
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
              className="dc-action-btn config-keys-btn"
              onClick={() => {
                soundEngine.playButtonClick(540);
                setPaymentModalTab('keys');
                setPaymentModalOpen(true);
              }}
              title="Manage Stripe & Chime API Keys / Handles"
            >
              <KeyRound size={15} />
              <span>Keys</span>
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

        {/* Interactive Demo Feature Buttons & Color Spectrum Switcher */}
        <div className="dc-topbar-actions">
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
            disabled={isSpinning || freeSpinsOpen}
            title="Launch 10 Automated Celestial Free Spins with 3× Multiplier & Retriggers!"
          >
            <Sparkles size={15} />
            <span>Free Spins (10)</span>
          </button>

          <button
            className="dc-action-btn special-anubis"
            onClick={() => triggerSpin('anubis')}
            disabled={isSpinning}
            title={THEME_COPY.expandDemoButtonTooltip}
          >
            <Flame size={15} />
            <span>{THEME_COPY.expandDemoButtonLabel}</span>
          </button>

          <button
            className="dc-action-btn special-bigwin"
            onClick={() => triggerSpin('bigwin')}
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
          >
            <BookOpen size={15} />
            <span>Paytable &amp; Rules</span>
          </button>

          <button
            className="dc-action-btn"
            onClick={() => {
              soundEngine.playButtonClick();
              if (currencyMode === 'SC') {
                setSweepsCoins(SWEEPSTAKES_CONFIG.defaultSweepsCoins);
                setStatusMessage('RESET SWEEPS COINS TO 10.00 SC ($10.00 USD)!');
              } else {
                setGoldCoins(SWEEPSTAKES_CONFIG.defaultGoldCoins);
                setStatusMessage(THEME_COPY.resetBankrollTicker);
              }
            }}
            title={currencyMode === 'SC' ? 'Reset Sweeps Coins to 10.00 SC' : 'Reset Gold Coins to 250,000 GC'}
          >
            <RotateCcw size={15} />
          </button>

          <button className="dc-action-btn" onClick={toggleMute} title="Toggle Sound">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Slot Machine Stage: Left Guardian + Center Cabinet + Right Guardian */}
      <main className="slot-stage-container">
        {/* Left Guardian Character (Configured in `GUARDIANS.left`) */}
        <aside
          className={`anubis-guardian-column left-col ${
            guardianAction ? 'anubis-action-surge' : ''
          }`}
        >
          <div className="anubis-guardian-figure">
            {GUARDIANS.left.auraImage && (
              <img
                src={GUARDIANS.left.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {GUARDIANS.left.keyedBackground ? (
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
        </aside>

        {/* Center Slot Machine Cabinet */}
        <section className="slot-cabinet-wrapper">
          <div className="reel-cabinet-box">
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

            {/* Top Arch 3D Gold & Jewel-Toned Plaque Logo */}
            <div className="cabinet-dc-neon-logo">
              <DcLogoPlaque className="cabinet-dc-logo-img" />
            </div>

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
            </div>

            {/* 5x3 Reel Window */}
            <div className="reel-window-viewport">
              <PhaserReelEngine
                initialGrid={initialGrid}
                initialExpandedCols={initialExpandedCols}
                spinTrigger={spinTrigger}
                onColumnStop={handleColumnStop}
                onSpinComplete={handleSpinComplete}
                winningLines={winningLines}
                winningCells={winningCells}
                activeWinLineIdx={activeWinLineIdx}
              />

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

              {/* Left Section: BET & LEVEL */}
              <div className="psd-ui-left-controls">
                <div className="psd-stat-block bet-block">
                  <img
                    src="/assets/psd/label_bet.png"
                    alt="BET"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-stat-value bet-display">
                    {currencyMode === 'SC'
                      ? `${formatCoinValue(currentBetSC)}`
                      : currentBetGC.toLocaleString()}
                  </div>
                </div>

                <div className="psd-stat-block level-block">
                  <img
                    src="/assets/psd/label_level.png"
                    alt="LEVEL"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-Selector-row">
                    <button
                      className="psd-arrow-btn"
                      onClick={() => handleLevelChange(-1)}
                      disabled={isSpinning || level <= 1}
                      aria-label="Decrease Level"
                    >
                      <img
                        src="/assets/psd/arrow_left.png"
                        alt="<"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                    <span className="psd-stat-value">{level}</span>
                    <button
                      className="psd-arrow-btn"
                      onClick={() => handleLevelChange(1)}
                      disabled={isSpinning || level >= CASINO_BRAND.maxLevel}
                      aria-label="Increase Level"
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
                  disabled={isSpinning}
                  aria-label="Spin Reels"
                >
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

              {/* Right Section: COIN VALUE & COINS */}
              <div className="psd-ui-right-controls">
                <div className="psd-stat-block coinval-block">
                  <img
                    src="/assets/psd/label_coin_value.png"
                    alt="COIN VALUE"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-Selector-row">
                    <button
                      className="psd-arrow-btn"
                      onClick={() => handleCoinValueChange(-1)}
                      disabled={isSpinning || coinValueIdx <= 0}
                      aria-label="Decrease Coin Value"
                    >
                      <img
                        src="/assets/psd/arrow_left.png"
                        alt="<"
                        className="neon-label-glow"
                        draggable={false}
                      />
                    </button>
                    <span className="psd-stat-value coinval-display">
                      {formatCoinValue(coinValue)}
                    </span>
                    <button
                      className="psd-arrow-btn"
                      onClick={() => handleCoinValueChange(1)}
                      disabled={isSpinning || coinValueIdx >= CASINO_BRAND.coinValues.length - 1}
                      aria-label="Increase Coin Value"
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

                <div className="psd-stat-block coins-block">
                  <img
                    src="/assets/psd/label_coins.png"
                    alt="COINS"
                    className="psd-label-img neon-label-glow"
                    draggable={false}
                  />
                  <div className="psd-stat-value coins-number">
                    {currencyMode === 'SC'
                      ? `${sweepsCoins.toFixed(2)} SC`
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
                          } = +${activeW.lineWin.toLocaleString()} COINS`
                        : `LINE #${activeW.line.id} (${activeW.line.name}): ${
                            activeW.matchCount
                          }× ${activeW.symbol.name}${
                            activeW.wildMultiplier > 1 ? ' [2× WILD]' : ''
                          } = +${activeW.lineWin.toLocaleString()} COINS (${
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
          }`}
        >
          <div className="anubis-guardian-figure bastet-figure">
            {GUARDIANS.right.auraImage && (
              <img
                src={GUARDIANS.right.auraImage}
                alt=""
                className="guardian-blue-aura"
                draggable={false}
              />
            )}
            {GUARDIANS.right.keyedBackground ? (
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
        </aside>
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
      />

      {/* Sweepstakes Payment & Coin Store Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        initialTab={paymentModalTab}
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
    </div>
  );
}
