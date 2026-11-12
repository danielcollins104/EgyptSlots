import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Sparkles,
  Flame,
  Crown,
  Trophy,
  CheckCircle2,
  Zap,
  RotateCw,
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
  const [retriggerBanner, setRetriggerBanner] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [countdown, setCountdown] = useState(2); // Initial 2-sec intro countdown
  const [winStreak, setWinStreak] = useState(0);
  const [spinWinPop, setSpinWinPop] = useState(null);
  const [totalCardPulse, setTotalCardPulse] = useState(false);
  const [collectCountdown, setCollectCountdown] = useState(4);
  const totalWinRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const isSC = currencyMode === 'SC';
  const autoLoopTimerRef = useRef(null);
  const multiplier = FREE_SPINS_CONFIG.winMultiplier || 2;

  const rollTape = useMemo(() => {
    const list = FREE_SPINS_CONFIG.symbols;
    return [...list, ...list];
  }, []);

  // Evaluate Free Spins 15-Payline wins with 2× Solar Multiplier
  const evaluateFreeSpinsWins = useCallback(
    (grid) => {
      const wins = [];
      const winCoordSet = new Set();
      let totalCoinsWon = 0;
      const multiplier = FREE_SPINS_CONFIG.winMultiplier || 2;

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
            const lineWin = basePayout * multiplier;
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
        scatterWinCoins = (scatterCells.length >= 4 ? 40 : 15) * multiplier;
        totalCoinsWon += scatterWinCoins;
        scatterCells.forEach(([c, r]) => winCoordSet.add(`${c}-${r}`));
        wins.unshift({
          line: { id: 'SCATTER', name: `${scatterCells.length}× Sun God Ra`, rows: [1, 1, 1, 1, 1], color: '#fbbf24' },
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
    []
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

  // Automated Spin Step with Authentic Staggered Casino Cascade
  const executeAutoSpin = useCallback(() => {
    if (isCompletedRef.current || isSpinningRef.current || spinsLeftRef.current <= 0) {
      return;
    }
    isSpinningRef.current = true;
    setIsSpinning(true);
    setSpinningCols([true, true, true, true, true]);
    setLandedCols([false, false, false, false, false]);
    setRetriggerBanner(null);
    setWinningLines([]);
    setWinningCells(new Set());
    soundEngine.playSpinStart();

    // Deduct exactly 1 spin for this spin execution
    spinsLeftRef.current -= 1;
    setSpinsRemaining(spinsLeftRef.current);

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

    // Authentic Sequential Staggered Stops (Reels 1 through 5 land sequentially)
    const stopDelays = [400, 580, 760, 940, 1120];
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
        }, 320);
        spinTimeoutsRef.current.push(bounceTm);
      }, delay);
      spinTimeoutsRef.current.push(stopTm);
    });

    // Evaluate wins after all 5 reels have finished landing with bounce
    const evalTm = setTimeout(() => {
      if (isCompletedRef.current) return;
      const {
        wins,
        winCoordSet,
        totalCoinsWon,
        retriggeredSpins,
        scatterCount,
      } = evaluateFreeSpinsWins(nextGrid);

      // Calculate won amount in active currency
      let wonAmount = 0;
      let nextStreak = 0;
      if (totalCoinsWon > 0) {
        nextStreak = winStreakRef.current + 1;
        winStreakRef.current = nextStreak;
        setWinStreak(nextStreak);
        const effectiveLineBet = lineBet != null ? lineBet : (betAmount / (linesCount || 15));
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
        const popId = Date.now();
        setSpinWinPop({
          id: popId,
          amount: wonAmount,
          linesHit: wins.length,
          isBig: wonAmount >= betAmount * 5,
        });
        setTimeout(() => {
          setTotalCardPulse(false);
        }, 1450);
        setTimeout(() => {
          setSpinWinPop((curr) => (curr?.id === popId ? null : curr));
        }, 1750);

        // Play win celebration
        soundEngine.playWinCelebration(wonAmount >= betAmount * 5 ? 'big' : 'standard');
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
              `🔥 ${nextStreak}-WIN SOLAR FRENZY STREAK! +${canAward} BONUS FREE SPINS AWARDED!`
            );
          }
        }
      }

      // Check for completion or schedule next automatic spin
      if (spinsLeftRef.current <= 0) {
        isCompletedRef.current = true;
        setIsSpinning(false);
        isSpinningRef.current = false;
        setTimeout(() => {
          setIsCompleted(true);
          soundEngine.playWin(true);
        }, 1200);
      } else {
        setIsSpinning(false);
        isSpinningRef.current = false;
        autoLoopTimerRef.current = setTimeout(() => {
          if (!isCompletedRef.current && executeAutoSpinRef.current) {
            executeAutoSpinRef.current();
          }
        }, wonAmount > 0 ? 1900 : 1200);
      }
    }, 1220);
    spinTimeoutsRef.current.push(evalTm);
  }, [isSC, betAmount, coinValue, evaluateFreeSpinsWins, linesCount, lineBet]);

  executeAutoSpinRef.current = executeAutoSpin;

  // Initial Countdown & Auto-Start Loop (Runs strictly once per modal opening)
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

    setSpinsRemaining(initialSpins);
    setTotalSpinsAwarded(initialSpins);
    setTotalAccumulatedWin(0);
    totalWinRef.current = 0;
    setLastSpinWin(0);
    setWinStreak(0);
    setIsCompleted(false);
    setCollectCountdown(4);
    setCountdown(2);

    const countInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countInterval);
          // Launch automatic spin 1
          setTimeout(() => {
            if (executeAutoSpinRef.current) {
              executeAutoSpinRef.current();
            }
          }, 500);
          return 0;
        }
        return prev - 1;
      });
    }, 900);

    return () => {
      clearInterval(countInterval);
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
    };
  }, [isOpen, initialSpins]);

  // Automatic Collect Countdown when Free Spins Complete
  useEffect(() => {
    if (!isOpen || !isCompleted) {
      setCollectCountdown(4);
      return;
    }
    setCollectCountdown(4);
    const interval = setInterval(() => {
      setCollectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          soundEngine.playWin(true);
          onCompleteRef.current?.(totalWinRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, isCompleted]);

  if (!isOpen) return null;

  return (
    <div className="free-spins-stage-container">
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
          <Flame size={20} className="fs-flame-icon" />
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

          {/* 2× Solar Multiplier Pill */}
          <div className="fs-multiplier-badge">
            <Zap size={16} className="zap-icon" />
            <span>{multiplier}× MULTIPLIER</span>
          </div>

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

      {/* Center Reel Cabinet Only (No Guardians, Clean Pure Focus on Reels) */}
      <main className="fs-cabinet-stage">
        <div className="fs-cabinet-frame-wrap">
          {/* Top Arch Solar Plaque (Outside the reel grid so it never blocks symbols) */}
          <div className="fs-top-arch-badge">
            <Sparkles size={14} />
            <span>DC ENTERPRISES • {multiplier}× SOLAR ARENA</span>
            <Sparkles size={14} />
          </div>

          {/* Celebratory Solar Spin Win Pop-Up Banner (Outside the reel symbols) */}
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
                {spinWinPop.isBig ? '🔥 BLAZING SOLAR HIT!' : '☀️ SOLAR SPIN WIN!'} ({spinWinPop.linesHit}{' '}
                {spinWinPop.linesHit === 1 ? 'LINE' : 'LINES'} • {multiplier}× MULT)
              </span>
              <strong className="fs-spin-pop-amount">
                +{isSC ? `$${spinWinPop.amount.toFixed(2)} USD` : `${spinWinPop.amount.toLocaleString()} COINS`}
              </strong>
            </div>
          )}

          {/* 5×3 Free Spins Grid Window — High Contrast, Unobstructed Symbol Stage */}
          <div className="fs-reel-window">
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
                      const isWinning = winningCells.has(`${colIdx}-${rowIdx}`);
                      return (
                        <div
                          key={rowIdx}
                          className={`fs-symbol-tile ${
                            sym.isWild ? 'wild-tile' : sym.isScatter ? 'scatter-tile' : ''
                          } ${isWinning ? 'winning-tile' : ''}`}
                          style={{
                            background: `radial-gradient(circle at 50% 45%, ${sym.tileBgStart} 0%, ${sym.tileBgEnd} 100%)`,
                            borderColor: sym.accentColor || '#fbbf24',
                          }}
                        >
                          {/* 3D Gold Extruded Bezel Frame */}
                          <div className="fs-tile-gold-bezel" />

                          {/* Blazing Phoenix Wild Flame Wings Aura (Behind symbol so it never dims it) */}
                          {sym.isWild && (
                            <div className="fs-phoenix-wild-auras" aria-hidden="true">
                              <div className="phoenix-wing-left" />
                              <div className="phoenix-wing-right" />
                              <div className="phoenix-core-flare" />
                            </div>
                          )}

                          {/* Unobstructed Full-Size 3D Graphic Asset or 3D Sculpted Royal Letter */}
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

                          {/* Winning Highlight Border Glow & Coin Sparkle Micro-Burst */}
                          {isWinning && (
                            <>
                              <div className="fs-winning-border-glow" />
                              <div className="fs-tile-win-micro-burst" aria-hidden="true">
                                <span className="fs-cell-burst-ring" />
                                <span className="fs-cell-spark s1">🪙</span>
                                <span className="fs-cell-spark s2">✨</span>
                                <span className="fs-cell-spark s3">🪙</span>
                                <span className="fs-cell-spark s4">💎</span>
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

            {/* Initial Countdown Splash */}
            {countdown > 0 && (
              <div className="fs-intro-countdown-overlay">
                <div className="fs-intro-content">
                  <Flame size={48} className="intro-flame-icon" />
                  <h3 className="intro-title">COMMENCING AUTOMATIC SPINS...</h3>
                  <div className="intro-countdown-num">{countdown}</div>
                  <p className="intro-sub">
                    {initialSpins} FREE SPINS • {multiplier}× SOLAR MULTIPLIER ON ALL WINS
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Running Auto-Status Bar Below Reel Grid (Outside the reel window) */}
          <div className="fs-running-status-bar">
            <div className="fs-status-left">
              <span className="status-dot-pulse" />
              <span>
                {isSpinning
                  ? `SPINNING FREE SPIN #${totalSpinsAwarded - spinsRemaining + 1}...`
                  : spinsRemaining > 0
                  ? `AUTO-SPIN READY (${spinsRemaining} REMAINING)`
                  : 'ALL FREE SPINS COMPLETED!'}
              </span>
            </div>
            <div className="fs-status-right">
              {lastSpinWin > 0 ? (
                <span className="last-win-text">
                  LAST SPIN WON: +{isSC ? `$${lastSpinWin.toFixed(2)}` : lastSpinWin.toLocaleString()}{' '}
                  ({multiplier}× MULT)
                </span>
              ) : (
                <span className="auto-running-tag">AUTOMATIC PLAY ACTIVE</span>
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
              All {totalSpinsAwarded} Celestial Free Spins have finished.
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
              onClick={() => {
                soundEngine.playWin(true);
                onComplete(totalAccumulatedWin);
              }}
            >
              <CheckCircle2 size={20} />
              <span>
                🎉 AUTO-COLLECTING{' '}
                {isSC
                  ? `$${totalAccumulatedWin.toFixed(2)} USD`
                  : `${totalAccumulatedWin.toLocaleString()} COINS`}{' '}
                IN {collectCountdown}s (TAP TO CLAIM NOW)
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
