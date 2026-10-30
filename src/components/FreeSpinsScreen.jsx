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

      // 1. Evaluate 15 Paylines
      for (const line of PAYLINES) {
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
        scatterWinCoins = (scatterCells.length >= 4 ? 180 : 60) * multiplier;
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
      } else if (scatterCells.length === 2) {
        // 2 Scatters awards a nice coin payout, but no extra spins
        scatterWinCoins = 15 * multiplier;
        totalCoinsWon += scatterWinCoins;
        scatterCells.forEach(([c, r]) => winCoordSet.add(`${c}-${r}`));
        wins.unshift({
          line: { id: 'SCATTER', name: '2× Sun God Ra Scatters', rows: [1, 1, 1, 1, 1], color: '#fbbf24' },
          symbol: { id: 'fs_retrigger', name: 'Sun God Ra Aureole' },
          matchCount: 2,
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
  const executeAutoSpinRef = useRef();
  const hasStartedRef = useRef(false);
  const MAX_SESSION_SPINS = 30; // Safety cap to prevent runaway loops

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

    // Generate outcome
    const nextGrid = generateFreeSpinsGrid();

    // Authentic Sequential Staggered Stops (Reels 1 through 5 land sequentially)
    const stopDelays = [400, 580, 760, 940, 1120];
    stopDelays.forEach((delay, colIdx) => {
      setTimeout(() => {
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

        setTimeout(() => {
          setLandedCols((prev) => {
            const n = [...prev];
            n[colIdx] = false;
            return n;
          });
        }, 320);
      }, delay);
    });

    // Evaluate wins after all 5 reels have finished landing with bounce
    setTimeout(() => {
      const {
        wins,
        winCoordSet,
        totalCoinsWon,
        retriggeredSpins,
        scatterCount,
      } = evaluateFreeSpinsWins(nextGrid);

      // Calculate won amount in active currency
      let wonAmount = 0;
      if (totalCoinsWon > 0) {
        wonAmount = isSC
          ? Number(((totalCoinsWon / 15) * betAmount).toFixed(2))
          : Math.round((totalCoinsWon / 15) * betAmount);

        setLastSpinWin(wonAmount);
        setTotalAccumulatedWin((prev) =>
          isSC ? Number((prev + wonAmount).toFixed(2)) : prev + wonAmount
        );
        setWinningLines(wins);
        setWinningCells(winCoordSet);

        // Play win celebration
        soundEngine.playWinCelebration(wonAmount >= betAmount * 5 ? 'big' : 'standard');
      } else {
        setLastSpinWin(0);
      }

      // Retrigger Scatters handler (3+ Scatters only, subject to session ceiling)
      if (retriggeredSpins > 0) {
        const canAward = Math.min(
          retriggeredSpins,
          Math.max(0, MAX_SESSION_SPINS - totalAwardedRef.current)
        );
        if (canAward > 0) {
          spinsLeftRef.current += canAward;
          totalAwardedRef.current += canAward;
          setSpinsRemaining(spinsLeftRef.current);
          setTotalSpinsAwarded(totalAwardedRef.current);
          soundEngine.playBonusTrigger();
          setRetriggerBanner(
            `☀️ ${scatterCount}× SUN GOD RA SCATTERS! +${canAward} EXTRA FREE SPINS!`
          );
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
          if (executeAutoSpinRef.current) {
            executeAutoSpinRef.current();
          }
        }, wonAmount > 0 ? 1900 : 1200);
      }
    }, 1220);
  }, [isSC, betAmount, coinValue, evaluateFreeSpinsWins]);

  executeAutoSpinRef.current = executeAutoSpin;

  // Initial Countdown & Auto-Start Loop (Runs strictly once per modal opening)
  useEffect(() => {
    if (!isOpen) {
      hasStartedRef.current = false;
      if (autoLoopTimerRef.current) clearTimeout(autoLoopTimerRef.current);
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    // Reset session
    spinsLeftRef.current = initialSpins;
    totalAwardedRef.current = initialSpins;
    isSpinningRef.current = false;
    isCompletedRef.current = false;

    setSpinsRemaining(initialSpins);
    setTotalSpinsAwarded(initialSpins);
    setTotalAccumulatedWin(0);
    setLastSpinWin(0);
    setIsCompleted(false);
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
          <div className="fs-metric-card total-won-card">
            <div className="fs-metric-label">RUNNING BONUS TOTAL</div>
            <div className="fs-running-digits">
              <PsdGoldNumber
                value={isSC ? totalAccumulatedWin.toFixed(2) : totalAccumulatedWin}
                height={34}
                gap={-2}
              />
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
      </header>

      {/* Center Reel Cabinet Only (No Guardians, Clean Pure Focus on Reels) */}
      <main className="fs-cabinet-stage">
        <div className="fs-cabinet-frame-wrap">
          {/* Reel Frame Image Asset */}
          <img
            src={THEME_ASSETS.reelFrameImage}
            alt=""
            className="fs-cabinet-frame-img"
            draggable={false}
          />

          {/* Top Arch Solar Plaque */}
          <div className="fs-top-arch-badge">
            <Sparkles size={15} />
            <span>DC ENTERPRISES • {multiplier}× SOLAR ARENA</span>
            <Sparkles size={15} />
          </div>

          {/* 5×3 Free Spins Grid Window */}
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
                              background: `radial-gradient(circle at 45% 40%, ${sym.tileBgStart} 0%, ${sym.tileBgEnd} 100%)`,
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
                                <span className="fs-royal-letter-3d">{sym.letter}</span>
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
                            background: `radial-gradient(circle at 45% 40%, ${sym.tileBgStart} 0%, ${sym.tileBgEnd} 100%)`,
                            borderColor: sym.accentColor || '#fbbf24',
                          }}
                        >
                          {/* 3D Gold Extruded Bezel Frame */}
                          <div className="fs-tile-gold-bezel" />

                          {/* 3D Graphic Asset or 3D Sculpted Royal Letter */}
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
                                  filter: `drop-shadow(0 3px 6px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 10px ${sym.gemColor || 'rgba(245, 158, 11, 0.6)'})`,
                                }}
                              >
                                {sym.letter}
                              </span>
                            </div>
                          )}

                          {/* Symbol Name Label */}
                          <div className="fs-tile-label-bar">
                            <span
                              className="fs-tile-name-txt"
                              style={{ color: sym.gemHighlight || '#fef08a' }}
                            >
                              {sym.name}
                            </span>
                          </div>

                          {/* Special Badges (3× WILD or +3 SPINS) */}
                          {sym.badge && (
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

                          {/* Winning Highlight Border Glow */}
                          {isWinning && <div className="fs-winning-border-glow" />}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* In-Game Win Celebration Animation Banner */}
            <WinCelebrationSplash
              winAmount={lastSpinWin}
              currencyMode={currencyMode}
              betAmount={betAmount}
              onClose={() => setLastSpinWin(0)}
            />

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

          {/* Running Auto-Status Bar at Bottom of Cabinet */}
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
                COLLECT{' '}
                {isSC
                  ? `$${totalAccumulatedWin.toFixed(2)} USD`
                  : `${totalAccumulatedWin.toLocaleString()} COINS`}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
