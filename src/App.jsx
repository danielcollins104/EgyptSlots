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
} from 'lucide-react';
import { CASINO_BRAND, SYMBOLS, PAYLINES } from './config/slotConfig';
import { soundEngine } from './audio/soundEngine';
import SplashScreen from './components/SplashScreen';
import BigWinPopup from './components/BigWinPopup';
import PaytableModal from './components/PaytableModal';
import PsdGoldNumber from './components/PsdGoldNumber';
import NeonKeyedImage from './components/NeonKeyedImage';
import PhaserReelEngine from './engine/PhaserReelEngine';
import './App.css';

const COLS = 5;
const ROWS = 3;

const NEON_THEMES = [
  { id: 'ultraviolet', label: 'Neon: Ultraviolet Cyber' },
  { id: 'acid', label: 'Neon: Acid Rainbow' },
  { id: 'laser', label: 'Neon: Laser Pink/Cyan' },
];

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
  const byId = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
  return [
    [byId.neon_a, byId.eye, byId.neon_q],
    [byId.anubis, byId.anubis, byId.anubis],
    [byId.scarab, byId.wild, byId.neon_k],
    [byId.eye, byId.ankh, byId.neon_j],
    [byId.neon_a, byId.necklace, byId.eye],
  ];
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [muted, setMuted] = useState(false);
  const [neonThemeIdx, setNeonThemeIdx] = useState(0);

  // PSD Bottom UI State (matches PSD defaults: 250000 coins, level 1, bet 15, coin value 0.02)
  const [coins, setCoins] = useState(CASINO_BRAND.defaultCoins);
  const [level, setLevel] = useState(1);
  const [coinValueIdx, setCoinValueIdx] = useState(CASINO_BRAND.defaultCoinValueIndex);

  // Initial Reel Grid & Phaser Spin Trigger
  const [initialGrid] = useState(() => generateInitialGrid());
  const [initialExpandedCols] = useState([false, true, false, false, false]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinTrigger, setSpinTrigger] = useState(null);
  const pendingSpinRef = useRef(null);

  // Win state
  const [lastWinCoins, setLastWinCoins] = useState(0);
  const [winningLines, setWinningLines] = useState([]);
  const [winningCells, setWinningCells] = useState(new Set());
  const [activeWinLineIdx, setActiveWinLineIdx] = useState(0);
  const [bigWinAmount, setBigWinAmount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    'WELCOME DANIEL TO DC ENTERPRISES CASINO — PHASER 3 WEBGL REEL ENGINE READY!'
  );

  // Autoplay & Modals
  const [autoPlayCount, setAutoPlayCount] = useState(0);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [anubisAction, setAnubisAction] = useState(false);
  const [anubisBlinking, setAnubisBlinking] = useState(false);

  const currentBet = CASINO_BRAND.baseLines * level;
  const coinValue = CASINO_BRAND.coinValues[coinValueIdx];
  const currentTheme = NEON_THEMES[neonThemeIdx];

  // Periodic Anubis eye blink
  useEffect(() => {
    const interval = setInterval(() => {
      setAnubisBlinking(true);
      setTimeout(() => setAnubisBlinking(false), 180);
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
    }, 1400);
    return () => clearInterval(timer);
  }, [winningLines]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  // Evaluate 15 paylines on a 5x3 grid
  const evaluateGridWins = useCallback((finalGrid, betLevel) => {
    const wins = [];
    const winCoordSet = new Set();
    let totalCoinsWon = 0;

    for (const line of PAYLINES) {
      const lineSymbols = line.rows.map((r, c) => finalGrid[c][r]);

      let targetSym = lineSymbols.find((s) => !s.isWild);
      if (!targetSym) {
        targetSym = lineSymbols[0];
      }

      let matchCount = 0;
      let hasPyramidWild = false;

      for (let c = 0; c < COLS; c++) {
        const sym = lineSymbols[c];
        if (sym.id === targetSym.id || sym.isWild) {
          matchCount++;
          if (sym.id === 'wild') hasPyramidWild = true;
        } else {
          break;
        }
      }

      if (matchCount >= 3) {
        const basePayout = targetSym.payouts[matchCount] || 0;
        const wildMultiplier = hasPyramidWild && !targetSym.isWild ? 2 : 1;
        const lineWin = basePayout * betLevel * wildMultiplier;

        if (lineWin > 0) {
          totalCoinsWon += lineWin;
          const cells = [];
          for (let c = 0; c < matchCount; c++) {
            const r = line.rows[c];
            cells.push([c, r]);
            winCoordSet.add(`${c}-${r}`);
          }
          wins.push({
            line,
            symbol: targetSym,
            matchCount,
            lineWin,
            wildMultiplier,
            cells,
          });
        }
      }
    }

    return { wins, winCoordSet, totalCoinsWon };
  }, []);

  const handleColumnStop = useCallback((colIdx, didExpand) => {
    if (didExpand) {
      setAnubisAction(true);
      soundEngine.playAnubisExpand();
      setTimeout(() => setAnubisAction(false), 1200);
    }
  }, []);

  const handleSpinComplete = useCallback(() => {
    const pending = pendingSpinRef.current;
    if (!pending) {
      setIsSpinning(false);
      return;
    }

    const { nextGrid, activeLevel, spinBet, forcedMode } = pending;
    const { wins, winCoordSet, totalCoinsWon } = evaluateGridWins(nextGrid, activeLevel);

    setIsSpinning(false);

    if (totalCoinsWon > 0) {
      setCoins((prev) => prev + totalCoinsWon);
      setLastWinCoins(totalCoinsWon);
      setWinningLines(wins);
      setWinningCells(winCoordSet);

      const isBig = totalCoinsWon >= spinBet * 8 || forcedMode === 'bigwin';
      soundEngine.playWin(isBig);
      setAnubisAction(true);
      setTimeout(() => setAnubisAction(false), 1800);

      if (isBig) {
        setBigWinAmount(totalCoinsWon);
        setStatusMessage(
          `MEGA NEON JACKPOT! DANIEL WON ${totalCoinsWon.toLocaleString()} COINS AT DC ENTERPRISES!`
        );
      } else {
        setStatusMessage(
          `NEON WINNER! ${wins.length} PAYLINE${
            wins.length > 1 ? 'S' : ''
          } PAID ${totalCoinsWon.toLocaleString()} COINS ($${(
            totalCoinsWon * coinValue
          ).toFixed(2)})!`
        );
      }
    } else {
      setStatusMessage('NO WINNING PAYLINES — SPIN AGAIN AT DC ENTERPRISES CASINO!');
    }
  }, [evaluateGridWins, coinValue]);

  const triggerSpin = useCallback(
    (forcedMode = null, overrideLevel = null) => {
      if (isSpinning) return;
      const activeLevel = overrideLevel ?? level;
      const spinBet = CASINO_BRAND.baseLines * activeLevel;

      if (coins < spinBet) {
        setStatusMessage('INSUFFICIENT COINS! CLICK RESET BANKROLL OR LOWER BET LEVEL.');
        setAutoPlayCount(0);
        return;
      }

      setCoins((prev) => prev - spinBet);
      setLastWinCoins(0);
      setWinningLines([]);
      setWinningCells(new Set());
      setBigWinAmount(0);
      setIsSpinning(true);
      setStatusMessage('PHASER 3 REELS SPINNING — DC ENTERPRISES CASINO!');

      soundEngine.playSpinStart();

      const byId = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));

      const nextGrid = Array.from({ length: COLS }, () =>
        Array.from({ length: ROWS }, () => pickWeightedSymbol(SYMBOLS, true))
      );
      const nextExpanded = [false, false, false, false, false];

      if (forcedMode === 'anubis') {
        nextExpanded[1] = true;
        nextExpanded[3] = true;
        nextGrid[0][1] = byId.eye;
        nextGrid[1] = [byId.anubis, byId.anubis, byId.anubis];
        nextGrid[2][1] = byId.eye;
        nextGrid[3] = [byId.anubis, byId.anubis, byId.anubis];
        nextGrid[4][1] = byId.eye;
      } else if (forcedMode === 'bigwin') {
        nextGrid[0] = [byId.eye, byId.eye, byId.neon_a];
        nextGrid[1] = [byId.eye, byId.wild, byId.neon_k];
        nextGrid[2] = [byId.wild, byId.eye, byId.eye];
        nextGrid[3] = [byId.eye, byId.wild, byId.neon_q];
        nextGrid[4] = [byId.eye, byId.eye, byId.neon_j];
      } else {
        for (let c = 1; c <= 3; c++) {
          if (Math.random() < 0.12) {
            nextExpanded[c] = true;
            nextGrid[c] = [byId.anubis, byId.anubis, byId.anubis];
          }
        }
      }

      pendingSpinRef.current = {
        nextGrid,
        nextExpanded,
        activeLevel,
        spinBet,
        forcedMode,
      };

      setSpinTrigger({
        id: Date.now() + Math.random(),
        targetGrid: nextGrid,
        targetExpanded: nextExpanded,
      });
    },
    [isSpinning, level, coins]
  );

  // Autoplay handler
  useEffect(() => {
    if (autoPlayCount > 0 && !isSpinning && bigWinAmount === 0) {
      const timer = setTimeout(() => {
        setAutoPlayCount((prev) => Math.max(0, prev - 1));
        triggerSpin();
      }, 950);
      return () => clearTimeout(timer);
    }
  }, [autoPlayCount, isSpinning, bigWinAmount, triggerSpin]);

  // Spacebar shortcut to Spin
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'Space' && !showSplash && !paytableOpen) {
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
  }, [showSplash, paytableOpen, bigWinAmount, triggerSpin]);

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
      {/* Welcome Screen with Daniel's Treasure Chest Photo */}
      {showSplash && <SplashScreen onEnterCasino={() => setShowSplash(false)} />}

      {/* Main Egyptian Temple Background with Psychedelic Neon Blacklight Shader */}
      <div
        className="temple-background neon-temple-bg"
        style={{ backgroundImage: "url('/assets/background/background.png')" }}
      />

      {/* Ambient Psychedelic PSD Spark & Ray Overlays */}
      <img
        src="/assets/psd/fx_sparks.png"
        alt=""
        className="ambient-sparks neon-fx-shift"
        draggable={false}
      />

      {/* Top DC Enterprises Casino VIP Navigation & Feature Bar */}
      <header className="dc-casino-topbar">
        <div
          className="dc-topbar-brand"
          onClick={() => setShowSplash(true)}
          title="Open Daniel's Welcome Screen"
        >
          <img
            src="/assets/neon/daniel_creative_ad_splash.jpg"
            alt="Daniel"
            className="dc-daniel-avatar"
          />
          <div className="dc-crest-badge">DC</div>
          <div className="dc-brand-titles">
            <span className="dc-casino-name">{CASINO_BRAND.casinoFullTitle}</span>
            <span className="dc-creator-tag">
              <Crown size={12} /> CREATED BY {CASINO_BRAND.creatorName.toUpperCase()} • PHASER 3 ENGINE
            </span>
          </div>
        </div>

        {/* Interactive Demo Feature Buttons & Neon Spectrum Switcher */}
        <div className="dc-topbar-actions">
          <button
            className="dc-action-btn special-anubis"
            onClick={() => triggerSpin('anubis')}
            disabled={isSpinning}
            title="Demo Dual 1x3 Expanding Guardians (Neon Anubis & Neon Bastet)!"
          >
            <Flame size={15} />
            <span>Dual 1×3 Expand</span>
          </button>

          <button
            className="dc-action-btn special-bigwin"
            onClick={() => triggerSpin('bigwin')}
            disabled={isSpinning}
            title="Demo the AI-Generated MEGA WIN Neon Banner & PSD 3D Digits!"
          >
            <Trophy size={15} />
            <span>Force Mega Win</span>
          </button>

          <button
            className="dc-action-btn active-mode"
            onClick={() => {
              soundEngine.playButtonClick();
              setNeonThemeIdx((p) => (p + 1) % NEON_THEMES.length);
            }}
            title="Cycle Psychedelic Neon Color Spectrum"
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
            <span>Paytable & Assets</span>
          </button>

          <button
            className="dc-action-btn"
            onClick={() => {
              soundEngine.playButtonClick();
              setCoins(CASINO_BRAND.defaultCoins);
              setStatusMessage('BANKROLL RESET TO 250,000 COINS BY DANIEL!');
            }}
            title="Reset Coins to 250,000"
          >
            <RotateCcw size={15} />
          </button>

          <button className="dc-action-btn" onClick={toggleMute} title="Toggle Sound">
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
        </div>
      </header>

      {/* Main Slot Machine Stage: Left Guardian (Anubis) + Center Cabinet + Right Guardian (Bastet) */}
      <main className="slot-stage-container">
        {/* Left Guardian: Psychedelic Neon Anubis */}
        <aside className={`anubis-guardian-column left-col ${anubisAction ? 'anubis-action-surge' : ''}`}>
          <div className="anubis-guardian-figure">
            <img
              src="/assets/psd/anubis_blue_light.png"
              alt=""
              className="guardian-blue-aura"
              draggable={false}
            />
            <img
              src="/assets/characters/anubis.png"
              alt="Neon Anubis Guardian"
              className="guardian-body-img neon-char-filter"
              draggable={false}
            />
            {anubisBlinking && (
              <img
                src="/assets/psd/anubis_eyes_closed.png"
                alt=""
                className="guardian-blink-overlay neon-char-filter"
                draggable={false}
              />
            )}
            <img
              src="/assets/psd/anubis_hand_fire.png"
              alt=""
              className="guardian-hand-flame"
              draggable={false}
            />
          </div>
          <div className="guardian-pedestal-plaque">
            <img
              src="/assets/psd/logo_short_frame.png"
              alt=""
              className="neon-frame-filter"
              draggable={false}
            />
            <div className="guardian-plaque-txt">
              <span>NEON GUARDIAN</span>
              <strong>DANIEL VIP</strong>
            </div>
          </div>
        </aside>

        {/* Center Slot Machine Cabinet */}
        <section className="slot-cabinet-wrapper">
          <div className="reel-cabinet-box">
            {/* PSD Layer 3: reel_glow.png in Neon */}
            <img
              src="/assets/psd/reel_glow.png"
              alt=""
              className="psd-reel-glow neon-fx-shift"
              draggable={false}
            />

            {/* PSD Layer 4: reel_shadow.png */}
            <img
              src="/assets/psd/reel_shadow.png"
              alt=""
              className="psd-reel-shadow"
              draggable={false}
            />

            {/* Custom Generated Winged Psychedelic Neon "DC ENTERPRISES" Logo mounted at the top arch */}
            <div className="cabinet-dc-neon-logo">
              <NeonKeyedImage
                src={CASINO_BRAND.logoImage}
                alt="DC ENTERPRISES"
                className="cabinet-dc-logo-img"
                threshold={26}
                feather={48}
              />
            </div>

            {/* Horus Falcon Frame in Psychedelic Neon (reel_frame_filled.png) */}
            <img
              src="/assets/reel/reel_frame_filled.png"
              alt="Reel Frame"
              className="psd-reel-frame-img neon-cabinet-filter"
              draggable={false}
            />

            {/* Engraved Neon Nameplate on the Top Arch Beam */}
            <div className="cabinet-arch-engraving">
              <span>DC ENTERPRISES CASINO</span>
              <span className="arch-dot">⚡</span>
              <span>CREATED BY DANIEL</span>
            </div>

            {/* 5x3 Reel Window Driven by Phaser 3 Hardware-Accelerated Spin Engine */}
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
            </div>

            {/* PSD Bottom Control Bar in Psychedelic Neon */}
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
                  <div className="psd-stat-value">{currentBet}</div>
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
                  className={`psd-wing-btn autoplay-wing ${autoPlayCount > 0 ? 'active-auto' : ''}`}
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
                    <span className="psd-stat-value">
                      {coinValue.toFixed(2).replace('.', ',')}
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
                    {coins.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Lower Cabinet Ticker & Engraved DC Enterprises Casino / Daniel Pediment */}
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
              <span className="pediment-label">CASH BALANCE</span>
              <span className="pediment-cash-val">
                ${(coins * coinValue).toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        </section>

        {/* Right Guardian: Psychedelic Neon Bastet Pharaoh Queen */}
        <aside className={`anubis-guardian-column right-col ${anubisAction ? 'anubis-action-surge' : ''}`}>
          <div className="anubis-guardian-figure bastet-figure">
            <NeonKeyedImage
              src={CASINO_BRAND.bastetCharacterImage}
              alt="Neon Bastet Guardian"
              className="guardian-body-img bastet-guardian-img"
              threshold={26}
              feather={44}
            />
          </div>
          <div className="guardian-pedestal-plaque">
            <img
              src="/assets/psd/logo_short_frame.png"
              alt=""
              className="neon-frame-filter"
              draggable={false}
            />
            <div className="guardian-plaque-txt">
              <span>QUEEN BASTET</span>
              <strong>DC ENTERPRISES</strong>
            </div>
          </div>
        </aside>
      </main>

      {/* Big Win / Mega Win Celebration Pop-Up */}
      <BigWinPopup
        winCoins={bigWinAmount}
        coinValue={coinValue}
        onClose={() => setBigWinAmount(0)}
      />

      {/* Paytable & PSD/Generated Asset Showcase Modal */}
      <PaytableModal
        isOpen={paytableOpen}
        onClose={() => setPaytableOpen(false)}
        level={level}
      />
    </div>
  );
}
