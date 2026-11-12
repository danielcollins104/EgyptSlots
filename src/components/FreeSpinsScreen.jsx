import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Flame,
  Crown,
  Trophy,
  CheckCircle2,
  Zap,
  RotateCw,
  FastForward,
} from 'lucide-react';
import { FREE_SPINS_CONFIG, PAYLINES, THEME_ASSETS } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import PsdGoldNumber from './PsdGoldNumber';
import WinCelebrationSplash from './WinCelebrationSplash';

const COLS = 5;
const ROWS = 3;

function pickWeightedSymbol(pool) {
  const totalWeight = pool.reduce((acc, s) => acc + s.weight, 0);
  let r = Math.random() * totalWeight;
  for (const sym of pool) {
    r -= sym.weight;
    if (r <= 0) return sym;
  }
  return pool[pool.length - 1];
}

function generateFreeSpinsGrid() {
  const symbols = FREE_SPINS_CONFIG.symbols;
  return Array.from({ length: COLS }, () =>
    Array.from({ length: ROWS }, () => pickWeightedSymbol(symbols))
  );
}

export default function FreeSpinsScreen({
  isOpen,
  initialSpins = 10,
  betAmount = 1,
  coinValue = 1.0,
  currencyMode = 'GC',
  linesCount = 15,
  lineBet = null,
  onComplete,
  onTriggerNestedBonus,
}) {
  const [spinsRemaining, setSpinsRemaining] = useState(initialSpins);
  const [totalSpinsAwarded, setTotalSpinsAwarded] = useState(initialSpins);
  const [totalAccumulatedWin, setTotalAccumulatedWin] = useState(0);
  const [lastSpinWin, setLastSpinWin] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinningCols, setSpinningCols] = useState([false, false, false, false, false]);
  const [landedCols, setLandedCols] = useState([false, false, false, false, false]);
  const [currentGrid, setCurrentGrid] = useState(() => generateFreeSpinsGrid());
  const [winningLines, setWinningLines] = useState([]);
  const [winningCells, setWinningCells] = useState(new Set());
  const [explodingCells, setExplodingCells] = useState(new Set());
  const [cascadedCells, setCascadedCells] = useState(new Set());
  const [retriggerBanner, setRetriggerBanner] = useState(null);
  const [subBonusEvent, setSubBonusEvent] = useState(null);
  const [nestedPortalUnlocked, setNestedPortalUnlocked] = useState(false);
  const nestedPortalUnlockedRef = useRef(false);
  const [sessionMultiplier, setSessionMultiplier] = useState(
    FREE_SPINS_CONFIG.winMultiplier || 2
  );
  const sessionMultiplierRef = useRef(FREE_SPINS_CONFIG.winMultiplier || 2);
  const [stageShake, setStageShake] = useState(false);
  const [turboBonus, setTurboBonus] = useState(false);
  const turboBonusRef = useRef(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(1); // Snappy 1-sec intro countdown
  const [winStreak, setWinStreak] = useState(0);
  const [spinWinPop, setSpinWinPop] = useState(null);
  const [totalCardPulse, setTotalCardPulse] = useState(false);
  const [collectCountdown, setCollectCountdown] = useState(2);
  const totalWinRef = useRef(0);
  const subBonusesTriggeredRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const onTriggerNestedBonusRef = useRef(onTriggerNestedBonus);
  onTriggerNestedBonusRef.current = onTriggerNestedBonus;

  const isSC = currencyMode === 'SC';
  const autoLoopTimerRef = useRef(null);
  const multiplier = sessionMultiplier;

  useEffect(() => {
    turboBonusRef.current = turboBonus;
  }, [turboBonus]);

  const rollTape = useMemo(() => {
    const list = FREE_SPINS_CONFIG.symbols;
    return [...list, ...list];
  }, []);

  const triggerStageImpact = useCallback(() => {
    setStageShake(false);
    requestAnimationFrame(() => setStageShake(true));
    setTimeout(() => setStageShake(false), 480);
  }, []);

  // Evaluate Free Spins 15-Payline wins with active Solar Multiplier
  const evaluateFreeSpinsWins = useCallback(
    (grid, activeMult = sessionMultiplierRef.current) => {
      const wins = [];
      const winCoordSet = new Set();
      let totalCoinsWon = 0;
      const mult = activeMult || FREE_SPINS_CONFIG.winMultiplier || 2;

      // 1. Evaluate Active Paylines
      const activePaylines = PAYLINES.slice(0, linesCount || 15);
      for (const line of activePaylines) {
        const lineSymbols = line.rows.map((r, c) => grid[c][r]);
        if (!lineSymbols[0] || lineSymbols[0].isScatter) continue;

        // Find first regular or wild symbol
        let firstSym = null;
        for (let c = 0; c < COLS; c++) {
          const s = lineSymbols[c];
          if (!s || s.isScatter) break;
          if (!s.isWild) {
            firstSym = s;
            break;
          }
        }

        // Count contiguous matches from Reel 1
        let matchCount = 0;
        let hasWild = false;
        if (firstSym) {
          for (let c = 0; c < COLS; c++) {
            const s = lineSymbols[c];
            if (!s || s.isScatter) break;
            if (s.id === firstSym.id || s.isWild) {
              matchCount++;
              if (s.isWild) hasWild = true;
            } else {
              break;
            }
          }
        } else if (lineSymbols[0]?.isWild) {
          // Pure Wild chain
          for (let c = 0; c < COLS; c++) {
            if (lineSymbols[c]?.isWild) matchCount++;
            else break;
          }
          firstSym = lineSymbols[0];
        }

        if (firstSym && matchCount >= 3) {
          const basePayout = firstSym.payouts?.[matchCount] || 0;
          if (basePayout > 0) {
            const lineWin = basePayout * mult;
            totalCoinsWon += lineWin;
            const winCells = [];
            for (let c = 0; c < matchCount; c++) {
              winCoordSet.add(`${c}-${line.rows[c]}`);
              winCells.push([c, line.rows[c]]);
            }
            wins.push({
              line,
              symbol: firstSym,
              matchCount,
              lineWin,
              hasWild,
              cells: winCells,
            });
          }
        }
      }

      // 2. Evaluate Sun God Ra Retrigger Scatters (3+ Scatters required for extra free spins)
      const scatterCells = [];
      for (let c = 0; c < COLS; c++) {
        for (let r = 0; r < ROWS; r++) {
          if (grid[c][r]?.isScatter) {
            scatterCells.push([c, r]);
          }
        }
      }

      let scatterWinCoins = 0;
      let retriggeredSpins = 0;
      if (scatterCells.length >= 3) {
        retriggeredSpins = scatterCells.length >= 4 ? 5 : 3;
        scatterWinCoins = (scatterCells.length >= 4 ? 40 : 15) * mult;
        totalCoinsWon += scatterWinCoins;
        scatterCells.forEach(([c, r]) => winCoordSet.add(`${c}-${r}`));
        wins.unshift({
          line: {
            id: 'SCATTER',
            name: `${scatterCells.length}× Sun God Ra`,
            rows: [1, 1, 1, 1, 1],
            color: '#fbbf24',
          },
          symbol: { id: 'fs_retrigger', name: 'Sun God Ra Aureole' },
          matchCount: scatterCells.length,
          lineWin: scatterWinCoins,
          hasWild: false,
          isScatter: true,
          cells: scatterCells,
        });
      }

      return {
        wins,
        winCoordSet,
        totalCoinsWon,
        retriggeredSpins,
        scatterCount: scatterCells.length,
      };
    },
    [linesCount]
  );

  const spinsLeftRef = useRef(initialSpins);
  const totalAwardedRef = useRef(initialSpins);
  const isSpinningRef = useRef(false);
  const isCompletedRef = useRef(false);
  const winStreakRef = useRef(0);
  const executeAutoSpinRef = useRef();
  const hasStartedRef = useRef(false);
  const spinTimeoutsRef = useRef([]);
  const MAX_SESSION_SPINS = 35; // Safety cap to prevent runaway loops

  const clearAllSpinTimeouts = useCallback(() => {
    if (autoLoopTimerRef.current) {
      clearTimeout(autoLoopTimerRef.current);
      autoLoopTimerRef.current = null;
    }
    if (spinTimeoutsRef.current.length > 0) {
      spinTimeoutsRef.current.forEach((id) => clearTimeout(id));
      spinTimeoutsRef.current = [];
    }
  }, []);

  // Automated Spin Step with Fast Staggered Stops, Winning Payline Laser Highlights,
  // Explosive Tile Detonation + Cascade, and Occasional "Bonus Within a Bonus"!
  const executeAutoSpin = useCallback(() => {
    if (isCompletedRef.current || isSpinningRef.current || spinsLeftRef.current <= 0) {
      return;
    }
    isSpinningRef.current = true;
    setIsSpinning(true);
    setSpinningCols([true, true, true, true, true]);
    setLandedCols([false, false, false, false, false]);
    setRetriggerBanner(null);
    setSubBonusEvent(null);
    setWinningLines([]);
    setWinningCells(new Set());
    setExplodingCells(new Set());
    setCascadedCells(new Set());
    soundEngine.playSpinStart();

    // Deduct exactly 1 spin for this spin execution
    spinsLeftRef.current -= 1;
    setSpinsRemaining(spinsLeftRef.current);

    const isFast = turboBonusRef.current;

    // Generate outcome (with modest consolation 3-of-a-kind floor on the final spin if totalWinRef is 0)
    const nextGrid = generateFreeSpinsGrid();
    if (spinsLeftRef.current === 0 && totalWinRef.current <= 0) {
      const consolationSym =
        FREE_SPINS_CONFIG.symbols.find((s) => s.id === 'fs_royal_q') ||
        FREE_SPINS_CONFIG.symbols.find((s) => s.isRoyal) ||
        FREE_SPINS_CONFIG.symbols[FREE_SPINS_CONFIG.symbols.length - 1];
      if (consolationSym) {
        nextGrid[0][1] = consolationSym;
        nextGrid[1][1] = consolationSym;
        nextGrid[2][1] = consolationSym;
      }
    }

    // Rare & Occasional "Bonus Within a Bonus" (~13% chance, max 1 per Free Spins session)
    let triggeredSubBonus = null;
    if (
      subBonusesTriggeredRef.current < 1 &&
      spinsLeftRef.current >= 1 &&
      Math.random() < 0.13
    ) {
      subBonusesTriggeredRef.current += 1;
      const roll = Math.random();
      const wildSym =
        FREE_SPINS_CONFIG.symbols.find((s) => s.isWild) || FREE_SPINS_CONFIG.symbols[0];
      const highSym =
        FREE_SPINS_CONFIG.symbols.find((s) => s.isHigh) || FREE_SPINS_CONFIG.symbols[2];

      if (roll < 0.45 && wildSym && highSym) {
        // Sub-Bonus 1: Anubis & Bastet Wild Bomb Drop (Drops 2 Wilds + High Symbol for an explosive win!)
        nextGrid[0][1] = highSym;
        nextGrid[1][1] = wildSym;
        nextGrid[2][1] = wildSym;
        triggeredSubBonus = {
          type: 'wild_bomb',
          title: '💣 BONUS WITHIN A BONUS: PHOENIX WILD BOMB!',
          subtitle: 'ANUBIS & BASTET BLASTED 2× PHOENIX WILDS ONTO THE REELS!',
          cells: ['0-1', '1-1', '2-1'],
        };
      } else if (roll < 0.80) {
        // Sub-Bonus 2: Solar Multiplier Surge (+1x Multiplier Upgrade & +1 Free Spin!)
        const nextM = Math.min(4, sessionMultiplierRef.current + 1);
        sessionMultiplierRef.current = nextM;
        setSessionMultiplier(nextM);
        if (totalAwardedRef.current < MAX_SESSION_SPINS) {
          spinsLeftRef.current += 1;
          totalAwardedRef.current += 1;
          setSpinsRemaining(spinsLeftRef.current);
          setTotalSpinsAwarded(totalAwardedRef.current);
        }
        triggeredSubBonus = {
          type: 'mult_surge',
          title: `⚡ BONUS WITHIN A BONUS: ${nextM}× SOLAR OVERDRIVE!`,
          subtitle: `ALL WINS UPGRADED TO ${nextM}× MULTIPLIER + 1 EXTRA FREE SPIN!`,
          cells: ['1-1', '2-1', '3-1'],
        };
      } else {
        // Sub-Bonus 3 (Rare!): Golden Chakra Portal Key — Unlocks the 3D Bonus Chamber right after Free Spins!
        nestedPortalUnlockedRef.current = true;
        setNestedPortalUnlocked(true);
        triggeredSubBonus = {
          type: 'portal_key',
          title: '👑 BONUS WITHIN A BONUS: 3D ROYAL VAULT PORTAL UNLOCKED!',
          subtitle: 'GOLDEN PORTAL KEY FOUND — LAUNCHES 3D BONUS CHAMBER AFTER FREE SPINS!',
          cells: ['2-0', '2-1', '2-2'],
        };
      }
    }

    // Fast, Punchy Sequential Staggered Stops (More than 2× faster so bonus rounds fly!)
    const stopDelays = isFast ? [80, 130, 180, 230, 280] : [160, 240, 320, 400, 480];
    const evalDelay = isFast ? 310 : 520;

    stopDelays.forEach((delay, colIdx) => {
      const stopTm = setTimeout(() => {
        if (isCompletedRef.current) return;
        setCurrentGrid((prev) => {
          const updated = [...prev];
          updated[colIdx] = nextGrid[colIdx];
          return updated;
        });

        setSpinningCols((prev) => {
          const n = [...prev];
          n[colIdx] = false;
          return n;
        });

        setLandedCols((prev) => {
          const n = [...prev];
          n[colIdx] = true;
          return n;
        });

        const hasSpecial = nextGrid[colIdx].some((s) => s.isWild || s.isScatter);
        try {
          soundEngine.playReelStop(colIdx, hasSpecial);
        } catch (_) {}

        const bounceTm = setTimeout(() => {
          setLandedCols((prev) => {
            const n = [...prev];
            n[colIdx] = false;
            return n;
          });
        }, 200);
        spinTimeoutsRef.current.push(bounceTm);
      }, delay);
      spinTimeoutsRef.current.push(stopTm);
    });

    // Evaluate wins after all 5 reels have landed
    const evalTm = setTimeout(() => {
      if (isCompletedRef.current) return;

      if (triggeredSubBonus) {
        setSubBonusEvent(triggeredSubBonus);
        triggerStageImpact();
        try {
          soundEngine.playThunderStrike?.();
          soundEngine.playBonusTrigger?.();
        } catch (_) {}
      }

      const {
        wins,
        winCoordSet,
        totalCoinsWon,
        retriggeredSpins,
        scatterCount,
      } = evaluateFreeSpinsWins(nextGrid, sessionMultiplierRef.current);

      const effectiveLineBet = lineBet != null ? lineBet : betAmount / (linesCount || 15);
      let wonAmount = 0;
      let nextStreak = 0;

      if (totalCoinsWon > 0) {
        nextStreak = winStreakRef.current + 1;
        winStreakRef.current = nextStreak;
        setWinStreak(nextStreak);
        wonAmount = isSC
          ? Number((totalCoinsWon * effectiveLineBet).toFixed(2))
          : Math.round(totalCoinsWon * effectiveLineBet);

        setLastSpinWin(wonAmount);
        setTotalAccumulatedWin((prev) => {
          const next = isSC ? Number((prev + wonAmount).toFixed(2)) : prev + wonAmount;
          totalWinRef.current = next;
          return next;
        });
        setWinningLines(wins);
        setWinningCells(winCoordSet);
        setTotalCardPulse(true);
        triggerStageImpact();

        const popId = Date.now();
        setSpinWinPop({
          id: popId,
          amount: wonAmount,
          linesHit: wins.length,
          isBig: wonAmount >= betAmount * 5,
        });

        // Play win celebration + explosive tile detonation sound
        soundEngine.playWinCelebration(wonAmount >= betAmount * 5 ? 'big' : 'standard');

        // Trigger Explosive Tile Detonation & Candy-Crush Cascade Animation on winning cells!
        const explodeTm = setTimeout(() => {
          if (isCompletedRef.current) return;
          setExplodingCells(new Set(winCoordSet));
          try {
            soundEngine.playSolarFireball?.();
          } catch (_) {}

          // Drop replacement royal tiles into the exploded positions for visual Candy-Crush cascade!
          const cascadeDropTm = setTimeout(() => {
            if (isCompletedRef.current) return;
            const royals = FREE_SPINS_CONFIG.symbols.filter((s) => s.isRoyal);
            const fallbackPool = royals.length > 0 ? royals : FREE_SPINS_CONFIG.symbols;
            setCurrentGrid((prev) =>
              prev.map((col, cIdx) =>
                col.map((sym, rIdx) =>
                  winCoordSet.has(`${cIdx}-${rIdx}`) && !sym.isScatter
                    ? pickWeightedSymbol(fallbackPool)
                    : sym
                )
              )
            );
            setExplodingCells(new Set());
            setCascadedCells(new Set(winCoordSet));
          }, isFast ? 180 : 260);
          spinTimeoutsRef.current.push(cascadeDropTm);
        }, isFast ? 220 : 340);
        spinTimeoutsRef.current.push(explodeTm);

        setTimeout(() => {
          setTotalCardPulse(false);
        }, 850);
        setTimeout(() => {
          setSpinWinPop((curr) => (curr?.id === popId ? null : curr));
        }, 1050);
      } else {
        winStreakRef.current = 0;
        setWinStreak(0);
        setLastSpinWin(0);
        setSpinWinPop(null);
      }

      // Retrigger Scatters handler (3+ Scatters) OR 5-Win Solar Frenzy Streak (+1 Extra Spin)
      const streakBonusSpins = nextStreak > 0 && nextStreak % 5 === 0 ? 1 : 0;
      const totalExtraRequested = retriggeredSpins + streakBonusSpins;
      if (totalExtraRequested > 0) {
        const canAward = Math.min(
          totalExtraRequested,
          Math.max(0, MAX_SESSION_SPINS - totalAwardedRef.current)
        );
        if (canAward > 0) {
          spinsLeftRef.current += canAward;
          totalAwardedRef.current += canAward;
          setSpinsRemaining(spinsLeftRef.current);
          setTotalSpinsAwarded(totalAwardedRef.current);
          soundEngine.playBonusTrigger();
          if (retriggeredSpins > 0) {
            setRetriggerBanner(
              `☀️ ${scatterCount}× SUN GOD RA SCATTERS! +${canAward} EXTRA FREE SPINS!`
            );
          } else {
            setRetriggerBanner(
              `🔥 ${nextStreak}-WIN SOLAR FRENZY STREAK! +${canAward} BONUS FREE SPIN AWARDED!`
            );
          }
        }
      }

      // Check for completion or schedule next automatic spin rapidly
      if (spinsLeftRef.current <= 0) {
        isCompletedRef.current = true;
        setIsSpinning(false);
        isSpinningRef.current = false;
        setTimeout(() => {
          setIsCompleted(true);
          soundEngine.playWin(true);
        }, isFast ? 450 : 750);
      } else {
        setIsSpinning(false);
        isSpinningRef.current = false;
        const nextSpinWait = isFast
          ? wonAmount > 0
            ? 520
            : 260
          : wonAmount > 0
          ? 920
          : 440;
        autoLoopTimerRef.current = setTimeout(() => {
          if (!isCompletedRef.current && executeAutoSpinRef.current) {
            executeAutoSpinRef.current();
          }
        }, nextSpinWait);
      }
    }, evalDelay);
    spinTimeoutsRef.current.push(evalTm);
  }, [isSC, betAmount, coinValue, evaluateFreeSpinsWins, linesCount, lineBet, triggerStageImpact]);

  executeAutoSpinRef.current = executeAutoSpin;

  const handleFinishAndCollect = useCallback(() => {
    soundEngine.playWin(true);
    const finalTotal = totalWinRef.current;
    const hadPortal = nestedPortalUnlockedRef.current;
    onCompleteRef.current?.(finalTotal);
    if (hadPortal && onTriggerNestedBonusRef.current) {
      setTimeout(() => {
        onTriggerNestedBonusRef.current();
      }, 250);
    }
  }, []);

  // Initial Countdown & Auto-Start Loop (Snappy 1-second launch)
  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false;
      isCompletedRef.current = true;
      isSpinningRef.current = false;
      clearAllSpinTimeouts();
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Reset session
    spinsLeftRef.current = initialSpins;
    totalAwardedRef.current = initialSpins;
    isSpinningRef.current = false;
    isCompletedRef.current = false;
    winStreakRef.current = 0;
    subBonusesTriggeredRef.current = 0;
    nestedPortalUnlockedRef.current = false;
    sessionMultiplierRef.current = FREE_SPINS_CONFIG.winMultiplier || 2;

    setSpinsRemaining(initialSpins);
    setTotalSpinsAwarded(initialSpins);
    setTotalAccumulatedWin(0);
    totalWinRef.current = 0;
    setLastSpinWin(0);
    setWinStreak(0);
    setSubBonusEvent(null);
    setNestedPortalUnlocked(false);
    setSessionMultiplier(FREE_SPINS_CONFIG.winMultiplier || 2);
    setIsCompleted(false);
    setCollectCountdown(2);
    setCountdown(1);

    const launchTm = setTimeout(() => {
      setCountdown(0);
      if (executeAutoSpinRef.current) {
        executeAutoSpinRef.current();
      }
    }, 650);

    return () => {
      clearTimeout(launchTm);
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    };
  }, [isOpen, initialSpins, clearAllSpinTimeouts]);

  // Automatic Collect Countdown when Free Spins Complete (Snappy 2s countdown)
  useEffect(() => {
    if (!isOpen || !isCompleted) {
      setCollectCountdown(2);
      return;
    }
    setCollectCountdown(2);
    const interval = setInterval(() => {
      setCollectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinishAndCollect();
          return 0;
        }
        return prev - 1;
      });
    }, 900);
    return () => clearInterval(interval);
  }, [isOpen, isCompleted, handleFinishAndCollect]);

  if (!isOpen) return null;

  const hasWinningHighlight = winningCells.size > 0;

  return (
    <div className={`free-spins-stage-container ${stageShake ? 'fs-stage-impact-shake' : ''}`}>
      {/* Background Animated Rays & Stars */}
      <img
        src="/assets/psd/fx_rays.png"
        alt=""
        className="fs-cosmic-rays"
        draggable={false}
      />
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="fs-cosmic-sparks"
        draggable={false}
      />

      {/* Floating Solar Embers */}
      <div className="fs-embers-wrap">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className={`fs-ember fs-ember-${i + 1}`} />
        ))}
      </div>

      {/* Free Spins Stage Header HUD */}
      <header className="fs-hud-header">
        <div className="fs-brand-tag">
          <Flame size={20} className="fs-flame-icon" />
          <div className="fs-title-group">
            <h2 className="fs-title">{FREE_SPINS_CONFIG.title}</h2>
            <p className="fs-subtitle">{FREE_SPINS_CONFIG.subTitle}</p>
          </div>
          <button
            type="button"
            className={`bonus-autoplay-toggle-pill ${turboBonus ? 'autoplay-on' : 'autoplay-off'}`}
            onClick={() => {
              soundEngine.playButtonClick?.(680);
              setTurboBonus((prev) => !prev);
            }}
            title="Toggle 2× Hyper-Speed Bonus Spins"
          >
            <FastForward size={14} />
            <span>{turboBonus ? '⚡ 2× HYPER SPEED: ON' : '⚡ 2× HYPER SPEED'}</span>
          </button>
        </div>

        {/* Free Spins Metrics Bar */}
        <div className="fs-metrics-bar">
          {/* Spins Remaining Badge */}
          <div className="fs-metric-card spins-left-card">
            <div className="fs-metric-label">FREE SPINS LEFT</div>
            <div className="fs-spins-counter">
              <span className="fs-counter-num">{spinsRemaining}</span>
              <span className="fs-counter-total">/ {totalSpinsAwarded}</span>
            </div>
            <div className="fs-spin-progress-bar">
              <div
                className="fs-progress-fill"
                style={{
                  width: `${(spinsRemaining / totalSpinsAwarded) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Active Solar Multiplier Pill */}
          <div className={`fs-multiplier-badge ${multiplier > 2 ? 'fs-mult-overcharged' : ''}`}>
            <Zap size={16} className="zap-icon" />
            <span>{multiplier}× MULTIPLIER</span>
          </div>

          {/* Nested Portal Key Indicator if unlocked */}
          {nestedPortalUnlocked && (
            <div className="fs-multiplier-badge fs-portal-key-pill">
              <Crown size={16} className="zap-icon" />
              <span>🗝️ 3D BONUS VAULT QUEUED!</span>
            </div>
          )}

          {/* Running Total Won Counter */}
          <div className={`fs-metric-card total-won-card ${totalCardPulse ? 'fs-total-card-pulse' : ''}`}>
            <div className="fs-metric-label">RUNNING BONUS TOTAL</div>
            <div className="fs-running-digits">
              <PsdGoldNumber
                value={isSC ? totalAccumulatedWin.toFixed(2) : totalAccumulatedWin}
                height={34}
                gap={-2}
              />
              {spinWinPop && (
                <span key={spinWinPop.id} className="fs-running-delta-pill">
                  +{isSC ? `$${spinWinPop.amount.toFixed(2)}` : spinWinPop.amount.toLocaleString()}!
                </span>
              )}
            </div>
            <div className="fs-running-usd">
              {isSC
                ? `+$${totalAccumulatedWin.toFixed(2)} USD PRIZE`
                : `+${totalAccumulatedWin.toLocaleString()} GC`}
            </div>
          </div>
        </div>

        {/* Bonus-Within-A-Bonus Eruption Banner */}
        {subBonusEvent && (
          <div className="fs-sub-bonus-eruption-banner" role="status">
            <Zap size={18} className="frenzy-flame" />
            <div className="fs-sub-bonus-txt">
              <strong>{subBonusEvent.title}</strong>
              <span>{subBonusEvent.subtitle}</span>
            </div>
            <Flame size={18} className="frenzy-flame" />
          </div>
        )}

        {/* Retrigger Callout Banner */}
        {retriggerBanner && (
          <div className="fs-retrigger-banner">
            <Sparkles size={16} />
            <span>{retriggerBanner}</span>
            <Sparkles size={16} />
          </div>
        )}

        {/* Solar Frenzy Streak Callout Banner */}
        {winStreak >= 2 && (
          <div className="fs-solar-frenzy-badge">
            <Flame size={18} className="frenzy-flame" />
            <span>SOLAR FRENZY STREAK: {winStreak} CONSECUTIVE WINS!</span>
            <Flame size={18} className="frenzy-flame" />
          </div>
        )}
      </header>

      {/* Center Reel Cabinet Stage */}
      <main className="fs-cabinet-stage">
        <div className="fs-cabinet-frame-wrap">
          {/* Top Arch Solar Plaque */}
          <div className="fs-top-arch-badge">
            <Sparkles size={14} />
            <span>
              DC ENTERPRISES • {multiplier}× SOLAR ARENA{' '}
              {hasWinningHighlight ? `• ${winningLines.length} WINNING PAYLINE${winningLines.length > 1 ? 'S' : ''} LIT!` : ''}
            </span>
            <Sparkles size={14} />
          </div>

          {/* Celebratory Solar Spin Win Pop-Up Banner */}
          {spinWinPop && (
            <div
              key={spinWinPop.id}
              className={`fs-spin-win-celebration-pop ${spinWinPop.isBig ? 'is-big-solar-win' : ''}`}
              aria-live="polite"
            >
              <div className="fs-spin-pop-coins" aria-hidden="true">
                <span className="fsp-coin c1">🪙</span>
                <span className="fsp-coin c2">☀️</span>
                <span className="fsp-coin c3">💎</span>
                <span className="fsp-coin c4">🪙</span>
                <span className="fsp-coin c5">✨</span>
                <span className="fsp-coin c6">🪙</span>
              </div>
              <span className="fs-spin-pop-tag">
                {spinWinPop.isBig ? '💥 SUPERNOVA SOLAR HIT!' : '⚡ WINNING SPIN DETONATION!'} ({spinWinPop.linesHit}{' '}
                {spinWinPop.linesHit === 1 ? 'LINE' : 'LINES'} • {multiplier}× MULT)
              </span>
              <strong className="fs-spin-pop-amount">
                +{isSC ? `$${spinWinPop.amount.toFixed(2)} USD` : `${spinWinPop.amount.toLocaleString()} COINS`}
              </strong>
            </div>
          )}

          {/* 5×3 Free Spins Grid Window with SVG Laser Payline Overlay & Explosive Tile FX */}
          <div
            className={`fs-reel-window ${hasWinningHighlight ? 'fs-window-win-lit' : ''}`}
            onClick={() => {
              // Tapping the reels toggles 2x hyper speed or slams the next spin immediately
              if (!isSpinning && spinsRemaining > 0 && executeAutoSpinRef.current) {
                clearAllSpinTimeouts();
                executeAutoSpinRef.current();
              }
            }}
            title="Tap reels to fast-forward to next spin"
          >
            <div className="fs-grid-layout">
              {currentGrid.map((col, colIdx) => {
                const isColSpinning = spinningCols[colIdx];
                const isColLanded = landedCols[colIdx];

                if (isColSpinning) {
                  return (
                    <div
                      key={colIdx}
                      className="fs-reel-column is-column-spinning"
                    >
                      <div className="fs-reel-strip-scroller">
                        {rollTape.map((sym, rIdx) => (
                          <div
                            key={rIdx}
                            className="fs-symbol-tile strip-tile"
                            style={{
                              background: `radial-gradient(circle at 50% 45%, ${sym.tileBgStart} 0%, ${sym.tileBgEnd} 100%)`,
                              borderColor: sym.accentColor || '#fbbf24',
                            }}
                          >
                            <div className="fs-tile-gold-bezel" />
                            {sym.image ? (
                              <img
                                src={sym.image}
                                alt={sym.name}
                                className="fs-tile-3d-art"
                                draggable={false}
                              />
                            ) : (
                              <div className="fs-royal-letter-wrap">
                                <span
                                  className="fs-royal-letter-3d"
                                  style={{
                                    color: sym.gemHighlight || '#fef08a',
                                    textShadow: `0 2px 6px rgba(0,0,0,0.95), 0 0 12px ${sym.gemColor || '#f59e0b'}`,
                                  }}
                                >
                                  {sym.letter}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={colIdx}
                    className={`fs-reel-column ${isColLanded ? 'col-landed-bounce' : ''}`}
                  >
                    {col.map((sym, rowIdx) => {
                      const cellKey = `${colIdx}-${rowIdx}`;
                      const isWinning = winningCells.has(cellKey);
                      const isExploding = explodingCells.has(cellKey);
                      const isCascaded = cascadedCells.has(cellKey);
                      const isSubBonusCell = subBonusEvent?.cells?.includes(cellKey);
                      const isDimmed = hasWinningHighlight && !isWinning && !isSubBonusCell;

                      return (
                        <div
                          key={rowIdx}
                          className={`fs-symbol-tile ${
                            sym.isWild ? 'wild-tile' : sym.isScatter ? 'scatter-tile' : ''
                          } ${isWinning ? 'winning-tile' : ''} ${
                            isExploding ? 'fs-tile-exploding' : ''
                          } ${isCascaded ? 'fs-tile-cascaded-in' : ''} ${
                            isSubBonusCell ? 'fs-tile-subbonus-hit' : ''
                          } ${isDimmed ? 'fs-tile-dimmed' : ''}`}
                          style={{
                            background: `radial-gradient(circle at 50% 45%, ${sym.tileBgStart} 0%, ${sym.tileBgEnd} 100%)`,
                            borderColor: isWinning
                              ? '#ffd700'
                              : sym.accentColor || '#fbbf24',
                          }}
                        >
                          {/* 3D Gold Extruded Bezel Frame */}
                          <div className="fs-tile-gold-bezel" />

                          {/* Blazing Phoenix Wild Flame Wings Aura */}
                          {sym.isWild && (
                            <div className="fs-phoenix-wild-auras" aria-hidden="true">
                              <div className="phoenix-wing-left" />
                              <div className="phoenix-wing-right" />
                              <div className="phoenix-core-flare" />
                            </div>
                          )}

                          {/* 3D Graphic Asset or Sculpted Royal Letter */}
                          {sym.image ? (
                            <img
                              src={sym.image}
                              alt={sym.name}
                              className="fs-tile-3d-art"
                              draggable={false}
                            />
                          ) : (
                            <div className="fs-royal-letter-wrap">
                              <span
                                className="fs-royal-letter-3d"
                                style={{
                                  color: sym.gemHighlight || '#fef08a',
                                  textShadow: `0 3px 8px rgba(0, 0, 0, 0.95), 0 0 14px ${sym.gemColor || '#f59e0b'}`,
                                }}
                              >
                                {sym.letter}
                              </span>
                            </div>
                          )}

                          {/* Minimal Corner Tag ONLY for Wild or Scatter */}
                          {(sym.isWild || sym.isScatter) && sym.badge && (
                            <div
                              className="fs-tile-badge"
                              style={{
                                background: sym.gemColor || '#fbbf24',
                                color: '#1a0e05',
                              }}
                            >
                              {sym.badge}
                            </div>
                          )}

                          {/* Winning Highlight Border Glow, Supernova Explosion & 8-Particle Shrapnel Burst */}
                          {(isWinning || isSubBonusCell) && (
                            <>
                              <div className="fs-winning-border-glow" />
                              <div className="fs-tile-win-micro-burst" aria-hidden="true">
                                <span className="fs-cell-burst-ring" />
                                <span className="fs-cell-burst-ring ring-2" />
                                <span className="fs-cell-spark s1">🪙</span>
                                <span className="fs-cell-spark s2">💥</span>
                                <span className="fs-cell-spark s3">🪙</span>
                                <span className="fs-cell-spark s4">💎</span>
                                <span className="fs-cell-spark s5">⚡</span>
                                <span className="fs-cell-spark s6">🔥</span>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* Glowing SVG Laser Payline Highlight Overlay for Winning Free Spins */}
            {winningLines.length > 0 && (
              <svg
                className="fs-paylines-svg-overlay"
                viewBox="0 0 500 300"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <filter id="fsLaserGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {winningLines.map((w, idx) => {
                  const rows = w.line?.rows || [1, 1, 1, 1, 1];
                  const lineColor = w.line?.color || '#ffd700';
                  const pts = rows
                    .map((r, c) => `${c * 100 + 50},${r * 100 + 50}`)
                    .join(' ');
                  const matchedPts = rows
                    .slice(0, w.matchCount || 3)
                    .map((r, c) => [c * 100 + 50, r * 100 + 50]);

                  return (
                    <g key={`${w.line?.id || idx}`} filter="url(#fsLaserGlow)">
                      {/* Outer neon laser beam */}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth="7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.88"
                      />
                      {/* Hot white core laser */}
                      <polyline
                        points={pts}
                        fill="none"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {/* Glowing node rings on winning cells */}
                      {matchedPts.map(([cx, cy], nIdx) => (
                        <g key={nIdx}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r="11"
                            fill="#ffffff"
                            stroke={lineColor}
                            strokeWidth="4"
                          />
                        </g>
                      ))}
                    </g>
                  );
                })}
              </svg>
            )}

            {/* Winning Payline Callout Pills */}
            {winningLines.length > 0 && (
              <div className="fs-winning-lines-strip" aria-live="polite">
                {winningLines.slice(0, 4).map((w, idx) => (
                  <span
                    key={`${w.line?.id || idx}`}
                    className="fs-win-line-chip"
                    style={{ borderColor: w.line?.color || '#ffd700' }}
                  >
                    <strong style={{ color: w.line?.color || '#ffd700' }}>
                      {w.isScatter ? '☀️ SCATTER' : `LINE #${w.line?.id}`}
                    </strong>
                    <span>
                      {w.matchCount}× {w.symbol?.letter || w.symbol?.name} (+{w.lineWin})
                    </span>
                  </span>
                ))}
              </div>
            )}

            {/* Snappy Initial Countdown Splash */}
            {countdown > 0 && (
              <div
                className="fs-intro-countdown-overlay"
                onClick={() => {
                  setCountdown(0);
                  if (executeAutoSpinRef.current) executeAutoSpinRef.current();
                }}
              >
                <div className="fs-intro-content">
                  <Flame size={48} className="intro-flame-icon" />
                  <h3 className="intro-title">LAUNCHING SOLAR FREE SPINS!</h3>
                  <div className="intro-countdown-num">{countdown}</div>
                  <p className="intro-sub">
                    {initialSpins} FAST FREE SPINS • {multiplier}× MULTIPLIER • EXPLODING WINS!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Running Auto-Status Bar Below Reel Grid */}
          <div className="fs-running-status-bar">
            <div className="fs-status-left">
              <span className="status-dot-pulse" />
              <span>
                {isSpinning
                  ? `SPINNING FREE SPIN #${totalSpinsAwarded - spinsRemaining}...`
                  : spinsRemaining > 0
                  ? `FAST AUTO-SPIN ACTIVE (${spinsRemaining} LEFT • TAP REELS TO SLAM)`
                  : 'ALL FREE SPINS COMPLETED!'}
              </span>
            </div>
            <div className="fs-status-right">
              {lastSpinWin > 0 ? (
                <span className="last-win-text">
                  💥 WINNING SPIN: +{isSC ? `$${lastSpinWin.toFixed(2)}` : lastSpinWin.toLocaleString()}{' '}
                  ({winningLines.length} {winningLines.length === 1 ? 'LINE' : 'LINES'} • {multiplier}× MULT)
                </span>
              ) : (
                <span className="auto-running-tag">⚡ RAPID BONUS PLAY ACTIVE</span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Completion Celebration Overlay */}
      {isCompleted && (
        <div className="fs-completed-overlay">
          <div className="fs-completed-modal">
            <div className="completed-crown-wrap">
              <Crown size={52} className="completed-crown-icon" />
            </div>
            <h2 className="completed-title">FREE SPINS COMPLETED!</h2>
            <p className="completed-desc">
              {nestedPortalUnlocked
                ? `All ${totalSpinsAwarded} Free Spins finished — AND your Golden Portal Key unlocks the 3D Bonus Chamber next!`
                : `All ${totalSpinsAwarded} Celestial Free Spins have finished.`}
            </p>

            <div className="completed-total-box">
              <span className="total-box-label">TOTAL ACCUMULATED WINNINGS:</span>
              <div className="total-box-digits">
                <PsdGoldNumber
                  value={
                    isSC
                      ? totalAccumulatedWin.toFixed(2)
                      : totalAccumulatedWin
                  }
                  height={56}
                  gap={-3}
                />
              </div>
              <span className="total-box-usd">
                {isSC
                  ? `+$${totalAccumulatedWin.toFixed(2)} USD REAL PRIZE`
                  : `+${totalAccumulatedWin.toLocaleString()} GOLD COINS`}
              </span>
            </div>

            <button
              className="fs-collect-bonus-btn"
              onClick={handleFinishAndCollect}
            >
              <CheckCircle2 size={20} />
              <span>
                {nestedPortalUnlocked
                  ? `👑 COLLECT & ENTER 3D BONUS CHAMBER IN ${collectCountdown}s!`
                  : `🎉 COLLECTING ${
                      isSC
                        ? `$${totalAccumulatedWin.toFixed(2)} USD`
                        : `${totalAccumulatedWin.toLocaleString()} COINS`
                    } IN ${collectCountdown}s (TAP NOW)`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
