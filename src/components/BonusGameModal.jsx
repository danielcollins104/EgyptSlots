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
  const pool = BONUS_CONFIG.vaultPrizeTemplates.map((tpl) => ({
    ...tpl,
    baseCoins: currentBet * tpl.betMult,
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
}) {
  // Navigation: 'doors' | 'holdspin' | 'vault' | 'wheel' | 'ascension'
  const [activeTab, setActiveTab] = useState('doors');

  // Game 1: 3D Pick Vault State
  const [picksLeft, setPicksLeft] = useState(bonusSession?.initialPicks || 3);
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
  const [wheelSpinsLeft, setWheelSpinsLeft] = useState(bonusSession?.wheelSpins || 1);
  const [wheelMultiplier, setWheelMultiplier] = useState(bonusSession?.startingMultiplier || 1);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelWinCoins, setWheelWinCoins] = useState(0);
  const [wheelBanner, setWheelBanner] = useState(BONUS_CONFIG.wheelDefaultBanner);
  const [activeWedgeIdx, setActiveWedgeIdx] = useState(null);

  // Game 3: Pharaoh's Hold & Win Respins State (5x3 = 15 cells)
  const [hwCells, setHwCells] = useState([]);
  const [hwSpinsLeft, setHwSpinsLeft] = useState(3);
  const [hwTotalWin, setHwTotalWin] = useState(0);
  const [hwIsSpinning, setHwIsSpinning] = useState(false);
  const [hwCompleted, setHwCompleted] = useState(false);
  const [hwBanner, setHwBanner] = useState("LOCK ORBS ON THE 5×3 GRID! EVERY NEW COIN RESETS RESPINS TO 3!");

  // Game 4: Ascension of Ra (Crash Multiplier Run)
  const [raStep, setRaStep] = useState(-1);
  const [raFlying, setRaFlying] = useState(false);
  const [raCrashed, setRaCrashed] = useState(false);
  const [raCashedOut, setRaCashedOut] = useState(false);
  const [raWinCoins, setRaWinCoins] = useState(0);
  const [raBanner, setRaBanner] = useState("THE SUN CHARIOT OF RA IS READY TO ASCEND THROUGH THE 8 CELESTIAL GATES!");

  const wheelCanvasRef = useRef(null);
  const wheelRotationRef = useRef({ deg: 0 });
  const raTimerRef = useRef(null);
  const wedges = BONUS_CONFIG.wheelWedges;
  const ascensionNodes = BONUS_CONFIG.ascension?.nodes || [2, 3, 5, 8, 15, 30, 50, 100];
  const ascensionCrashProbs = BONUS_CONFIG.ascension?.crashProb || [0.08, 0.12, 0.15, 0.20, 0.28, 0.38, 0.50, 0.65];

  useEffect(() => {
    if (!bonusSession) return;
    setActiveTab(bonusSession.defaultGame || 'doors');
    setPicksLeft(bonusSession.initialPicks || 3);
    setVaultMultiplier(bonusSession.startingMultiplier || 1);
    setVaultTiles(buildVaultBoard(currentBet));
    setVaultWinCoins(0);
    setWonJackpots([]);
    setVaultBanner(
      `UNLOCKED VIA ${bonusSession.triggerReason}! PICK ${
        bonusSession.initialPicks || 3
      } 3D TILES OR SPIN THE 3D WHEEL!`
    );

    setWheelSpinsLeft(bonusSession.wheelSpins || 1);
    setWheelMultiplier(bonusSession.startingMultiplier || 1);
    setWheelSpinning(false);
    setWheelWinCoins(0);
    setActiveWedgeIdx(null);
    wheelRotationRef.current.deg = 0;

    // Initialize Hold & Win
    const hwInit = buildHoldSpinBoard(currentBet);
    setHwCells(hwInit.cells);
    setHwSpinsLeft(3);
    setHwTotalWin(hwInit.initialWin);
    setHwIsSpinning(false);
    setHwCompleted(false);
    setHwBanner("LOCK ORBS ON THE 5×3 GRID! EVERY NEW COIN RESETS RESPINS TO 3!");

    // Initialize Ascension of Ra
    setRaStep(-1);
    setRaFlying(false);
    setRaCrashed(false);
    setRaCashedOut(false);
    setRaWinCoins(0);
    setRaBanner("THE SUN CHARIOT OF RA IS READY TO ASCEND THROUGH THE 8 CELESTIAL GATES!");
  }, [bonusSession, currentBet]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (raTimerRef.current) clearTimeout(raTimerRef.current);
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

    setFloatingPrizes((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        text: `+${wonCoins.toLocaleString()}`,
        x: spawnX,
        y: spawnY,
        isJackpot: prize.kind === 'jackpot',
      },
    ]);

    setVaultMultiplier(nextMult);
    setPicksLeft(nextPicks);
    setVaultWinCoins((prev) => prev + wonCoins);

    setVaultTiles((prev) =>
      prev.map((t) =>
        t.id === tileId
          ? {
              ...t,
              picked: true,
              awardedCoins: wonCoins,
            }
          : t
      )
    );

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
    setWheelSpinsLeft((prev) => Math.max(0, prev - 1));
    soundEngine.playSpinStart();

    const chosenIdx = Math.floor(Math.random() * wedges.length);
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
      duration: 4.1,
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

        if (wedge.type === 'upgrade') {
          const nextWMult = wheelMultiplier * 2;
          setWheelMultiplier(nextWMult);
          setWheelSpinsLeft((prev) => prev + 1);
          soundEngine.playBonusTrigger();
          setWheelBanner(
            `${BONUS_CONFIG.wheelUpgradeBannerPrefix} ${nextWMult}× + 1 FREE RESPIN!`
          );
        } else if (wedge.type === 'jackpot') {
          const jpCoins = wedge.mult * currentBet;
          setWheelWinCoins((prev) => prev + jpCoins);
          setWonJackpots((prev) => [...prev, wedge.jackpotId]);
          soundEngine.playWin(true);
          soundEngine.playThunderStrike?.();
          setJackpotCelebration({
            label: wedge.label,
            amount: jpCoins,
          });
          setWheelBanner(
            `${BONUS_CONFIG.wheelJackpotBannerPrefix} ${wedge.label} AWARDED +${jpCoins.toLocaleString()} COINS!`
          );
        } else {
          const winAmt = wedge.mult * wheelMultiplier * currentBet;
          setWheelWinCoins((prev) => prev + winAmt);
          soundEngine.playWin(winAmt >= currentBet * 40);
          setWheelBanner(
            `WHEEL LANDED ON ${wedge.mult * wheelMultiplier}× BET: +${winAmt.toLocaleString()} COINS!`
          );
        }
      },
    });
  };

  // --- 3. PHARAOH'S HOLD & WIN RESPIN HANDLER ---
  const handleHoldSpinRespin = () => {
    if (hwIsSpinning || hwSpinsLeft <= 0 || hwCompleted) return;
    setHwIsSpinning(true);
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

    setTimeout(() => {
      let newLandedCount = 0;
      let newWonCoins = 0;
      let updatedCells = [...hwCells];

      updatedCells = updatedCells.map((cell) => {
        if (cell.locked) return { ...cell, isNew: false };
        if (Math.random() < (BONUS_CONFIG.holdSpin?.landChance || 0.28)) {
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

      const totalLocked = updatedCells.filter((c) => c.locked).length;
      setHwCells(updatedCells);
      setHwIsSpinning(false);
      setHwTotalWin((prev) => prev + newWonCoins);

      if (newLandedCount > 0) {
        setHwSpinsLeft(3); // Reset to 3 respins on new coin!
        soundEngine.playRespinReset();
        setHwBanner(`✨ ${newLandedCount} NEW SACRED ORBS LOCKED! RESPINS RESET TO 3!`);
      } else {
        const nextSpins = hwSpinsLeft - 1;
        setHwSpinsLeft(nextSpins);
        soundEngine.playHoldAndWinLock();
        setHwBanner(`NO NEW ORBS THIS RESPIN. ${nextSpins} RESPINS REMAINING!`);

        if (nextSpins <= 0) {
          setHwCompleted(true);
          soundEngine.playWinCelebration('epic');
          setHwBanner(`👑 HOLD & WIN COMPLETED! VAULT HARVESTED +${(hwTotalWin + newWonCoins).toLocaleString()} COINS!`);
        }
      }

      // Check full board Grand Jackpot (15/15 cells filled)
      if (totalLocked >= 15) {
        const grandBonus = currentBet * (BONUS_CONFIG.holdSpin?.fullBoardBonusMult || 500);
        setHwTotalWin((prev) => prev + grandBonus);
        setHwCompleted(true);
        soundEngine.playThunderStrike?.();
        soundEngine.playWinCelebration('epic');
        setWonJackpots((prev) => [...prev, 'grand']);
        setJackpotCelebration({
          label: 'FULL BOARD 15/15 GRAND JACKPOT!',
          amount: grandBonus,
        });
        setHwBanner(`👑 FULL BOARD 15/15 ACHIEVED! GRAND JACKPOT +${grandBonus.toLocaleString()} COINS AWARDED!`);
      }
    }, 700);
  };

  // --- 4. ASCENSION OF RA (CRASH MULTIPLIER) HANDLER ---
  const handleStartAscension = () => {
    if (raFlying || raCrashed || raCashedOut) return;
    setRaFlying(true);
    setRaStep(-1);
    setRaCrashed(false);
    setRaCashedOut(false);
    setRaBanner("SUN CHARIOT LIFTING OFF! CLIMBING TOWARDS THE 8 CELESTIAL GATES OF RA!");
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
        setRaWinCoins(topWin);
        soundEngine.playAscensionCashOut();
        setRaBanner(`☀️ ZENITH GLORY! PERFECT FLIGHT REACHED ×${topMult}! +${topWin.toLocaleString()} COINS BANKED!`);
        return;
      }

      const isCrashed = Math.random() < ascensionCrashProbs[step];
      if (isCrashed) {
        setRaStep(step);
        setRaFlying(false);
        setRaCrashed(true);
        soundEngine.playAscensionCrash();
        const safeMult = step > 0 ? ascensionNodes[step - 1] : (BONUS_CONFIG.ascension?.consolationMult || 1);
        const consolationCoins = safeMult * currentBet;
        setRaWinCoins(consolationCoins);
        setRaBanner(`⚡ DIVINE STORM STRUCK AT ×${ascensionNodes[step]}! CONSOLATION SAFE PAYOUT: +${consolationCoins.toLocaleString()} COINS (×${safeMult})!`);
      } else {
        setRaStep(step);
        soundEngine.playAscensionStep(step);
        setRaBanner(`☀️ REACHED GATE #${step + 1}: CURRENT MULTIPLIER ×${ascensionNodes[step]}! CASH OUT OR CLIMB HIGHER!`);
        step++;
        raTimerRef.current = setTimeout(runNextStep, BONUS_CONFIG.ascension?.stepDelay || 950);
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
    setRaWinCoins(wonAmt);
    soundEngine.playAscensionCashOut();
    setRaBanner(`👑 CASHED OUT SAFELY AT ×${lockedMult}! +${wonAmt.toLocaleString()} COINS BANKED!`);
  };

  const activeRaMultiplier = raStep >= 0 ? ascensionNodes[raStep] : 1;
  const currentCashOutCoins = activeRaMultiplier * currentBet;
  const hwLockedCount = hwCells.filter((c) => c.locked).length;

  return (
    <div className="bonus-modal-backdrop">
      <div className="bonus-modal-cabinet">
        {/* Top Header & 4 Progressive 3D Cabochon Jackpot Meters */}
        <div className="bonus-modal-header">
          {/* Centered Title */}
          <div className="bonus-title-center-row">
            <div className="bonus-title-badge">
              <Sparkles size={18} />
              <span>{BONUS_CONFIG.modalTitle}</span>
            </div>
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
              <h2 className="doors-hero-title">{BONUS_CONFIG.doorsTitle || 'THE DOORS OF KEMET'}</h2>
              <p className="doors-hero-sub">
                {BONUS_CONFIG.doorsSubtitle || 'CHOOSE YOUR PATH THROUGH THE SACRED TEMPLES OF WEALTH'}
              </p>
            </div>

            <div className="doors-grid-container">
              {(BONUS_CONFIG.doors || []).map((door) => (
                <div
                  key={door.id}
                  className="door-gateway-card"
                  onClick={() => {
                    soundEngine.playButtonClick(620);
                    setActiveTab(door.id);
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
                      setActiveTab(door.id);
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

        {/* SCREEN 2: PHARAOH'S 15-CELL HOLD & WIN RESPINS */}
        {activeTab === 'holdspin' && (
          <div className="bonus-holdspin-stage">
            <div className="bonus-stats-ribbon">
              <div className="bonus-stat-pill">
                <span>RESPINS REMAINING</span>
                <div className="hw-respins-pips">
                  {[1, 2, 3].map((pip) => (
                    <span
                      key={pip}
                      className={`hw-respin-pip ${pip <= hwSpinsLeft ? 'pip-lit' : ''}`}
                    />
                  ))}
                  <strong>{hwSpinsLeft}</strong>
                </div>
              </div>
              <div className="bonus-stat-pill mult-pill">
                <span>LOCKED ORBS</span>
                <strong>{hwLockedCount} / 15</strong>
              </div>
              <div className="bonus-stat-pill">
                <span>HOLD &amp; WIN REWARD</span>
                <strong>+{hwTotalWin.toLocaleString()} COINS</strong>
              </div>
            </div>

            <div className="bonus-live-banner">
              <Coins size={16} />
              <span>{hwBanner}</span>
            </div>

            <div className="hw-grid-board">
              {hwCells.map((cell) => (
                <div
                  key={cell.id}
                  className={`hw-cell-tile ${cell.locked ? 'cell-locked' : 'cell-empty'} ${
                    cell.isNew ? 'cell-new-land' : ''
                  }`}
                >
                  <div className="hw-cell-bg-carving" />
                  {cell.locked && cell.coin ? (
                    <div className="hw-orb-content">
                      <img
                        src={cell.coin.icon}
                        alt=""
                        className="hw-orb-icon"
                        draggable={false}
                      />
                      <span className="hw-orb-badge" style={{ color: cell.coin.color || '#fde047' }}>
                        {cell.coin.label}
                      </span>
                      <div className="hw-orb-coins">
                        <PsdGoldNumber value={cell.coin.coins} height={18} gap={-2} />
                      </div>
                    </div>
                  ) : (
                    <div className="hw-empty-placeholder">
                      <span className="hw-empty-dot" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="hw-controls-panel">
              <button
                type="button"
                className="hw-respin-btn"
                onClick={handleHoldSpinRespin}
                disabled={hwIsSpinning || hwSpinsLeft <= 0 || hwCompleted}
              >
                <RotateCw size={18} className={hwIsSpinning ? 'spin-icon-anim' : ''} />
                <span>
                  {hwIsSpinning
                    ? 'ORBS CASCADING...'
                    : hwCompleted
                    ? 'ALL RESPINS FINISHED'
                    : `SPIN RESPIN (${hwSpinsLeft} LEFT · RESETS ON HIT)`}
                </span>
              </button>
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
                      <div className="vault-tile-burst-effect">
                        <div className="burst-shockwave-ring" />
                        <div className="burst-spark-glow" />
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
                      <div className="vault-prize-overlay">
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
              </div>

              <div className="wheel-controls-panel">
                <h3>{BONUS_CONFIG.wheelTitle}</h3>
                <p>{BONUS_CONFIG.wheelDescription}</p>

                <button
                  className="wheel-spin-cta-btn"
                  onClick={handleSpinWheel}
                  disabled={wheelSpinning || wheelSpinsLeft <= 0}
                >
                  <RotateCw size={18} className={wheelSpinning ? 'spin-icon-anim' : ''} />
                  <span>
                    {wheelSpinning
                      ? '3D FORTUNE WHEEL SPINNING...'
                      : wheelSpinsLeft > 0
                      ? `SPIN 3D FORTUNE WHEEL (${wheelSpinsLeft} LEFT)`
                      : 'ALL WHEEL SPINS COMPLETED'}
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
                <span>FLIGHT STATUS</span>
                <strong>
                  {raFlying
                    ? 'CHARIOT ASCENDING'
                    : raCrashed
                    ? 'STORM STRUCK'
                    : raCashedOut
                    ? 'BANKED SAFELY'
                    : 'READY AT LAUNCH'}
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

                return (
                  <div
                    key={idx}
                    className={`ra-gate-node ${isPassed ? 'gate-passed' : ''} ${
                      isCurrent ? 'gate-current' : ''
                    } ${isDead ? 'gate-dead' : ''}`}
                  >
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

            {/* Interactive Flight Controls */}
            <div className="ra-controls-panel">
              {!raFlying && !raCashedOut && !raCrashed ? (
                <button
                  type="button"
                  className="ra-launch-btn"
                  onClick={handleStartAscension}
                >
                  <Sun size={20} className="launch-sun-icon" />
                  <span>LAUNCH SUN CHARIOT (ASCEND 8 GATES)</span>
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
                    {raCashedOut
                      ? `CASHED OUT: +${raWinCoins.toLocaleString()} COINS`
                      : raCrashed
                      ? `STORM STRUCK (CONSOLATION: +${raWinCoins.toLocaleString()})`
                      : `CASH OUT NOW: +${currentCashOutCoins.toLocaleString()} COINS (×${activeRaMultiplier})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer: Total Bonus Payout & Collect Button */}
        <div className="bonus-modal-footer">
          <div className="bonus-total-summary">
            <span className="bonus-total-label">
              TOTAL BONUS FEATURE WINNINGS ({currencyMode === 'SC' ? 'SWEEPS COINS' : 'GOLD COINS'}):
            </span>
            <div className="bonus-total-digits">
              <PsdGoldNumber value={totalCombinedBonusWin} height={32} gap={-2} />
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
              >
                <Crown size={16} />
                <span>Doors Portal</span>
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
                COLLECT {totalCombinedBonusWin.toLocaleString()} {currencyMode === 'SC' ? 'SC' : 'COINS'}
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

        {/* Floating Flying Coin Prize Toasts */}
        {floatingPrizes.map((toast) => (
          <div
            key={toast.id}
            className={`bonus-flying-prize-toast ${toast.isJackpot ? 'jackpot-toast' : ''}`}
            style={{ left: toast.x, top: toast.y }}
          >
            {toast.text}
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
