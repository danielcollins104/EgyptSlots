import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import gsap from 'gsap';
import {
  Sparkles,
  Flame,
  Compass,
  Gem,
  CheckCircle2,
  RotateCw,
  Crown,
  Zap,
  Star,
  Coins,
  Sun,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import { BONUS_CONFIG, BONUS_JACKPOT_TIERS } from '../config/slotConfig';
import { soundEngine } from '../audio/soundEngine';
import PsdGoldNumber from './PsdGoldNumber';

function buildVaultBoard(currentBet) {
  const styles = BONUS_CONFIG.vaultTileStyles;
  const templates = BONUS_CONFIG.vaultPrizeTemplates;
  const regularTemplates = templates.filter((t) => t.kind !== 'jackpot');
  const miniJp = templates.find((t) => t.jackpotId === 'mini') || regularTemplates[0];
  const minorJp = templates.find((t) => t.jackpotId === 'minor') || regularTemplates[0];
  const majorJp = templates.find((t) => t.jackpotId === 'major') || regularTemplates[0];

  // Build a weighted 12-tile board so Major/Minor jackpots only appear on the board occasionally
  const selectedTemplates = [...regularTemplates];
  while (selectedTemplates.length < 11) {
    selectedTemplates.push(regularTemplates[selectedTemplates.length % regularTemplates.length]);
  }
  const jpRoll = Math.random();
  if (jpRoll < 0.04) {
    selectedTemplates.push(majorJp);
  } else if (jpRoll < 0.18) {
    selectedTemplates.push(minorJp);
  } else {
    selectedTemplates.push(miniJp);
  }

  const pool = selectedTemplates.map((tpl) => ({
    ...tpl,
    baseCoins: Number((currentBet * tpl.betMult).toFixed(2)),
  }));

  // Shuffle Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.map((prize, idx) => {
    const style = styles[idx % styles.length];
    return {
      id: idx,
      ...style,
      prize,
      picked: false,
      awardedCoins: 0,
    };
  });
}

function buildHoldSpinBoard(currentBet) {
  const table = BONUS_CONFIG.holdSpin?.coinTable || [];
  const pickRandomCoin = () => {
    let r = Math.random();
    for (const c of table) {
      r -= c.chance;
      if (r <= 0) return { ...c, coins: Math.round(c.mult * currentBet) };
    }
    const last = table[table.length - 1] || { mult: 1, label: '1× BET', icon: '/assets/symbols/high/high_scarab_no_frame.png', color: '#10b981' };
    return { ...last, coins: Math.round(last.mult * currentBet) };
  };

  const cells = Array.from({ length: 15 }, (_, id) => ({
    id,
    locked: false,
    coin: null,
    isNew: false,
  }));

  // Pick 3 initial random unique cell indexes
  const initialIdxs = [];
  const targetInitial = BONUS_CONFIG.holdSpin?.initialCoins || 3;
  while (initialIdxs.length < targetInitial) {
    const rand = Math.floor(Math.random() * 15);
    if (!initialIdxs.includes(rand)) initialIdxs.push(rand);
  }

  let initialWin = 0;
  initialIdxs.forEach((idx) => {
    const coin = pickRandomCoin();
    cells[idx] = { id: idx, locked: true, coin, isNew: true };
    initialWin += coin.coins;
  });

  return { cells, initialWin };
}

export default function BonusGameModal({
  bonusSession,
  currentBet,
  coinValue,
  currencyMode = 'GC',
  onCompleteBonus,
  onLaunchCelestialOverload,
}) {
  // Navigation: 'doors' | 'holdspin' | 'vault' | 'wheel' | 'ascension'
  const [activeTab, setActiveTab] = useState('doors');

  // Game 1: 3D Pick Vault State
  const [picksLeft, setPicksLeft] = useState(bonusSession?.initialPicks || 5);
  const [vaultMultiplier, setVaultMultiplier] = useState(bonusSession?.startingMultiplier || 1);
  const [vaultTiles, setVaultTiles] = useState([]);
  const [vaultWinCoins, setVaultWinCoins] = useState(0);
  const [wonJackpots, setWonJackpots] = useState([]);
  const [vaultBanner, setVaultBanner] = useState(BONUS_CONFIG.vaultDefaultBanner);
  const [burstTiles, setBurstTiles] = useState(new Set());
  const [floatingPrizes, setFloatingPrizes] = useState([]);
  const [multiplierBlaze, setMultiplierBlaze] = useState(false);
  const [jackpotCelebration, setJackpotCelebration] = useState(null);

  // Game 2: Fortune Wheel State
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState(bonusSession?.wheelSpins || 3);
  const [wheelMultiplier, setWheelMultiplier] = useState(bonusSession?.startingMultiplier || 1);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelWinCoins, setWheelWinCoins] = useState(0);
  const [wheelBanner, setWheelBanner] = useState(BONUS_CONFIG.wheelDefaultBanner);
  const [activeWedgeIdx, setActiveWedgeIdx] = useState(null);
  const [wheelWinPop, setWheelWinPop] = useState(null);

  // Game 3: Pharaoh's Hold & Win Respins State (5x3 = 15 cells)
  const [hwCells, setHwCells] = useState([]);
  const [hwSpinsLeft, setHwSpinsLeft] = useState(3);
  const [hwTotalWin, setHwTotalWin] = useState(0);
  const [hwIsSpinning, setHwIsSpinning] = useState(false);
  const [hwCompleted, setHwCompleted] = useState(false);
  const [hwBanner, setHwBanner] = useState(
    '⚡ AUTOMATIC HOLD & WIN ACTIVE — ORBS LOCK & RESET RESPINS TO 3!'
  );
  const [hwRespinResetPop, setHwRespinResetPop] = useState(false);
  const [hwRoundNum, setHwRoundNum] = useState(0);

  // Refs for Hold & Win Automatic Sequence Loop
  const hwCellsRef = useRef([]);
  const hwSpinsLeftRef = useRef(3);
  const hwTotalWinRef = useRef(0);
  const hwIsSpinningRef = useRef(false);
  const hwCompletedRef = useRef(false);
  const hwRescuesUsedRef = useRef(0);
  const hwAutoTimerRef = useRef(null);
  const hwStepFnRef = useRef(null);

  // Game 4: Ascension of Ra (Crash Multiplier Run)
  const [raStep, setRaStep] = useState(-1);
  const [raFlying, setRaFlying] = useState(false);
  const [raCrashed, setRaCrashed] = useState(false);
  const [raCashedOut, setRaCashedOut] = useState(false);
  const [raWinCoins, setRaWinCoins] = useState(0);
  const [raFlightsLeft, setRaFlightsLeft] = useState(2);
  const [raShieldActive, setRaShieldActive] = useState(true);
  const raShieldActiveRef = useRef(true);
  const [raBanner, setRaBanner] = useState("THE SUN CHARIOT OF RA IS READY TO ASCEND THROUGH THE 8 CELESTIAL GATES!");
  const [raGateBurstStep, setRaGateBurstStep] = useState(null);
  const [raCashoutShower, setRaCashoutShower] = useState(false);

  // Universal Footer Total Pulse & Delta Micro-Animation
  const [footerWinPulse, setFooterWinPulse] = useState(null);

  // Hands-Free Automatic Celebration Mode (Default: ON so bonus rounds play out automatically like a Free Money Party!)
  const [autoPlayBonus, setAutoPlayBonus] = useState(true);
  const autoPlayBonusRef = useRef(true);
  const [doorsCountdown, setDoorsCountdown] = useState(3);
  const [tourFinishedCountdown, setTourFinishedCountdown] = useState(null);

  const pickTileFnRef = useRef(null);
  const spinWheelFnRef = useRef(null);
  const startAscensionFnRef = useRef(null);
  const completeBonusFnRef = useRef(null);
  const vaultRefillingRef = useRef(false);

  useEffect(() => {
    autoPlayBonusRef.current = autoPlayBonus;
  }, [autoPlayBonus]);

  const spawnFloatingWinBurst = useCallback((text, subtitle = 'BONUS WIN!', opts = {}) => {
    const id = Date.now() + Math.random();
    const x = opts.x ?? window.innerWidth * (0.42 + Math.random() * 0.16);
    const y = opts.y ?? window.innerHeight * (0.42 + Math.random() * 0.12);
    setFloatingPrizes((prev) => [
      ...prev.slice(-8),
      {
        id,
        text,
        subtitle,
        x,
        y,
        isJackpot: Boolean(opts.isJackpot),
        variant: opts.variant || 'gold',
      },
    ]);
    if (opts.deltaCoins && opts.deltaCoins > 0) {
      setFooterWinPulse({
        id,
        delta: opts.deltaCoins,
        label: subtitle,
      });
      setTimeout(() => {
        setFooterWinPulse((curr) => (curr?.id === id ? null : curr));
      }, 1500);
    }
    setTimeout(() => {
      setFloatingPrizes((prev) => prev.filter((item) => item.id !== id));
    }, 1850);
  }, []);

  const wheelCanvasRef = useRef(null);
  const wheelRotationRef = useRef({ deg: 0 });
  const raTimerRef = useRef(null);
  const wedges = BONUS_CONFIG.wheelWedges;
  const ascensionNodes = BONUS_CONFIG.ascension?.nodes || [2, 3, 5, 8, 15, 30, 50, 100];
  const ascensionCrashProbs = BONUS_CONFIG.ascension?.crashProb || [0.08, 0.12, 0.15, 0.20, 0.28, 0.38, 0.50, 0.65];

  useEffect(() => {
    if (!bonusSession) {
      if (raTimerRef.current) clearTimeout(raTimerRef.current);
      if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
      hwIsSpinningRef.current = false;
      hwCompletedRef.current = true;
      return;
    }
    setActiveTab(bonusSession.defaultGame || 'doors');
    setAutoPlayBonus(true);
    autoPlayBonusRef.current = true;
    setDoorsCountdown(3);
    setTourFinishedCountdown(null);
    vaultRefillingRef.current = false;
    setPicksLeft(bonusSession.initialPicks || 5);
    setVaultMultiplier(bonusSession.startingMultiplier || 1);
    setVaultTiles(buildVaultBoard(currentBet));
    setVaultWinCoins(0);
    setWonJackpots([]);
    setVaultBanner(
      `UNLOCKED VIA ${bonusSession.triggerReason}! PICK ${
        bonusSession.initialPicks || 5
      } 3D TILES OR SPIN THE 3D WHEEL!`
    );

    setWheelSpinsLeft(bonusSession.wheelSpins || 3);
    setWheelMultiplier(bonusSession.startingMultiplier || 1);
    setWheelSpinning(false);
    setWheelWinCoins(0);
    setActiveWedgeIdx(null);
    wheelRotationRef.current.deg = 0;

    // Initialize Hold & Win
    if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
    const hwInit = buildHoldSpinBoard(currentBet);
    hwCellsRef.current = hwInit.cells;
    hwSpinsLeftRef.current = 3;
    hwTotalWinRef.current = hwInit.initialWin;
    hwIsSpinningRef.current = false;
    hwCompletedRef.current = false;
    hwRescuesUsedRef.current = 0;
    setHwCells(hwInit.cells);
    setHwSpinsLeft(3);
    setHwTotalWin(hwInit.initialWin);
    setHwIsSpinning(false);
    setHwCompleted(false);
    setHwRoundNum(0);
    setHwBanner(
      '⚡ AUTOMATIC HOLD & WIN COMMENCING — EVERY NEW ORB RESETS RESPINS TO 3!'
    );

    // Initialize Ascension of Ra
    setRaStep(-1);
    setRaFlying(false);
    setRaCrashed(false);
    setRaCashedOut(false);
    setRaWinCoins(0);
    setRaFlightsLeft(2);
    setRaShieldActive(true);
    raShieldActiveRef.current = true;
    setRaBanner("THE SUN CHARIOT OF RA IS READY TO ASCEND (2 FLIGHTS + SOLAR AEGIS SHIELD ACTIVE)!");
  }, [bonusSession, currentBet]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (raTimerRef.current) clearTimeout(raTimerRef.current);
      if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
    };
  }, []);

  // Draw the 3D Brushed-Gold & Cabochon-Gemstone Fortune Wheel onto Canvas
  const drawWheelCanvas = useCallback(() => {
    const canvas = wheelCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.45;
    const sliceRad = (Math.PI * 2) / wedges.length;

    ctx.clearRect(0, 0, size, size);

    // Outer 3D Gold Bezel Rim
    ctx.save();
    ctx.translate(cx, cy);
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;

    const rimGrad = ctx.createLinearGradient(-outerR, -outerR, outerR, outerR);
    rimGrad.addColorStop(0, '#fffbeb');
    rimGrad.addColorStop(0.25, '#fde047');
    rimGrad.addColorStop(0.55, '#d97706');
    rimGrad.addColorStop(0.85, '#78350f');
    rimGrad.addColorStop(1, '#fef08a');

    ctx.beginPath();
    ctx.arc(0, 0, outerR + 14, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.restore();

    // Draw the 12 Jewel-Toned Velvet Wedges
    wedges.forEach((w, i) => {
      const startAngle = -Math.PI / 2 - sliceRad / 2 + i * sliceRad;
      const endAngle = startAngle + sliceRad;
      const midAngle = (startAngle + endAngle) / 2;

      ctx.save();
      ctx.translate(cx, cy);

      const wGrad = ctx.createRadialGradient(0, 0, outerR * 0.15, 0, 0, outerR);
      wGrad.addColorStop(0, w.bgEnd);
      wGrad.addColorStop(0.7, w.bgStart);
      wGrad.addColorStop(1, '#090214');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, outerR, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = wGrad;
      ctx.fill();

      // Brushed 24k Gold Rib Divider
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fde047';
      ctx.stroke();

      // Highlight active winning wedge
      if (activeWedgeIdx === i) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
      }

      // Draw Perimeter Cabochon Gemstone on the outer gold bezel for this wedge
      const gx = Math.cos(midAngle) * (outerR + 7);
      const gy = Math.sin(midAngle) * (outerR + 7);
      ctx.save();
      ctx.translate(gx, gy);
      ctx.beginPath();
      ctx.arc(0, 0, 6.5, 0, Math.PI * 2);
      ctx.fillStyle = w.gemColor;
      ctx.fill();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = '#fffbeb';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-2, -2, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = w.gemHi;
      ctx.fill();
      ctx.restore();

      // Draw Wedge Text & Multiplier
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      const displayMult =
        w.type === 'coins' ? `${w.mult * wheelMultiplier}× BET` : w.label;

      ctx.font = "900 13.5px 'Cinzel Decorative', 'Amarante', 'Cinzel', serif";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#090214';
      ctx.strokeText(displayMult, outerR - 18, 0);
      ctx.fillStyle = w.type === 'jackpot' || w.type === 'upgrade' ? '#fde047' : '#ffffff';
      ctx.fillText(displayMult, outerR - 18, 0);

      ctx.restore();
    });

    // Inner Gold Ring
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fillStyle = '#451a03';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#fde047';
    ctx.stroke();
    ctx.restore();

    // Preserve rotation state
    if (wheelCanvasRef.current) {
      wheelCanvasRef.current.style.transform = `rotate(${wheelRotationRef.current.deg}deg)`;
    }
  }, [wedges, wheelMultiplier, activeWedgeIdx]);

  useEffect(() => {
    drawWheelCanvas();
    const raf = requestAnimationFrame(drawWheelCanvas);
    const tm = setTimeout(drawWheelCanvas, 60);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(tm);
    };
  }, [drawWheelCanvas, activeTab]);

  const jackpotsWithValues = useMemo(() => {
    return BONUS_JACKPOT_TIERS.map((tier) => ({
      ...tier,
      coins: tier.baseMultiplier * currentBet,
    }));
  }, [currentBet]);

  // Automatic Hold & Win Respin Sequence Loop when entering the Hold & Win tab
  useEffect(() => {
    if (!bonusSession || activeTab !== 'holdspin') {
      if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
      return;
    }
    if (hwCompletedRef.current || hwIsSpinningRef.current || hwSpinsLeftRef.current <= 0) {
      return;
    }
    hwAutoTimerRef.current = setTimeout(() => {
      if (hwStepFnRef.current) {
        hwStepFnRef.current();
      }
    }, 850);
    return () => {
      if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
    };
  }, [bonusSession, activeTab, hwCompleted]);

  // Auto-claim Jackpot Celebration Popup after 2.5s so hands-free celebration never stalls
  useEffect(() => {
    if (!jackpotCelebration || !autoPlayBonus) return;
    const tm = setTimeout(() => {
      setJackpotCelebration(null);
    }, 2500);
    return () => clearTimeout(tm);
  }, [jackpotCelebration, autoPlayBonus]);

  // Helper: Next unplayed chamber in the 4-Chamber Free Money Tour
  const nextChamberId = useMemo(() => {
    const order = [
      !hwCompleted ? 'holdspin' : null,
      picksLeft > 0 ? 'vault' : null,
      wheelSpinsLeft > 0 ? 'wheel' : null,
      raFlightsLeft > 0 ? 'ascension' : null,
    ].filter(Boolean);
    return order.find((id) => id !== activeTab) || order[0] || null;
  }, [hwCompleted, picksLeft, wheelSpinsLeft, raFlightsLeft, activeTab]);

  // 1. DOORS OF KEMET: 3-second Auto-Start Countdown into the Free Money Tour
  useEffect(() => {
    if (!bonusSession || activeTab !== 'doors' || !autoPlayBonus || !nextChamberId) {
      setDoorsCountdown(3);
      return;
    }
    setDoorsCountdown(3);
    const interval = setInterval(() => {
      setDoorsCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          soundEngine.playButtonClick?.(620);
          setActiveTab(nextChamberId);
          return 0;
        }
        return prev - 1;
      });
    }, 950);
    return () => clearInterval(interval);
  }, [bonusSession, activeTab, autoPlayBonus, nextChamberId]);

  // 2. HOLD & WIN: Auto-advance to next chamber 2.5s after Hold & Win completes
  useEffect(() => {
    if (!bonusSession || activeTab !== 'holdspin' || !hwCompleted || !autoPlayBonus || jackpotCelebration) {
      return;
    }
    if (!nextChamberId) return;
    const tm = setTimeout(() => {
      soundEngine.playButtonClick?.(580);
      setActiveTab(nextChamberId);
    }, 2500);
    return () => clearTimeout(tm);
  }, [bonusSession, activeTab, hwCompleted, autoPlayBonus, jackpotCelebration, nextChamberId]);

  // 3. SACRED RELIC VAULT: Auto-pick unsealed relics every 1.2s & auto-advance when done
  useEffect(() => {
    if (!bonusSession || activeTab !== 'vault' || !autoPlayBonus || jackpotCelebration) {
      return;
    }
    if (picksLeft > 0) {
      const tm = setTimeout(() => {
        if (vaultRefillingRef.current) return;
        const unpicked = vaultTiles.filter((t) => !t.picked);
        if (unpicked.length > 0 && pickTileFnRef.current) {
          const chosen = unpicked[Math.floor(Math.random() * unpicked.length)];
          pickTileFnRef.current(chosen.id, null);
        }
      }, 1200);
      return () => clearTimeout(tm);
    } else if (nextChamberId) {
      const tm = setTimeout(() => {
        soundEngine.playButtonClick?.(600);
        setActiveTab(nextChamberId);
      }, 2400);
      return () => clearTimeout(tm);
    }
  }, [bonusSession, activeTab, autoPlayBonus, jackpotCelebration, picksLeft, vaultTiles, nextChamberId]);

  // 4. 3D FORTUNE WHEEL: Auto-spin wheel & auto-advance when all spins complete
  useEffect(() => {
    if (!bonusSession || activeTab !== 'wheel' || !autoPlayBonus || jackpotCelebration || wheelSpinning) {
      return;
    }
    if (wheelSpinsLeft > 0) {
      const delay = wheelWinPop ? 2200 : 1000;
      const tm = setTimeout(() => {
        if (spinWheelFnRef.current) {
          spinWheelFnRef.current();
        }
      }, delay);
      return () => clearTimeout(tm);
    } else if (nextChamberId) {
      const tm = setTimeout(() => {
        soundEngine.playButtonClick?.(640);
        setActiveTab(nextChamberId);
      }, 2400);
      return () => clearTimeout(tm);
    }
  }, [bonusSession, activeTab, autoPlayBonus, jackpotCelebration, wheelSpinning, wheelSpinsLeft, wheelWinPop, nextChamberId]);

  // 5. ASCENSION OF RA: Auto-launch Sun Chariot flights & auto-advance when done
  useEffect(() => {
    if (!bonusSession || activeTab !== 'ascension' || !autoPlayBonus || jackpotCelebration || raFlying) {
      return;
    }
    if (raFlightsLeft > 0) {
      const delay = raCashedOut || raCrashed ? 2200 : 1000;
      const tm = setTimeout(() => {
        if (startAscensionFnRef.current) {
          startAscensionFnRef.current();
        }
      }, delay);
      return () => clearTimeout(tm);
    } else if (nextChamberId) {
      const tm = setTimeout(() => {
        soundEngine.playButtonClick?.(560);
        setActiveTab(nextChamberId);
      }, 2400);
      return () => clearTimeout(tm);
    }
  }, [bonusSession, activeTab, autoPlayBonus, jackpotCelebration, raFlying, raFlightsLeft, raCashedOut, raCrashed, nextChamberId]);

  // 6. GRAND FINALE AUTO-COLLECT: When all 4 chambers are finished, run a 4s celebratory countdown and auto-bank winnings
  const allChambersFinished =
    Boolean(bonusSession) &&
    hwCompleted &&
    picksLeft <= 0 &&
    !wheelSpinning &&
    wheelSpinsLeft <= 0 &&
    !raFlying &&
    raFlightsLeft <= 0 &&
    !jackpotCelebration;

  useEffect(() => {
    if (!allChambersFinished || !autoPlayBonus) {
      setTourFinishedCountdown(null);
      return;
    }
    setTourFinishedCountdown(4);
    const interval = setInterval(() => {
      setTourFinishedCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          if (completeBonusFnRef.current) {
            completeBonusFnRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [allChambersFinished, autoPlayBonus]);

  if (!bonusSession) return null;

  const totalCombinedBonusWin =
    (bonusSession.scatterWinCoins || 0) +
    vaultWinCoins +
    wheelWinCoins +
    hwTotalWin +
    raWinCoins;

  // --- 1. PICK VAULT HANDLER ---
  const handlePickTile = (tileId, e) => {
    if (picksLeft <= 0) return;
    const target = vaultTiles.find((t) => t.id === tileId);
    if (!target || target.picked) return;

    setBurstTiles((prev) => new Set([...prev, tileId]));
    setTimeout(() => {
      setBurstTiles((prev) => {
        const next = new Set(prev);
        next.delete(tileId);
        return next;
      });
    }, 1200);

    const { prize } = target;
    let nextMult = vaultMultiplier;
    let nextPicks = picksLeft - 1;

    const rect = e?.currentTarget?.getBoundingClientRect();
    const spawnX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const spawnY = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    if (prize.kind === 'multiplier') {
      nextMult = vaultMultiplier + prize.multAdd;
      nextPicks += prize.extraPicks;
      soundEngine.playBonusPick(true);
      setMultiplierBlaze(true);
      setTimeout(() => setMultiplierBlaze(false), 2000);
    } else if (prize.kind === 'extra_picks') {
      nextPicks += prize.extraPicks;
      soundEngine.playBonusPick(true);
    } else if (prize.kind === 'jackpot') {
      soundEngine.playWin(true);
      soundEngine.playThunderStrike?.();
      setWonJackpots((prev) => [...prev, prize.jackpotId]);
      setJackpotCelebration({
        label: prize.label,
        amount: prize.baseCoins,
      });
    } else {
      soundEngine.playBonusPick(false);
    }

    const wonCoins =
      prize.kind === 'jackpot'
        ? prize.baseCoins
        : Math.round(prize.baseCoins * nextMult);

    const pickSubtitle =
      prize.kind === 'jackpot'
        ? `${prize.label} UNLOCKED!`
        : prize.kind === 'multiplier'
        ? `${nextMult}× VAULT MULTIPLIER!`
        : prize.kind === 'extra_picks'
        ? `+${prize.extraPicks} EXTRA PICKS!`
        : `${String(target?.title || 'SACRED RELIC').toUpperCase()} WIN!`;

    spawnFloatingWinBurst(`+${wonCoins.toLocaleString()}`, pickSubtitle, {
      x: spawnX,
      y: spawnY,
      isJackpot: prize.kind === 'jackpot',
      variant: prize.kind === 'multiplier' ? 'emerald' : prize.kind === 'jackpot' ? 'royal' : 'gold',
      deltaCoins: wonCoins,
    });

    setVaultMultiplier(nextMult);
    setPicksLeft(nextPicks);
    setVaultWinCoins((prev) => prev + wonCoins);

    const updatedTiles = vaultTiles.map((t) =>
      t.id === tileId
        ? {
            ...t,
            picked: true,
            awardedCoins: wonCoins,
          }
        : t
    );
    const pickedCountNow = updatedTiles.filter((t) => t.picked).length;

    // Sacred Vault Chamber Refill Mechanism: If 8+ tiles picked and picks remain, unseal fresh relics!
    if (pickedCountNow >= 8 && nextPicks > 0) {
      vaultRefillingRef.current = true;
      setVaultTiles(updatedTiles);
      setTimeout(() => {
        vaultRefillingRef.current = false;
        soundEngine.playBonusTrigger();
        setVaultTiles(buildVaultBoard(currentBet));
        spawnFloatingWinBurst('CHAMBER REFILLED!', `FRESH RELICS AT ${nextMult}× MULT!`, {
          variant: 'emerald',
        });
        setVaultBanner(
          `✨ SACRED VAULT CHAMBER REFILLED! 12 FRESH RELICS UNSEALED AT ${nextMult}× MULTIPLIER (${nextPicks} PICKS LEFT)!`
        );
      }, 650);
    } else {
      setVaultTiles(updatedTiles);
    }

    if (prize.kind === 'multiplier') {
      setVaultBanner(
        `⚡ ${prize.label} VAULT MULTIPLIER UPGRADED TO ${nextMult}× + ${wonCoins.toLocaleString()} COINS!`
      );
    } else if (prize.kind === 'extra_picks') {
      setVaultBanner(
        `✨ ${BONUS_CONFIG.vaultExtraPicksBlessing} ${prize.label} + ${wonCoins.toLocaleString()} COINS!`
      );
    } else if (prize.kind === 'jackpot') {
      setVaultBanner(
        `👑 JACKPOT UNLOCKED! ${prize.label} PAID ${wonCoins.toLocaleString()} COINS!`
      );
    } else {
      setVaultBanner(
        `✨ REVEALED ${String(target?.title || 'RELIC').toUpperCase()}: +${wonCoins.toLocaleString()} COINS (${nextMult}× MULT)!`
      );
    }
  };

  // --- 2. FORTUNE WHEEL HANDLER ---
  const handleSpinWheel = () => {
    if (wheelSpinning || wheelSpinsLeft <= 0) return;
    setWheelSpinning(true);
    setActiveWedgeIdx(null);
    setWheelWinPop(null);
    setWheelSpinsLeft((prev) => Math.max(0, prev - 1));
    soundEngine.playSpinStart();

    // Weighted wedge selection with boosted 2x UPGRADE (+Free Spin) frequency for extended gameplay
    const getWedgeWeight = (w) => {
      if (w.jackpotId === 'grand') return 0.35;
      if (w.jackpotId === 'major') return 1.3;
      if (w.jackpotId === 'minor') return 4.0;
      if (w.jackpotId === 'mini') return 7.5;
      if (w.type === 'upgrade') return 9.5;
      return Math.max(4, 24 - (w.mult || 5));
    };
    const weights = wedges.map(getWedgeWeight);
    const totalW = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * totalW;
    let chosenIdx = 0;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        chosenIdx = i;
        break;
      }
    }
    const sliceDeg = 360 / wedges.length;
    const currentDeg = wheelRotationRef.current.deg;
    const targetMod = (360 - chosenIdx * sliceDeg) % 360;
    const currentMod = ((currentDeg % 360) + 360) % 360;
    let deltaDeg = targetMod - currentMod;
    if (deltaDeg <= 0) deltaDeg += 360;

    const fullSpins = (5 + Math.floor(Math.random() * 2)) * 360;
    const finalDeg = currentDeg + fullSpins + deltaDeg;

    let lastTickStep = Math.floor(currentDeg / sliceDeg);

    gsap.to(wheelRotationRef.current, {
      deg: finalDeg,
      duration: 4.5,
      ease: 'power4.out',
      onUpdate: () => {
        const degNow = wheelRotationRef.current.deg;
        if (wheelCanvasRef.current) {
          wheelCanvasRef.current.style.transform = `rotate(${degNow}deg)`;
        }
        const stepNow = Math.floor(degNow / sliceDeg);
        if (stepNow !== lastTickStep) {
          lastTickStep = stepNow;
          soundEngine.playWheelTick(stepNow % 6);
        }
      },
      onComplete: () => {
        setWheelSpinning(false);
        setActiveWedgeIdx(chosenIdx);
        const wedge = wedges[chosenIdx];
        const wRect = wheelCanvasRef.current?.getBoundingClientRect();
        const wCenterX = wRect ? wRect.left + wRect.width / 2 : window.innerWidth * 0.4;
        const wCenterY = wRect ? wRect.top + wRect.height / 2 : window.innerHeight * 0.5;

        if (wedge.type === 'upgrade') {
          const nextWMult = wheelMultiplier * 2;
          setWheelMultiplier(nextWMult);
          setWheelSpinsLeft((prev) => prev + 1);
          soundEngine.playBonusTrigger();
          setWheelWinPop({
            id: Date.now(),
            title: `WHEEL UPGRADED TO ${nextWMult}×!`,
            subtitle: '+1 FREE BONUS RESPIN AWARDED!',
            coins: 0,
            color: wedge.gemColor || '#34d399',
            type: 'upgrade',
          });
          spawnFloatingWinBurst(`${nextWMult}× UPGRADE!`, '+1 FREE WHEEL SPIN!', {
            x: wCenterX,
            y: wCenterY,
            variant: 'emerald',
          });
          setWheelBanner(
            `${BONUS_CONFIG.wheelUpgradeBannerPrefix} ${nextWMult}× + 1 FREE RESPIN!`
          );
        } else if (wedge.type === 'jackpot') {
          const jpCoins = wedge.mult * currentBet;
          setWheelWinCoins((prev) => prev + jpCoins);
          setWonJackpots((prev) => [...prev, wedge.jackpotId]);
          // Solar Momentum: Mini & Minor Jackpots also award +1 Free Bonus Respin!
          const awardsBonusSpin = wedge.jackpotId === 'mini' || wedge.jackpotId === 'minor';
          if (awardsBonusSpin) {
            setWheelSpinsLeft((prev) => prev + 1);
          }
          soundEngine.playWin(true);
          soundEngine.playThunderStrike?.();
          setWheelWinPop({
            id: Date.now(),
            title: `${wedge.label} STRUCK!`,
            subtitle: awardsBonusSpin
              ? 'ROYAL JACKPOT + 1 FREE BONUS RESPIN!'
              : 'ROYAL FORTUNE WHEEL JACKPOT',
            coins: jpCoins,
            color: wedge.gemColor || '#fde047',
            type: 'jackpot',
          });
          spawnFloatingWinBurst(
            `+${jpCoins.toLocaleString()}`,
            awardsBonusSpin ? `${wedge.label} + 1 FREE SPIN!` : `${wedge.label} HIT!`,
            {
              x: wCenterX,
              y: wCenterY,
              isJackpot: true,
              variant: 'royal',
              deltaCoins: jpCoins,
            }
          );
          setJackpotCelebration({
            label: wedge.label,
            amount: jpCoins,
          });
          setWheelBanner(
            `${BONUS_CONFIG.wheelJackpotBannerPrefix} ${wedge.label} AWARDED +${jpCoins.toLocaleString()} COINS${
              awardsBonusSpin ? ' + 1 FREE RESPIN!' : '!'
            }`
          );
        } else {
          const winAmt = wedge.mult * wheelMultiplier * currentBet;
          const awardsMomentumSpin = wedge.mult >= 8;
          if (awardsMomentumSpin) {
            setWheelSpinsLeft((prev) => prev + 1);
          }
          setWheelWinCoins((prev) => prev + winAmt);
          soundEngine.playWin(winAmt >= currentBet * 40);
          setWheelWinPop({
            id: Date.now(),
            title: `${wedge.mult * wheelMultiplier}× BET WEDGE WIN!`,
            subtitle: awardsMomentumSpin
              ? 'SOLAR MOMENTUM: +1 FREE BONUS RESPIN!'
              : 'FORTUNE WHEEL PAYOUT',
            coins: winAmt,
            color: wedge.gemColor || '#fde047',
            type: 'coins',
          });
          spawnFloatingWinBurst(
            `+${winAmt.toLocaleString()}`,
            awardsMomentumSpin
              ? `WHEEL ${wedge.mult * wheelMultiplier}× + 1 FREE SPIN!`
              : `WHEEL ${wedge.mult * wheelMultiplier}× WIN!`,
            {
              x: wCenterX,
              y: wCenterY,
              variant: awardsMomentumSpin ? 'emerald' : 'gold',
              deltaCoins: winAmt,
            }
          );
          setWheelBanner(
            `WHEEL LANDED ON ${wedge.mult * wheelMultiplier}× BET: +${winAmt.toLocaleString()} COINS${
              awardsMomentumSpin ? ' + 1 FREE SOLAR RESPIN!' : '!'
            }`
          );
        }
        setTimeout(() => {
          setWheelWinPop(null);
        }, 2800);
      },
    });
  };

  // --- 3. PHARAOH'S HOLD & WIN AUTOMATIC RESPIN HANDLER ---
  const handleHoldSpinRespin = () => {
    if (
      hwIsSpinningRef.current ||
      hwSpinsLeftRef.current <= 0 ||
      hwCompletedRef.current
    ) {
      return;
    }
    if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);

    hwIsSpinningRef.current = true;
    setHwIsSpinning(true);
    setHwRespinResetPop(false);
    setHwRoundNum((prev) => prev + 1);
    soundEngine.playSpinStart();

    const table = BONUS_CONFIG.holdSpin?.coinTable || [];
    const pickRandomCoin = () => {
      let r = Math.random();
      for (const c of table) {
        r -= c.chance;
        if (r <= 0) return { ...c, coins: Math.round(c.mult * currentBet) };
      }
      const last = table[table.length - 1];
      return { ...last, coins: Math.round(last.mult * currentBet) };
    };

    if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
    hwAutoTimerRef.current = setTimeout(() => {
      if (!bonusSession || hwCompletedRef.current) return;
      let newLandedCount = 0;
      let newWonCoins = 0;
      let rescuedByGuardian = false;
      const currentCells = hwCellsRef.current;

      let updatedCells = currentCells.map((cell) => {
        if (cell.locked) return { ...cell, isNew: false };
        if (Math.random() < (BONUS_CONFIG.holdSpin?.landChance || 0.24)) {
          const coin = pickRandomCoin();
          newLandedCount++;
          newWonCoins += coin.coins;
          return {
            ...cell,
            locked: true,
            coin,
            isNew: true,
          };
        }
        return cell;
      });

      // Guardian Second-Wind Orb Rescue Mechanism:
      // If on the final respin (1 left) no orb landed naturally and board has < 11 orbs,
      // Anubis & Bastet can summon a Second-Wind Jewel Orb (up to 2 times per session) to extend the round!
      const currentLockedCount = updatedCells.filter((c) => c.locked).length;
      if (
        newLandedCount === 0 &&
        hwSpinsLeftRef.current === 1 &&
        currentLockedCount < 11 &&
        hwRescuesUsedRef.current < 2 &&
        Math.random() < 0.78
      ) {
        const emptyIndices = updatedCells
          .map((c, idx) => (!c.locked ? idx : -1))
          .filter((idx) => idx >= 0);
        if (emptyIndices.length > 0) {
          hwRescuesUsedRef.current += 1;
          rescuedByGuardian = true;
          const chosenEmptyIdx = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
          const rescueCoin = pickRandomCoin();
          newLandedCount = 1;
          newWonCoins += rescueCoin.coins;
          updatedCells = updatedCells.map((cell, idx) =>
            idx === chosenEmptyIdx
              ? { ...cell, locked: true, coin: rescueCoin, isNew: true }
              : cell
          );
        }
      }

      const totalLocked = updatedCells.filter((c) => c.locked).length;
      const nextTotalWin = hwTotalWinRef.current + newWonCoins;

      hwCellsRef.current = updatedCells;
      hwTotalWinRef.current = nextTotalWin;
      hwIsSpinningRef.current = false;

      setHwCells(updatedCells);
      setHwIsSpinning(false);
      setHwTotalWin(nextTotalWin);

      // Check full board Grand Jackpot (15/15 cells filled)
      if (totalLocked >= 15) {
        const grandBonus = currentBet * (BONUS_CONFIG.holdSpin?.fullBoardBonusMult || 500);
        const finalGrandTotal = nextTotalWin + grandBonus;
        hwTotalWinRef.current = finalGrandTotal;
        hwCompletedRef.current = true;
        setHwTotalWin(finalGrandTotal);
        setHwCompleted(true);
        soundEngine.playThunderStrike?.();
        soundEngine.playWinCelebration('epic');
        setWonJackpots((prev) => [...prev, 'grand']);
        spawnFloatingWinBurst(`+${grandBonus.toLocaleString()}`, '15/15 GRAND JACKPOT!', {
          isJackpot: true,
          variant: 'royal',
          deltaCoins: grandBonus,
        });
        setJackpotCelebration({
          label: 'FULL BOARD 15/15 GRAND JACKPOT!',
          amount: grandBonus,
        });
        setHwBanner(
          `👑 FULL BOARD 15/15 ACHIEVED! GRAND JACKPOT +${grandBonus.toLocaleString()} COINS AWARDED!`
        );
        return;
      }

      if (newLandedCount > 0) {
        hwSpinsLeftRef.current = 3; // Reset to 3 respins on new coin!
        setHwSpinsLeft(3);
        setHwRespinResetPop(true);
        setTimeout(() => setHwRespinResetPop(false), 1550);
        soundEngine.playRespinReset();
        spawnFloatingWinBurst(
          `+${newWonCoins.toLocaleString()}`,
          rescuedByGuardian
            ? '⚡ GUARDIAN SECOND-WIND! RESPINS → 3'
            : `${newLandedCount} NEW ORB${newLandedCount > 1 ? 'S' : ''} LOCKED! RESPINS → 3`,
          {
            variant: rescuedByGuardian || newLandedCount >= 2 ? 'royal' : 'emerald',
            deltaCoins: newWonCoins,
          }
        );
        setHwBanner(
          rescuedByGuardian
            ? `⚡ GUARDIAN SECOND-WIND RESCUE! BONUS ORB SUMMONED — RESPINS RESET TO 3!`
            : `🌈 ${newLandedCount} NEW JEWEL ORB${newLandedCount > 1 ? 'S' : ''} LOCKED! RESPINS AUTOMATICALLY RESET TO 3!`
        );

        // Automatically schedule next respin wave
        hwAutoTimerRef.current = setTimeout(() => {
          if (hwStepFnRef.current) hwStepFnRef.current();
        }, 1550);
      } else {
        const nextSpins = hwSpinsLeftRef.current - 1;
        hwSpinsLeftRef.current = nextSpins;
        setHwSpinsLeft(nextSpins);
        soundEngine.playHoldAndWinLock();

        if (nextSpins <= 0) {
          hwCompletedRef.current = true;
          setHwCompleted(true);
          soundEngine.playWinCelebration('epic');
          spawnFloatingWinBurst(
            `+${nextTotalWin.toLocaleString()}`,
            `HOLD & WIN HARVEST COMPLETE! (${totalLocked}/15 ORBS)`,
            {
              isJackpot: true,
              variant: 'royal',
            }
          );
          setHwBanner(
            `👑 HOLD & WIN COMPLETED! VAULT HARVESTED +${nextTotalWin.toLocaleString()} COINS!`
          );
        } else {
          setHwBanner(
            `⚡ AUTO-SPINNING NEXT RESPIN... (${nextSpins} RESPIN${nextSpins === 1 ? '' : 'S'} REMAINING)`
          );
          hwAutoTimerRef.current = setTimeout(() => {
            if (hwStepFnRef.current) hwStepFnRef.current();
          }, 1250);
        }
      }
    }, 900);
  };

  hwStepFnRef.current = handleHoldSpinRespin;

  // --- 4. ASCENSION OF RA (CRASH MULTIPLIER) HANDLER ---
  const handleStartAscension = () => {
    if (raFlying || raFlightsLeft <= 0) return;
    setRaFlying(true);
    setRaStep(-1);
    setRaCrashed(false);
    setRaCashedOut(false);
    setRaCashoutShower(false);
    setRaGateBurstStep(null);
    setRaShieldActive(true);
    raShieldActiveRef.current = true;
    setRaFlightsLeft((prev) => Math.max(0, prev - 1));
    setRaBanner(
      "☀️ SUN CHARIOT LIFTING OFF WITH RA'S SOLAR AEGIS SHIELD! CLIMBING THE 8 CELESTIAL GATES!"
    );
    soundEngine.playBonusTrigger();

    let step = 0;
    const runNextStep = () => {
      if (step >= ascensionNodes.length) {
        // Perfect Zenith Flight
        const topMult = ascensionNodes[ascensionNodes.length - 1];
        const topWin = topMult * currentBet;
        setRaStep(ascensionNodes.length - 1);
        setRaFlying(false);
        setRaCashedOut(true);
        setRaWinCoins((prev) => prev + topWin);
        setRaCashoutShower(true);
        soundEngine.playAscensionCashOut();
        spawnFloatingWinBurst(`+${topWin.toLocaleString()}`, `ZENITH ×${topMult} GLORY!`, {
          isJackpot: true,
          variant: 'royal',
          deltaCoins: topWin,
        });
        setRaBanner(`☀️ ZENITH GLORY! PERFECT FLIGHT REACHED ×${topMult}! +${topWin.toLocaleString()} COINS BANKED!`);
        return;
      }

      const isCrashed = Math.random() < ascensionCrashProbs[step];
      if (isCrashed) {
        // Ra's Solar Aegis Shield Mechanism: Absorbs the first storm strike of the flight!
        if (raShieldActiveRef.current) {
          raShieldActiveRef.current = false;
          setRaShieldActive(false);
          setRaStep(step);
          setRaGateBurstStep(step);
          soundEngine.playBonusPick(true);
          spawnFloatingWinBurst(
            `🛡️ AEGIS SHIELD!`,
            `STORM DEFLECTED AT GATE #${step + 1} (×${ascensionNodes[step]})!`,
            { variant: 'emerald' }
          );
          setRaBanner(
            `🛡️ RA'S SOLAR AEGIS ABSORBED THE STORM AT GATE #${step + 1} (×${ascensionNodes[step]})! CHARIOT CONTINUES ASCENDING!`
          );
          step++;
          raTimerRef.current = setTimeout(runNextStep, BONUS_CONFIG.ascension?.stepDelay || 1200);
          return;
        }

        setRaStep(step);
        setRaFlying(false);
        setRaCrashed(true);
        soundEngine.playAscensionCrash();
        const safeMult = step > 0 ? ascensionNodes[step - 1] : Math.max(2, BONUS_CONFIG.ascension?.consolationMult || 2);
        const consolationCoins = safeMult * currentBet;
        setRaWinCoins((prev) => prev + consolationCoins);
        setRaCashoutShower(true);
        spawnFloatingWinBurst(
          `+${consolationCoins.toLocaleString()}`,
          `GUARANTEED FREE MONEY (×${safeMult})!`,
          {
            variant: 'gold',
            deltaCoins: consolationCoins,
          }
        );
        setRaBanner(`🎉 GUARANTEED FREE MONEY LOCKED! +${consolationCoins.toLocaleString()} COINS (×${safeMult} MULTIPLIER) BANKED!`);
      } else {
        setRaStep(step);
        setRaGateBurstStep(step);
        soundEngine.playAscensionStep(step);

        // Smart Celebration Auto-Bank: When Auto-Play is ON and chariot reaches a high gate (8x, 15x, 30x, 50x) after shield is used or at 15x+, bank the jackpot haul automatically!
        const reachedMult = ascensionNodes[step];
        const shouldSmartAutoBank =
          autoPlayBonusRef.current &&
          ((!raShieldActiveRef.current && step >= 3) || (step >= 4 && Math.random() < 0.68));

        if (shouldSmartAutoBank) {
          const autoBankCoins = reachedMult * currentBet;
          setRaFlying(false);
          setRaCashedOut(true);
          setRaWinCoins((prev) => prev + autoBankCoins);
          setRaCashoutShower(true);
          soundEngine.playAscensionCashOut();
          spawnFloatingWinBurst(
            `+${autoBankCoins.toLocaleString()}`,
            `👑 AUTO-BANKED AT ×${reachedMult}!`,
            {
              isJackpot: reachedMult >= 15,
              variant: reachedMult >= 15 ? 'royal' : 'emerald',
              deltaCoins: autoBankCoins,
            }
          );
          setRaBanner(
            `👑 GOLDEN AUTO-PILOT BANKED ×${reachedMult} MULTIPLIER! +${autoBankCoins.toLocaleString()} FREE COINS SECURED!`
          );
          return;
        }

        setRaBanner(`☀️ REACHED GATE #${step + 1}: GUARANTEED FREE MONEY AT ×${reachedMult}! AUTO-CLIMBING HIGHER!`);
        step++;
        raTimerRef.current = setTimeout(runNextStep, BONUS_CONFIG.ascension?.stepDelay || 1100);
      }
    };

    raTimerRef.current = setTimeout(runNextStep, BONUS_CONFIG.ascension?.startDelay || 900);
  };

  const handleCashOutAscension = () => {
    if (!raFlying || raCrashed || raCashedOut || raStep < 0) return;
    if (raTimerRef.current) clearTimeout(raTimerRef.current);
    const lockedMult = ascensionNodes[raStep];
    const wonAmt = lockedMult * currentBet;
    setRaFlying(false);
    setRaCashedOut(true);
    setRaWinCoins((prev) => prev + wonAmt);
    setRaCashoutShower(true);
    soundEngine.playAscensionCashOut();
    spawnFloatingWinBurst(`+${wonAmt.toLocaleString()}`, `CASHED OUT AT ×${lockedMult}!`, {
      isJackpot: lockedMult >= 15,
      variant: lockedMult >= 15 ? 'royal' : 'emerald',
      deltaCoins: wonAmt,
    });
    setRaBanner(`👑 CASHED OUT SAFELY AT ×${lockedMult}! +${wonAmt.toLocaleString()} COINS BANKED!`);
  };

  const activeRaMultiplier = raStep >= 0 ? ascensionNodes[raStep] : 1;
  const currentCashOutCoins = activeRaMultiplier * currentBet;
  const hwLockedCount = hwCells.filter((c) => c.locked).length;

  pickTileFnRef.current = handlePickTile;
  spinWheelFnRef.current = handleSpinWheel;
  startAscensionFnRef.current = handleStartAscension;
  completeBonusFnRef.current = () => {
    soundEngine.playWin(true);
    onCompleteBonus(totalCombinedBonusWin);
  };

  const chamberGuideText =
    activeTab === 'doors'
      ? nextChamberId
        ? `🎉 CONGRATULATIONS! YOU'RE IN THE FREE MONEY BONUS! Auto-starting your 4-Chamber Celebration Tour in ${doorsCountdown}s (or tap any chamber)!`
        : `🎉 ALL 4 BONUS CHAMBERS COMPLETED! Total Free Money Won: +${totalCombinedBonusWin.toLocaleString()} ${currencyMode === 'SC' ? 'SC' : 'COINS'}!`
      : activeTab === 'holdspin'
      ? '🪙 FREE MONEY CHAMBER 1/4 (HOLD & WIN): Golden Orbs lock in & pay instant Free Coins! Every new orb resets Respins back to 3 — 100% Automatic!'
      : activeTab === 'vault'
      ? '🏺 FREE MONEY CHAMBER 2/4 (RELIC VAULT): Every chest holds guaranteed Free Coins, Multipliers, or Jackpots! Auto-opening chests for you now!'
      : activeTab === 'wheel'
      ? '🎡 FREE MONEY CHAMBER 3/4 (WHEEL OF KEMET): Every spin wins guaranteed Free Coins, 2× Upgrades, or Royal Jackpots! Auto-spinning for you now!'
      : '☀️ FREE MONEY CHAMBER 4/4 (ASCENSION OF RA): The Sun Chariot climbs up to 100× Multiplier! Protected by Ra’s Shield — 100% Guaranteed Free Money!';

  // Next Available Chamber helper to encourage multi-chamber bonus tour (excluding current tab)
  const availableChambers = [
    !hwCompleted ? { id: 'holdspin', label: 'Hold & Win Respins' } : null,
    picksLeft > 0 ? { id: 'vault', label: `Relic Vault (${picksLeft} Picks)` } : null,
    wheelSpinsLeft > 0 ? { id: 'wheel', label: `Fortune Wheel (${wheelSpinsLeft} Spins)` } : null,
    raFlightsLeft > 0 ? { id: 'ascension', label: `Ascension of Ra (${raFlightsLeft} Flights)` } : null,
  ].filter(Boolean);
  const nextAvailableChamber = availableChambers.find((c) => c.id !== activeTab) || null;

  return (
    <div className="bonus-modal-backdrop">
      <div className="bonus-modal-cabinet">
        {/* Top Header & 4 Progressive 3D Cabochon Jackpot Meters */}
        <div className="bonus-modal-header">
          {/* Centered Title & Hands-Free Auto-Play Toggle */}
          <div className="bonus-title-center-row">
            <div className="bonus-title-badge">
              <Sparkles size={18} />
              <span>🎉 {BONUS_CONFIG.modalTitle} • FREE MONEY CELEBRATION!</span>
            </div>
            <button
              type="button"
              className={`bonus-autoplay-toggle-pill ${autoPlayBonus ? 'autoplay-on' : 'autoplay-off'}`}
              onClick={() => {
                soundEngine.playButtonClick(580);
                setAutoPlayBonus((prev) => !prev);
              }}
              title="Toggle Hands-Free Automatic Bonus Play"
            >
              <Zap size={14} />
              <span>{autoPlayBonus ? 'AUTO-PLAY: ON (HANDS-FREE)' : 'AUTO-PLAY: PAUSED (MANUAL)'}</span>
            </button>
          </div>

          {/* Crystal-Clear 1-Sentence Plain-English Celebration Guide */}
          <div className="bonus-celebration-guide-bar">
            <span className="guide-free-money-tag">100% FREE BONUS MONEY</span>
            <span className="guide-plain-text">{chamberGuideText}</span>
          </div>

          {/* Centered Game Selection Tabs */}
          <div className="bonus-tabs-center-row">
            <div className="bonus-game-tabs">
              <button
                className={`bonus-tab-btn ${activeTab === 'doors' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(520);
                  setActiveTab('doors');
                }}
              >
                <Crown size={15} />
                <span>Doors of Kemet</span>
              </button>

              <button
                className={`bonus-tab-btn ${activeTab === 'holdspin' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(540);
                  setActiveTab('holdspin');
                }}
              >
                <Coins size={15} />
                <span>Hold &amp; Win ({hwCompleted ? 'Done' : `${hwSpinsLeft} Respins`})</span>
              </button>

              <button
                className={`bonus-tab-btn ${activeTab === 'vault' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(560);
                  setActiveTab('vault');
                }}
              >
                <Gem size={15} />
                <span>Vault ({picksLeft} Picks)</span>
              </button>

              <button
                className={`bonus-tab-btn ${activeTab === 'wheel' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(600);
                  setActiveTab('wheel');
                }}
              >
                <Compass size={15} />
                <span>Wheel ({wheelSpinsLeft} Spins)</span>
              </button>

              <button
                className={`bonus-tab-btn ${activeTab === 'ascension' ? 'active' : ''}`}
                onClick={() => {
                  soundEngine.playButtonClick(640);
                  setActiveTab('ascension');
                }}
              >
                <Sun size={15} />
                <span>Ascension of Ra</span>
              </button>

              {onLaunchCelestialOverload && (
                <button
                  className="bonus-tab-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(680);
                    onLaunchCelestialOverload(totalCombinedBonusWin);
                  }}
                >
                  <Flame size={15} />
                  <span>Wrath of Gods ⚡</span>
                </button>
              )}
            </div>
          </div>

          <div className="bonus-jackpot-bar">
            {jackpotsWithValues.map((jp) => {
              const isHit = wonJackpots.includes(jp.id);
              return (
                <div
                  key={jp.id}
                  className={`bonus-jackpot-card jp-${jp.id} ${isHit ? 'jp-hit-glow' : ''}`}
                >
                  <img
                    src={jp.icon}
                    alt={jp.label}
                    className="jp-floating-3d-icon"
                    draggable={false}
                  />
                  <div className="jp-card-info">
                    <span className="jp-tier-label">{jp.label}</span>
                    <span className="jp-tier-coins">{jp.coins.toLocaleString()} COINS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SCREEN 1: DOORS OF KEMET PORTAL HUB */}
        {activeTab === 'doors' && (
          <div className="bonus-doors-stage">
            <div className="doors-hero-header">
              <h2 className="doors-hero-title">🎉 FREE MONEY BONUS CELEBRATION! 🎉</h2>
              <p className="doors-hero-sub">
                SIT BACK &amp; CELEBRATE — EVERY CHAMBER PAYS 100% GUARANTEED FREE COINS AUTOMATICALLY!
              </p>
              {nextChamberId && (
                <button
                  type="button"
                  className="doors-autostart-banner-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(640);
                    setActiveTab(nextChamberId);
                  }}
                >
                  <Zap size={18} />
                  <span>
                    {autoPlayBonus
                      ? `🚀 AUTO-STARTING FULL BONUS TOUR IN ${doorsCountdown}s... (TAP TO START NOW!)`
                      : '🚀 START FULL FREE MONEY BONUS TOUR NOW!'}
                  </span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>

            <div className="doors-grid-container">
              {[
                ...(BONUS_CONFIG.doors || []),
                ...(onLaunchCelestialOverload && BONUS_CONFIG.celestialDoor
                  ? [BONUS_CONFIG.celestialDoor]
                  : []),
              ].map((door) => (
                <div
                  key={door.id}
                  className="door-gateway-card"
                  onClick={() => {
                    soundEngine.playButtonClick(620);
                    if (door.id === 'celestial' && onLaunchCelestialOverload) {
                      onLaunchCelestialOverload(totalCombinedBonusWin);
                    } else {
                      setActiveTab(door.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="door-badge-pill" style={{ color: door.color }}>
                    {door.badge}
                  </div>
                  <div className="door-icon-orb">
                    <span className="door-emoji-symbol">{door.icon}</span>
                  </div>
                  <h3 className="door-card-name">{door.name}</h3>
                  <div className="door-card-subtitle">{door.subtitle}</div>
                  <p className="door-card-tagline">{door.tagline}</p>
                  <button
                    type="button"
                    className="door-enter-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      soundEngine.playButtonClick(640);
                      if (door.id === 'celestial' && onLaunchCelestialOverload) {
                        onLaunchCelestialOverload(totalCombinedBonusWin);
                      } else {
                        setActiveTab(door.id);
                      }
                    }}
                  >
                    <span>ENTER CHAMBER</span>
                    <ArrowRight size={15} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SCREEN 2: PHARAOH'S 15-CELL HOLD & WIN RESPINS (BRIGHT PRISMATIC AUTO-PLAY ARENA) */}
        {activeTab === 'holdspin' && (
          <div className={`bonus-holdspin-stage ${hwIsSpinning ? 'hw-stage-spinning' : ''} ${hwCompleted ? 'hw-stage-completed' : ''}`}>
            {/* Radiant Prismatic Background Rays */}
            <div className="hw-prismatic-aura-backdrop" aria-hidden="true">
              <span className="hw-prism-beam b1" />
              <span className="hw-prism-beam b2" />
              <span className="hw-prism-beam b3" />
            </div>

            <div className="bonus-stats-ribbon">
              <div className={`bonus-stat-pill hw-bright-pill ${hwRespinResetPop ? 'hw-reset-celebration-pill' : ''}`}>
                <span>AUTO RESPINS LEFT</span>
                <div className="hw-respins-pips">
                  {[1, 2, 3].map((pip) => (
                    <span
                      key={pip}
                      className={`hw-respin-pip ${pip <= hwSpinsLeft ? 'pip-lit' : ''}`}
                    />
                  ))}
                  <strong>{hwSpinsLeft}</strong>
                </div>
                {hwRespinResetPop && (
                  <span className="hw-reset-pop-badge">🌈 RESET TO 3!</span>
                )}
              </div>
              <div className="bonus-stat-pill mult-pill hw-bright-pill">
                <span>LOCKED JEWEL ORBS</span>
                <strong>{hwLockedCount} / 15</strong>
              </div>
              <div className="bonus-stat-pill hw-bright-pill hw-reward-pill">
                <span>HOLD &amp; WIN REWARD</span>
                <strong>+{hwTotalWin.toLocaleString()} COINS</strong>
              </div>
            </div>

            <div className={`bonus-live-banner hw-rainbow-banner ${hwIsSpinning ? 'banner-pulsing' : ''}`}>
              <Sparkles size={16} className="hw-banner-spark" />
              <span>{hwBanner}</span>
              <Sparkles size={16} className="hw-banner-spark" />
            </div>

            <div className={`hw-grid-board ${hwIsSpinning ? 'board-cascading' : ''}`}>
              {hwCells.map((cell) => {
                const cMult = cell.coin?.mult || 1;
                const isJpOrb = cell.coin?.type === 'jackpot';
                const orbTierClass = isJpOrb
                  ? 'orb-tier-jackpot'
                  : cMult >= 12
                  ? 'orb-tier-solar'
                  : cMult >= 8
                  ? 'orb-tier-ruby'
                  : cMult >= 5
                  ? 'orb-tier-amethyst'
                  : cMult >= 3
                  ? 'orb-tier-sapphire'
                  : 'orb-tier-emerald';
                const orbAccent = cell.coin?.color || '#fde047';

                return (
                  <div
                    key={cell.id}
                    className={`hw-cell-tile ${cell.locked ? `cell-locked ${orbTierClass}` : 'cell-empty'} ${
                      cell.isNew ? 'cell-new-land' : ''
                    } ${!cell.locked && hwIsSpinning ? 'cell-spinning-active' : ''}`}
                    style={cell.locked ? { '--orb-accent': orbAccent } : undefined}
                  >
                    <div className="hw-cell-bg-carving" />
                    {cell.isNew && cell.coin && (
                      <div className="hw-cell-win-micro-burst" aria-hidden="true">
                        <span className="hw-cell-shockwave" />
                        <span className="hw-cell-shockwave ring-2" />
                        <span className="hw-cell-floating-delta">
                          +{cell.coin.coins.toLocaleString()}
                        </span>
                        <span className="hw-mini-coin c1">🪙</span>
                        <span className="hw-mini-coin c2">🌈</span>
                        <span className="hw-mini-coin c3">💎</span>
                        <span className="hw-mini-coin c4">✨</span>
                      </div>
                    )}
                    {cell.locked && cell.coin ? (
                      <div className="hw-orb-content">
                        <span className="hw-orb-prismatic-ring" aria-hidden="true" />
                        <span className="hw-orb-shimmer-sweep" aria-hidden="true" />
                        <img
                          src={cell.coin.icon}
                          alt=""
                          className="hw-orb-icon"
                          draggable={false}
                        />
                        <span
                          className="hw-orb-badge"
                          style={{
                            color: '#ffffff',
                            background: orbAccent,
                          }}
                        >
                          {cell.coin.label}
                        </span>
                        <div className="hw-orb-coins">
                          <PsdGoldNumber value={cell.coin.coins} height={18} gap={-2} />
                        </div>
                      </div>
                    ) : hwIsSpinning ? (
                      <div className="hw-cell-spinning-vortex" aria-hidden="true">
                        <span className="hw-vortex-ring" />
                        <div className="hw-spinning-icons-strip">
                          <span>🪙</span>
                          <span>💎</span>
                          <span>👑</span>
                          <span>☀️</span>
                          <span>⚡</span>
                        </div>
                      </div>
                    ) : (
                      <div className="hw-empty-placeholder">
                        <span className="hw-empty-ring" />
                        <span className="hw-empty-dot" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Grand Harvest Celebration Banner when Auto-Play Completes */}
            {hwCompleted && (
              <div className="hw-harvest-complete-banner" aria-live="polite">
                <div className="hw-harvest-coin-shower" aria-hidden="true">
                  <span className="hh-coin c1">🪙</span>
                  <span className="hh-coin c2">💎</span>
                  <span className="hh-coin c3">🌈</span>
                  <span className="hh-coin c4">👑</span>
                  <span className="hh-coin c5">🪙</span>
                  <span className="hh-coin c6">✨</span>
                </div>
                <span className="hw-harvest-eyebrow">
                  ✨ AUTOMATIC HOLD &amp; WIN COMPLETED ({hwLockedCount}/15 JEWEL ORBS LOCKED) ✨
                </span>
                <strong className="hw-harvest-total-text">
                  VAULT HARVESTED: +{hwTotalWin.toLocaleString()} {currencyMode === 'SC' ? 'SC' : 'COINS'}!
                </strong>
              </div>
            )}

            <div className="hw-controls-panel">
              {hwCompleted ? (
                <button
                  type="button"
                  className="hw-respin-btn hw-auto-active-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(640);
                    if (hwAutoTimerRef.current) clearTimeout(hwAutoTimerRef.current);
                    const hwInit = buildHoldSpinBoard(currentBet);
                    hwCellsRef.current = hwInit.cells;
                    hwSpinsLeftRef.current = 3;
                    hwTotalWinRef.current += hwInit.initialWin;
                    hwIsSpinningRef.current = false;
                    hwCompletedRef.current = false;
                    hwRescuesUsedRef.current = 0;
                    setHwCells(hwInit.cells);
                    setHwSpinsLeft(3);
                    setHwTotalWin(hwTotalWinRef.current);
                    setHwIsSpinning(false);
                    setHwCompleted(false);
                    setHwRoundNum(0);
                    setHwBanner('🌈 ENCORE HOLD & WIN BOARD UNLOCKED! 3 NEW RESPINS COMMENCING!');
                    hwAutoTimerRef.current = setTimeout(() => {
                      if (hwStepFnRef.current) hwStepFnRef.current();
                    }, 950);
                  }}
                >
                  <RotateCw size={18} className="spin-icon-anim" />
                  <span>
                    🌈 PLAY ANOTHER HOLD &amp; WIN ROUND (TOTAL: +{hwTotalWin.toLocaleString()} COINS)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="hw-respin-btn hw-auto-active-btn"
                  onClick={handleHoldSpinRespin}
                  disabled={hwIsSpinning || hwSpinsLeft <= 0}
                >
                  <RotateCw size={18} className="spin-icon-anim" />
                  <span>
                    {hwIsSpinning
                      ? `🌈 AUTO-SPINNING RESPIN #${hwRoundNum}... ORBS CASCADING!`
                      : `⚡ AUTO-PLAYING RESPINS (${hwSpinsLeft} LEFT · RESETS TO 3 ON HIT)`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SCREEN 3: 3D POP-OUT PICK VAULT (12 TILES) */}
        {activeTab === 'vault' && (
          <div className="bonus-vault-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>VAULT PICKS LEFT</span>
                <strong>{picksLeft}</strong>
              </div>
              <div className={`bonus-stat-pill mult-pill ${multiplierBlaze ? 'mult-blazing' : ''}`}>
                <span>ACTIVE VAULT MULTIPLIER</span>
                <strong>{vaultMultiplier}×</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>SCATTER TRIGGER BONUS</span>
                <strong>+{(bonusSession.scatterWinCoins || 0).toLocaleString()}</strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Flame size={16} />
              <span>{vaultBanner}</span>
            </div>

            <div className="vault-3d-grid">
              {vaultTiles.map((tile) => {
                const isRevealed = tile.picked || picksLeft === 0;
                const isUnpickedReveal = !tile.picked && picksLeft === 0;
                const isBursting = burstTiles.has(tile.id);

                return (
                  <button
                    key={tile.id}
                    className={`vault-3d-tile ${tile.tileClass} ${
                      tile.picked ? 'tile-picked-win' : ''
                    } ${isUnpickedReveal ? 'tile-unpicked-dim' : ''}`}
                    onClick={(e) => handlePickTile(tile.id, e)}
                    disabled={tile.picked || picksLeft <= 0}
                  >
                    {isBursting && (
                      <div className="vault-tile-burst-effect" aria-hidden="true">
                        <div className="burst-shockwave-ring" />
                        <div className="burst-shockwave-ring secondary-ring" />
                        <div className="burst-spark-glow" />
                        <span className="vault-burst-coin vc-1">🪙</span>
                        <span className="vault-burst-coin vc-2">💎</span>
                        <span className="vault-burst-coin vc-3">🪙</span>
                        <span className="vault-burst-coin vc-4">✨</span>
                        <span className="vault-burst-coin vc-5">🪙</span>
                        <span className="vault-burst-coin vc-6">👑</span>
                      </div>
                    )}

                    <div className="vault-tile-velvet-cushion">
                      <span className="corner-gem tl" />
                      <span className="corner-gem tr" />
                      <span className="corner-gem bl" />
                      <span className="corner-gem br" />
                    </div>

                    <div
                      className="vault-tile-pop-artifact"
                      style={{ '--tile-tilt': tile.tilt }}
                    >
                      <img
                        src={tile.art}
                        alt={tile.title}
                        className="vault-pop-img"
                        draggable={false}
                      />
                    </div>

                    {isRevealed ? (
                      <div className={`vault-prize-overlay ${tile.picked ? 'picked-win-shimmer' : ''}`}>
                        {tile.picked && (
                          <span className="vault-picked-crown-badge" aria-hidden="true">
                            ✨ WON!
                          </span>
                        )}
                        <span className="vault-prize-tag">{tile.prize.label}</span>
                        <div className="vault-prize-digits">
                          <PsdGoldNumber
                            value={
                              tile.picked
                                ? tile.awardedCoins
                                : tile.prize.baseCoins * vaultMultiplier
                            }
                            height={22}
                            gap={-2}
                          />
                        </div>
                        <span className="vault-coins-unit">COINS</span>
                      </div>
                    ) : (
                      <div className="vault-tile-caption">
                        <span>{tile.title}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {picksLeft <= 0 && (
              <div className="hw-controls-panel" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="hw-respin-btn hw-auto-active-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(640);
                    setVaultTiles(buildVaultBoard(currentBet));
                    setPicksLeft(3);
                    setBurstTiles(new Set());
                    setVaultBanner('🏺 ENCORE SACRED RELIC CHAMBER UNLOCKED! +3 FRESH VAULT PICKS GRANTED!');
                  }}
                >
                  <Gem size={18} />
                  <span>🏺 UNLOCK ENCORE RELIC VAULT (+3 FRESH PICKS)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* SCREEN 4: 3D CABOCHON FORTUNE WHEEL */}
        {activeTab === 'wheel' && (
          <div className="bonus-wheel-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>WHEEL SPINS LEFT</span>
                <strong>{wheelSpinsLeft}</strong>
              </div>
              <div className="bonus-stat-pill mult-pill">
                <span>WHEEL WEDGE MULTIPLIER</span>
                <strong>{wheelMultiplier}×</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>WHEEL WINNINGS</span>
                <strong>+{wheelWinCoins.toLocaleString()} COINS</strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Sparkles size={16} />
              <span>{wheelBanner}</span>
            </div>

            <div className="wheel-chamber-layout">
              <div className="wheel-canvas-container">
                <div className={`wheel-top-pointer ${wheelSpinning ? 'flapper-vibrating' : ''}`}>
                  ▼
                  {wheelSpinning && <span className="wheel-pointer-spark" />}
                </div>

                <canvas
                  ref={wheelCanvasRef}
                  width={420}
                  height={420}
                  className="kemet-wheel-canvas"
                />

                <button
                  className="wheel-center-scarab-btn"
                  onClick={handleSpinWheel}
                  disabled={wheelSpinning || wheelSpinsLeft <= 0}
                  title="Click to Spin the 3D Fortune Wheel!"
                >
                  <img
                    src={BONUS_CONFIG.wheelCenterIcon}
                    alt="Spin Wheel"
                    className="wheel-center-scarab-img"
                    draggable={false}
                  />
                  <span>{wheelSpinning ? 'SPINNING' : 'SPIN'}</span>
                </button>

                {/* Celebratory Fortune Wheel Wedge Win Pop-Up */}
                {wheelWinPop && (
                  <div
                    key={wheelWinPop.id}
                    className={`wheel-win-celebration-pop pop-${wheelWinPop.type}`}
                    onClick={() => setWheelWinPop(null)}
                  >
                    <div className="wheel-pop-coins-ring" aria-hidden="true">
                      <span className="wp-coin c1">🪙</span>
                      <span className="wp-coin c2">✨</span>
                      <span className="wp-coin c3">💎</span>
                      <span className="wp-coin c4">🪙</span>
                      <span className="wp-coin c5">👑</span>
                      <span className="wp-coin c6">🪙</span>
                    </div>
                    <span className="wheel-pop-subtitle">{wheelWinPop.subtitle}</span>
                    <strong className="wheel-pop-title" style={{ color: wheelWinPop.color }}>
                      {wheelWinPop.title}
                    </strong>
                    {wheelWinPop.coins > 0 && (
                      <div className="wheel-pop-digits">
                        <PsdGoldNumber value={wheelWinPop.coins} height={28} gap={-2} />
                        <span className="wheel-pop-unit">COINS</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="wheel-controls-panel">
                <h3>{BONUS_CONFIG.wheelTitle}</h3>
                <p>{BONUS_CONFIG.wheelDescription}</p>

                <button
                  className="wheel-spin-cta-btn"
                  onClick={() => {
                    if (wheelSpinsLeft <= 0 && !wheelSpinning) {
                      soundEngine.playButtonClick(620);
                      setWheelSpinsLeft(2);
                      setWheelBanner('🎡 ENCORE FORTUNE WHEEL SPINS GRANTED! SPIN FOR MORE JACKPOTS!');
                      return;
                    }
                    handleSpinWheel();
                  }}
                  disabled={wheelSpinning}
                >
                  <RotateCw size={18} className={wheelSpinning ? 'spin-icon-anim' : ''} />
                  <span>
                    {wheelSpinning
                      ? '3D FORTUNE WHEEL SPINNING...'
                      : wheelSpinsLeft > 0
                      ? `SPIN 3D FORTUNE WHEEL (${wheelSpinsLeft} LEFT)`
                      : '🎡 SPIN ENCORE WHEEL (+2 FREE SPINS)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SCREEN 5: ASCENSION OF RA (CRASH-STYLE MULTIPLIER RUN) */}
        {activeTab === 'ascension' && (
          <div className="bonus-ascension-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>ACTIVE GATE</span>
                <strong>{raStep >= 0 ? `${ascensionNodes[raStep]}×` : 'GATE #1 READY'}</strong>
              </div>
              <div className="bonus-stat-pill mult-pill">
                <span>BANKABLE WIN</span>
                <strong>+{currentCashOutCoins.toLocaleString()} COINS</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>SOLAR AEGIS SHIELD</span>
                <strong>{raShieldActive ? '🛡️ READY (1 HIT)' : '⚡ EXPENDED'}</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>CHARIOT FLIGHTS</span>
                <strong>
                  {raFlying
                    ? 'ASCENDING SKY...'
                    : `${raFlightsLeft} ${raFlightsLeft === 1 ? 'FLIGHT' : 'FLIGHTS'} LEFT`}
                </strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Sun size={16} />
              <span>{raBanner}</span>
            </div>

            {/* Visual 8 Celestial Gates Multiplier Ladder Track */}
            <div className="ra-gates-track">
              {ascensionNodes.map((mult, idx) => {
                const isPassed = raStep > idx;
                const isCurrent = raStep === idx;
                const isDead = raCrashed && isCurrent;
                const isBurstGate = raGateBurstStep === idx && !isDead;

                return (
                  <div
                    key={idx}
                    className={`ra-gate-node ${isPassed ? 'gate-passed' : ''} ${
                      isCurrent ? 'gate-current' : ''
                    } ${isDead ? 'gate-dead' : ''} ${isBurstGate ? 'gate-win-burst-active' : ''}`}
                  >
                    {isBurstGate && (
                      <div className="ra-gate-win-micro-burst" aria-hidden="true">
                        <span className="ra-gate-halo-ring" />
                        <span className="ra-gate-floating-coins">
                          +{(mult * currentBet).toLocaleString()}
                        </span>
                        <span className="ra-gate-spark s1">☀️</span>
                        <span className="ra-gate-spark s2">🪙</span>
                        <span className="ra-gate-spark s3">✨</span>
                      </div>
                    )}
                    <div className="gate-number-tag">GATE #{idx + 1}</div>
                    <div className="gate-sun-disk">
                      {isCurrent && (
                        <div className="ra-solar-chariot-avatar" aria-hidden="true">
                          ☀️
                        </div>
                      )}
                      <span className="gate-mult-val">{mult}×</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Golden Chariot Cashout Celebration Banner & Coin Shower */}
            {raCashoutShower && (
              <div className="ra-cashout-celebration-banner" aria-live="polite">
                <div className="ra-cashout-coin-fountain" aria-hidden="true">
                  <span className="rc-coin c1">🪙</span>
                  <span className="rc-coin c2">☀️</span>
                  <span className="rc-coin c3">💎</span>
                  <span className="rc-coin c4">🪙</span>
                  <span className="rc-coin c5">👑</span>
                  <span className="rc-coin c6">🪙</span>
                </div>
                <span className="ra-cashout-tag">SOLAR CHARIOT TREASURY SECURED!</span>
                <strong className="ra-cashout-amount">
                  +{raWinCoins.toLocaleString()} {currencyMode === 'SC' ? 'SC' : 'COINS'} (×{activeRaMultiplier})
                </strong>
              </div>
            )}

            {/* Interactive Flight Controls */}
            <div className="ra-controls-panel">
              {!raFlying && raFlightsLeft > 0 ? (
                <button
                  type="button"
                  className="ra-launch-btn"
                  onClick={handleStartAscension}
                >
                  <Sun size={20} className="launch-sun-icon" />
                  <span>
                    {raCashedOut || raCrashed
                      ? `LAUNCH SUN CHARIOT FLIGHT #2 (${raFlightsLeft} LEFT)`
                      : `LAUNCH SUN CHARIOT (${raFlightsLeft} FLIGHTS • 8 GATES)`}
                  </span>
                </button>
              ) : !raFlying && raFlightsLeft <= 0 ? (
                <button
                  type="button"
                  className="ra-launch-btn"
                  onClick={() => {
                    soundEngine.playButtonClick(640);
                    setRaFlightsLeft(1);
                    setRaStep(-1);
                    setRaCrashed(false);
                    setRaCashedOut(false);
                    setRaShieldActive(true);
                    raShieldActiveRef.current = true;
                    setRaBanner("☀️ ENCORE SOLAR CHARIOT FLIGHT GRANTED WITH AEGIS SHIELD! READY TO LAUNCH!");
                  }}
                >
                  <Sun size={20} className="launch-sun-icon" />
                  <span>
                    ☀️ LAUNCH ENCORE CHARIOT FLIGHT (+1 FLIGHT • EARNED: +{raWinCoins.toLocaleString()} COINS)
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className={`ra-cashout-btn ${raFlying && raStep >= 0 ? 'cashout-pulsing' : ''}`}
                  onClick={handleCashOutAscension}
                  disabled={!raFlying || raStep < 0}
                >
                  <TrendingUp size={20} />
                  <span>
                    {`CASH OUT NOW: +${currentCashOutCoins.toLocaleString()} COINS (×${activeRaMultiplier})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer: Total Bonus Payout & Collect Button */}
        <div className="bonus-modal-footer">
          <div className={`bonus-total-summary ${footerWinPulse ? 'bonus-total-pulse-active' : ''}`}>
            <span className="bonus-total-label">
              TOTAL BONUS FEATURE WINNINGS ({currencyMode === 'SC' ? 'SWEEPS COINS' : 'GOLD COINS'}):
            </span>
            <div className="bonus-total-digits">
              <PsdGoldNumber value={totalCombinedBonusWin} height={32} gap={-2} />
              {footerWinPulse && (
                <span key={footerWinPulse.id} className="bonus-footer-delta-pop">
                  +{footerWinPulse.delta.toLocaleString()}!
                </span>
              )}
            </div>
            <span className="bonus-total-usd">
              ({currencyMode === 'SC'
                ? `$${Number(totalCombinedBonusWin).toFixed(2)} USD PRIZE VALUE`
                : `$${(totalCombinedBonusWin * coinValue).toFixed(2)}`}
              )
            </span>
          </div>

          <div className="bonus-footer-actions">
            {activeTab !== 'doors' && (
              <button
                className="bonus-switch-game-btn"
                onClick={() => setActiveTab('doors')}
                disabled={wheelSpinning || hwIsSpinning || raFlying}
              >
                <Crown size={16} />
                <span>Doors Portal</span>
              </button>
            )}

            {activeTab !== 'doors' && nextAvailableChamber && (
              <button
                type="button"
                className="bonus-switch-game-btn next-chamber-cta-btn"
                onClick={() => {
                  soundEngine.playButtonClick();
                  setActiveTab(nextAvailableChamber.id);
                }}
                disabled={wheelSpinning || hwIsSpinning || raFlying}
                title="Continue your bonus adventure in the next chamber!"
              >
                <Sparkles size={16} />
                <span>NEXT: {nextAvailableChamber.label}</span>
              </button>
            )}

            <button
              className="bonus-collect-btn"
              onClick={() => {
                soundEngine.playWin(true);
                onCompleteBonus(totalCombinedBonusWin);
              }}
              disabled={wheelSpinning || hwIsSpinning || raFlying}
            >
              <CheckCircle2 size={18} />
              <span>
                {tourFinishedCountdown !== null
                  ? `🎉 AUTO-COLLECTING ${totalCombinedBonusWin.toLocaleString()} ${
                      currencyMode === 'SC' ? 'SC' : 'COINS'
                    } IN ${tourFinishedCountdown}s!`
                  : `COLLECT ${totalCombinedBonusWin.toLocaleString()} ${
                      currencyMode === 'SC' ? 'SC' : 'COINS'
                    }`}
              </span>
            </button>
          </div>
        </div>

        {/* Ambient floating hieroglyphic particles */}
        <div className="vault-ambient-particles" aria-hidden="true">
          <span className="vault-hieroglyph-float p1">𓋹</span>
          <span className="vault-hieroglyph-float p2">𓊹</span>
          <span className="vault-hieroglyph-float p3">𓆣</span>
          <span className="vault-hieroglyph-float p4">𓂀</span>
          <span className="vault-hieroglyph-float p5">𓇳</span>
        </div>

        {/* Floating Flying Coin Prize Toasts with 3D Coin & Gem Particle Eruption */}
        {floatingPrizes.map((toast) => (
          <div
            key={toast.id}
            className={`bonus-flying-prize-toast ${toast.isJackpot ? 'jackpot-toast' : ''} toast-variant-${
              toast.variant || 'gold'
            }`}
            style={{ left: toast.x, top: toast.y }}
          >
            <div className="toast-coin-fountain" aria-hidden="true">
              <span className="toast-coin-p p1">🪙</span>
              <span className="toast-coin-p p2">✨</span>
              <span className="toast-coin-p p3">💎</span>
              <span className="toast-coin-p p4">🪙</span>
              <span className="toast-coin-p p5">✨</span>
              <span className="toast-coin-p p6">🪙</span>
            </div>
            {toast.subtitle && (
              <span className="toast-prize-subtitle">{toast.subtitle}</span>
            )}
            <span className="toast-prize-main">{toast.text}</span>
          </div>
        ))}

        {/* Royal Jackpot Celebration Popup Splash */}
        {jackpotCelebration && (
          <div
            className="vault-jackpot-splash-overlay"
            onClick={() => setJackpotCelebration(null)}
          >
            <div
              className="vault-jackpot-splash-card"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="jp-crown-halo">
                <Crown size={56} className="jp-crown-spin" />
              </div>
              <h2 className="jp-splash-title">ROYAL JACKPOT STRUCK!</h2>
              <div className="jp-splash-tier">{jackpotCelebration.label}</div>
              <div className="jp-splash-amount">
                <PsdGoldNumber value={jackpotCelebration.amount} height={46} gap={-2} />
              </div>
              <p className="jp-splash-sub">
                THE GODS OF KEMET BESTOW THEIR SUPREME TREASURE UPON YOU!
              </p>
              <button
                type="button"
                className="jp-splash-claim-btn"
                onClick={() => setJackpotCelebration(null)}
              >
                CLAIM JACKPOT REWARD
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
